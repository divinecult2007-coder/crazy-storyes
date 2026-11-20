import { db } from './db.ts';
import type { TelegramAccessRecord, Novel, User } from './types.ts';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramInviteLinkResult {
  invite_link: string;
  creator?: any;
  creates_join_request?: boolean;
  is_primary?: boolean;
  is_revoked?: boolean;
  name?: string;
  expire_date?: number;
  member_limit?: number;
  pending_join_request_count?: number;
}

export function isTelegramInviteUrl(val: string | number | undefined | null): boolean {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('t.me/') ||
    s.includes('t.me/+') ||
    s.includes('/+') ||
    s.includes('joinchat')
  );
}

export function isNumericTelegramChatId(val: string | number | undefined | null): boolean {
  if (val === undefined || val === null) return false;
  return /^-?\d+$/.test(String(val).trim());
}

export function isUserVipActive(user: User): boolean {
  if (user.isBlocked) return false;
  if (user.role === 'admin') return true;
  if (!user.membership?.isActive) return false;
  if (!user.membership.expiresAt) return true;
  return new Date(user.membership.expiresAt).getTime() > Date.now();
}

export class TelegramService {
  private cachedBotUsername?: string;

  private get token(): string | undefined {
    return process.env.TELEGRAM_BOT_TOKEN?.trim();
  }

  public get botUsername(): string {
    if (this.cachedBotUsername) {
      return this.cachedBotUsername.replace(/^@/, '');
    }
    const raw = process.env.TELEGRAM_BOT_USERNAME?.trim() || '';
    if (raw && !raw.includes(':') && !/^\d+$/.test(raw)) {
      return raw.replace(/^@/, '');
    }
    return 'CrazyStoryesManagerBot';
  }

