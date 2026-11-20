import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, UPLOADS_DIR, PRIVATE_SCREENSHOTS_DIR } from '../db.ts';
import { requireAdmin, type AuthRequest } from '../auth.ts';
import type { Novel, Chapter, MembershipPlan } from '../types.ts';
import { supabase, checkSupabaseConnection, checkMembershipDiscountColumnsReadOnly } from '../supabase.ts';
import { telegramService, isTelegramInviteUrl, isNumericTelegramChatId } from '../telegram.ts';
import {
  validateAndNormalizePlanInput,
  MEMBERSHIP_DISCOUNT_MIGRATION_SQL
} from '../planValidation.ts';

const router = express.Router();

// Multer disk storage (kept strictly for legacy /upload-audio compatibility)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    cb(null, `${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max for audio
});

// Dedicated memoryStorage for Supabase Storage image uploads (zero temp local files)
const SUPABASE_STORAGE_BUCKET = 'crazy-storyes-assets';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
      return cb(new Error('अमान्य फ़ाइल प्रकार: केवल JPEG, PNG या WebP इमेज ही स्वीकार्य हैं।'));
    }
    cb(null, true);
  }
});

function detectImageFormatFromBuffer(
  buf: Buffer
): { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: '.jpg' | '.png' | '.webp' } | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // WebP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }

  return null;
}

// All routes in /api/admin require authenticated Admin
router.use(requireAdmin);

// -------------------------------------------------------------
// Live Supabase Health & Connection Verification Endpoint
// -------------------------------------------------------------
router.get('/supabase-status', async (req, res) => {
  try {
    const health = await checkSupabaseConnection();
    return res.json({
      ...health,
      initErrors: db.getInitErrors()
    });
  } catch (err: any) {
    return res.status(500).json({
      configured: false,
      connected: false,
      error: err.message || 'Supabase कनेक्शन जांच में त्रुटि',
      initErrors: db.getInitErrors()
    });
  }
});

function formatDurationLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'अनिर्धारित';
  if (days % 365 === 0) {
    const years = days / 365;
    return `${days} दिन (${years} वर्ष)`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return `${days} दिन (${months} ${months === 1 ? 'महीना' : 'महीने'})`;
  }
  return `${days} दिन`;
}

function isMembershipActiveNow(
  membership: { isActive?: boolean; expiresAt?: string } | undefined,
  nowMs: number
): boolean {
  if (!membership?.isActive) return false;
  if (!membership.expiresAt) return true;
  const expMs = new Date(membership.expiresAt).getTime();
  if (Number.isNaN(expMs)) return true;
  return expMs > nowMs;
}

// -------------------------------------------------------------
// 1. Dashboard Statistics
// -------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const [users, novels, chapters, payments, supabaseHealth] = await Promise.all([
      db.getUsers(),
      db.getNovels(),
      db.getChapters(),
      db.getPayments(),
      checkSupabaseConnection().catch(() => null)
    ]);

    const nowMs = Date.now();
    const uniquePayments = Array.from(new Map(payments.map(p => [p.id, p])).values());
    const totalUsers = users.length;
    const totalNovels = novels.length;
    const totalChapters = chapters.length;
    const premiumMembers = users.filter(u => isMembershipActiveNow(u.membership, nowMs)).length;
    const pendingPayments = uniquePayments.filter(p => p.status === 'pending').length;
    const totalRevenue = uniquePayments
      .filter(p => p.status === 'approved')
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return res.json({
      totalUsers,
      totalNovels,
      totalChapters,
      premiumMembers,
      pendingPayments,
      totalRevenue,
      supabaseHealth
    });
  } catch (err) {
    console.error('Stats error:', err);
    return res.status(500).json({ error: 'डैशबोर्ड आंकड़े लोड करने में त्रुटि' });
  }
});

