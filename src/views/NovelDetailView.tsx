import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Crown, 
  Star, 
  Eye, 
  Bookmark, 
  BookmarkCheck, 
  Headphones, 
  Play, 
  Layers, 
  Sparkles,
  Lock,
  Unlock,
  Heart,
  Send,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Novel, Chapter } from '../types.js';
import { useAuth } from '../context/AuthContext.js';

interface NovelDetailViewProps {
  novelId: string;
  onBack: () => void;
  onNavigate: (view: string, params?: any) => void;
}

export const NovelDetailView: React.FC<NovelDetailViewProps> = ({
  novelId,
  onBack,
  onNavigate
}) => {
  const { user, token, isVip, toggleBookmark } = useAuth();
  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setLoading(true);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`/api/novels/${novelId}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('उपन्यास लोड नहीं हो सका');
        return res.json();
      })
      .then((data) => {
        setNovel(data.novel);
        setChapters(data.chapters || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [novelId, token]);

  useEffect(() => {
    if (user?.bookmarks && novelId) {
      setIsBookmarked(user.bookmarks.includes(novelId));
    }
  }, [user, novelId]);

  const handleBookmarkToggle = async () => {
    const updated = await toggleBookmark(novelId);
    setIsBookmarked(updated);
  };

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [userRating, setUserRating] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Telegram Integration State
  const [telegramModalOpen, setTelegramModalOpen] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramInviteLink, setTelegramInviteLink] = useState<string | null>(null);
  const [telegramExpiresAt, setTelegramExpiresAt] = useState<number | null>(null);
  const [telegramChannelName, setTelegramChannelName] = useState<string | null>(null);
  const [telegramChannelType, setTelegramChannelType] = useState<'public' | 'private'>('private');
  const [telegramRequiresApproval, setTelegramRequiresApproval] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [linkCodeModalOpen, setLinkCodeModalOpen] = useState(false);
  const [linkCodeData, setLinkCodeData] = useState<{
    code: string;
    botUsername: string;
    deepLink: string;
    expiresAt: number;
  } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [vipRequiredModal, setVipRequiredModal] = useState(false);
  const [telegramNotConfiguredModalOpen, setTelegramNotConfiguredModalOpen] = useState(false);

  // Chapter Audio State
  const [chapterAudioLoadingId, setChapterAudioLoadingId] = useState<string | null>(null);
  const [chapterAudioModalOpen, setChapterAudioModalOpen] = useState(false);
  const [activeChapterAudio, setActiveChapterAudio] = useState<{
    chapterId: string;
    chapterNumber: number;
    title: string;
    link: string;
    isVip: boolean;
  } | null>(null);

  const handlePlayChapterAudio = async (chapter: Chapter) => {
    const isChapterVip = Boolean(chapter.isPremium || chapter.telegramAudioAccessType === 'premium');
    const hasVipAccess = isVip || user?.role === 'admin';

    // 1. VIP gate check
    if (isChapterVip && !hasVipAccess) {
      setVipRequiredModal(true);
      return;
    }

    // 2. Direct fast path if link is present on chapter object
    if (chapter.telegramMessageLink) {
      window.open(chapter.telegramMessageLink, '_blank', 'noopener,noreferrer');
      setActiveChapterAudio({
        chapterId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: chapter.title,
        link: chapter.telegramMessageLink,
        isVip: isChapterVip,
      });
      setChapterAudioModalOpen(true);
      return;
    }

    // 3. Secure backend verification and link retrieval
    setChapterAudioLoadingId(chapter.id);
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`/api/telegram/chapters/${chapter.id}/audio`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'VIP_REQUIRED') {
          setVipRequiredModal(true);
          return;
        }
        if (data.code === 'LOGIN_REQUIRED') {
          alert('यह VIP अध्याय है। Telegram ऑडियो सुनने के लिए कृपया पहले लॉगिन करें।');
          return;
        }
        alert(data.error || 'इस अध्याय के लिए Telegram ऑडियो लिंक अभी उपलब्ध नहीं है।');
        return;
      }

      if (data.telegramMessageLink) {
        window.open(data.telegramMessageLink, '_blank', 'noopener,noreferrer');
        setActiveChapterAudio({
          chapterId: chapter.id,
          chapterNumber: chapter.chapterNumber,
          title: chapter.title,
          link: data.telegramMessageLink,
          isVip: isChapterVip,
        });
        setChapterAudioModalOpen(true);
      } else {
        alert('इस अध्याय के लिए Telegram ऑडियो लिंक अभी कॉन्फ़िगर नहीं किया गया है।');
      }
    } catch (err: any) {
      alert(err.message || 'नेटवर्क समस्या के कारण Telegram ऑडियो लिंक लोड नहीं हो सका।');
    } finally {
      setChapterAudioLoadingId(null);
    }
  };

  const handleOpenTelegram = async () => {
    if (!token || !user) {
      alert('कृपया Telegram चैनल से जुड़ने के लिए पहले लॉगिन करें (Please Login to access Telegram Channel)');
      return;
    }

    const hasGroupConfigured = Boolean(
      novel?.telegramConfigured ||
      (novel?.telegramIntegrationEnabled && (novel?.telegramChannelLink || novel?.telegramChannelId))
    );

    if (!hasGroupConfigured) {
      setTelegramNotConfiguredModalOpen(true);
      return;
    }

    setTelegramLoading(true);
    setTelegramError(null);

    const isChannelVip = novel?.telegramAccessType === 'premium' || novel?.isPremium;
    const hasVipAccess = isVip || user.role === 'admin';

    // 1. Check VIP requirement upfront
    if (isChannelVip && !hasVipAccess) {
      setVipRequiredModal(true);
      setTelegramLoading(false);
      return;
    }

    try {
      // 2. Request channel access from API (handles both public direct and private single-use invites)
      const joinRes = await fetch(`/api/telegram/novels/${novelId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const joinData = await joinRes.json();

      if (!joinRes.ok) {
        if (joinData.code === 'TELEGRAM_GROUP_NOT_CONFIGURED' || joinData.code === 'NOT_CONFIGURED') {
          setTelegramNotConfiguredModalOpen(true);
          setTelegramLoading(false);
          return;
        }

        if (joinData.code === 'TELEGRAM_NOT_LINKED') {
          // User needs to link their Telegram account first for private channel
          const codeRes = await fetch('/api/telegram/link-code', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const codeData = await codeRes.json();
          if (codeData.ok) {
            setLinkCodeData(codeData);
            setLinkCodeModalOpen(true);
          } else {
            setTelegramError(codeData.error || 'लिंकिंग कोड जनरेट करने में त्रुटि');
            setTelegramModalOpen(true);
          }
          setTelegramLoading(false);
          return;
        }

        if (joinData.code === 'VIP_REQUIRED') {
          setVipRequiredModal(true);
          setTelegramLoading(false);
          return;
        }

        setTelegramError(joinData.error || 'चैनल लोड करने में विफलता');
        setTelegramModalOpen(true);
        setTelegramLoading(false);
        return;
      }

      // 3. Handle successful response
      if (joinData.channelType === 'public' && joinData.channelLink) {
        setTelegramChannelType('public');
        setTelegramRequiresApproval(false);
        setTelegramInviteLink(joinData.channelLink);
        setTelegramChannelName(joinData.channelName || novel?.title || 'Crazy Storyes');
        setTelegramModalOpen(true);
      } else if (joinData.inviteLink) {
        setTelegramChannelType('private');
        setTelegramRequiresApproval(Boolean(joinData.requiresApproval ?? true));
        setTelegramInviteLink(joinData.inviteLink);
        setTelegramExpiresAt(joinData.expiresAt);
        setTelegramChannelName(joinData.channelName || novel?.title || 'Crazy Storyes');
        setTelegramModalOpen(true);
      }
    } catch (err: any) {
      setTelegramError(err.message || 'नेटवर्क समस्या के कारण अनुरोध विफल रहा');
      setTelegramModalOpen(true);
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleCopyInvite = () => {
    if (!telegramInviteLink) return;
    navigator.clipboard.writeText(telegramInviteLink);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2500);
  };

  useEffect(() => {
    if (novel) {
      setLikesCount(novel.likes || 0);
      setLiked(Boolean(novel.likedByCurrentUser || (user?.id && novel.likedBy?.includes(user.id))));
      if (typeof novel.currentUserRating === 'number') {
        setUserRating(novel.currentUserRating);
      }
    }
  }, [novel, user?.id]);

  const handleLike = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/novels/${novelId}/like`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setLiked(data.liked);
        setLikesCount(data.likes);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleRate = async (score: number) => {
    if (ratingSubmitting) return;
    setRatingSubmitting(true);
    setUserRating(score);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/novels/${novelId}/rate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ rating: score })
      });
      const data = await res.json();
      if (res.ok && novel) {
        setNovel({ ...novel, rating: data.rating, ratingCount: data.ratingCount });
      }
    } catch (err) {
      console.error('Rate error:', err);
    } finally {
      setRatingSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-purple-300">उपन्यास लोड हो रहा है...</p>
      </div>
    );
  }

  if (error || !novel) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-red-400 font-bold">{error || 'उपन्यास नहीं मिला'}</p>
        <button
          onClick={onBack}
          className="btn-3d btn-3d-subtle px-5 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> वापस जाएं
        </button>
      </div>
    );
  }

  const firstChapter = chapters[0];

  return (
    <div className="space-y-8 pb-16">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="btn-3d btn-3d-subtle px-4 py-2 rounded-xl text-xs font-bold text-purple-200 flex items-center gap-2 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>पीछे जाएं (Back to Novels)</span>
      </button>

      {/* Hero Showcase with 16:9 Banner */}
      <div className="rounded-3xl bg-gradient-to-b from-[#190933] to-[#0d0419] border border-purple-500/30 p-6 lg:p-8 shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 16:9 Image Showcase */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border-2 border-purple-500/50 shadow-2xl bg-black">
              <img
                src={novel.coverImage}
                alt={novel.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                {novel.isPremium ? (
                  <div className="vip-badge-3d px-2.5 py-1 rounded-full text-xs font-black text-amber-950 flex items-center gap-1.5 shadow-md">
                    <img
                      src="/assets/aistudio/photo_2026-11-04_13-38-45_aa9b961d.jpg"
                      alt="VIP"
                      className="w-4 h-4 rounded-full object-cover border border-amber-950/40"
                    />
                    <span>VIP EXCLUSIVE</span>
                  </div>
                ) : (
                  <div className="free-badge-3d px-3 py-1 rounded-full text-xs font-bold text-white shadow-md">
                    <span>100% FREE</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md border border-purple-500/30 text-[11px] font-mono text-purple-300">
                16:9 HD Cover
              </div>
            </div>

            {/* Quick Action Buttons Below Image */}
            <div className="w-full grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleBookmarkToggle}
                className={`btn-3d py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${
                  isBookmarked
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'btn-3d-subtle text-purple-200'
                }`}
              >
                {isBookmarked ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-amber-300" />
                    <span>बुकमार्क किया गया</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4 text-purple-400" />
                    <span>बुकमार्क करें</span>
                  </>
                )}
              </button>

              <button
                onClick={() => onNavigate('ai', { novelId: novel.id })}
                className="btn-3d btn-3d-subtle py-2.5 rounded-xl text-xs font-bold text-pink-300 hover:text-pink-200 flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4 text-pink-400" />
                <span>Crazy AI से पूछें</span>
              </button>
            </div>
          </div>

          {/* Details Column */}
          <div className="lg:col-span-7 space-y-4">
            {/* Categories */}
            <div className="flex flex-wrap items-center gap-2">
              {novel.categories.map((cat) => (
                <span
                  key={cat}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-900/50 text-purple-200 border border-purple-500/30"
                >
                  {cat}
                </span>
              ))}
              {novel.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-950 text-purple-400/80 border border-purple-800/30"
                >
                  #{tag}
                </span>
              ))}
            </div>

            {/* Title (Single language only) */}
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                <span className="text-3d-title">
                  {novel.title || novel.hindiTitle}
                </span>
              </h1>
            </div>

            {/* Stats (Author completely removed) */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-purple-300 pt-1">
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> {novel.rating.toFixed(1)}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3.5 h-3.5" /> {(novel.views / 1000).toFixed(1)}k व्यूज
              </span>
              <span>•</span>
              <span>📖 {chapters.length} कुल अध्याय</span>
            </div>

            {/* Like & Rate Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleLike}
                className={`btn-3d px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  liked
                    ? 'bg-pink-600/40 border-pink-400 text-pink-200'
                    : 'btn-3d-subtle text-purple-200 hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-pink-400 text-pink-400' : 'text-pink-400'}`} />
                <span>पसंद करें ({likesCount})</span>
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/50 border border-purple-500/20 text-xs">
                <span className="text-purple-300 font-semibold mr-1">रेटिंग दें:</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={ratingSubmitting}
                    onClick={() => handleRate(star)}
                    className="hover:scale-125 transition-transform"
                    title={`${star} स्टार`}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        star <= (userRating || Math.round(novel.rating))
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-purple-500/50'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                कथा सार (Synopsis)
              </h3>
              <p className="text-xs sm:text-sm text-purple-200/90 leading-relaxed whitespace-pre-line bg-purple-950/30 p-4 rounded-2xl border border-purple-500/20">
                {novel.description}
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              {/* Telegram Voice Channel Button (Primary Voice Action) */}
              {(!novel.telegramConfigured && (!novel.telegramIntegrationEnabled || (!novel.telegramChannelLink && !novel.telegramChannelId))) ? (
                <button
                  type="button"
                  onClick={handleOpenTelegram}
                  className="btn-3d btn-3d-subtle px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-purple-300 border border-purple-500/30 flex items-center gap-2 hover:scale-105 transition-all"
                  title="इस उपन्यास का Telegram ग्रुप जल्द उपलब्ध कराया जाएगा"
                >
                  <Send className="w-4 h-4 text-purple-400" />
                  <span>🚀 Telegram चैनल (जल्द आ रहा है)</span>
                  <span className="text-[10px] font-mono bg-purple-900/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/40">
                    SOON
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleOpenTelegram}
                  disabled={telegramLoading}
                  className="btn-3d bg-gradient-to-r from-[#229ED9] via-[#0088cc] to-[#1769aa] hover:from-[#29b6f6] hover:to-[#0288d1] text-white px-7 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 shadow-xl border border-sky-400/40 hover:scale-105 transition-all disabled:opacity-50"
                >
                  <Send className="w-4 h-4 text-white" />
                  <span>
                    {telegramLoading ? 'लोड हो रहा है...' : '🚀 Telegram पर सुनें (Listen on Telegram)'}
                  </span>
                  {(novel.telegramAccessType === 'premium' || novel.isPremium) ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-amber-400 text-amber-950 ml-1">
                      VIP
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-500/30 text-emerald-300 ml-1">
                      FREE
                    </span>
                  )}
                </button>
              )}

              {firstChapter && (
                <button
                  onClick={() => handlePlayChapterAudio(firstChapter)}
                  className="btn-3d btn-3d-subtle px-5 py-3 rounded-xl font-bold text-xs sm:text-sm text-purple-200 border border-purple-500/30 flex items-center gap-2 shadow-lg hover:scale-105 transition-all"
                >
                  <Headphones className="w-4 h-4 text-purple-300" />
                  <span>पहला अध्याय सुनें (Listen First Chapter)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chapter List Section */}
      <div className="rounded-3xl bg-[#120726] border border-purple-500/20 p-6 lg:p-8 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-purple-900/40">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Headphones className="w-6 h-6 text-purple-400" />
              <span>ऑडियो अध्याय सूची (Audio Chapters)</span>
            </h2>
            <p className="text-xs text-purple-300/80 mt-0.5">
              कुल {chapters.length} ऑडियो अध्याय उपलब्ध हैं
            </p>
          </div>

          {!isVip && novel.isPremium && (
            <button
              onClick={() => onNavigate('premium')}
              className="btn-3d btn-3d-gold px-4 py-2 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>वीआईपी अनलॉक करें</span>
            </button>
          )}
        </div>

        {/* Chapters Grid / List */}
        <div className="grid grid-cols-1 gap-3 pt-2">
          {chapters.map((chapter) => {
            const isChapterVip = Boolean(chapter.isPremium || chapter.telegramAudioAccessType === 'premium');
            const hasVipAccess = isVip || user?.role === 'admin';
            const isAudioLoading = chapterAudioLoadingId === chapter.id;

            return (
              <div
                key={chapter.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                  isChapterVip
                    ? 'bg-gradient-to-r from-purple-950/70 to-[#1e0e33] border-amber-500/30 hover:border-amber-400/60'
                    : 'bg-purple-950/40 border-purple-500/20 hover:border-purple-400/50 hover:bg-purple-900/40'
                }`}
              >
                {/* Chapter Info */}
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                      isChapterVip
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)]'
                        : 'bg-purple-900/60 text-purple-300 border border-purple-500/30'
                    }`}
                  >
                    #{chapter.chapterNumber}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm sm:text-base font-bold text-white group-hover:text-purple-200 transition-colors line-clamp-1">
                      {chapter.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-purple-400">
                      <span className="flex items-center gap-1 text-purple-300 font-medium">
                        <Headphones className="w-3.5 h-3.5 text-sky-400" />
                        <span>Telegram Audio</span>
                      </span>
                      <span>•</span>
                      <span>
                        {isChapterVip ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                            <Crown className="w-3 h-3" /> VIP Audio
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                            FREE Audio
                          </span>
                        )}
                      </span>
                      {chapter.audioDurationSeconds ? (
                        <>
                          <span>•</span>
                          <span className="text-purple-300/70">
                            {Math.floor(chapter.audioDurationSeconds / 60)}m {chapter.audioDurationSeconds % 60}s
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Chapter Action Buttons: Telegram Audio + Read Text */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto w-full md:w-auto">
                  {/* Dedicated Telegram Audio Button */}
                  {isChapterVip && !hasVipAccess ? (
                    <button
                      type="button"
                      onClick={() => setVipRequiredModal(true)}
                      className="btn-3d flex-1 md:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 flex items-center justify-center gap-1.5 shadow-md hover:scale-105 transition-all"
                      title="इस VIP अध्याय का Telegram ऑडियो अनलॉक करने के लिए सदस्यता अपग्रेड करें"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>UNLOCK VIP AUDIO</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isAudioLoading}
                      onClick={() => handlePlayChapterAudio(chapter)}
                      className={`btn-3d flex-1 md:flex-none px-3.5 py-2.5 rounded-xl font-black text-xs text-white flex items-center justify-center gap-1.5 shadow-md hover:scale-105 transition-all ${
                        isChapterVip
                          ? 'bg-gradient-to-r from-amber-600 via-amber-500 to-purple-600 hover:from-amber-500 hover:to-purple-500 border border-amber-400/40'
                          : 'bg-gradient-to-r from-[#229ED9] to-[#0088cc] hover:from-[#29b6f6] hover:to-[#0288d1] border border-sky-400/40'
                      }`}
                      title="Telegram पर इस अध्याय का वॉइस/ऑडियो सुनें"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isAudioLoading ? 'खुल रहा है...' : isChapterVip ? 'LISTEN ON TELEGRAM' : 'LISTEN FREE ON TELEGRAM'}
                      </span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reviews & Ratings Section */}
      <div className="rounded-3xl bg-gradient-to-b from-[#16082c] to-[#0c0419] border border-purple-500/30 p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-900/40 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              पाठक समीक्षाएं और रेटिंग (Reviews & Ratings)
            </h2>
            <p className="text-xs text-purple-300/80">
              औसत रेटिंग: <strong className="text-amber-400">★ {novel.rating.toFixed(1)}</strong> ({novel.ratingCount || 1} रेटिंग्स • {novel.reviews?.length || 0} समीक्षाएं)
            </p>
          </div>
        </div>

        {/* Write a Review Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setReviewError(null);
            if (!token) {
              setReviewError('समीक्षा लिखने के लिए कृपया पहले लॉगिन करें।');
              return;
            }
            const commentClean = reviewComment.trim();
            if (!commentClean || commentClean.length < 3) {
              setReviewError('कृपया कम से कम 3 अक्षरों की समीक्षा लिखें।');
              return;
            }

            const EXTERNAL_URL_REGEX = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|whatsapp\.com|bit\.ly|tinyurl\.com|\b[a-zA-Z0-9-]+\.(com|in|net|org|xyz|io|co|top|site|club|vip|online|me|app|link|cc|to|tv|dev|info|biz|ru|cn|tk|ga|cf|ml|gq)\b)/i;
            if (user?.role !== 'admin' && EXTERNAL_URL_REGEX.test(commentClean)) {
              setReviewError('समीक्षा में बाहरी लिंक, वेबसाइट या टेलीग्राम/व्हाट्सएप लिंक साझा करना सख्त मना है।');
              return;
            }

            setReviewSubmitting(true);
            try {
              const res = await fetch(`/api/novels/${novelId}/reviews`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                  rating: userRating || 5,
                  comment: reviewComment.trim()
                })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'समीक्षा सहेजने में त्रुटि');
              setNovel({
                ...novel,
                reviews: data.reviews,
                rating: data.rating,
                ratingCount: data.ratingCount
              });
              setReviewComment('');
            } catch (err: any) {
              setReviewError(err.message);
            } finally {
              setReviewSubmitting(false);
            }
          }}
          className="space-y-3 p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-200">अपनी समीक्षा लिखें (Write a Review):</span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setUserRating(s)}
                  className="hover:scale-110 transition"
                >
                  <Star
                    className={`w-4 h-4 ${
                      s <= (userRating || 5) ? 'fill-amber-400 text-amber-400' : 'text-purple-500/50'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {reviewError && (
            <p className="text-xs text-red-300 bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30">
              {reviewError}
            </p>
          )}

          <textarea
            rows={2}
            placeholder="इस उपन्यास के बारे में अपने विचार लिखें..."
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-white placeholder-purple-400/50 text-xs focus:outline-none focus:border-purple-400"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={reviewSubmitting}
              className="btn-3d btn-3d-primary px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50"
            >
              {reviewSubmitting ? 'भेजा जा रहा है...' : 'समीक्षा सबमिट करें (Submit Review)'}
            </button>
          </div>
        </form>

        {/* Reviews List */}
        {novel.reviews && novel.reviews.length > 0 ? (
          <div className="space-y-3">
            {novel.reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/20 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{rev.userName}</span>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{rev.rating}.0</span>
                  </div>
                </div>
                <p className="text-xs text-purple-200/90 leading-relaxed">{rev.comment}</p>
                <span className="text-[10px] text-purple-400/70 block">
                  {new Date(rev.createdAt).toLocaleDateString('hi-IN')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-purple-300/70 text-center py-4">
            अभी तक कोई समीक्षा नहीं है। सबसे पहले समीक्षा लिखें!
          </p>
        )}
      </div>

      {/* MODAL 1: TELEGRAM ACCOUNT LINKING MODAL */}
      {linkCodeModalOpen && linkCodeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#190933] to-[#0e041c] border-2 border-[#229ED9]/50 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#229ED9]/20 border border-[#229ED9]/40 flex items-center justify-center text-[#229ED9] shadow-lg">
              <Send className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">
                Telegram खाता लिंक करें
              </h3>
              <p className="text-xs text-purple-300/80 mt-1">
                ऑडियो उपन्यास डाउनलोड व सुनने के लिए अपने खाते को <strong>@{linkCodeData.botUsername}</strong> से जोड़ें।
              </p>
            </div>

            {/* Code Box */}
            <div className="p-4 rounded-2xl bg-purple-950/70 border border-purple-500/30 space-y-1">
              <span className="text-[11px] font-mono text-purple-400 uppercase tracking-wider block">
                आपका वन-टाइम लिंकिंग कोड (15 मिनट वैध)
              </span>
              <div className="text-2xl font-mono font-black text-amber-400 tracking-widest">
                {linkCodeData.code}
              </div>
            </div>

            {/* Direct Connect Button */}
            <a
              href={linkCodeData.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-3d w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#229ED9] to-[#0088cc] flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform"
            >
              <Send className="w-4 h-4" />
              <span>1-क्लिक Telegram बॉट में जोड़ें (Connect Bot)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setLinkCodeModalOpen(false)}
                className="btn-3d btn-3d-subtle w-1/2 py-2.5 rounded-xl text-xs font-bold text-purple-300"
              >
                रद्द करें
              </button>

              <button
                type="button"
                onClick={() => {
                  setLinkCodeModalOpen(false);
                  handleOpenTelegram();
                }}
                className="btn-3d btn-3d-gold w-1/2 py-2.5 rounded-xl text-xs font-black text-amber-950 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>मैं लिंक कर चुका हूँ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VIP REQUIRED MODAL */}
      {vipRequiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#210c3d] to-[#0d0419] border-2 border-amber-500/50 p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
              <Crown className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white">
                VIP सदस्यता आवश्यक है
              </h3>
              <p className="text-xs text-purple-300/80 mt-1">
                यह उपन्यास एक विशेष <strong>VIP ऑडियो उपन्यास</strong> है। इस चैनल का एक्सेस केवल VIP सदस्यों के लिए उपलब्ध है।
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-200/90 text-left space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-300">
                <span>👑</span> VIP सदस्यता लाभ:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-200/80 pl-1">
                <li>सभी VIP ऑडियो उपन्यासों के Telegram चैनल्स का असीमित एक्सेस</li>
                <li>हाई-स्पीड डायरेक्ट ऑडियो डाउनलोड बिना किसी विज्ञापन के</li>
                <li>सभी नए एपिसोड्स सबसे पहले</li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVipRequiredModal(false)}
                className="btn-3d btn-3d-subtle w-1/3 py-2.5 rounded-xl text-xs font-bold text-purple-300"
              >
                बंद करें
              </button>

              <button
                type="button"
                onClick={() => {
                  setVipRequiredModal(false);
                  onNavigate('premium');
                }}
                className="btn-3d btn-3d-gold w-2/3 py-2.5 rounded-xl text-xs font-black text-amber-950 flex items-center justify-center gap-1.5 shadow-md"
              >
                <Crown className="w-4 h-4" />
                <span>👑 VIP प्लान देखें (Upgrade Now)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: TELEGRAM INVITE LINK SUCCESS / ERROR MODAL */}
      {telegramModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#180933] to-[#0d0419] border-2 border-purple-500/40 p-6 shadow-2xl text-center space-y-4">
            {telegramError ? (
              <>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-lg">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    चैनल जॉइन नहीं हो सका
                  </h3>
                  <p className="text-xs text-red-300 mt-2 p-3 rounded-xl bg-red-950/50 border border-red-500/30">
                    {telegramError}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTelegramModalOpen(false)}
                  className="btn-3d btn-3d-subtle w-full py-2.5 rounded-xl text-xs font-bold text-purple-200"
                >
                  बंद करें
                </button>
              </>
            ) : telegramInviteLink ? (
              <>
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#229ED9]/20 border border-[#229ED9]/40 flex items-center justify-center text-[#229ED9] shadow-lg animate-bounce">
                  <Send className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-black text-white">
                    {telegramChannelType === 'private'
                      ? 'व्यक्तिगत Private आमंत्रण लिंक तैयार है!'
                      : 'आमंत्रण लिंक तैयार है!'}
                  </h3>
                  <p className="text-xs text-purple-300/80 mt-1">
                    <strong>{telegramChannelName}</strong> चैनल में आपका स्वागत है।
                  </p>
                </div>

                {/* Personal Private Join-Request warning or public note */}
                <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-[11px] text-purple-200/90 text-left space-y-1.5">
                  <span className="font-bold text-amber-400 block">
                    {telegramChannelType === 'private'
                      ? '🔒 व्यक्तिगत Join-Request व बॉट सत्यापन निर्देश:'
                      : '📢 आधिकारिक चैनल लिंक:'}
                  </span>
                  <p className="leading-relaxed">
                    {telegramChannelType === 'private'
                      ? 'यह आपका व्यक्तिगत Private Join-Request लिंक है (10 मिनट वैध)। इसे किसी अन्य व्यक्ति के साथ साझा न करें — Telegram पर Request भेजते ही बॉट आपके लिंक्ड Telegram खाते और सक्रिय VIP सदस्यता की पुष्टि करके प्रवेश Approve करेगा। दूसरे यूज़र का प्रयास स्वतः Reject कर दिया जाएगा।'
                      : 'इस चैनल में इस उपन्यास के सभी नवीनतम ऑडियो एपिसोड्स और वॉइस अपडेट्स उपलब्ध हैं।'}
                  </p>
                  {telegramChannelType === 'private' && telegramRequiresApproval && telegramExpiresAt && (
                    <p className="text-[10px] font-mono text-sky-300/90 pt-0.5">
                      ⏱️ लिंक समाप्ति समय: {new Date(telegramExpiresAt).toLocaleTimeString('hi-IN')}
                    </p>
                  )}
                </div>

                {/* Primary Action Button */}
                <a
                  href={telegramInviteLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-3d w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#229ED9] to-[#0088cc] flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {telegramChannelType === 'private'
                      ? 'Telegram पर Join Request भेजें'
                      : 'Telegram में चैनल खोलें (Open in Telegram)'}
                  </span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                {/* Copy Link Button */}
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="btn-3d btn-3d-subtle w-full py-2.5 rounded-xl text-xs font-bold text-purple-200 flex items-center justify-center gap-2"
                >
                  {copiedInvite ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-300">लिंक कॉपी हो गया!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-purple-400" />
                      <span>लिंक कॉपी करें (Copy Link)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTelegramModalOpen(false)}
                  className="text-xs text-purple-400 hover:text-white pt-2 block mx-auto"
                >
                  बाद में बंद करें
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* MODAL 4: TELEGRAM GROUP NOT CONFIGURED MODAL */}
      {telegramNotConfiguredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#180933] to-[#0d0419] border-2 border-purple-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg">
              <Send className="w-8 h-8 text-sky-400" />
            </div>

            <div>
              <div className="inline-block px-2.5 py-1 rounded-full bg-purple-900/60 border border-purple-500/30 text-[10px] font-mono text-purple-300 font-bold mb-2">
                COMING SOON • जल्द उपलब्ध होगा
              </div>
              <h3 className="text-xl font-black text-white">
                Telegram Group Not Configured
              </h3>
              <p className="text-xs text-purple-300/80 mt-1">
                (टेलीग्राम ग्रुप अभी कॉन्फ़िगर नहीं है)
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-purple-950/60 border border-purple-500/20 text-xs text-purple-200/90 text-left leading-relaxed space-y-2">
              <p>
                इस उपन्यास (<strong>{novel?.title || novel?.hindiTitle}</strong>) के लिए समर्पित Telegram ऑडियो चैनल अभी लेखक/एडमिन द्वारा तैयार किया जा रहा है।
              </p>
              <p className="text-[11px] text-purple-400">
                जैसे ही ऑडियो एपिसोड्स और चैनल लिंक सक्रिय होगा, आप सीधे इस बटन पर क्लिक करके सुन सकेंगे।
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTelegramNotConfiguredModalOpen(false)}
              className="btn-3d btn-3d-gold w-full py-3 rounded-xl font-bold text-xs text-amber-950 shadow-lg"
            >
              ठीक है, समझ गया (Got It)
            </button>
          </div>
        </div>
      )}

      {/* MODAL 5: CHAPTER TELEGRAM AUDIO MODAL */}
      {chapterAudioModalOpen && activeChapterAudio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#180933] to-[#0d0419] border-2 border-sky-500/40 p-6 shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400 shadow-lg animate-pulse">
              <Headphones className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-block px-2.5 py-1 rounded-full bg-sky-900/60 border border-sky-500/30 text-[10px] font-mono text-sky-300 font-bold mb-2">
                {activeChapterAudio.isVip ? '👑 VIP CHAPTER AUDIO' : '🆓 FREE CHAPTER AUDIO'}
              </div>
              <h3 className="text-xl font-black text-white">
                अध्याय {activeChapterAudio.chapterNumber}: {activeChapterAudio.title}
              </h3>
              <p className="text-xs text-purple-300/80 mt-1">
                Telegram ऑडियो लिंक नई विंडो में खोल दिया गया है।
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-xs text-purple-200/90 text-left space-y-1.5">
              <p className="font-semibold text-sky-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-sky-400" /> यदि Telegram स्वतः नहीं खुला:
              </p>
              <p className="text-[11px] text-purple-300/80">
                नीचे दिए गए बटन पर क्लिक करके सीधे Telegram ऐप या वेब में इस अध्याय की ऑडियो रिकॉर्डिंग सुनें।
              </p>
            </div>

            {/* Direct Open Button */}
            <a
              href={activeChapterAudio.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-3d w-full py-3.5 rounded-xl font-black text-sm text-white bg-gradient-to-r from-[#229ED9] to-[#0088cc] flex items-center justify-center gap-2 shadow-xl hover:scale-105 transition-transform"
            >
              <Send className="w-4 h-4" />
              <span>Telegram में दोबारा खोलें</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeChapterAudio.link);
                setCopiedInvite(true);
                setTimeout(() => setCopiedInvite(false), 2500);
              }}
              className="btn-3d btn-3d-subtle w-full py-2.5 rounded-xl text-xs font-bold text-purple-200 flex items-center justify-center gap-2"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">लिंक कॉपी हो गया!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-purple-400" />
                  <span>अध्याय ऑडियो लिंक कॉपी करें</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setChapterAudioModalOpen(false);
                setActiveChapterAudio(null);
              }}
              className="text-xs text-purple-400 hover:text-white pt-1 block mx-auto"
            >
              बंद करें (Close)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
