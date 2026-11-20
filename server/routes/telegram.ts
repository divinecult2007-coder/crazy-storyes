import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db.ts';
import { telegramService, isTelegramInviteUrl, isNumericTelegramChatId, isUserVipActive } from '../telegram.ts';
import { type AuthRequest, authenticateToken, optionalAuth, requireAdmin } from '../auth.ts';
import type { Novel, User } from '../types.ts';

const router = Router();

// Helper to check if a user currently has active VIP membership
function userHasActiveVip(user: User): boolean {
  return isUserVipActive(user);
}

// ==========================================
// 1. TELEGRAM WEBHOOK ENDPOINT
// ==========================================
router.post('/webhook', async (req, res) => {
  // 1. Enforce Webhook Secret Authentication
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

  if (!configuredSecret) {
    console.warn('[Telegram Webhook] Rejected: TELEGRAM_WEBHOOK_SECRET is not configured on server');
    return res.status(403).json({
      ok: false,
      error: 'TELEGRAM_WEBHOOK_SECRET is not configured on server. Webhook requests rejected for security.'
    });
  }

  if (!secretHeader || secretHeader !== configuredSecret) {
    console.warn('[Telegram Webhook] Unauthorized request rejected: invalid or missing x-telegram-bot-api-secret-token');
    return res.status(403).json({ ok: false, error: 'Unauthorized webhook request' });
  }

  const update = req.body;
  if (!update || typeof update !== 'object') {
    return res.status(200).json({ ok: true });
  }

  // 2. Duplicate Update Protection
  const updateId = Number(update.update_id);
  if (updateId) {
    const alreadyProcessed = await db.isTelegramUpdateProcessed(updateId);
    if (alreadyProcessed) {
      console.log(`[Telegram Webhook] Skipping duplicate update_id: ${updateId}`);
      return res.status(200).json({ ok: true, duplicate: true });
    }
  }

  try {
    // ---------------------------------------------------------
    // A. CHAT JOIN REQUEST VERIFICATION (STRICT PRIVATE GATE)
    // ---------------------------------------------------------
    if (update.chat_join_request) {
      const joinReq = update.chat_join_request;
      const channelId = String(joinReq.chat?.id || '').trim();
      const chatTitle = joinReq.chat?.title || 'Crazy Storyes VIP Channel';
      const fromUser = joinReq.from;
      const tgUserId = Number(fromUser?.id);
      const userChatId = Number(joinReq.user_chat_id || tgUserId);
      const usedInviteLink = String(joinReq.invite_link?.invite_link || '').trim();
      const nowIso = new Date().toISOString();

      const allNovels = await db.getNovels();
      const matchedNovels = allNovels.filter(
        (n: Novel) => n.telegramIntegrationEnabled && String(n.telegramChannelId || '').trim() === channelId
      );
      const matchedNovel = matchedNovels[0];
      const appUser = tgUserId ? await db.getUserByTelegramId(tgUserId) : null;

      await db.addTelegramLog({
        id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: appUser?.id || 'unlinked',
        telegramUserId: tgUserId || undefined,
        channelId,
        novelId: matchedNovel?.id,
        action: 'join_requested',
        status: 'pending',
        details: `Join request received from @${fromUser?.username || tgUserId} for '${chatTitle}'${usedInviteLink ? ' via personal invite link' : ' (no invite link metadata)'}`,
        createdAt: nowIso,
      });

      const rejectJoin = async (
        reasonCode: string,
        dmMessage: string,
        targetAccessId?: string,
        accessStatus: 'rejected' | 'expired' = 'rejected',
        revokeUsedLink = false
      ) => {
        const declineRes = await telegramService.declineChatJoinRequest(channelId, tgUserId);

        if (revokeUsedLink && usedInviteLink) {
          await telegramService.revokeChatInviteLink(channelId, usedInviteLink).catch(() => {});
        }

        if (targetAccessId) {
          await db.updateTelegramAccess(targetAccessId, {
            status: accessStatus,
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }

        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: appUser?.id || 'unlinked',
          telegramUserId: tgUserId || undefined,
          channelId,
          novelId: matchedNovel?.id,
          action: 'join_rejected',
          status: declineRes.ok ? 'success' : 'failed',
          details: declineRes.ok
            ? `Rejected (${reasonCode}) — Telegram declineChatJoinRequest confirmed`
            : `Rejection (${reasonCode}) Telegram API failed: ${declineRes.description}`,
          createdAt: new Date().toISOString(),
        });

        if (userChatId && dmMessage) {
          await telegramService.sendMessage(userChatId, dmMessage).catch(() => {});
        }

        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true, decision: 'rejected', reason: reasonCode, apiOk: declineRes.ok });
      };

      // 1. Reject invalid user or bots
      if (!tgUserId || fromUser?.is_bot) {
        return rejectJoin('BOT_OR_INVALID_USER', '');
      }

      // 2. Reject unknown/unconfigured channels
      if (matchedNovels.length === 0) {
        return rejectJoin(
          'UNCONFIGURED_CHANNEL',
          `❌ यह Telegram ग्रुप अभी Crazy Storyes प्लेटफॉर्म से अधिकृत नहीं है।`
        );
      }

      // 3. Reject if Telegram account is not linked in Crazy Storyes app
      if (!appUser) {
        return rejectJoin(
          'TELEGRAM_NOT_LINKED',
          `❌ <b>पहुंच अस्वीकृत (Access Rejected)</b>\n\nआपका Telegram खाता Crazy Storyes ऐप से लिंक नहीं है। कृपया पहले वेबसाइट पर लॉगिन करें, अपना Telegram खाता लिंक करें, और ऐप से नया Private Invite Link प्राप्त करें।`
        );
      }

      // 4. Reject if App account is blocked
      if (appUser.isBlocked) {
        return rejectJoin(
          'USER_BLOCKED',
          `❌ आपका Crazy Storyes खाता एडमिन द्वारा अवरुद्ध (Blocked) किया गया है, इसलिए ग्रुप प्रवेश अस्वीकृत कर दिया गया है।`
        );
      }

      const requiresVip = matchedNovels.some((n) => n.telegramAccessType === 'premium' || n.isPremium);
      const userAccesses = await db.getUserTelegramAccesses(appUser.id);
      const matchedUserAccess = usedInviteLink
        ? userAccesses.find(
            (a) =>
              String(a.channelId).trim() === channelId &&
              Number(a.telegramUserId) === tgUserId &&
              (a.inviteLink || '').trim() === usedInviteLink
          )
        : undefined;

      // 5. Reject if Premium/VIP channel and membership is inactive or expired
      if (requiresVip && !userHasActiveVip(appUser)) {
        return rejectJoin(
          'VIP_INACTIVE_OR_EXPIRED',
          `❌ <b>VIP सदस्यता निष्क्रिय / समाप्त (Request Rejected)</b>\n\nनमस्ते ${appUser.name}, आपकी Crazy Storyes VIP सदस्यता सक्रिय नहीं है या समाप्त हो चुकी है।\nकृपया वेबसाइट पर जाकर VIP प्लान रिन्यू/सक्रिय करें — सत्यापन के बाद ही आपको प्रवेश की अनुमति मिलेगी।`,
          matchedUserAccess?.id,
          'expired',
          Boolean(usedInviteLink)
        );
      }

      // 6. Verify Invite Link presence and strict 1-user ownership (prevents link sharing!)
      if (!usedInviteLink) {
        return rejectJoin(
          'UNISSUED_OR_DIRECT_LINK',
          `❌ <b>प्रत्यक्ष प्रवेश अस्वीकृत</b>\n\nकृपया केवल Crazy Storyes ऐप में लॉगिन करके 'Listen on Telegram' से मिला अपना व्यक्तिगत Private Join-Request लिंक ही उपयोग करें।`
        );
      }

      if (!matchedUserAccess) {
        const stolenOrOtherAccess = await db.findTelegramAccessByInviteLink(usedInviteLink);
        if (stolenOrOtherAccess && (stolenOrOtherAccess.userId !== appUser.id || Number(stolenOrOtherAccess.telegramUserId) !== tgUserId)) {
          return rejectJoin(
            'SHARED_INVITE_LINK_FORBIDDEN',
            `❌ <b>साझा किया गया इनवाइट लिंक अमान्य (Shared Link Rejected)</b>\n\nयह इनवाइट लिंक किसी अन्य Crazy Storyes उपयोगकर्ता को जारी किया गया था। व्यक्तिगत लिंक साझा नहीं किए जा सकते — कृपया वेबसाइट पर अपने लॉगिन किए गए खाते से स्वयं नया लिंक जनरेट करें।`,
            undefined,
            'rejected',
            true
          );
        }

        return rejectJoin(
          'INVALID_OR_UNRECOGNIZED_INVITE_LINK',
          `❌ <b>अमान्य या समाप्त इनवाइट लिंक</b>\n\nकृपया Crazy Storyes वेबसाइट पर जाकर अपने खाते से एक नया Private Join-Request लिंक जनरेट करें।`,
          undefined,
          'rejected',
          true
        );
      }

      if (
        matchedUserAccess.status === 'revoked' ||
        matchedUserAccess.status === 'rejected' ||
        matchedUserAccess.status === 'expired'
      ) {
        return rejectJoin(
          'INVITE_REVOKED_OR_EXPIRED',
          `❌ यह इनवाइट लिंक रद्द या समाप्त हो चुका है। कृपया वेबसाइट पर जाकर दोबारा नया लिंक प्राप्त करें।`,
          matchedUserAccess.id,
          'rejected',
          true
        );
      }

      // Check link expiry time when still pending
      if (matchedUserAccess.status === 'pending' && matchedUserAccess.expiresAt) {
        const linkExp = new Date(matchedUserAccess.expiresAt).getTime();
        if (!Number.isNaN(linkExp) && linkExp < Date.now()) {
          return rejectJoin(
            'INVITE_LINK_TIMED_OUT',
            `⌛ आपका इनवाइट लिंक 10 मिनट की समय-सीमा के कारण समाप्त हो गया है। कृपया वेबसाइट से नया लिंक जनरेट करें।`,
            matchedUserAccess.id,
            'rejected',
            true
          );
        }
      }

      // 7. ALL VERIFICATIONS PASSED -> Approve via live Telegram Bot API
      const approveRes = await telegramService.approveChatJoinRequest(channelId, tgUserId);
      if (!approveRes.ok) {
        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: appUser.id,
          telegramUserId: tgUserId,
          channelId,
          novelId: matchedUserAccess.novelId,
          action: 'join_approval_failed',
          status: 'failed',
          details: `Telegram approveChatJoinRequest API failed: ${approveRes.description || 'Unknown error'}`,
          createdAt: new Date().toISOString(),
        });

        await telegramService.sendMessage(
          userChatId,
          `⚠️ आपकी सदस्यता सत्यापित हो गई है, लेकिन तकनीकी त्रुटि के कारण बॉट Telegram से प्रवेश स्वीकृत नहीं कर सका। कृपया कुछ क्षण बाद पुनः प्रयास करें या सहायता से संपर्क करें।`
        ).catch(() => {});

        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true, decision: 'approval_failed', error: approveRes.description });
      }

      // 8. Telegram API Confirmed Approval -> Activate access & revoke used link immediately
      const revokeRes = await telegramService.revokeChatInviteLink(channelId, usedInviteLink);
      await db.updateTelegramAccess(matchedUserAccess.id, {
        status: 'active',
        joinedAt: nowIso,
        expiresAt: requiresVip ? (appUser.membership?.expiresAt || undefined) : undefined,
      });

      await db.addTelegramLog({
        id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: appUser.id,
        telegramUserId: tgUserId,
        channelId,
        novelId: matchedUserAccess.novelId,
        action: 'join_approved',
        status: 'success',
        details: `Approved via Telegram API approveChatJoinRequest (${requiresVip ? 'Active VIP' : 'Private Free'})${revokeRes.ok ? '; personal invite link revoked' : ''}`,
        createdAt: new Date().toISOString(),
      });

      await telegramService.sendMessage(
        userChatId,
        `✅ <b>प्रवेश स्वीकृत! (Join Request Approved)</b>\n\n` +
        `🎉 स्वागत है <b>${appUser.name}</b>!\n` +
        `📚 <b>चैनल/ग्रुप:</b> ${chatTitle}\n` +
        `🔐 <b>सत्यापित खाता:</b> ${appUser.email}\n\n` +
        `अब आप चैनल में जाकर सभी ऑडियो एपिसोड्स सुन सकते हैं। सुरक्षा के लिए आपका एकल-उपयोग इनवाइट लिंक निष्क्रिय कर दिया गया है।`
      ).catch(() => {});

      if (updateId) await db.markTelegramUpdateProcessed(updateId);
      return res.status(200).json({ ok: true, decision: 'approved', userId: appUser.id });
    }

    // ---------------------------------------------------------
    // B. CHAT MEMBER GUARD (ANTI-BYPASS FOR DIRECT JOINS)
    // ---------------------------------------------------------
    if (update.chat_member) {
      const cm = update.chat_member;
      const channelId = String(cm.chat?.id || '').trim();
      const targetUser = cm.new_chat_member?.user;
      const tgUserId = Number(targetUser?.id);
      const newStatus = cm.new_chat_member?.status;
      const oldStatus = cm.old_chat_member?.status;

      const joinedNow =
        (newStatus === 'member' || newStatus === 'restricted') &&
        oldStatus !== 'member' &&
        oldStatus !== 'administrator' &&
        oldStatus !== 'creator';

      if (joinedNow && tgUserId && !targetUser?.is_bot && channelId) {
        const allNovels = await db.getNovels();
        const matchedNovels = allNovels.filter(
          (n: Novel) => n.telegramIntegrationEnabled && String(n.telegramChannelId || '').trim() === channelId
        );

        if (matchedNovels.length > 0) {
          const requiresVip = matchedNovels.some((n) => n.telegramAccessType === 'premium' || n.isPremium);
          const appUser = await db.getUserByTelegramId(tgUserId);
          const channelAccesses = appUser ? await db.getUserTelegramAccesses(appUser.id) : [];
          const hasAuthorizedActive = Boolean(
            appUser &&
              !appUser.isBlocked &&
              (!requiresVip || userHasActiveVip(appUser)) &&
              channelAccesses.some(
                (a) => String(a.channelId).trim() === channelId && Number(a.telegramUserId) === tgUserId && a.status === 'active'
              )
          );

          if (!hasAuthorizedActive) {
            const kickRes = await telegramService.removeUserFromChannel(channelId, tgUserId);
            await db.addTelegramLog({
              id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              userId: appUser?.id || 'unlinked',
              telegramUserId: tgUserId,
              channelId,
              novelId: matchedNovels[0].id,
              action: 'unauthorized_join_removed',
              status: kickRes.ok ? 'success' : 'failed',
              details: kickRes.ok
                ? `Unauthorized direct join into Private channel detected and removed via Telegram API`
                : `Unauthorized join removal failed: ${kickRes.description}`,
              createdAt: new Date().toISOString(),
            });

            if (!kickRes.ok) {
              await db.addTelegramPendingOp({
                id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                operationType: 'remove_member',
                userId: appUser?.id || 'unlinked',
                telegramUserId: tgUserId,
                channelId,
                novelId: matchedNovels[0].id,
                retryCount: 1,
                lastError: kickRes.description,
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }

            if (tgUserId) {
              await telegramService.sendMessage(
                tgUserId,
                `⚠️ <b>अनाधिकृत प्रवेश हटाया गया</b>\n\nसीधे Telegram से इस Private ग्रुप में प्रवेश की अनुमति नहीं है। कृपया पहले Crazy Storyes ऐप में लॉगिन करें, VIP सदस्यता सक्रिय रखें और आधिकारिक Join-Request लिंक से जुड़ें।`
              ).catch(() => {});
            }
          }
        }
      }

      if (updateId) await db.markTelegramUpdateProcessed(updateId);
      return res.status(200).json({ ok: true });
    }

    // ---------------------------------------------------------
    // C. BOT COMMAND MESSAGES (/start, /status, /unlink, /help)
    // ---------------------------------------------------------
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const text = (msg.text || '').trim();
      const from = msg.from;

      if (!chatId || !from) {
        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true });
      }

      // Handle /start command, optionally with linking code
      if (text.startsWith('/start')) {
        const parts = text.split(/\s+/);
        const code = parts[1]?.trim();

        if (code) {
          const linkRecord = await db.getTelegramLinkCode(code);
          if (!linkRecord) {
            await telegramService.sendMessage(
              chatId,
              `⚠️ <b>लिंकिंग कोड अमान्य है</b>\n\n` +
              `यह कोड सिस्टम में मौजूद नहीं है या पहले ही उपयोग किया जा चुका है।\n` +
              `कृपया Crazy Storyes वेबसाइट पर जाकर नया कोड जनरेट करें।`
            );
            if (updateId) await db.markTelegramUpdateProcessed(updateId);
            return res.status(200).json({ ok: true });
          }

          if (linkRecord.usedAt) {
            await telegramService.sendMessage(
              chatId,
              `⚠️ <b>कोड पहले ही उपयोग हो चुका है</b>\n\n` +
              `कृपया Crazy Storyes वेबसाइट पर नया लिंकिंग कोड जनरेट करें।`
            );
            if (updateId) await db.markTelegramUpdateProcessed(updateId);
            return res.status(200).json({ ok: true });
          }

          if (new Date(linkRecord.expiresAt).getTime() < Date.now()) {
            await telegramService.sendMessage(
              chatId,
              `⌛ <b>लिंकिंग कोड की समय-सीमा समाप्त हो गई है</b>\n\n` +
              `यह कोड 15 मिनट के लिए वैध था। कृपया वेबसाइट पर नया कोड जनरेट करें।`
            );
            if (updateId) await db.markTelegramUpdateProcessed(updateId);
            return res.status(200).json({ ok: true });
          }

          const targetUser = await db.getUserById(linkRecord.userId);
          if (!targetUser) {
            await telegramService.sendMessage(chatId, `⚠️ उपयोगकर्ता खाता नहीं मिला।`);
            if (updateId) await db.markTelegramUpdateProcessed(updateId);
            return res.status(200).json({ ok: true });
          }

          await db.linkUserTelegram(targetUser.id, {
            telegramUserId: from.id,
            telegramUsername: from.username,
            telegramFirstName: from.first_name,
          });

          await db.markTelegramLinkCodeUsed(linkRecord.id);
          console.log(`[Telegram Webhook] Account linked successfully: User ID ${targetUser.id} -> TG User ID ${from.id}`);

          const isVip = userHasActiveVip(targetUser);
          const vipStatusText = isVip
            ? `👑 <b>VIP स्टेटस:</b> एक्टिव (वैधता: ${targetUser.membership?.expiresAt ? new Date(targetUser.membership.expiresAt).toLocaleDateString('hi-IN') : 'सक्रिय'})`
            : `🆓 <b>सदस्यता:</b> सामान्य सदस्य`;

          await telegramService.sendMessage(
            chatId,
            `🎉 <b>बधाई हो! आपका Telegram खाता Crazy Storyes से सफलतापूर्वक लिंक व सत्यापित हो गया है!</b>\n\n` +
            `👤 <b>यूज़र:</b> ${targetUser.name}\n` +
            `📱 <b>Telegram ID:</b> ${from.id}\n` +
            `${vipStatusText}\n\n` +
            `🚀 अब आप वेबसाइट पर जाकर किसी भी उपन्यास के 'Listen on Telegram' बटन से अपना व्यक्तिगत Join-Request लिंक प्राप्त कर सकते हैं!\n\n` +
            `<i>क्रेज़ी स्टोरीज़ परिवार में आपका स्वागत है!</i>`
          );

          if (updateId) await db.markTelegramUpdateProcessed(updateId);
          return res.status(200).json({ ok: true });
        }

        const existingUser = await db.getUserByTelegramId(from.id);
        if (existingUser) {
          const isVip = userHasActiveVip(existingUser);
          const vipText = isVip ? '👑 VIP सक्रिय' : '🆓 सामान्य पाठक';
          await telegramService.sendMessage(
            chatId,
            `नमस्ते <b>${from.first_name || 'दोस्त'}</b>! 👋\n\n` +
            `आपका खाता पहले से Crazy Storyes से जुड़ा हुआ है:\n` +
            `📧 ईमेल: ${existingUser.email}\n` +
            `⭐ स्थिति: ${vipText}\n\n` +
            `ऑडियो उपन्यास सुनने के लिए वेबसाइट पर जाएँ और अपना व्यक्तिगत Private Join-Request लिंक जनरेट करें!`
          );
        } else {
          await telegramService.sendMessage(
            chatId,
            `👋 <b>नमस्ते! Crazy Storyes Manager Bot में आपका स्वागत है।</b>\n\n` +
            `यह बॉट केवल Crazy Storyes ऐप के अधिकृत और सत्यापित सदस्यों को ही Private ऑडियो चैनल्स व ग्रुप्स में प्रवेश देता है।\n\n` +
            `🔗 <b>खाता कैसे लिंक करें?</b>\n` +
            `1. Crazy Storyes वेबसाइट पर लॉगिन करें।\n` +
            `2. किसी भी उपन्यास पर 'Listen on Telegram' पर क्लिक करें।\n` +
            `3. दिए गए लिंकिंग लिंक पर टैप करें, आपका खाता तुरंत सत्यापित हो जाएगा!\n\n` +
            `मदद के लिए /help टाइप करें।`
          );
        }

        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true });
      }

      if (text === '/status') {
        const user = await db.getUserByTelegramId(from.id);
        if (!user) {
          await telegramService.sendMessage(
            chatId,
            `ℹ️ <b>आपका Telegram खाता अभी किसी Crazy Storyes खाते से लिंक नहीं है।</b>\n\n` +
            `कृपया वेबसाइट पर जाकर 'Connect Telegram' बटन पर क्लिक करें।`
          );
          if (updateId) await db.markTelegramUpdateProcessed(updateId);
          return res.status(200).json({ ok: true });
        }

        const isVip = userHasActiveVip(user);
        const expiryDate = user.membership?.expiresAt ? new Date(user.membership.expiresAt).toLocaleDateString('hi-IN') : 'N/A';

        await telegramService.sendMessage(
          chatId,
          `📊 <b>खाता स्थिति (Account Status):</b>\n\n` +
          `👤 <b>नाम:</b> ${user.name}\n` +
          `📧 <b>ईमेल:</b> ${user.email}\n` +
          `👑 <b>VIP सदस्यता:</b> ${isVip ? `सक्रिय (वैधता: ${expiryDate})` : 'निष्क्रिय / समाप्त'}\n` +
          `🔗 <b>लिंक्ड समय:</b> ${user.telegram?.linkedAt ? new Date(user.telegram.linkedAt).toLocaleDateString('hi-IN') : 'हाल ही में'}\n\n` +
          `${isVip ? '✅ आप सभी VIP Private चैनल्स के लिए व्यक्तिगत Join-Request लिंक प्राप्त करने के पात्र हैं।' : 'ℹ️ VIP चैनल्स जॉइन करने के लिए वेबसाइट पर जाकर प्लान सक्रिय या रिन्यू करें।'}`
        );
        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true });
      }

      if (text === '/unlink') {
        const user = await db.getUserByTelegramId(from.id);
        if (!user) {
          await telegramService.sendMessage(chatId, `कोई लिंक्ड खाता नहीं मिला।`);
          if (updateId) await db.markTelegramUpdateProcessed(updateId);
          return res.status(200).json({ ok: true });
        }

        // Security: revoke Private VIP/channel access before unlinking account
        await telegramService.revokeUserVipAccess(user.id, 'User unlinked Telegram via /unlink command', true);
        await db.unlinkUserTelegram(user.id);
        await telegramService.sendMessage(
          chatId,
          `✅ आपका Telegram खाता Crazy Storyes वेबसाइट से अनलिंक कर दिया गया है और संबंधित Private ग्रुप एक्सेस हटा दिए गए हैं।`
        );
        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true });
      }

      if (text === '/help') {
        await telegramService.sendMessage(
          chatId,
          `📖 <b>Crazy Storyes Bot कमांड सूची:</b>\n\n` +
          `/status - अपनी सदस्यता व खाते की स्थिति देखें\n` +
          `/unlink - Telegram खाते को अनलिंक करें\n` +
          `/help - सहायता जानकारी प्राप्त करें\n\n` +
          `🌐 वेबसाइट: Crazy Storyes Novel Platform`
        );
        if (updateId) await db.markTelegramUpdateProcessed(updateId);
        return res.status(200).json({ ok: true });
      }
    }

    if (updateId) await db.markTelegramUpdateProcessed(updateId);
    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  } catch (err: any) {
    console.error('Error handling Telegram webhook:', err);
    if (!res.headersSent) {
      return res.status(500).json({ ok: false, error: 'Webhook processing failed' });
    }
  }
});