// -------------------------------------------------------------
// 1B. Membership Management Overview (Plans, Paid Revenue, User-wise Details)
// -------------------------------------------------------------
router.get('/membership-overview', async (req, res) => {
  try {
    const [plans, rawPayments, users] = await Promise.all([
      db.getPlans(),
      db.getPayments(),
      db.getUsers()
    ]);

    const nowMs = Date.now();

    // Deduplicate payment records strictly by payment ID so no payment is ever counted twice
    const uniquePayments = Array.from(new Map(rawPayments.map(p => [p.id, p])).values());
    const membershipPayments = uniquePayments
      .filter(p => p.itemType !== 'novel')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const approvedMembershipPayments = membershipPayments.filter(p => p.status === 'approved');
    const pendingMembershipPayments = membershipPayments.filter(p => p.status === 'pending');
    const rejectedMembershipPayments = membershipPayments.filter(p => p.status === 'rejected');

    const findPlanForPayment = (p: typeof membershipPayments[number]) =>
      plans.find(pl => pl.id === p.itemId) ||
      plans.find(pl => Number(pl.price) === Number(p.amount)) ||
      plans.find(
        pl =>
          pl.name.toLowerCase() === (p.itemName || '').toLowerCase() ||
          pl.hindiName === p.itemName
      );

    // Plan-wise purchase counts & revenue strictly from Approved payments
    const planStatsMap = new Map<string, { purchaseCount: number; totalRevenue: number }>();
    for (const pl of plans) {
      planStatsMap.set(pl.id, { purchaseCount: 0, totalRevenue: 0 });
    }
    const otherPlanStats = { purchaseCount: 0, totalRevenue: 0 };

    for (const p of approvedMembershipPayments) {
      const matched = findPlanForPayment(p);
      const amt = Number(p.amount) || 0;
      if (matched) {
        const entry = planStatsMap.get(matched.id)!;
        entry.purchaseCount += 1;
        entry.totalRevenue += amt;
      } else {
        otherPlanStats.purchaseCount += 1;
        otherPlanStats.totalRevenue += amt;
      }
    }

    const planSummaries = plans.map(pl => {
      const st = planStatsMap.get(pl.id) || { purchaseCount: 0, totalRevenue: 0 };
      const origPrice =
        pl.originalPrice !== undefined && pl.originalPrice > 0 ? Number(pl.originalPrice) : Number(pl.price);
      return {
        id: pl.id,
        name: pl.name,
        hindiName: pl.hindiName,
        originalPrice: origPrice,
        price: Number(pl.price) || 0,
        discountType: pl.discountType || 'none',
        discountPercentage: Number(pl.discountPercentage) || 0,
        discountAmount: Number(pl.discountAmount) || 0,
        durationDays: Number(pl.durationDays) || 0,
        durationLabel: formatDurationLabel(Number(pl.durationDays) || 0),
        isActive: pl.isActive !== false,
        badgeText: pl.badgeText || null,
        description: pl.description,
        features: Array.isArray(pl.features) ? pl.features : [],
        purchaseCount: st.purchaseCount,
        totalRevenue: st.totalRevenue
      };
    });

    // User lookups
    const userById = new Map(users.map(u => [u.id, u]));
    const userByEmail = new Map(users.map(u => [u.email.toLowerCase(), u]));
    const resolveUser = (p: typeof membershipPayments[number]) =>
      userById.get(p.userId) || userByEmail.get((p.userEmail || '').toLowerCase());

    // Track latest approved payment per unique buyer
    const latestApprovedByUser = new Map<string, typeof membershipPayments[number]>();
    for (const p of approvedMembershipPayments) {
      const userKey = p.userId || (p.userEmail || '').toLowerCase();
      if (!latestApprovedByUser.has(userKey)) {
        latestApprovedByUser.set(userKey, p);
      }
    }

    let activePaidMembers = 0;
    let expiredPaidMembers = 0;

    for (const [, latestPay] of latestApprovedByUser.entries()) {
      const u = resolveUser(latestPay);
      const matchedPlan = findPlanForPayment(latestPay);
      const startIso = latestPay.reviewedAt || latestPay.createdAt;
      const startMs = new Date(startIso).getTime();

      let expiresAt: string | null = u?.membership?.expiresAt || null;
      if (!expiresAt && matchedPlan?.durationDays && !Number.isNaN(startMs)) {
        expiresAt = new Date(startMs + matchedPlan.durationDays * 86400000).toISOString();
      }

      const expMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
      const isExpiredByDate = Boolean(expiresAt) && !Number.isNaN(expMs) && expMs <= nowMs;
      const isActive = u ? Boolean(u.membership?.isActive) && !isExpiredByDate : !isExpiredByDate;

      if (isActive) {
        activePaidMembers += 1;
      } else {
        expiredPaidMembers += 1;
      }
    }

    const totalMembershipRevenue = approvedMembershipPayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );

    const totalActiveVipUsers = users.filter(u => isMembershipActiveNow(u.membership, nowMs)).length;

    const userMemberships = membershipPayments.map(p => {
      const u = resolveUser(p);
      const matchedPlan =
        plans.find(pl => pl.id === p.itemId) ||
        plans.find(
          pl =>
            pl.name.toLowerCase() === (p.itemName || '').toLowerCase() ||
            pl.hindiName === p.itemName
        ) ||
        plans.find(pl => Number(pl.price) === Number(p.amount));

      const userKey = p.userId || (p.userEmail || '').toLowerCase();
      const isLatestApprovedForUser =
        p.status === 'approved' && latestApprovedByUser.get(userKey)?.id === p.id;

      const startDate = p.status === 'approved' ? (p.reviewedAt || p.createdAt) : null;
      let expiresAt: string | null = null;
      if (p.status === 'approved') {
        if (isLatestApprovedForUser && u?.membership?.expiresAt) {
          expiresAt = u.membership.expiresAt;
        } else if (startDate && matchedPlan?.durationDays) {
          const startMs = new Date(startDate).getTime();
          if (!Number.isNaN(startMs)) {
            expiresAt = new Date(startMs + matchedPlan.durationDays * 86400000).toISOString();
          }
        }
      }

      let durationDays = matchedPlan ? Number(matchedPlan.durationDays) || 0 : null;
      if (startDate && expiresAt) {
        const startMs = new Date(startDate).getTime();
        const expMs = new Date(expiresAt).getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(expMs) && expMs > startMs) {
          durationDays = Math.max(1, Math.round((expMs - startMs) / 86400000));
        }
      }
      const durationLabel = durationDays ? formatDurationLabel(durationDays) : 'अनिर्धारित';

      let membershipStatus: 'active' | 'expired' | 'pending' | 'rejected' = 'pending';
      if (p.status === 'pending') {
        membershipStatus = 'pending';
      } else if (p.status === 'rejected') {
        membershipStatus = 'rejected';
      } else {
        const expMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
        const isExpiredByDate = Boolean(expiresAt) && !Number.isNaN(expMs) && expMs <= nowMs;
        if (isExpiredByDate) {
          membershipStatus = 'expired';
        } else if (isLatestApprovedForUser && u && !u.membership?.isActive) {
          membershipStatus = 'expired';
        } else if (!isLatestApprovedForUser) {
          membershipStatus = 'expired';
        } else {
          membershipStatus = 'active';
        }
      }

      return {
        paymentId: p.id,
        userId: p.userId,
        userName: u?.name || p.userName,
        userEmail: u?.email || p.userEmail,
        planId: matchedPlan?.id || p.itemId,
        planName: p.itemName || (matchedPlan ? `${matchedPlan.hindiName} (${matchedPlan.name})` : 'Membership Plan'),
        amount: Number(p.amount) || 0,
        durationDays,
        durationLabel,
        paymentDate: p.createdAt,
        startDate,
        expiresAt,
        membershipStatus,
        paymentStatus: p.status
      };
    });

    return res.json({
      generatedAt: new Date(nowMs).toISOString(),
      summary: {
        totalPaidBuyers: latestApprovedByUser.size,
        totalApprovedOrders: approvedMembershipPayments.length,
        activePaidMembers,
        expiredPaidMembers,
        totalActiveVipUsers,
        pendingPaymentsCount: pendingMembershipPayments.length,
        rejectedPaymentsCount: rejectedMembershipPayments.length,
        totalMembershipRevenue
      },
      plans: planSummaries,
      otherPlansStats: otherPlanStats,
      userMemberships
    });
  } catch (err) {
    console.error('Membership overview error:', err);
    return res.status(500).json({ error: 'सदस्यता विवरण लोड करने में त्रुटि' });
  }
});

