import express from 'express';
import { db } from '../db.ts';
import { optionalAuth, type AuthRequest } from '../auth.ts';
import type { Novel, User } from '../types.ts';

const router = express.Router();

export function sanitizeNovelForResponse(novel: Novel, user?: User) {
  const isAdmin = user?.role === 'admin';
  const telegramConfigured = Boolean(
    novel.telegramIntegrationEnabled && (novel.telegramChannelLink || novel.telegramChannelId)
  );
  const likedByCurrentUser = Boolean(
    user?.id && Array.isArray(novel.likedBy) && novel.likedBy.includes(user.id)
  );
  const currentUserRating =
    user?.id && novel.userRatings && typeof novel.userRatings[user.id] === 'number'
      ? novel.userRatings[user.id]
      : undefined;

  if (isAdmin) {
    return {
      ...novel,
      telegramConfigured,
      likedByCurrentUser,
      currentUserRating
    };
  }

  const isPublicFreeChannel =
    !novel.isPremium &&
    novel.telegramAccessType !== 'premium' &&
    novel.telegramChannelPrivacy === 'public';

  const {
    likedBy: _likedBy,
    userRatings: _userRatings,
    telegramChannelId: _telegramChannelId,
    telegramChannelLink,
    ...publicFields
  } = novel;

  return {
    ...publicFields,
    telegramChannelLink: isPublicFreeChannel ? telegramChannelLink : undefined,
    telegramConfigured,
    likedByCurrentUser,
    currentUserRating
  };
}

// List Novels with filters and search
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { q, category, filter, sort, includeUnpublished } = req.query as {
      q?: string;
      category?: string;
      filter?: string;
      sort?: string;
      includeUnpublished?: string;
    };
    const isAdmin = req.user?.role === 'admin';
    const allNovels = await db.getNovels();
    let novels = allNovels.filter(n => n.isPublished || (isAdmin && includeUnpublished === 'true'));

    // Search by novel name, hindi title, author, category, or tags
    if (q && q.trim()) {
      const term = q.trim().toLowerCase();
      novels = novels.filter(n =>
        n.title.toLowerCase().includes(term) ||
        (n.hindiTitle && n.hindiTitle.toLowerCase().includes(term)) ||
        n.author.toLowerCase().includes(term) ||
        n.categories.some(c => c.toLowerCase().includes(term)) ||
        n.tags.some(t => t.toLowerCase().includes(term))
      );
    }

    // Category filter
    if (category && category !== 'All' && category !== 'सभी') {
      novels = novels.filter(n =>
        n.categories.some(c => c.toLowerCase() === category.toLowerCase())
      );
    }

    // Type Filter
    if (filter === 'free') {
      novels = novels.filter(n => !n.isPremium);
    } else if (filter === 'premium') {
      novels = novels.filter(n => n.isPremium);
    } else if (filter === 'featured') {
      novels = novels.filter(n => n.isFeatured);
    } else if (filter === 'trending') {
      novels = novels.filter(n => n.isTrending);
    } else if (filter === 'popular') {
      novels = novels.filter(n => n.isPopular);
    }

    // Sorting
    if (sort === 'popular') {
      novels.sort((a, b) => b.rating - a.rating || b.views - a.views);
    } else if (sort === 'rating') {
      novels.sort((a, b) => b.rating - a.rating);
    } else if (sort === 'oldest') {
      novels.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else {
      // Default newest/recently updated
      novels.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    const safeNovels = novels.map(n => sanitizeNovelForResponse(n, req.user));

    return res.json({
      total: safeNovels.length,
      novels: safeNovels
    });
  } catch (err) {
    console.error('List novels error:', err);
    return res.status(500).json({ error: 'उपन्यास लोड करने में त्रुटि' });
  }
});

// External URL Regex to prevent spam and link sharing in comments and support
export const EXTERNAL_URL_REGEX = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|whatsapp\.com|bit\.ly|tinyurl\.com|\b[a-zA-Z0-9-]+\.(com|in|net|org|xyz|io|co|top|site|club|vip|online|me|app|link|cc|to|tv|dev|info|biz|ru|cn|tk|ga|cf|ml|gq)\b)/i;

export function isUserVipActive(user?: any): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (!user.membership?.isActive) return false;
  if (!user.membership?.expiresAt) return true; // Lifetime or active
  const expiry = new Date(user.membership.expiresAt).getTime();
  if (isNaN(expiry) || expiry <= Date.now()) return false;
  return true;
}