// ==========================================
// 2. USER ENDPOINTS
// ==========================================

/**
 * Generate a single-use 15-minute linking code for the logged-in user
 */
router.post('/link-code', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const code = 'CS' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    await db.createTelegramLinkCode({
      id: `tlc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code,
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const botUsername = telegramService.botUsername;
    const deepLink = `https://t.me/${botUsername}?start=${code}`;

    res.json({
      ok: true,
      code,
      botUsername,
      deepLink,
      expiresAt,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Check linking status of current user
 */
router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const isVip = userHasActiveVip(user);
    const accesses = await db.getUserTelegramAccesses(user.id);

    res.json({
      ok: true,
      linked: Boolean(user.telegram?.telegramUserId),
      telegram: user.telegram || null,
      isVip,
      vipExpiresAt: user.membership?.expiresAt || null,
      accesses,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Unlink telegram account safely (revokes active private accesses)
 */
router.post('/unlink', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    await telegramService.revokeUserVipAccess(user.id, 'User unlinked Telegram account from app', true);
    await db.unlinkUserTelegram(user.id);
    res.json({ ok: true, message: 'Telegram खाता सफलतापूर्वक अनलिंक कर दिया गया' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Access a novel's Telegram channel:
 * - Premium/VIP novels MUST be Private numeric Chat IDs with creates_join_request: true + Bot Approval (Public access FORBIDDEN)
 * - Free public novels may still use Public Channel links when explicitly configured as free & public
 */
router.post('/novels/:novelId/join', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { novelId } = req.params;

    if (user.isBlocked) {
      return res.status(403).json({
        ok: false,
        error: 'आपका खाता अवरुद्ध (Blocked) है।',
        code: 'USER_BLOCKED',
      });
    }

    const novel = await db.getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ ok: false, error: 'उपन्यास नहीं मिला' });
    }

    if (!novel.isPublished && user.role !== 'admin') {
      return res.status(404).json({ ok: false, error: 'यह उपन्यास अभी प्रकाशित नहीं हुआ है' });
    }

    if (!novel.telegramIntegrationEnabled || (!novel.telegramChannelLink && !novel.telegramChannelId)) {
      return res.status(400).json({
        ok: false,
        error: 'Telegram Group Not Configured (इस उपन्यास के लिए Telegram ग्रुप अभी कॉन्फ़िगर नहीं है)',
        code: 'TELEGRAM_GROUP_NOT_CONFIGURED',
      });
    }

    const isChannelVip = novel.telegramAccessType === 'premium' || novel.isPremium;
    const isVip = userHasActiveVip(user);

    // 1. Check VIP requirement
    if (isChannelVip && !isVip) {
      return res.status(403).json({
        ok: false,
        error: 'यह एक VIP ऑडियो उपन्यास चैनल है। जॉइन करने के लिए सक्रिय VIP सदस्यता आवश्यक है।',
        code: 'VIP_REQUIRED',
      });
    }

    // 2. STRICT SECURITY POLICY: Premium Channels MUST NEVER use Public access or open URLs
    const configuredAsPublic = novel.telegramChannelPrivacy === 'public' || (!novel.telegramChannelId && Boolean(novel.telegramChannelLink));
    if (isChannelVip && configuredAsPublic) {
      return res.status(403).json({
        ok: false,
        error: 'सुरक्षा नीति: सभी Premium Telegram ग्रुप्स/चैनल्स Private होना अनिवार्य हैं। Public Link या खुला एक्सेस अनुमति नहीं है। कृपया एडमिन सेटिंग्स में संख्यात्मक Private Chat ID दर्ज करें।',
        code: 'PUBLIC_CHANNEL_FORBIDDEN',
      });
    }

    // 3. CASE A: PUBLIC FREE CHANNEL (allowed ONLY when non-VIP free novel)
    if (!isChannelVip && configuredAsPublic && novel.telegramChannelLink) {
      let publicLink = novel.telegramChannelLink.trim();
      if (!publicLink.startsWith('http://') && !publicLink.startsWith('https://')) {
        publicLink = publicLink.startsWith('@') ? `https://t.me/${publicLink.slice(1)}` : `https://t.me/${publicLink}`;
      }

      await db.addTelegramLog({
        id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.id,
        telegramUserId: user.telegram?.telegramUserId,
        channelId: novel.telegramChannelLink,
        novelId: novel.id,
        action: 'link_generated',
        status: 'success',
        details: `Public free channel accessed: ${publicLink}`,
        createdAt: new Date().toISOString(),
      });

      return res.json({
        ok: true,
        channelType: 'public',
        requiresApproval: false,
        channelLink: publicLink,
        channelName: novel.telegramChannelName || novel.title,
        accessType: 'free',
      });
    }

    // 4. CASE B: STRICT PRIVATE CHANNEL / GROUP (JOIN REQUEST + BOT APPROVAL)
    if (!novel.telegramChannelId) {
      return res.status(400).json({
        ok: false,
        error: 'Telegram Group Not Configured (इस उपन्यास के लिए Private संख्यात्मक Chat ID कॉन्फ़िगर नहीं है)',
        code: 'TELEGRAM_GROUP_NOT_CONFIGURED',
      });
    }

    if (isTelegramInviteUrl(novel.telegramChannelId) || !isNumericTelegramChatId(novel.telegramChannelId)) {
      return res.status(400).json({
        ok: false,
        error: 'अमान्य कॉन्फ़िगरेशन: इनवाइट लिंक (URL) या @username को Private Chat ID के रूप में उपयोग नहीं किया जा सकता। कृपया संख्यात्मक ID (-100...) दर्ज करें।',
        code: 'INVALID_CHAT_ID',
      });
    }

    // User must link & verify their Telegram account with the bot first
    if (!user.telegram?.telegramUserId) {
      return res.status(400).json({
        ok: false,
        error: 'प्राइवेट चैनल जॉइन करने से पहले कृपया अपना Telegram खाता लिंक और सत्यापित करें',
        code: 'TELEGRAM_NOT_LINKED',
      });
    }

    // Verify with live Telegram Chat info that Premium channel has NO public @username
    if (isChannelVip && telegramService.isConfigured()) {
      const chatInfo = await telegramService.getChat(novel.telegramChannelId);
      if (chatInfo.ok && chatInfo.result?.username) {
        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: user.id,
          telegramUserId: user.telegram.telegramUserId,
          channelId: novel.telegramChannelId,
          novelId: novel.id,
          action: 'join_rejected',
          status: 'failed',
          details: `Blocked invite generation: Premium Telegram chat has public @username (@${chatInfo.result.username})`,
          createdAt: new Date().toISOString(),
        });

        return res.status(403).json({
          ok: false,
          error: `सुरक्षा उल्लंघन: इस Premium Telegram ग्रुप/चैनल में Public Username (@${chatInfo.result.username}) सक्रिय है। एडमिन को पहले Telegram में जाकर ग्रुप को Private (बिना @username के) करना होगा।`,
          code: 'PUBLIC_CHANNEL_FORBIDDEN',
        });
      }
    }

    // Revoke any previously issued unused/pending personal invite link for this user + novel
    const existingAccess = await db.getTelegramAccess(user.id, novel.id);
    if (existingAccess?.inviteLink && isTelegramInviteUrl(existingAccess.inviteLink)) {
      await telegramService.revokeChatInviteLink(novel.telegramChannelId, existingAccess.inviteLink).catch(() => {});
    }

    // Generate personal 10-minute Private Join-Request Invite Link (`creates_join_request: true`)
    const inviteRes = await telegramService.createJoinRequestInviteLink(
      novel.telegramChannelId,
      `VIP-${user.telegram.telegramUserId}`,
      10
    );

    if (!inviteRes.ok || !inviteRes.inviteLink) {
      return res.status(500).json({
        ok: false,
        error: inviteRes.description || 'Failed to generate Telegram Join-Request invite link. Check bot admin permissions.',
        code: 'BOT_ERROR',
      });
    }

    const accessType: 'free' | 'premium' = isChannelVip ? 'premium' : 'free';
    const nowIso = new Date().toISOString();

    // Record as 'pending' until Telegram chat_join_request arrives and approveChatJoinRequest succeeds!
    await db.saveTelegramAccess({
      id: `tacc_${user.id}_${novel.id}`,
      userId: user.id,
      telegramUserId: user.telegram.telegramUserId,
      novelId: novel.id,
      novelTitle: novel.title,
      channelId: novel.telegramChannelId,
      channelName: novel.telegramChannelName || novel.title,
      accessType,
      inviteLink: inviteRes.inviteLink,
      status: 'pending',
      joinedAt: nowIso,
      expiresAt: inviteRes.expireDate ? new Date(inviteRes.expireDate).toISOString() : undefined,
      createdAt: existingAccess?.createdAt || nowIso,
      updatedAt: nowIso,
    });

    await db.addTelegramLog({
      id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: user.id,
      telegramUserId: user.telegram.telegramUserId,
      channelId: novel.telegramChannelId,
      novelId: novel.id,
      action: 'link_generated',
      status: 'success',
      details: `Personal Private Join-Request invite link (10m expiry, approval required) issued for ${accessType} channel`,
      createdAt: nowIso,
    });

    return res.json({
      ok: true,
      channelType: 'private',
      requiresApproval: true,
      inviteLink: inviteRes.inviteLink,
      expiresAt: inviteRes.expireDate,
      channelName: novel.telegramChannelName || novel.title,
      accessType,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Access a chapter's dedicated Telegram Audio link
 * - Free chapters: accessible to any user or guest
 * - VIP/Premium chapters: requires active VIP membership & must not point to an open channel invite for non-VIP
 */
const handleChapterAudioAccess = async (req: AuthRequest, res: any) => {
  try {
    const { chapterId } = req.params;
    const chapter = await db.getChapterById(chapterId);
    if (!chapter) {
      return res.status(404).json({ ok: false, error: 'अध्याय नहीं मिला (Chapter not found)' });
    }

    if (!chapter.isPublished && req.user?.role !== 'admin') {
      return res.status(404).json({ ok: false, error: 'अध्याय अभी प्रकाशित नहीं हुआ है' });
    }

    const rawLink = chapter.telegramMessageLink?.trim();
    if (!rawLink) {
      return res.status(404).json({
        ok: false,
        code: 'AUDIO_NOT_CONFIGURED',
        error: 'Telegram Audio Not Configured (इस अध्याय के लिए Telegram ऑडियो लिंक अभी सेट नहीं किया गया है)'
      });
    }

    const isPremiumChapter = Boolean(chapter.isPremium || chapter.telegramAudioAccessType === 'premium');

    if (isPremiumChapter) {
      if (!req.user) {
        return res.status(401).json({
          ok: false,
          code: 'LOGIN_REQUIRED',
          error: 'यह एक VIP अध्याय है। Telegram ऑडियो सुनने के लिए कृपया पहले लॉगिन करें।'
        });
      }

      const freshUser = (await db.getUserById(req.user.id)) || req.user;
      const isVip = userHasActiveVip(freshUser);

      if (!isVip) {
        return res.status(403).json({
          ok: false,
          code: 'VIP_REQUIRED',
          error: 'इस VIP अध्याय का Telegram ऑडियो सुनने के लिए सक्रिय VIP सदस्यता आवश्यक है।'
        });
      }
    }

    let telegramLink = rawLink;
    if (!telegramLink.startsWith('http://') && !telegramLink.startsWith('https://')) {
      if (telegramLink.startsWith('t.me/')) {
        telegramLink = `https://${telegramLink}`;
      } else if (telegramLink.startsWith('@')) {
        telegramLink = `https://t.me/${telegramLink.slice(1)}`;
      } else {
        telegramLink = `https://t.me/${telegramLink}`;
      }
    }

    await db.addTelegramLog({
      id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user?.id || 'guest',
      telegramUserId: req.user?.telegram?.telegramUserId,
      channelId: chapter.telegramChatId || chapter.novelId,
      novelId: chapter.novelId,
      action: 'chapter_audio_accessed',
      status: 'success',
      details: `Chapter ${chapter.chapterNumber} Telegram audio opened: ${chapter.title} (${isPremiumChapter ? 'VIP' : 'FREE'})`,
      createdAt: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      telegramMessageLink: telegramLink,
      telegramMessageId: chapter.telegramMessageId,
      telegramChatId: chapter.telegramChatId,
      telegramDestinationType: chapter.telegramDestinationType || 'channel',
      telegramAudioAccessType: isPremiumChapter ? 'premium' : 'free',
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      novelId: chapter.novelId
    });
  } catch (err: any) {
    console.error('Chapter audio access error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'Telegram ऑडियो लिंक प्राप्त करने में त्रुटि' });
  }
};

router.post('/chapters/:chapterId/audio', optionalAuth, handleChapterAudioAccess);
router.get('/chapters/:chapterId/audio', optionalAuth, handleChapterAudioAccess);

// ==========================================
// 3. ADMIN ENDPOINTS
// ==========================================

router.get('/admin/bot-status', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const isConfigured = telegramService.isConfigured();
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
    const secretConfigured = Boolean(webhookSecret && webhookSecret.length >= 8);

    if (!isConfigured) {
      return res.json({
        ok: true,
        configured: false,
        botUsername: telegramService.botUsername,
        message: 'TELEGRAM_BOT_TOKEN environment variable is not configured',
        secretConfigured,
        webhookSecretWarning: secretConfigured
          ? null
          : 'TELEGRAM_WEBHOOK_SECRET पर्यावरण चर (env var) सेट नहीं है। सुरक्षा के लिए वेबहुक अनुरोध अस्वीकार (403) किए जाएंगे।',
        deduplicationActive: true,
      });
    }

    const [meRes, webhookRes] = await Promise.all([
      telegramService.getMe(),
      telegramService.getWebhookInfo(),
    ]);

    res.json({
      ok: true,
      configured: true,
      bot: meRes.result || null,
      botError: meRes.ok ? null : meRes.description,
      webhook: webhookRes.result || null,
      webhookError: webhookRes.ok ? null : webhookRes.description,
      envUsername: telegramService.botUsername,
      secretConfigured,
      webhookSecretWarning: secretConfigured
        ? null
        : 'TELEGRAM_WEBHOOK_SECRET पर्यावरण चर (env var) सेट नहीं है। सुरक्षा के लिए वेबहुक अनुरोध 403 के साथ अस्वीकार किए जा रहे हैं। कृपया Secrets में गुप्त कुंजी सेट करें।',
      deduplicationActive: true,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/set-webhook', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { url, secret } = req.body;
    if (!url) {
      return res.status(400).json({ ok: false, error: 'Webhook URL is required' });
    }

    const setRes = await telegramService.setWebhook(url, secret);
    if (!setRes.ok) {
      return res.status(400).json({ ok: false, error: setRes.description });
    }

    res.json({ ok: true, message: 'Webhook set successfully with chat_join_request support', result: setRes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/check-channel', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { channelId } = req.body;
    if (!channelId) {
      return res.status(400).json({ ok: false, error: 'channelId is required' });
    }

    const status = await telegramService.checkBotAdminStatus(channelId);
    res.json({ ok: true, status });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/unlink/:userId', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const user = await db.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ ok: false, error: 'उपयोगकर्ता नहीं मिला' });
    }

    const revokeResult = await telegramService.revokeUserVipAccess(user.id, 'Admin unlinked user Telegram account', true);
    await db.unlinkUserTelegram(user.id);

    res.json({
      ok: true,
      message: 'उपयोगकर्ता का Telegram खाता अनलिंक कर दिया गया और सक्रिय चैनल एक्सेस हटा दिए गए',
      revokeResult,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/admin/overview', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [allNovels, allUsers, allAccesses, logs, pendingOps] = await Promise.all([
      db.getNovels(),
      db.getUsers(),
      db.getAllTelegramAccesses(),
      db.getTelegramLogs(100),
      db.getPendingTelegramOps(),
    ]);

    const channels = allNovels
      .filter((n: Novel) => n.telegramChannelId || n.telegramChannelLink || n.telegramIntegrationEnabled)
      .map((n: Novel) => ({
        novelId: n.id,
        novelTitle: n.title,
        channelPrivacy: (n.telegramAccessType === 'premium' || n.isPremium)
          ? 'private'
          : (n.telegramChannelPrivacy || (n.telegramChannelLink && !n.telegramChannelId ? 'public' : 'private')),
        channelLink: (n.telegramAccessType === 'premium' || n.isPremium) ? '' : (n.telegramChannelLink || ''),
        channelId: n.telegramChannelId || '',
        channelName: n.telegramChannelName || '',
        channelType: n.telegramChannelType || 'channel',
        accessType: n.telegramAccessType || (n.isPremium ? 'premium' : 'free'),
        enabled: Boolean(n.telegramIntegrationEnabled),
      }));

    const linkedUsers = allUsers
      .filter((u: User) => u.telegram?.telegramUserId)
      .map((u: User) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isVip: userHasActiveVip(u),
        vipExpiresAt: u.membership?.expiresAt,
        telegram: u.telegram,
      }));

    const userMap = new Map(allUsers.map((u: User) => [u.id, u]));
    const enrichedLogs = logs.map((l) => ({
      ...l,
      userEmail: userMap.get(l.userId)?.email,
    }));

    res.json({
      ok: true,
      channels,
      linkedUsers,
      accesses: allAccesses,
      recentLogs: enrichedLogs,
      pendingOps,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/process-expiries', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await telegramService.processMembershipExpiries();
    res.json({ ok: true, result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/retry-pending/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const result = await telegramService.retryPendingOp(req.params.id);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.message });
    }
    res.json({ ok: true, message: result.message });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/retry-all-pending', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const summary = await telegramService.retryAllPendingOps();
    res.json({ ok: true, summary });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