// -------------------------------------------------------------
// 2. Novel Management CRUD
// -------------------------------------------------------------
router.post('/novels', async (req, res) => {
  try {
    const {
      title,
      hindiTitle,
      author,
      description,
      coverImage,
      categories,
      tags,
      isPremium,
      isPublished,
      isFeatured,
      telegramChannelPrivacy,
      telegramChannelLink,
      telegramChannelId,
      telegramChannelName,
      telegramChannelType,
      telegramAccessType,
      telegramIntegrationEnabled
    } = req.body;

    if (!title || !description || !coverImage) {
      return res.status(400).json({ error: 'शीर्षक, विवरण और 16:9 कवर इमेज आवश्यक हैं' });
    }

    const isVipNovel = Boolean(isPremium) || telegramAccessType === 'premium';
    const normalizedAccessType: 'free' | 'premium' = isVipNovel ? 'premium' : 'free';
    const cleanChannelId = telegramChannelId ? String(telegramChannelId).trim() : '';
    const cleanChannelLink = telegramChannelLink ? String(telegramChannelLink).trim() : '';
    const isEnabled = Boolean(telegramIntegrationEnabled);

    if (isVipNovel && telegramChannelPrivacy === 'public') {
      return res.status(400).json({
        error: 'सुरक्षा नीति: सभी Premium Telegram ग्रुप्स व चैनल्स Private होना अनिवार्य हैं। Public चैनल या खुले लिंक की अनुमति नहीं है।'
      });
    }

    if (isVipNovel && cleanChannelLink && !cleanChannelId) {
      return res.status(400).json({
        error: 'Premium चैनल में Public Link या Username की अनुमति नहीं है। कृपया केवल संख्यात्मक Private Chat ID (-100...) दर्ज करें।'
      });
    }

    if (cleanChannelId && (isTelegramInviteUrl(cleanChannelId) || !isNumericTelegramChatId(cleanChannelId))) {
      return res.status(400).json({
        error: 'अमान्य Telegram Chat ID: इनवाइट लिंक (URL) या @username स्वीकार्य नहीं हैं। कृपया संख्यात्मक ID (-100...) दर्ज करें।'
      });
    }

    if (isVipNovel && isEnabled && !isNumericTelegramChatId(cleanChannelId)) {
      return res.status(400).json({
        error: 'Premium उपन्यास के लिए Telegram डिलीवरी सक्षम करने से पहले संख्यात्मक Private Chat ID (-100...) दर्ज करें।'
      });
    }

    const resolvedPrivacy: 'public' | 'private' = isVipNovel
      ? 'private'
      : (telegramChannelPrivacy === 'public' ? 'public' : (cleanChannelId ? 'private' : 'public'));

    const newNovel: Novel = {
      id: `novel_${Date.now()}`,
      title: title.trim(),
      hindiTitle: hindiTitle ? hindiTitle.trim() : undefined,
      author: (author || '').trim(),
      description: description.trim(),
      coverImage: coverImage.trim(),
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ['Action'],
      tags: Array.isArray(tags) ? tags : [],
      isPremium: Boolean(isPremium),
      isPublished: isPublished !== false,
      isFeatured: Boolean(isFeatured),
      isTrending: false,
      isPopular: false,
      views: 0,
      rating: 5.0,
      ratingCount: 0,
      totalChapters: 0,
      telegramChannelPrivacy: resolvedPrivacy,
      telegramChannelLink: isVipNovel ? undefined : (cleanChannelLink || undefined),
      telegramChannelId: cleanChannelId || undefined,
      telegramChannelName: telegramChannelName ? telegramChannelName.trim() : undefined,
      telegramChannelType: telegramChannelType || 'channel',
      telegramAccessType: normalizedAccessType,
      telegramIntegrationEnabled: isEnabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.addNovel(newNovel);
    return res.status(201).json({ message: 'उपन्यास सफलतापूर्वक जोड़ा गया', novel: saved });
  } catch (err) {
    console.error('Add novel error:', err);
    return res.status(500).json({ error: 'उपन्यास जोड़ने में विफलता' });
  }
});

router.put('/novels/:id', async (req, res) => {
  try {
    const novelId = req.params.id;
    const existing = await db.getNovelById(novelId);
    if (!existing) return res.status(404).json({ error: 'उपन्यास नहीं मिला' });

    const patch: Partial<Novel> = { ...req.body };
    const nextIsPremium = patch.isPremium !== undefined ? Boolean(patch.isPremium) : existing.isPremium;
    const nextAccessType =
      patch.telegramAccessType !== undefined
        ? patch.telegramAccessType
        : (nextIsPremium ? 'premium' : (existing.telegramAccessType || 'free'));
    const nextIsVip = nextIsPremium || nextAccessType === 'premium';
    const nextChannelId = (
      patch.telegramChannelId !== undefined ? String(patch.telegramChannelId || '') : (existing.telegramChannelId || '')
    ).trim();
    const nextEnabled =
      patch.telegramIntegrationEnabled !== undefined
        ? Boolean(patch.telegramIntegrationEnabled)
        : Boolean(existing.telegramIntegrationEnabled);

    if (nextChannelId && (isTelegramInviteUrl(nextChannelId) || !isNumericTelegramChatId(nextChannelId))) {
      return res.status(400).json({
        error: 'अमान्य Telegram Chat ID: केवल संख्यात्मक Private Chat ID (-100...) दर्ज करें, URL या @username नहीं।'
      });
    }

    if (nextIsVip) {
      if (patch.telegramChannelPrivacy === 'public') {
        return res.status(400).json({
          error: 'सुरक्षा नीति: सभी Premium Telegram ग्रुप्स व चैनल्स Private होना अनिवार्य हैं। Public चैनल सेट नहीं किया जा सकता।'
        });
      }

      if (nextEnabled && !isNumericTelegramChatId(nextChannelId)) {
        return res.status(400).json({
          error: 'Premium उपन्यास पर Telegram डिलीवरी सक्षम करने के लिए मान्य संख्यात्मक Private Chat ID (-100...) अनिवार्य है।'
        });
      }

      patch.telegramChannelPrivacy = 'private';
      patch.telegramAccessType = 'premium';
      patch.telegramChannelLink = '';
    }

    if (patch.telegramChannelId !== undefined) {
      patch.telegramChannelId = nextChannelId || undefined;
    }

    const updated = await db.updateNovel(novelId, patch);
    return res.json({ message: 'उपन्यास अपडेट हुआ', novel: updated });
  } catch (err) {
    console.error('Update novel error:', err);
    return res.status(500).json({ error: 'उपन्यास अपडेट में विफलता' });
  }
});

router.put('/novels/:id/toggle-premium', async (req, res) => {
  try {
    const novel = await db.getNovelById(req.params.id);
    if (!novel) return res.status(404).json({ error: 'उपन्यास नहीं मिला' });

    const nextPremium = !novel.isPremium;
    const updates: Partial<Novel> = { isPremium: nextPremium };
    if (nextPremium) {
      updates.telegramAccessType = 'premium';
      updates.telegramChannelPrivacy = 'private';
      updates.telegramChannelLink = '';
      if (novel.telegramIntegrationEnabled && !isNumericTelegramChatId(novel.telegramChannelId)) {
        updates.telegramIntegrationEnabled = false;
      }
    }

    const updated = await db.updateNovel(novel.id, updates);
    return res.json({ message: `उपन्यास ${updated?.isPremium ? 'VIP' : 'FREE'} किया गया`, novel: updated });
  } catch (err) {
    console.error('Toggle novel premium error:', err);
    return res.status(500).json({ error: 'प्रीमियम स्थिति बदलने में विफलता' });
  }
});

router.put('/novels/:id/toggle-publish', async (req, res) => {
  try {
    const novel = await db.getNovelById(req.params.id);
    if (!novel) return res.status(404).json({ error: 'उपन्यास नहीं मिला' });

    const updated = await db.updateNovel(novel.id, { isPublished: !novel.isPublished });
    return res.json({ message: `उपन्यास ${updated?.isPublished ? 'प्रकाशित' : 'अप्रकाशित'} किया गया`, novel: updated });
  } catch (err) {
    console.error('Toggle novel publish error:', err);
    return res.status(500).json({ error: 'प्रकाशन स्थिति बदलने में विफलता' });
  }
});

router.delete('/novels/:id', async (req, res) => {
  try {
    const success = await db.deleteNovel(req.params.id);
    if (!success) return res.status(404).json({ error: 'उपन्यास नहीं मिला' });
    return res.json({ message: 'उपन्यास और उसके सभी अध्याय हटा दिए गए' });
  } catch (err) {
    console.error('Delete novel error:', err);
    return res.status(500).json({ error: 'उपन्यास हटाने में विफलता' });
  }
});

// -------------------------------------------------------------
// 3. Chapter Management CRUD
// -------------------------------------------------------------
router.get('/novels/:novelId/chapters', async (req, res) => {
  try {
    const chapters = await db.getChapters(req.params.novelId);
    return res.json({ chapters });
  } catch (err) {
    console.error('Get chapters error:', err);
    return res.status(500).json({ error: 'अध्याय लोड करने में त्रुटि' });
  }
});

router.post('/chapters', async (req, res) => {
  try {
    const {
      novelId,
      chapterNumber,
      title,
      content,
      isPremium,
      isPublished,
      telegramMessageLink,
      telegramMessageId,
      telegramChatId,
      telegramDestinationType,
      telegramAudioAccessType
    } = req.body;

    if (!novelId || !title) {
      return res.status(400).json({ error: 'novelId और अध्याय शीर्षक आवश्यक हैं' });
    }

    const novel = await db.getNovelById(novelId);
    if (!novel) return res.status(404).json({ error: 'संबंधित उपन्यास नहीं मिला' });

    const cleanTgLink = telegramMessageLink ? String(telegramMessageLink).trim() : undefined;
    const cleanTgMsgId = telegramMessageId ? Number(telegramMessageId) : undefined;
    const cleanTgChatId = telegramChatId ? String(telegramChatId).trim() : undefined;
    const isConfigured = Boolean(cleanTgLink);

    const newChapter: Chapter = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      novelId,
      chapterNumber: Number(chapterNumber) || (novel.totalChapters + 1),
      title: title.trim(),
      content: (content || '').trim(),
      telegramMessageLink: cleanTgLink,
      telegramMessageId: cleanTgMsgId,
      telegramChatId: cleanTgChatId,
      telegramDestinationType: telegramDestinationType || 'channel',
      telegramAudioAccessType: telegramAudioAccessType || (isPremium ? 'premium' : 'free'),
      telegramAudioConfigured: isConfigured,
      isPremium: Boolean(isPremium),
      isPublished: isPublished !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const saved = await db.addChapter(newChapter);
    return res.status(201).json({ message: 'अध्याय सफलतापूर्वक जोड़ा गया', chapter: saved });
  } catch (err) {
    console.error('Add chapter error:', err);
    return res.status(500).json({ error: 'अध्याय जोड़ने में विफलता' });
  }
});

router.put('/chapters/:id', async (req, res) => {
  try {
    const chapterId = req.params.id;
    const existing = await db.getChapterById(chapterId);
    if (!existing) return res.status(404).json({ error: 'अध्याय नहीं मिला' });

    const payload: Partial<Chapter> = { ...req.body };
    if (payload.chapterNumber !== undefined) {
      payload.chapterNumber = Number(payload.chapterNumber);
    }
    if (payload.isPremium !== undefined) {
      payload.isPremium = Boolean(payload.isPremium);
    }
    if (payload.isPublished !== undefined) {
      payload.isPublished = Boolean(payload.isPublished);
    }
    if (payload.telegramMessageLink !== undefined) {
      payload.telegramMessageLink = payload.telegramMessageLink ? String(payload.telegramMessageLink).trim() : undefined;
      payload.telegramAudioConfigured = Boolean(payload.telegramMessageLink);
    }
    if (payload.telegramMessageId !== undefined) {
      payload.telegramMessageId = payload.telegramMessageId ? Number(payload.telegramMessageId) : undefined;
    }
    if (payload.telegramChatId !== undefined) {
      payload.telegramChatId = payload.telegramChatId ? String(payload.telegramChatId).trim() : undefined;
    }

    const updated = await db.updateChapter(chapterId, payload);
    return res.json({ message: 'अध्याय अपडेट हुआ', chapter: updated });
  } catch (err) {
    console.error('Update chapter error:', err);
    return res.status(500).json({ error: 'अध्याय अपडेट में विफलता' });
  }
});

// Quick Update Chapter Telegram Audio Link
router.put('/chapters/:id/telegram-link', async (req, res) => {
  try {
    const chapterId = req.params.id;
    const existing = await db.getChapterById(chapterId);
    if (!existing) return res.status(404).json({ error: 'अध्याय नहीं मिला' });

    const { telegramMessageLink, telegramMessageId, telegramChatId, telegramDestinationType, telegramAudioAccessType } = req.body;
    const cleanLink = telegramMessageLink !== undefined ? (telegramMessageLink ? String(telegramMessageLink).trim() : '') : (existing.telegramMessageLink || '');

    const updated = await db.updateChapter(chapterId, {
      telegramMessageLink: cleanLink || undefined,
      telegramMessageId: telegramMessageId !== undefined ? (telegramMessageId ? Number(telegramMessageId) : undefined) : existing.telegramMessageId,
      telegramChatId: telegramChatId !== undefined ? (telegramChatId ? String(telegramChatId).trim() : undefined) : existing.telegramChatId,
      telegramDestinationType: telegramDestinationType || existing.telegramDestinationType || 'channel',
      telegramAudioAccessType: telegramAudioAccessType || existing.telegramAudioAccessType || (existing.isPremium ? 'premium' : 'free'),
      telegramAudioConfigured: Boolean(cleanLink),
      updatedAt: new Date().toISOString()
    });

    return res.json({ message: 'अध्याय का Telegram ऑडियो लिंक अपडेट किया गया', chapter: updated });
  } catch (err: any) {
    console.error('Update chapter telegram link error:', err);
    return res.status(500).json({ error: err.message || 'Telegram ऑडियो लिंक अपडेट में विफलता' });
  }
});

router.put('/chapters/:id/toggle-premium', async (req, res) => {
  try {
    const chapter = await db.getChapterById(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'अध्याय नहीं मिला' });

    const updated = await db.updateChapter(chapter.id, { isPremium: !chapter.isPremium });
    return res.json({ message: `अध्याय ${updated?.isPremium ? 'VIP' : 'FREE'} किया गया`, chapter: updated });
  } catch (err) {
    console.error('Toggle chapter premium error:', err);
    return res.status(500).json({ error: 'अध्याय प्रीमियम स्थिति बदलने में विफलता' });
  }
});