// Single Novel Details + Chapter listing
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const novel = await db.getNovelById(req.params.id);
    if (!novel) {
      return res.status(404).json({ error: 'उपन्यास नहीं मिला (Novel not found)' });
    }

    // Only admin can view unpublished novels
    if (!novel.isPublished && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'उपन्यास अभी प्रकाशित नहीं हुआ है (Novel unpublished)' });
    }

    const allChapters = await db.getChapters(novel.id);
    const visibleChapters = req.user?.role === 'admin' 
      ? allChapters 
      : allChapters.filter(c => c.isPublished);

    const isVipUser = req.user ? isUserVipActive(req.user) : false;
    const isAdmin = req.user?.role === 'admin';

    const safeChapters = visibleChapters.map(c => {
      const isChapterVip = Boolean(c.isPremium || c.telegramAudioAccessType === 'premium');
      const canAccessAudioLink = !isChapterVip || isVipUser || isAdmin;

      return {
        id: c.id,
        novelId: c.novelId,
        chapterNumber: c.chapterNumber,
        title: c.title,
        isPremium: c.isPremium,
        isPublished: c.isPublished,
        telegramAudioConfigured: Boolean(c.telegramAudioConfigured || c.telegramMessageLink),
        telegramAudioAccessType: c.telegramAudioAccessType || (c.isPremium ? 'premium' : 'free'),
        telegramDestinationType: c.telegramDestinationType || 'channel',
        // Redact Telegram Message Link if chapter is VIP and user is not active VIP or admin
        telegramMessageLink: canAccessAudioLink ? c.telegramMessageLink : undefined,
        telegramMessageId: canAccessAudioLink ? c.telegramMessageId : undefined,
        telegramChatId: isAdmin ? c.telegramChatId : undefined,
        createdAt: c.createdAt
      };
    });

    // Increment view count asynchronously
    novel.views = (novel.views || 0) + 1;
    await db.updateNovel(novel.id, { views: novel.views });

    return res.json({
      novel: sanitizeNovelForResponse(novel, req.user),
      chapters: safeChapters
    });
  } catch (err) {
    console.error('Get novel error:', err);
    return res.status(500).json({ error: 'उपन्यास विवरण लोड करने में त्रुटि' });
  }
});

// Chapter Content & Reader endpoint (Secured with VIP Authorization)
router.get('/:novelId/chapters/:chapterId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { novelId, chapterId } = req.params;
    const novel = await db.getNovelById(novelId);
    if (!novel) {
      return res.status(404).json({ error: 'उपन्यास नहीं मिला' });
    }

    const chapter = await db.getChapterById(chapterId);
    if (!chapter || chapter.novelId !== novelId) {
      return res.status(404).json({ error: 'अध्याय नहीं मिला' });
    }

    if (!chapter.isPublished && req.user?.role !== 'admin') {
      return res.status(404).json({ error: 'अध्याय अभी प्रकाशित नहीं हुआ है' });
    }

    // Fetch fresh user to check current membership expiry
    const user = req.user ? ((await db.getUserById(req.user.id)) || req.user) : null;
    const isAdmin = user?.role === 'admin';
    const isVip = isUserVipActive(user);
    const isChapterVip = Boolean(chapter.isPremium || chapter.telegramAudioAccessType === 'premium');

    // If chapter is NOT premium, anyone can access (free access without login)
    if (!chapter.isPremium) {
      return res.json({
        chapter: {
          ...chapter,
          telegramAudioConfigured: Boolean(chapter.telegramAudioConfigured || chapter.telegramMessageLink),
          telegramAudioAccessType: chapter.telegramAudioAccessType || 'free',
          telegramMessageLink: (!isChapterVip || isVip || isAdmin) ? chapter.telegramMessageLink : undefined,
          telegramMessageId: (!isChapterVip || isVip || isAdmin) ? chapter.telegramMessageId : undefined,
          isLocked: false
        },
        isLocked: false,
        userAccess: {
          isVip,
          isAdmin
        }
      });
    }

    // Chapter is Premium: Check VIP permission
    if (isAdmin || isVip) {
      return res.json({
        chapter: {
          ...chapter,
          telegramAudioConfigured: Boolean(chapter.telegramAudioConfigured || chapter.telegramMessageLink),
          telegramAudioAccessType: chapter.telegramAudioAccessType || 'premium',
          isLocked: false
        },
        isLocked: false,
        userAccess: {
          isVip: true,
          isAdmin
        }
      });
    }

    // User is not VIP: Return locked response with content and telegram link redacted
    return res.json({
      chapter: {
        id: chapter.id,
        novelId: chapter.novelId,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        content: '',
        telegramMessageLink: undefined,
        telegramMessageId: undefined,
        telegramAudioConfigured: Boolean(chapter.telegramAudioConfigured || chapter.telegramMessageLink),
        telegramAudioAccessType: chapter.telegramAudioAccessType || 'premium',
        isPremium: true,
        createdAt: chapter.createdAt,
        isLocked: true
      },
      isLocked: true,
      lockReason: !user 
        ? 'प्रीमियम अध्याय: Telegram ऑडियो सुनने के लिए कृपया पहले लॉगिन करें (Login required to access VIP chapter)' 
        : 'प्रीमियम अध्याय: इसे अनलॉक करने के लिए सक्रिय VIP सदस्यता आवश्यक है (Active VIP Membership required)',
      userAccess: {
        isVip: false,
        isAdmin: false
      }
    });
  } catch (err) {
    console.error('Get chapter error:', err);
    return res.status(500).json({ error: 'अध्याय लोड करने में त्रुटि' });
  }
});