  public get webhookSecret(): string {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 10);
  }

  private async callApi<T = any>(
    method: string,
    params: Record<string, any> = {}
  ): Promise<{ ok: boolean; result?: T; description?: string; error_code?: number }> {
    if (!this.token) {
      return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not configured on the server' };
    }

    try {
      const url = `${TELEGRAM_API_BASE}/bot${this.token}/${method}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(8000),
      });

      const data = await response.json();
      return data;
    } catch (err: any) {
      return { ok: false, description: err?.message || 'Network error calling Telegram Bot API' };
    }
  }

  public async getMe(): Promise<{ ok: boolean; result?: TelegramBotInfo; description?: string }> {
    const res = await this.callApi<TelegramBotInfo>('getMe');
    if (res.ok && res.result?.username) {
      this.cachedBotUsername = res.result.username;
    }
    return res;
  }

  public async getWebhookInfo(): Promise<{ ok: boolean; result?: any; description?: string }> {
    return this.callApi('getWebhookInfo');
  }

  public async setWebhook(url: string, secretToken?: string): Promise<{ ok: boolean; description?: string }> {
    const resolvedSecret = (secretToken || this.webhookSecret).trim();
    if (!resolvedSecret) {
      return {
        ok: false,
        description: 'TELEGRAM_WEBHOOK_SECRET सेट नहीं है। सुरक्षित webhook के लिए secret_token आवश्यक है।',
      };
    }

    return this.callApi('setWebhook', {
      url,
      secret_token: resolvedSecret,
      allowed_updates: ['message', 'chat_join_request', 'chat_member', 'my_chat_member'],
    });
  }

  public async getChat(chatId: string | number): Promise<{ ok: boolean; result?: any; description?: string }> {
    if (isTelegramInviteUrl(chatId) || !isNumericTelegramChatId(chatId)) {
      return {
        ok: false,
        description: 'इनवाइट लिंक (URL) या @username को Private Chat ID के रूप में उपयोग नहीं किया जा सकता। कृपया संख्यात्मक Chat ID (-100...) दर्ज करें।',
      };
    }
    return this.callApi('getChat', { chat_id: chatId });
  }

  public async getChatAdministrators(chatId: string | number): Promise<{ ok: boolean; result?: any[]; description?: string }> {
    if (isTelegramInviteUrl(chatId) || !isNumericTelegramChatId(chatId)) {
      return {
        ok: false,
        description: 'इनवाइट लिंक (URL) या @username को Private Chat ID के रूप में उपयोग नहीं किया जा सकता। कृपया संख्यात्मक Chat ID (-100...) दर्ज करें।',
      };
    }
    return this.callApi('getChatAdministrators', { chat_id: chatId });
  }

  public async getChatMember(chatId: string | number, userId: number): Promise<{ ok: boolean; result?: any; description?: string; error_code?: number }> {
    return this.callApi('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  public async checkBotAdminStatus(chatId: string | number): Promise<{
    isAdmin: boolean;
    canInviteUsers: boolean;
    canRestrictMembers: boolean;
    hasRequiredPermissions: boolean;
    isPublicChat: boolean;
    publicUsername?: string;
    title?: string;
    warning?: string;
    error?: string;
  }> {
    if (!chatId) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canRestrictMembers: false,
        hasRequiredPermissions: false,
        isPublicChat: false,
        error: 'Telegram Chat ID दर्ज नहीं की गई है',
      };
    }

    if (isTelegramInviteUrl(chatId) || !isNumericTelegramChatId(chatId)) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canRestrictMembers: false,
        hasRequiredPermissions: false,
        isPublicChat: false,
        error: '⚠️ केवल संख्यात्मक Private Chat ID (उदा. -100xxxxxxxxxx) मान्य है। URL या @username की अनुमति नहीं है।',
      };
    }

    const chatRes = await this.getChat(chatId);
    if (!chatRes.ok) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canRestrictMembers: false,
        hasRequiredPermissions: false,
        isPublicChat: false,
        error: chatRes.description || 'ग्रुप/चैनल नहीं मिला या बॉट अभी इसमें नहीं जुड़ा है। सुनिश्चित करें कि बॉट को इस ग्रुप में जोड़कर एडमिन बनाया गया है।',
      };
    }

    const title = chatRes.result?.title || 'Telegram Group / Channel';
    const publicUsername = chatRes.result?.username || undefined;
    const isPublicChat = Boolean(publicUsername);

    const adminsRes = await this.getChatAdministrators(chatId);
    if (!adminsRes.ok) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canRestrictMembers: false,
        hasRequiredPermissions: false,
        isPublicChat,
        publicUsername,
        title,
        error: adminsRes.description || 'बॉट एडमिनिस्ट्रेटर सूची नहीं देख सका। सुनिश्चित करें कि बॉट एडमिन है।',
      };
    }

    const meRes = await this.getMe();
    const botId = meRes.result?.id;

    const botAdmin = (adminsRes.result || []).find((admin: any) => admin.user?.id === botId);
    if (!botAdmin) {
      return {
        isAdmin: false,
        canInviteUsers: false,
        canRestrictMembers: false,
        hasRequiredPermissions: false,
        isPublicChat,
        publicUsername,
        title,
        error: `बॉट (@${this.botUsername}) इस ग्रुप में एडमिन के रूप में नहीं जोड़ा गया है। कृपया ग्रुप सेटिंग में जाकर बॉट को एडमिन बनाएं।`,
      };
    }

    const canInviteUsers = Boolean(botAdmin.can_invite_users || botAdmin.status === 'creator');
    const canRestrictMembers = Boolean(botAdmin.can_restrict_members || botAdmin.status === 'creator');
    const hasRequiredPermissions = canInviteUsers && canRestrictMembers;

    const missingPerms: string[] = [];
    if (!canInviteUsers) missingPerms.push('Invite Users via Link / Approve Join Requests');
    if (!canRestrictMembers) missingPerms.push('Ban / Remove Users');

    const warning = isPublicChat
      ? `⚠️ सुरक्षा चेतावनी: इस ग्रुप/चैनल में Public Username (@${publicUsername}) सेट है! सभी Premium ग्रुप्स/चैनल्स को Telegram में Private बनाना अनिवार्य है और Public Username हटाना जरूरी है।`
      : undefined;

    return {
      isAdmin: true,
      canInviteUsers,
      canRestrictMembers,
      hasRequiredPermissions,
      isPublicChat,
      publicUsername,
      title,
      warning,
      error: !hasRequiredPermissions
        ? `बॉट एडमिन है लेकिन आवश्यक अनुमतियाँ कम हैं: ${missingPerms.join(', ')}`
        : warning,
    };
  }

  /**
   * Generates a strict Private Join-Request Invite Link (`creates_join_request: true`).
   * Note: Telegram Bot API forbids `member_limit` when `creates_join_request: true`.
   * Approval happens ONLY in webhook upon `chat_join_request` verification, and the link is immediately revoked after use.
   */
  public async createJoinRequestInviteLink(
    chatId: string | number,
    name = 'CrazyStoryes VIP',
    expireMinutes = 10
  ): Promise<{ ok: boolean; inviteLink?: string; description?: string; errorCode?: number; expireDate?: number }> {
    if (isTelegramInviteUrl(chatId) || !isNumericTelegramChatId(chatId)) {
      return {
        ok: false,
        description: 'Cannot use Invite URL or @username as Private Telegram Chat ID. Provide numeric Chat ID (-100...).',
      };
    }

    const expireDate = Math.floor(Date.now() / 1000) + expireMinutes * 60;
    const sanitizedName = String(name || 'CrazyStoryes').trim().slice(0, 32);

    const res = await this.callApi<TelegramInviteLinkResult>('createChatInviteLink', {
      chat_id: chatId,
      name: sanitizedName,
      expire_date: expireDate,
      creates_join_request: true,
    });

    if (!res.ok || !res.result?.invite_link) {
      return {
        ok: false,
        errorCode: res.error_code,
        description: res.description || 'Failed to create Join-Request Private Invite Link',
      };
    }

    return {
      ok: true,
      inviteLink: res.result.invite_link,
      expireDate: expireDate * 1000,
    };
  }

  public async createSingleUseInviteLink(
    chatId: string | number,
    name = 'CrazyStoryes VIP',
    expireMinutes = 10
  ): Promise<{ ok: boolean; inviteLink?: string; description?: string; errorCode?: number; expireDate?: number }> {
    return this.createJoinRequestInviteLink(chatId, name, expireMinutes);
  }

  public async approveChatJoinRequest(
    chatId: string | number,
    userId: number
  ): Promise<{ ok: boolean; description?: string; errorCode?: number }> {
    const res = await this.callApi('approveChatJoinRequest', {
      chat_id: chatId,
      user_id: userId,
    });
    return {
      ok: Boolean(res.ok),
      description: res.description,
      errorCode: res.error_code,
    };
  }

  public async declineChatJoinRequest(
    chatId: string | number,
    userId: number
  ): Promise<{ ok: boolean; description?: string; errorCode?: number }> {
    const res = await this.callApi('declineChatJoinRequest', {
      chat_id: chatId,
      user_id: userId,
    });
    return {
      ok: Boolean(res.ok),
      description: res.description,
      errorCode: res.error_code,
    };
  }

  public async revokeChatInviteLink(
    chatId: string | number,
    inviteLink: string
  ): Promise<{ ok: boolean; description?: string }> {
    if (!chatId || !inviteLink) {
      return { ok: false, description: 'Missing chatId or inviteLink for revocation' };
    }
    const res = await this.callApi('revokeChatInviteLink', {
      chat_id: chatId,
      invite_link: inviteLink,
    });
    return {
      ok: Boolean(res.ok),
      description: res.description,
    };
  }

  public async removeUserFromChannel(
    chatId: string | number,
    userId: number
  ): Promise<{ ok: boolean; unbanned?: boolean; errorCode?: number; description?: string }> {
    // Briefly ban member to kick them out of the Private group/channel
    const banRes = await this.callApi('banChatMember', {
      chat_id: chatId,
      user_id: userId,
      until_date: Math.floor(Date.now() / 1000) + 60, // 60 seconds
    });

    if (!banRes.ok) {
      return {
        ok: false,
        errorCode: banRes.error_code,
        description: banRes.description || 'Failed to ban/kick member from channel',
      };
    }

    // Immediately unban so user can rejoin after VIP renewal & fresh verification
    const unbanRes = await this.callApi('unbanChatMember', {
      chat_id: chatId,
      user_id: userId,
      only_if_banned: true,
    });

    return { ok: true, unbanned: Boolean(unbanRes.ok) };
  }

  public async sendMessage(
    chatId: string | number,
    text: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML',
    replyMarkup?: any
  ): Promise<{ ok: boolean; description?: string }> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      reply_markup: replyMarkup,
      disable_web_page_preview: false,
    });
  }

  private async enqueueRemovalRetry(
    userId: string,
    telegramUserId: number,
    channelId: string,
    novelId: string,
    errorMsg?: string
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const existingPending = await db.getPendingTelegramOps();
    const alreadyQueued = existingPending.some(
      (p) =>
        p.status === 'pending' &&
        p.operationType === 'remove_member' &&
        p.channelId === channelId &&
        p.telegramUserId === telegramUserId
    );

    if (!alreadyQueued) {
      await db.addTelegramPendingOp({
        id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        operationType: 'remove_member',
        userId,
        telegramUserId,
        channelId,
        novelId,
        retryCount: 1,
        lastError: errorMsg,
        status: 'pending',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  /**
   * Revokes links and removes a specific user from VIP (or all private) Telegram groups/channels.
   * Only marks access status as 'expired'/'revoked' when Telegram Bot API confirms removal!
   */
  public async revokeUserVipAccess(
    userId: string,
    reason = 'VIP membership inactive or expired',
    includeAllPrivate = false
  ): Promise<{ kickedCount: number; errorsCount: number; details: string[] }> {
    const details: string[] = [];
    let kickedCount = 0;
    let errorsCount = 0;

    const user = await db.getUserById(userId);
    if (!user) {
      return { kickedCount, errorsCount, details };
    }

    const nowIso = new Date().toISOString();
    const novels: Novel[] = await db.getNovels();
    const userAccesses: TelegramAccessRecord[] = await db.getUserTelegramAccesses(user.id);

    const targetAccesses = userAccesses.filter((a) => {
      const isActiveOrPending = a.status === 'active' || a.status === 'pending';
      if (!isActiveOrPending) return false;
      if (includeAllPrivate || user.isBlocked) return true;
      return a.accessType === 'premium';
    });

    const targetStatus: 'expired' | 'revoked' = includeAllPrivate || user.isBlocked ? 'revoked' : 'expired';

    for (const access of targetAccesses) {
      const novel = novels.find((n: Novel) => n.id === access.novelId);
      const channelId = access.channelId || novel?.telegramChannelId;
      const telegramUserId = access.telegramUserId || user.telegram?.telegramUserId;

      if (!channelId || !isNumericTelegramChatId(channelId) || !telegramUserId) {
        await db.updateTelegramAccess(access.id, {
          status: targetStatus,
          updatedAt: nowIso,
        });
        continue;
      }

      // 1. Revoke stored personal invite link on Telegram so it cannot be submitted anymore
      if (access.inviteLink && isTelegramInviteUrl(access.inviteLink)) {
        const revokeRes = await this.revokeChatInviteLink(channelId, access.inviteLink);
        if (revokeRes.ok) {
          await db.addTelegramLog({
            id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            userId: user.id,
            telegramUserId,
            channelId,
            novelId: access.novelId,
            action: 'link_revoked',
            status: 'success',
            details: `Personal invite link revoked (${reason})`,
            createdAt: nowIso,
          });
        }
      }

      // 2. If user only generated a pending link and hasn't joined yet, check if they are actually inside the group
      let shouldKick = access.status === 'active';
      if (access.status === 'pending') {
        const memberCheck = await this.getChatMember(channelId, telegramUserId);
        const st = memberCheck.result?.status;
        if (memberCheck.ok && (st === 'member' || st === 'restricted')) {
          shouldKick = true;
        }
      }

      if (!shouldKick) {
        await db.updateTelegramAccess(access.id, {
          status: targetStatus,
          updatedAt: nowIso,
        });
        details.push(`✓ Revoked pending invite for @${user.telegram?.telegramUsername || telegramUserId} on ${access.novelTitle || channelId}`);
        continue;
      }

      // 3. Actually kick/remove member via Telegram Bot API — ONLY mark success if Telegram API responds ok: true
      const kickRes = await this.removeUserFromChannel(channelId, telegramUserId);
      if (kickRes.ok) {
        kickedCount++;
        await db.updateTelegramAccess(access.id, {
          status: targetStatus,
          updatedAt: nowIso,
        });
        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: user.id,
          telegramUserId,
          channelId,
          novelId: access.novelId,
          action: 'member_removed',
          status: 'success',
          details: `${reason} (Telegram API confirmed removal${kickRes.unbanned ? ', eligible to rejoin upon renewal' : ''})`,
          createdAt: nowIso,
        });
        details.push(`✓ Removed @${user.telegram?.telegramUsername || telegramUserId} from ${access.novelTitle || channelId}`);
      } else {
        errorsCount++;
        details.push(`✗ Failed to remove @${user.telegram?.telegramUsername || telegramUserId} from ${access.novelTitle || channelId}: ${kickRes.description}`);
        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: user.id,
          telegramUserId,
          channelId,
          novelId: access.novelId,
          action: 'removal_failed',
          status: 'failed',
          details: `Bot kick failed (${reason}): ${kickRes.description}`,
          createdAt: nowIso,
        });

        await this.enqueueRemovalRetry(user.id, telegramUserId, channelId, access.novelId, kickRes.description);
      }
    }

    return { kickedCount, errorsCount, details };
  }

  /**
   * Periodic runner: checks for expired/inactive VIP subscriptions and removes users from all VIP Telegram groups/channels.
   * Also catches users whose `isActive` was already flipped to false dynamically before periodic kick ran.
   */
  public async processMembershipExpiries(): Promise<{
    processedUsers: number;
    kickedCount: number;
    errorsCount: number;
    details: string[];
  }> {
    const details: string[] = [];
    let processedUsers = 0;
    let kickedCount = 0;
    let errorsCount = 0;

    try {
      const now = Date.now();
      const nowIso = new Date().toISOString();
      const users: User[] = await db.getUsers();

      for (const user of users) {
        if (user.role === 'admin' && !user.isBlocked) continue;

        const hasActiveVip = isUserVipActive(user);
        const expiresAt = user.membership?.expiresAt;
        const isExpiredOnDate = Boolean(user.membership?.isActive && expiresAt && new Date(expiresAt).getTime() <= now);

        const userAccesses = await db.getUserTelegramAccesses(user.id);
        const staleVipAccesses = userAccesses.filter(
          (a) =>
            (a.status === 'active' || a.status === 'pending') &&
            (user.isBlocked || (!hasActiveVip && a.accessType === 'premium'))
        );

        if (isExpiredOnDate || staleVipAccesses.length > 0) {
          processedUsers++;

          if (isExpiredOnDate) {
            details.push(`User ${user.email} (ID: ${user.id}) VIP expired on ${new Date(expiresAt!).toLocaleString()}`);
            await db.updateUser(user.id, {
              membership: {
                ...user.membership,
                isActive: false,
              },
            });
          }

          if (staleVipAccesses.length > 0) {
            const reason = user.isBlocked
              ? 'User account blocked'
              : 'VIP membership expired or inactive — auto-cleanup across all VIP channels';
            const res = await this.revokeUserVipAccess(user.id, reason, Boolean(user.isBlocked));
            kickedCount += res.kickedCount;
            errorsCount += res.errorsCount;
            details.push(...res.details);
          }

          if (isExpiredOnDate && user.telegram?.telegramUserId) {
            await this.sendMessage(
              user.telegram.telegramUserId,
              `⚠️ <b>Crazy Storyes – VIP सब्सक्रिप्शन समाप्त</b>\n\n` +
              `नमस्ते ${user.telegram.telegramFirstName || user.name || 'दोस्त'}!\n` +
              `आपका Crazy Storyes VIP सब्सक्रिप्शन समाप्त हो गया है। इसलिए सभी Premium/VIP Telegram ग्रुप्स व चैनल्स से आपका एक्सेस समाप्त कर दिया गया है।\n\n` +
              `🔄 पुनः एक्सेस पाने के लिए वेबसाइट पर जाकर अपना VIP प्लान रिन्यू करें — रिन्यू और सत्यापन के बाद आपको नया Private Join-Request लिंक मिल जाएगा।\n\n` +
              `धन्यवाद!`
            );
          }
        }
      }

      // Retry pending removal operations
      const pendingOps = await db.getPendingTelegramOps();
      for (const op of pendingOps) {
        if (op.retryCount >= 5) {
          await db.updateTelegramPendingOp(op.id, { status: 'failed', updatedAt: nowIso });
          continue;
        }

        if (op.operationType === 'remove_member') {
          const res = await this.removeUserFromChannel(op.channelId, op.telegramUserId);
          if (res.ok) {
            await db.updateTelegramPendingOp(op.id, { status: 'completed', updatedAt: nowIso });
            const access = await db.getTelegramAccess(op.userId, op.novelId);
            if (access) {
              await db.updateTelegramAccess(access.id, { status: 'expired', updatedAt: nowIso });
            }
            await db.addTelegramLog({
              id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              userId: op.userId,
              telegramUserId: op.telegramUserId,
              channelId: op.channelId,
              novelId: op.novelId,
              action: 'retry_removal',
              status: 'success',
              details: `Retry successful after ${op.retryCount} attempts`,
              createdAt: nowIso,
            });
            kickedCount++;
            details.push(`✓ Retry succeeded: kicked ${op.telegramUserId} from ${op.channelId}`);
          } else {
            const nextCount = op.retryCount + 1;
            await db.updateTelegramPendingOp(op.id, {
              retryCount: nextCount,
              lastError: res.description,
              status: nextCount >= 5 ? 'failed' : 'pending',
              updatedAt: nowIso,
            });
          }
        }
      }
    } catch (err: any) {
      details.push(`Fatal error in processMembershipExpiries: ${err.message}`);
      errorsCount++;
    }

    return { processedUsers, kickedCount, errorsCount, details };
  }

  public async retryPendingOp(opId: string): Promise<{ ok: boolean; message: string }> {
    const ops = await db.getPendingTelegramOps();
    const op = ops.find((o) => o.id === opId);
    if (!op) return { ok: false, message: 'लंबित ऑपरेशन नहीं मिला' };

    const nowIso = new Date().toISOString();
    if (op.operationType === 'remove_member') {
      const res = await this.removeUserFromChannel(op.channelId, op.telegramUserId);
      if (res.ok) {
        await db.updateTelegramPendingOp(op.id, { status: 'completed', updatedAt: nowIso });
        const access = await db.getTelegramAccess(op.userId, op.novelId);
        if (access) {
          await db.updateTelegramAccess(access.id, { status: 'expired', updatedAt: nowIso });
        }
        await db.addTelegramLog({
          id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: op.userId,
          telegramUserId: op.telegramUserId,
          channelId: op.channelId,
          novelId: op.novelId,
          action: 'retry_removal',
          status: 'success',
          details: 'Manual admin retry removal successful',
          createdAt: nowIso,
        });
        return { ok: true, message: `सफलतापूर्वक चैनल से हटाया गया (${op.telegramUserId})` };
      } else {
        await db.updateTelegramPendingOp(op.id, {
          retryCount: op.retryCount + 1,
          lastError: res.description,
          updatedAt: nowIso,
        });
        return { ok: false, message: res.description || 'पुनः प्रयास विफल रहा' };
      }
    }

    return { ok: false, message: 'असमर्थित ऑपरेशन प्रकार' };
  }

  public async retryAllPendingOps(): Promise<{ total: number; succeeded: number; failed: number }> {
    const ops = await db.getPendingTelegramOps();
    const pendingList = ops.filter((o) => o.status === 'pending');
    let succeeded = 0;
    let failed = 0;

    for (const op of pendingList) {
      const res = await this.retryPendingOp(op.id);
      if (res.ok) succeeded++;
      else failed++;
    }

    return { total: pendingList.length, succeeded, failed };
  }
}

export const telegramService = new TelegramService();