router.put('/chapters/:id/toggle-publish', async (req, res) => {
  try {
    const chapter = await db.getChapterById(req.params.id);
    if (!chapter) return res.status(404).json({ error: 'अध्याय नहीं मिला' });

    const updated = await db.updateChapter(chapter.id, { isPublished: !chapter.isPublished });
    return res.json({ message: `अध्याय ${updated?.isPublished ? 'प्रकाशित' : 'अप्रकाशित'} किया गया`, chapter: updated });
  } catch (err) {
    console.error('Toggle chapter publish error:', err);
    return res.status(500).json({ error: 'अध्याय प्रकाशन स्थिति बदलने में विफलता' });
  }
});

router.delete('/chapters/:id', async (req, res) => {
  try {
    const success = await db.deleteChapter(req.params.id);
    if (!success) return res.status(404).json({ error: 'अध्याय नहीं मिला' });
    return res.json({ message: 'अध्याय हटा दिया गया' });
  } catch (err) {
    console.error('Delete chapter error:', err);
    return res.status(500).json({ error: 'अध्याय हटाने में विफलता' });
  }
});

// -------------------------------------------------------------
// 4. User Management & Role Updates
// -------------------------------------------------------------
router.get('/users', async (req, res) => {
  try {
    const { q } = req.query as { q?: string };
    let users = await db.getUsers();

    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
    }

    const safeUsers = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isBlocked: u.isBlocked,
      membership: u.membership,
      lastLoginAt: u.lastLoginAt,
      lastLogoutAt: u.lastLogoutAt,
      createdAt: u.createdAt
    }));

    return res.json({ users: safeUsers });
  } catch (err) {
    console.error('Get users error:', err);
    return res.status(500).json({ error: 'उपयोगकर्ता लोड करने में त्रुटि' });
  }
});