// Like / Unlike a Novel
router.post('/:id/like', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const novel = await db.getNovelById(req.params.id);
    if (!novel) {
      return res.status(404).json({ error: 'उपन्यास नहीं मिला (Novel not found)' });
    }

    const userId = req.user?.id || req.ip || 'guest';
    const likedBy = Array.isArray(novel.likedBy) ? [...novel.likedBy] : [];
    const currentLikes = typeof novel.likes === 'number' ? novel.likes : 0;

    const idx = likedBy.indexOf(userId);
    let liked = false;
    let newLikes = currentLikes;

    if (idx === -1) {
      likedBy.push(userId);
      newLikes = currentLikes + 1;
      liked = true;
    } else {
      likedBy.splice(idx, 1);
      newLikes = Math.max(0, currentLikes - 1);
      liked = false;
    }

    await db.updateNovel(novel.id, { likes: newLikes, likedBy });

    return res.json({
      likes: newLikes,
      liked
    });
  } catch (err) {
    console.error('Like novel error:', err);
    return res.status(500).json({ error: 'लाइक अपडेट में त्रुटि' });
  }
});

// Rate a Novel (1 to 5 stars, one active rating per user, updatable)
router.post('/:id/rate', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const novel = await db.getNovelById(req.params.id);
    if (!novel) {
      return res.status(404).json({ error: 'उपन्यास नहीं मिला (Novel not found)' });
    }

    const score = Number(req.body?.rating);
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ error: 'कृपया 1 से 5 के बीच रेटिंग दें (Rating must be 1-5)' });
    }

    const userKey = req.user?.id || req.ip || 'guest';
    const userRatings: Record<string, number> = { ...(novel.userRatings || {}) };
    userRatings[userKey] = score;

    const allScores = Object.values(userRatings);
    const newCount = allScores.length;
    const sum = allScores.reduce((acc, val) => acc + val, 0);
    const newRating = Number((sum / newCount).toFixed(1));

    await db.updateNovel(novel.id, {
      rating: newRating,
      ratingCount: newCount,
      userRatings
    });

    return res.json({
      rating: newRating,
      ratingCount: newCount,
      userRating: score
    });
  } catch (err) {
    console.error('Rate novel error:', err);
    return res.status(500).json({ error: 'रेटिंग अपडेट में त्रुटि' });
  }
});

// Add a Review to a Novel
router.post('/:id/reviews', optionalAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'समीक्षा लिखने के लिए कृपया लॉगिन करें (Please log in to write a review)' });
    }

    const novel = await db.getNovelById(req.params.id);
    if (!novel) {
      return res.status(404).json({ error: 'उपन्यास नहीं मिला (Novel not found)' });
    }

    const comment = (req.body?.comment || '').trim();
    const score = Number(req.body?.rating) || 5;

    if (!comment || comment.length < 3) {
      return res.status(400).json({ error: 'कृपया कम से कम 3 अक्षरों की समीक्षा लिखें' });
    }

    // Check external links prohibition
    if (req.user.role !== 'admin' && EXTERNAL_URL_REGEX.test(comment)) {
      return res.status(400).json({ 
        error: 'समीक्षा में बाहरी लिंक, वेबसाइट या टेलीग्राम/व्हाट्सएप लिंक साझा करना सख्त मना है (External links and URLs are prohibited)' 
      });
    }


    if (score < 1 || score > 5) {
      return res.status(400).json({ error: 'रेटिंग 1 से 5 के बीच होनी चाहिए' });
    }

    const fullUser = await db.getUserById(req.user.id);
    const userName = fullUser?.name || req.user.email.split('@')[0];

    const reviews = Array.isArray(novel.reviews) ? [...novel.reviews] : [];
    const newReview = {
      id: `rev_${Date.now()}`,
      userId: req.user.id,
      userName,
      rating: score,
      comment,
      createdAt: new Date().toISOString()
    };

    reviews.unshift(newReview);

    // Also update user's rating
    const userRatings: Record<string, number> = { ...(novel.userRatings || {}) };
    userRatings[req.user.id] = score;
    const allScores = Object.values(userRatings);
    const newCount = allScores.length;
    const newRating = Number((allScores.reduce((a, b) => a + b, 0) / newCount).toFixed(1));

    await db.updateNovel(novel.id, {
      reviews,
      rating: newRating,
      ratingCount: newCount,
      userRatings
    });

    return res.status(201).json({
      review: newReview,
      reviews,
      rating: newRating,
      ratingCount: newCount
    });
  } catch (err) {
    console.error('Add review error:', err);
    return res.status(500).json({ error: 'समीक्षा दर्ज करने में त्रुटि' });
  }
});

export default router;