// Role Update (Admin <-> Reader)
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== 'admin' && role !== 'reader') {
      return res.status(400).json({ error: 'अमान्य रोल। केवल admin या reader मान्य हैं।' });
    }

    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला' });

    const settings = await db.getSettings();
    const ownerEmail = (settings.adminEmail || '').toLowerCase();
    const isOwner =
      user.email.toLowerCase() === ownerEmail ||
      user.email.toLowerCase() === 'divinecult2007@gmail.com' ||
      user.email.toLowerCase() === 'ganish9784@gmail.com';

    // Prevent demoting the owner account
    if (isOwner && role !== 'admin') {
      return res.status(400).json({ error: 'वेबसाइट स्वामी (Owner) के एडमिन रोल को हटाया नहीं जा सकता।' });
    }

    const updated = await db.updateUser(user.id, { role });
    return res.json({
      message: `उपयोगकर्ता रोल बदलकर ${role === 'admin' ? 'ADMIN (व्यवस्थापक)' : 'READER (पाठक)'} कर दिया गया।`,
      user: {
        id: updated?.id,
        name: updated?.name,
        email: updated?.email,
        role: updated?.role,
        membership: updated?.membership,
        isBlocked: updated?.isBlocked
      }
    });
  } catch (err) {
    console.error('Update user role error:', err);
    return res.status(500).json({ error: 'रोल बदलने में विफलता' });
  }
});

// Block / Unblock User
router.put('/users/:id/block', async (req, res) => {
  try {
    const { isBlocked } = req.body;
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला' });

    const settings = await db.getSettings();
    const ownerEmail = (settings.adminEmail || '').toLowerCase();
    const isOwner =
      user.email.toLowerCase() === ownerEmail ||
      user.email.toLowerCase() === 'divinecult2007@gmail.com' ||
      user.email.toLowerCase() === 'ganish9784@gmail.com';

    if (isOwner) {
      return res.status(400).json({ error: 'वेबसाइट स्वामी (Owner) के खाते को ब्लॉक नहीं किया जा सकता।' });
    }

    const updated = await db.updateUser(user.id, { isBlocked: Boolean(isBlocked) });
    if (Boolean(isBlocked)) {
      telegramService.revokeUserVipAccess(user.id, 'User account blocked by Admin', true).catch((e) => {
        console.error('Error revoking Telegram access on user block:', e);
      });
    }

    const safeUpdated = updated ? (({ passwordHash: _ph, ...rest }) => rest)(updated) : undefined;
    return res.json({
      message: isBlocked ? 'खाता अवरुद्ध (Blocked) कर दिया गया' : 'खाता सक्रिय (Unblocked) किया गया',
      user: safeUpdated
    });
  } catch (err) {
    console.error('Block user error:', err);
    return res.status(500).json({ error: 'खाता स्थिति बदलने में विफलता' });
  }
});

// Admin Unlink User Telegram or generic partial update
router.put('/users/:id', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला' });

    if (req.body?.telegram === null) {
      await telegramService.revokeUserVipAccess(user.id, 'Admin unlinked user Telegram account', true);
      const unlinkedUser = await db.unlinkUserTelegram(user.id);
      const safeUnlinked = unlinkedUser ? (({ passwordHash: _ph, ...rest }) => rest)(unlinkedUser) : null;
      return res.json({ message: 'उपयोगकर्ता का Telegram अनलिंक किया गया', user: safeUnlinked });
    }

    const allowedPatch: any = {};
    if (req.body?.name !== undefined) allowedPatch.name = String(req.body.name).trim();
    const updated = await db.updateUser(user.id, allowedPatch);
    const safeUpdated = updated ? (({ passwordHash: _ph, ...rest }) => rest)(updated) : undefined;
    return res.json({ message: 'उपयोगकर्ता अपडेट हुआ', user: safeUpdated });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'उपयोगकर्ता अपडेट में विफलता' });
  }
});

// Membership Grant / Revoke
router.put('/users/:id/membership', async (req, res) => {
  try {
    const { isActive, durationDays, planName } = req.body;
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला' });

    let expiresAt: string | undefined = undefined;
    let expiresEpoch: number | undefined = undefined;
    if (isActive) {
      const days = Number(durationDays) || 30;
      expiresEpoch = Date.now() + days * 86400000;
      expiresAt = new Date(expiresEpoch).toISOString();
    }

    const updatedMembership = {
      isActive: Boolean(isActive),
      planName: isActive ? (planName || 'Admin Granted VIP') : undefined,
      expiresAt
    };

    const updated = await db.updateUser(user.id, {
      membership: updatedMembership
    });

    if (!isActive) {
      telegramService.revokeUserVipAccess(user.id, 'VIP membership deactivated by Admin', false).catch((e) => {
        console.error('Error revoking Telegram VIP access on admin deactivation:', e);
      });
    }

    return res.json({ message: 'उपयोगकर्ता सदस्यता अपडेट हुई', membership: updated?.membership });
  } catch (err) {
    console.error('Membership update error:', err);
    return res.status(500).json({ error: 'सदस्यता अपडेट में विफलता' });
  }
});

// -------------------------------------------------------------
// 5. Payment & UTR Verification Management
// -------------------------------------------------------------
router.get('/payments', async (req, res) => {
  try {
    const payments = await db.getPayments();
    return res.json({ payments });
  } catch (err) {
    console.error('Get payments error:', err);
    return res.status(500).json({ error: 'भुगतान रिकॉर्ड लोड करने में त्रुटि' });
  }
});

// Approve Payment & Instantly Upgrade Membership in Supabase
router.put('/payments/:id/approve', async (req: AuthRequest, res) => {
  try {
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'पेमेंट रिकॉर्ड नहीं मिला' });
    if (payment.status === 'approved') return res.status(400).json({ error: 'यह पेमेंट पहले ही स्वीकृत हो चुकी है' });

    // Automatically activate VIP membership for the user in Supabase first
    const user = await db.getUserById(payment.userId);
    if (!user) return res.status(404).json({ error: 'भुगतान से जुड़ा उपयोगकर्ता नहीं मिला' });

    const plans = await db.getPlans();
    const matchedPlan = plans.find(p => p.id === payment.itemId) || plans.find(p => p.price === payment.amount);
    const durationDays = matchedPlan ? matchedPlan.durationDays : 30;
    const expiresEpoch = Date.now() + durationDays * 86400000;
    const expiresAt = new Date(expiresEpoch).toISOString();

    const membership = {
      isActive: true,
      planId: matchedPlan?.id,
      planName: payment.itemName,
      expiresAt
    };

    const updatedUser = await db.updateUser(user.id, { membership });
    if (!updatedUser) {
      return res.status(500).json({ error: 'उपयोगकर्ता सदस्यता अपडेट करने में विफलता' });
    }

    payment.status = 'approved';
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = req.user?.email || 'admin';
    const updatedPayment = await db.updatePayment(payment.id, payment);

    // If user has linked Telegram, notify them instantly
    if (user.telegram?.telegramUserId) {
      telegramService.sendMessage(
        user.telegram.telegramUserId,
        `🎉 <b>बधाई हो! आपकी VIP सदस्यता सक्रिय हो गई है!</b>\n\n` +
        `💰 <b>स्वीकृत प्लान:</b> ${payment.itemName} (₹${payment.amount})\n` +
        `📅 <b>वैधता:</b> ${new Date(expiresEpoch).toLocaleDateString('hi-IN')}\n\n` +
        `🚀 अब आप वेबसाइट पर किसी भी VIP ऑडियो उपन्यास के पेज पर जाकर 'Listen on Telegram' बटन से अपना व्यक्तिगत Private Join-Request लिंक प्राप्त कर सकते हैं — बॉट आपकी VIP स्थिति सत्यापित करके स्वतः Approve कर देगा!`
      ).catch((err) => console.error('Error sending Telegram approval notification:', err));
    }

    return res.json({
      message: 'पेमेंट स्वीकृत! वीआईपी सदस्यता तत्काल सक्रिय कर दी गई है। (Payment approved & VIP activated)',
      payment: updatedPayment,
      userMembership: updatedUser?.membership
    });
  } catch (err) {
    console.error('Approve payment error:', err);
    return res.status(500).json({ error: 'पेमेंट स्वीकृत करने में विफलता' });
  }
});

// Reject Payment with Reason saved to Supabase
router.put('/payments/:id/reject', async (req: AuthRequest, res) => {
  try {
    const { reason } = req.body;
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'पेमेंट रिकॉर्ड नहीं मिला' });

    const rejectionReason = (reason || 'भुगतान सत्यापित नहीं हो सका (UTR/स्क्रीनशॉट अमान्य)').trim();

    payment.status = 'rejected';
    payment.rejectionReason = rejectionReason;
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = req.user?.email || 'admin';
    const updatedPayment = await db.updatePayment(payment.id, payment);

    return res.json({
      message: 'पेमेंट अस्वीकृत किया गया (Payment rejected)',
      payment: updatedPayment
    });
  } catch (err) {
    console.error('Reject payment error:', err);
    return res.status(500).json({ error: 'पेमेंट अस्वीकृत करने में विफलता' });
  }
});

// Request Additional Payment Information
router.put('/payments/:id/request-info', async (req: AuthRequest, res) => {
  try {
    const { note } = req.body;
    const payment = await db.getPaymentById(req.params.id);
    if (!payment) return res.status(404).json({ error: 'पेमेंट रिकॉर्ड नहीं मिला' });

    const adminNote = (note || 'कृपया स्पष्ट भुगतान स्क्रीनशॉट या 12 अंकों का UTR नंबर प्रदान करें').trim();

    payment.adminNote = adminNote;
    payment.reviewedAt = new Date().toISOString();
    payment.reviewedBy = req.user?.email || 'admin';
    const updatedPayment = await db.updatePayment(payment.id, payment);

    return res.json({
      message: 'अतिरिक्त जानकारी का अनुरोध भेजा गया',
      payment: updatedPayment
    });
  } catch (err) {
    console.error('Request info error:', err);
    return res.status(500).json({ error: 'जानकारी अनुरोध भेजने में विफलता' });
  }
});

// Serve private payment screenshot securely to Admin (Short-lived Signed URL for Supabase Private Bucket)
const PAYMENT_PROOFS_BUCKET = 'crazy-storyes-payment-proofs';
const SIGNED_URL_EXPIRES_IN_SEC = 60;

router.get('/payments/:id/screenshot', async (req: AuthRequest, res) => {
  try {
    const payment = await db.getPaymentById(req.params.id);
    if (!payment || !payment.screenshotPath) {
      return res.status(404).json({ error: 'स्क्रीनशॉट नहीं मिला' });
    }

    const rawPath = payment.screenshotPath.trim();

    // New private Supabase Storage object path (e.g. "payment-proofs/pay_....png")
    if (rawPath.startsWith('payment-proofs/')) {
      if (rawPath.includes('..') || rawPath.startsWith('/')) {
        return res.status(400).json({ error: 'अमान्य स्क्रीनशॉट पाथ' });
      }
      if (!supabase) {
        return res.status(503).json({ error: 'Supabase Storage उपलब्ध नहीं है' });
      }

      const { data: signedData, error: signedErr } = await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .createSignedUrl(rawPath, SIGNED_URL_EXPIRES_IN_SEC);

      if (signedErr || !signedData?.signedUrl) {
        console.error('Failed to create signed URL for payment screenshot:', {
          bucket: PAYMENT_PROOFS_BUCKET,
          path: rawPath,
          message: signedErr?.message || 'Unknown signed URL error'
        });
        return res.status(502).json({
          error: 'भुगतान स्क्रीनशॉट के लिए सुरक्षित Signed URL नहीं बन सका'
        });
      }

      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        success: true,
        storage: 'supabase',
        bucket: PAYMENT_PROOFS_BUCKET,
        path: rawPath,
        signedUrl: signedData.signedUrl,
        expiresIn: SIGNED_URL_EXPIRES_IN_SEC
      });
    }

    // Backward-compatible read-only fallback for older pre-migration local screenshots
    const safeName = path.basename(rawPath);
    const fullPath = path.join(PRIVATE_SCREENSHOTS_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'स्क्रीनशॉट फ़ाइल सर्वर पर उपलब्ध नहीं है' });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(fullPath);
  } catch (err) {
    console.error('Get screenshot error:', err);
    return res.status(500).json({ error: 'स्क्रीनशॉट लोड करने में त्रुटि' });
  }
});

// -------------------------------------------------------------
// 6. Settings & Membership Plans
// -------------------------------------------------------------
router.get('/settings', async (req, res) => {
  try {
    const [settings, plans] = await Promise.all([
      db.getSettings(),
      db.getPlans()
    ]);
    return res.json({ settings, plans });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'सेटिंग्स लोड करने में त्रुटि' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const updated = await db.updateSettings(req.body);
    return res.json({ message: 'सेटिंग्स सफलतापूर्वक सहेजी गईं', settings: updated });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'सेटिंग्स अपडेट में विफलता' });
  }
});

router.get('/plans', async (req, res) => {
  try {
    const [plans, rawPayments, users, colCheck] = await Promise.all([
      db.getPlans(),
      db.getPayments(),
      db.getUsers(),
      supabase ? checkMembershipDiscountColumnsReadOnly(supabase) : Promise.resolve({ ready: true })
    ]);

    const uniquePayments = Array.from(new Map(rawPayments.map(p => [p.id, p])).values()).filter(
      p => p.itemType !== 'novel'
    );

    const linkedUsageByPlanId: Record<
      string,
      { paymentsCount: number; pendingPaymentsCount: number; approvedPaymentsCount: number; activeUsersCount: number }
    > = {};

    const nowMs = Date.now();
    for (const pl of plans) {
      const linkedPays = uniquePayments.filter(p => p.itemId === pl.id);
      const linkedActiveUsers = users.filter(
        u => isMembershipActiveNow(u.membership, nowMs) && u.membership?.planId === pl.id
      );
      linkedUsageByPlanId[pl.id] = {
        paymentsCount: linkedPays.length,
        pendingPaymentsCount: linkedPays.filter(p => p.status === 'pending').length,
        approvedPaymentsCount: linkedPays.filter(p => p.status === 'approved').length,
        activeUsersCount: linkedActiveUsers.length
      };
    }

    return res.json({
      plans,
      linkedUsageByPlanId,
      discountColumnsReady: colCheck.ready,
      sqlMigration: colCheck.ready ? undefined : MEMBERSHIP_DISCOUNT_MIGRATION_SQL
    });
  } catch (err) {
    console.error('Get admin plans error:', err);
    return res.status(500).json({ error: 'सदस्यता प्लान लोड करने में त्रुटि' });
  }
});

router.post('/plans', async (req, res) => {
  try {
    const validation = validateAndNormalizePlanInput(req.body, { isNew: true });
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const existing = await db.getPlanById(validation.plan.id);
    if (existing) {
      validation.plan.id = `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const created = await db.addPlan(validation.plan);
    return res.status(201).json({
      message: 'नया सदस्यता प्लान सफलतापूर्वक बनाया गया',
      plan: created
    });
  } catch (err: any) {
    console.error('Create plan error:', err);
    if (err?.code === 'DISCOUNT_COLUMNS_MISSING') {
      return res.status(409).json({
        error: err.message,
        code: 'DISCOUNT_COLUMNS_MISSING',
        sqlMigration: MEMBERSHIP_DISCOUNT_MIGRATION_SQL
      });
    }
    return res.status(500).json({ error: 'नया सदस्यता प्लान बनाने में विफलता' });
  }
});

router.put('/plans/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    const existing = await db.getPlanById(planId);
    if (!existing) {
      return res.status(404).json({ error: 'सदस्यता प्लान नहीं मिला' });
    }

    const validation = validateAndNormalizePlanInput(
      { ...existing, ...req.body, id: planId },
      { planId }
    );
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error });
    }

    const updated = await db.updatePlan(planId, validation.plan);
    if (!updated) {
      return res.status(404).json({ error: 'सदस्यता प्लान अपडेट नहीं हो सका' });
    }

    return res.json({
      message: 'सदस्यता प्लान सफलतापूर्वक अपडेट किया गया',
      plan: updated
    });
  } catch (err: any) {
    console.error('Update single plan error:', err);
    if (err?.code === 'DISCOUNT_COLUMNS_MISSING') {
      return res.status(409).json({
        error: err.message,
        code: 'DISCOUNT_COLUMNS_MISSING',
        sqlMigration: MEMBERSHIP_DISCOUNT_MIGRATION_SQL
      });
    }
    return res.status(500).json({ error: 'सदस्यता प्लान अपडेट करने में विफलता' });
  }
});

router.put('/plans/:id/toggle-active', async (req, res) => {
  try {
    const planId = req.params.id;
    const existing = await db.getPlanById(planId);
    if (!existing) {
      return res.status(404).json({ error: 'सदस्यता प्लान नहीं मिला' });
    }

    const nextActive =
      typeof req.body?.isActive === 'boolean' ? req.body.isActive : !existing.isActive;
    const updated = await db.updatePlan(planId, {
      ...existing,
      isActive: nextActive,
      updatedAt: new Date().toISOString()
    });

    return res.json({
      message: updated?.isActive
        ? 'सदस्यता प्लान सक्रिय (Active) कर दिया गया'
        : 'सदस्यता प्लान निष्क्रिय (Inactive) कर दिया गया',
      plan: updated
    });
  } catch (err: any) {
    console.error('Toggle plan active error:', err);
    if (err?.code === 'DISCOUNT_COLUMNS_MISSING') {
      return res.status(409).json({
        error: err.message,
        code: 'DISCOUNT_COLUMNS_MISSING',
        sqlMigration: MEMBERSHIP_DISCOUNT_MIGRATION_SQL
      });
    }
    return res.status(500).json({ error: 'प्लान स्थिति बदलने में विफलता' });
  }
});

router.delete('/plans/:id', async (req, res) => {
  try {
    const planId = req.params.id;
    const existing = await db.getPlanById(planId);
    if (!existing) {
      return res.status(404).json({ error: 'सदस्यता प्लान नहीं मिला' });
    }

    const [rawPayments, users] = await Promise.all([db.getPayments(), db.getUsers()]);
    const uniquePayments = Array.from(new Map(rawPayments.map(p => [p.id, p])).values());
    const linkedPayments = uniquePayments.filter(
      p => p.itemType !== 'novel' && p.itemId === planId
    );
    const linkedUsers = users.filter(u => u.membership?.planId === planId);

    const forceDelete = req.query.force === 'true';
    if ((linkedPayments.length > 0 || linkedUsers.length > 0) && !forceDelete) {
      return res.status(409).json({
        requiresConfirmation: true,
        linkedPaymentsCount: linkedPayments.length,
        linkedUsersCount: linkedUsers.length,
        error: `इस प्लान से ${linkedPayments.length} पेमेंट रिकॉर्ड और ${linkedUsers.length} यूज़र सदस्यताएं जुड़ी हुई हैं। स्थायी रूप से हटाने से पुराने पेमेंट व यूज़र इतिहास सुरक्षित रहेंगे, लेकिन प्लान सूची से हट जाएगा। सुरक्षित विकल्प के लिए प्लान को केवल Inactive करें या स्थायी डिलीट की पुष्टि करें।`
      });
    }

    const deleted = await db.deletePlan(planId);
    if (!deleted) {
      return res.status(404).json({ error: 'सदस्यता प्लान नहीं मिला' });
    }

    return res.json({
      message: 'सदस्यता प्लान हटाया गया (पुराने पेमेंट और यूज़र सदस्यता रिकॉर्ड पूरी तरह सुरक्षित हैं)',
      deletedId: planId
    });
  } catch (err) {
    console.error('Delete plan error:', err);
    return res.status(500).json({ error: 'सदस्यता प्लान हटाने में विफलता' });
  }
});

router.put('/plans', async (req, res) => {
  try {
    const { plans } = req.body;
    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ error: 'अमान्य प्लान डेटा: कम से कम एक प्लान आवश्यक है' });
    }

    const validatedPlans: MembershipPlan[] = [];
    for (let i = 0; i < plans.length; i++) {
      const validation = validateAndNormalizePlanInput(plans[i], {
        planId: plans[i]?.id,
        isNew: !plans[i]?.id
      });
      if (!validation.ok) {
        return res.status(400).json({
          error: `प्लान #${i + 1} (${plans[i]?.name || 'Unknown'}): ${validation.error}`
        });
      }
      validatedPlans.push(validation.plan);
    }

    const updated = await db.updatePlans(validatedPlans);
    return res.json({ message: 'सदस्यता प्लान सुरक्षित रूप से अपडेट हुए', plans: updated });
  } catch (err: any) {
    console.error('Update plans error:', err);
    if (err?.code === 'DISCOUNT_COLUMNS_MISSING') {
      return res.status(409).json({
        error: err.message,
        code: 'DISCOUNT_COLUMNS_MISSING',
        sqlMigration: MEMBERSHIP_DISCOUNT_MIGRATION_SQL
      });
    }
    return res.status(500).json({ error: 'प्लान अपडेट में विफलता' });
  }
});

// -------------------------------------------------------------
// 7. File Uploads (Covers & Audio)
// -------------------------------------------------------------
router.post('/upload-image', (req, res) => {
  imageUpload.single('image')(req, res, async (multerErr: any) => {
    if (multerErr) {
      if (multerErr?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          bucket: SUPABASE_STORAGE_BUCKET,
          error: 'इमेज का आकार 10 MB से अधिक नहीं होना चाहिए (अधिकतम 10 MB)।'
        });
      }
      return res.status(400).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: multerErr?.message || 'अमान्य इमेज फ़ाइल'
      });
    }

    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: 'कोई इमेज फाइल नहीं मिली'
      });
    }

    if (req.file.size > MAX_IMAGE_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: 'इमेज का आकार 10 MB से अधिक नहीं होना चाहिए (अधिकतम 10 MB)।'
      });
    }

    const detected = detectImageFormatFromBuffer(req.file.buffer);
    if (!detected) {
      return res.status(400).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: 'अमान्य इमेज फ़ाइल: वास्तविक JPEG, PNG या WebP सामग्री की पुष्टि नहीं हुई।'
      });
    }

    if (!supabase) {
      console.error('Supabase storage upload aborted: Supabase client is not initialized.');
      return res.status(503).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: 'Supabase Storage उपलब्ध नहीं है — कृपया सर्वर पर SUPABASE_URL और SUPABASE_SECRET_KEY जांचें।'
      });
    }

    const uniqueToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const storageKey = `covers/${Date.now()}_${uniqueToken}${detected.ext}`;

    try {
      const { data, error } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storageKey, req.file.buffer, {
          contentType: detected.mime,
          upsert: false
        });

      if (error || !data) {
        const errMsg = error?.message || 'अज्ञात Supabase Storage त्रुटि';
        console.error('Supabase storage upload failed:', {
          bucket: SUPABASE_STORAGE_BUCKET,
          path: storageKey,
          statusCode: (error as any)?.statusCode,
          message: errMsg
        });
        return res.status(502).json({
          success: false,
          bucket: SUPABASE_STORAGE_BUCKET,
          error: `Supabase Storage में अपलोड विफल रहा: ${errMsg}`
        });
      }

      const objectPath = data.path || storageKey;
      const { data: pubData } = supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(objectPath);

      if (!pubData?.publicUrl) {
        console.error('Supabase storage public URL missing after upload:', {
          bucket: SUPABASE_STORAGE_BUCKET,
          path: objectPath
        });
        return res.status(502).json({
          success: false,
          bucket: SUPABASE_STORAGE_BUCKET,
          error: 'इमेज अपलोड हुई लेकिन Supabase Public URL प्राप्त नहीं हो सका।'
        });
      }

      return res.json({
        success: true,
        url: pubData.publicUrl,
        storage: 'supabase',
        bucket: SUPABASE_STORAGE_BUCKET,
        path: objectPath,
        filename: path.basename(objectPath),
        mimeType: detected.mime,
        size: req.file.size
      });
    } catch (err: any) {
      const errMsg = err?.message || 'Supabase Storage अपलोड अपवाद';
      console.error('Supabase storage upload exception:', {
        bucket: SUPABASE_STORAGE_BUCKET,
        path: storageKey,
        message: errMsg
      });
      return res.status(502).json({
        success: false,
        bucket: SUPABASE_STORAGE_BUCKET,
        error: `Supabase Storage अपलोड में तकनीकी त्रुटि: ${errMsg}`
      });
    }
  });
});

router.post('/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'कोई ऑडियो फाइल नहीं मिली' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({ url: fileUrl, filename: req.file.filename });
});

// -------------------------------------------------------------
// 8. Support Tickets
// -------------------------------------------------------------
router.get('/tickets', async (req, res) => {
  try {
    const tickets = await db.getSupportTickets();
    return res.json({ tickets });
  } catch (err) {
    console.error('Get tickets error:', err);
    return res.status(500).json({ error: 'टिकट लोड करने में त्रुटि' });
  }
});

router.put('/tickets/:id/reply', async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply) return res.status(400).json({ error: 'उत्तर आवश्यक है' });

    const ticket = await db.updateSupportTicket(req.params.id, {
      adminReply: reply.trim(),
      status: 'answered',
      repliedAt: new Date().toISOString()
    });

    if (!ticket) return res.status(404).json({ error: 'टिकट नहीं मिला' });
    return res.json({ message: 'उत्तर सफलतापूर्वक भेजा गया', ticket });
  } catch (err) {
    console.error('Reply ticket error:', err);
    return res.status(500).json({ error: 'उत्तर भेजने में विफलता' });
  }
});

// -------------------------------------------------------------
// 9. User Login & Security History Logs
// -------------------------------------------------------------
router.get('/auth-logs', async (req, res) => {
  try {
    const { userId, eventType, limit } = req.query as {
      userId?: string;
      eventType?: string;
      limit?: string;
    };

    const logs = await db.getAuthLogs({
      userId: userId ? String(userId).trim() : undefined,
      eventType: eventType ? String(eventType).trim() : undefined,
      limit: limit ? Number(limit) : 200
    });

    return res.json({ logs });
  } catch (err: any) {
    console.error('Get auth logs error:', err);
    return res.status(500).json({ error: err.message || 'लॉगिन इतिहास लोड करने में त्रुटि' });
  }
});

router.get('/users/:id/auth-history', async (req, res) => {
  try {
    const user = await db.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'उपयोगकर्ता नहीं मिला' });

    const logs = await db.getAuthLogs({ userId: user.id, limit: 100 });
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        lastLogoutAt: user.lastLogoutAt
      },
      logs
    });
  } catch (err: any) {
    console.error('Get user auth history error:', err);
    return res.status(500).json({ error: err.message || 'उपयोगकर्ता इतिहास लोड करने में त्रुटि' });
  }
});

export default router;
