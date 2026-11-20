import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Crown, 
  Flame, 
  Headphones, 
  ArrowRight, 
  Play, 
  Clock, 
  TrendingUp, 
  Zap, 
  Layers,
  Filter,
  Check
} from 'lucide-react';
import { Novel } from '../types.js';
import { NovelCard } from '../components/NovelCard.js';
import { useAuth } from '../context/AuthContext.js';

interface HomeViewProps {
  novels: Novel[];
  onSelectNovel: (novelId: string) => void;
  onReadDirect: (novelId: string) => void;
  onNavigate: (view: string, params?: any) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  novels,
  onSelectNovel,
  onReadDirect,
  onNavigate
}) => {
  const { user } = useAuth();

  // Instant Horizontal Filter States
  const [selectedCategory, setSelectedCategory] = useState<string>('all'); // all, free, premium, popular, latest
  const [selectedGenre, setSelectedGenre] = useState<string>('All');

  const mainCategories = [
    { id: 'all', label: 'All Novels – सभी उपन्यास' },
    { id: 'free', label: 'Free Novels – फ्री उपन्यास' },
    { id: 'premium', label: 'Premium (VIP) – प्रीमियम' },
    { id: 'popular', label: 'Popular – लोकप्रिय' },
    { id: 'latest', label: 'Latest – नए अपडेट' }
  ];

  const genres = [
    'All',
    'System',
    'Action',
    'Fantasy',
    'Adventure',
    'Rebirth',
    'Cultivation',
    'Romance',
    'Comedy',
    'Supernatural',
    'Martial Arts',
    'Modern',
    'Mystery'
  ];

  const featuredNovels = novels.filter((n) => n.isFeatured);
  const heroNovel = featuredNovels[0] || novels[0];

  // Immediate live filtering right below the horizontal tabs
  const filteredNovels = useMemo(() => {
    let result = novels.filter((n) => n.isPublished);

    // Main category filter
    if (selectedCategory === 'free') {
      result = result.filter((n) => !n.isPremium);
    } else if (selectedCategory === 'premium') {
      result = result.filter((n) => n.isPremium);
    } else if (selectedCategory === 'popular') {
      result = [...result].sort((a, b) => b.rating - a.rating || b.views - a.views);
    } else if (selectedCategory === 'latest') {
      result = [...result].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }

    // Genre filter
    if (selectedGenre !== 'All') {
      result = result.filter((n) =>
        n.categories.some((c) => c.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    return result;
  }, [novels, selectedCategory, selectedGenre]);

  const heroTitle = heroNovel?.title || heroNovel?.hindiTitle || '';

  return (
    <div className="space-y-10 pb-16">
      {/* Hero Section with 16:9 Featured Novel (Single Language Title, No Author Name) */}
      {false && heroNovel && (
        <section className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-purple-500/30 bg-gradient-to-b from-[#190933] to-[#0c0419] shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6 lg:p-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 flex items-center gap-1 shadow-md">
                  <Crown className="w-3.5 h-3.5 fill-amber-950" />
                  <span>Featured Novel – चुनिंदा उपन्यास</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold bg-purple-900/60 text-purple-200 border border-purple-500/30">
                  {heroNovel.categories.join(' • ')}
                </span>
              </div>

              {/* Single Language Title with 3D Depth */}
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white leading-tight">
                <span className="text-3d-title">
                  {heroTitle}
                </span>
              </h1>

              {/* Description without author name */}
              <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed max-w-2xl line-clamp-3">
                {heroNovel.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs font-semibold text-purple-300 pt-1">
                <span className="text-amber-400">★ {heroNovel.rating.toFixed(1)} रेटिंग</span>
                <span>•</span>
                <span>📖 {heroNovel.totalChapters} कुल अध्याय</span>
                <span>•</span>
                <span>🎧 ऑडियो प्लेयर उपलब्ध</span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onSelectNovel(heroNovel.id)}
                  className="btn-3d btn-3d-gold px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center gap-2"
                >
                  <Headphones className="w-4 h-4 text-amber-950" />
                  <span>अभी ऑडियो सुनें (Listen Audio)</span>
                </button>
                <button
                  onClick={() => onSelectNovel(heroNovel.id)}
                  className="btn-3d btn-3d-subtle px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-purple-200 flex items-center gap-2"
                >
                  <Play className="w-4 h-4 text-purple-400" />
                  <span>अध्याय & विवरण</span>
                </button>
              </div>
            </div>

            {/* Right 16:9 Cover Presentation */}
            <div className="lg:col-span-5">
              <div
                onClick={() => onSelectNovel(heroNovel.id)}
                className="card-3d group relative aspect-video rounded-xl sm:rounded-2xl overflow-hidden border-2 border-purple-500/50 shadow-2xl cursor-pointer bg-black"
              >
                <img
                  src={heroNovel.coverImage}
                  alt={heroTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3 sm:p-4">
                  <div className="flex items-center justify-between w-full">
                    <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[10px] sm:text-xs font-bold text-purple-200 border border-purple-500/30">
                      16:9 Cover
                    </span>
                    <span className="btn-3d btn-3d-primary px-3 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1">
                      <span>विवरण देखें</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Continue Listening Section (If user has history) */}
      {user?.readingHistory && user.readingHistory.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-950/60 to-[#1b0a33] border border-purple-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              <span>Continue Listening – <span className="text-purple-300">ऑडियो सुनना जारी रखें</span></span>
            </h2>
            <button
              onClick={() => onNavigate('library')}
              className="text-xs font-bold text-purple-300 hover:text-white"
            >
              सभी देखें →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {user.readingHistory.slice(0, 3).map((item) => (
              <div
                key={item.novelId}
                onClick={() => onSelectNovel(item.novelId)}
                className="p-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/20 hover:border-purple-400/50 cursor-pointer transition flex flex-col justify-between"
              >
                <div>
                  <h4 className="text-xs font-bold text-white line-clamp-1">{item.novelTitle}</h4>
                  <p className="text-[11px] text-purple-300/80 mt-0.5 line-clamp-1">{item.chapterTitle}</p>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <div className="flex-1 bg-purple-950 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-amber-400 h-full rounded-full"
                      style={{ width: `${item.progressPercent || 20}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-purple-300">
                    {Math.round(item.progressPercent || 0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* 1. HORIZONTAL CATEGORY NAVIGATION BARS (VERY IMPORTANT)   */}
      {/* ======================================================== */}
      <section className="space-y-4 pt-1">
        {/* Section Heading */}
        <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300">
                Explore Novels
              </span>{' '}
              – <span className="text-amber-400 text-3d-gold">उपन्यास सूची</span>
            </h2>
            <p className="text-xs text-purple-300/80 mt-0.5">
              ऊपर दी गई श्रेणियों और विधाओं पर क्लिक करके तुरंत फ़िल्टर करें
            </p>
          </div>

          {(selectedCategory !== 'all' || selectedGenre !== 'All') && (
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedGenre('All');
              }}
              className="text-xs font-bold text-amber-400 hover:underline shrink-0"
            >
              फ़िल्टर रीसेट करें (Reset)
            </button>
          )}
        </div>

        {/* ROW 1: Horizontal Sliding Category Tabs (All Novels, Free, VIP, Popular, Latest) */}
        <div className="relative">
          <div className="flex items-center gap-2 sm:gap-2.5 overflow-x-auto pb-2 scrollbar-none touch-pan-x">
            {mainCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`btn-3d px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'btn-3d-gold text-amber-950 shadow-lg scale-[1.02]'
                      : 'bg-[#180b2e] text-purple-200 hover:text-white border border-purple-500/30 hover:border-purple-400/60 shadow-sm'
                  }`}
                >
                  {cat.id === 'premium' && <Crown className="w-3.5 h-3.5 fill-current" />}
                  {cat.id === 'popular' && <Flame className="w-3.5 h-3.5 text-amber-400" />}
                  {cat.id === 'free' && <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{cat.label}</span>
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ROW 2: Horizontal Sliding Genres Bar (System, Action, Fantasy, etc.) */}
        <div className="relative">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none touch-pan-x">
            <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <Layers className="w-3 h-3" /> विधा:
            </span>
            {genres.map((genre) => {
              const isSelected = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`btn-3d px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                    isSelected
                      ? 'btn-3d-primary text-white shadow-md'
                      : 'bg-purple-950/60 text-purple-300 hover:text-white border border-purple-500/20 hover:border-purple-400/40'
                  }`}
                >
                  {genre === 'All' ? 'सभी विधाएं (All)' : genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. NOVEL CARD GRID – STRICT TWO CARDS PER ROW ON MOBILE  */}
        {/* ======================================================== */}
        <div className="pt-2">
          {filteredNovels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {filteredNovels.map((novel) => (
                <NovelCard
                  key={novel.id}
                  novel={novel}
                  onSelect={onSelectNovel}
                  onReadDirect={onReadDirect}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center rounded-2xl bg-purple-950/20 border border-purple-500/20 p-6 space-y-2">
              <Headphones className="w-10 h-10 text-purple-400/40 mx-auto" />
              <h3 className="text-sm font-bold text-white">इस श्रेणी में कोई उपन्यास नहीं मिला</h3>
              <p className="text-xs text-purple-300/70">
                कृपया दूसरी श्रेणी या विधा चुनें।
              </p>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedGenre('All');
                }}
                className="btn-3d btn-3d-primary px-4 py-1.5 rounded-xl text-xs font-bold text-white mt-2"
              >
                सभी उपन्यास देखें
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 3. Featured Showcase Grid (Strict Two Cards Per Row on Mobile) */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              <span className="text-amber-400 text-3d-gold">Popular Stories</span> –{' '}
              <span className="text-purple-200">लोकप्रिय कहानियाँ</span>
            </h2>
            <p className="text-xs text-purple-300/80 mt-0.5">
              पाठकों द्वारा सबसे ज्यादा पढ़ी जाने वाली कहानियाँ
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory('popular');
              window.scrollTo({ top: 400, behavior: 'smooth' });
            }}
            className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1"
          >
            <span>सभी देखें</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Two cards per row grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {novels
            .filter((n) => n.isPopular || n.views > 25000)
            .slice(0, 4)
            .map((novel) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                onSelect={onSelectNovel}
                onReadDirect={onReadDirect}
              />
            ))}
        </div>
      </section>

      {/* 4. VIP Premium Collection (Strict Two Cards Per Row on Mobile) */}
      <section className="space-y-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#1a0833] to-[#120524] border border-amber-500/40 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-2 border-b border-amber-900/40">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="vip-badge-3d px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black text-amber-950 flex items-center gap-1">
                <Crown className="w-3 h-3 fill-amber-950" /> VIP EXCLUSIVE
              </span>
              <span className="text-[11px] text-amber-300 font-semibold">असीमित एक्सेस & 3x ऑडियो</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              <span className="text-3d-gold text-amber-400">Premium Collection</span> –{' '}
              <span className="text-purple-200">वीआईपी संकलन</span>
            </h2>
          </div>
          <button
            onClick={() => onNavigate('premium')}
            className="btn-3d btn-3d-gold px-3.5 py-1.5 rounded-xl text-xs font-black text-amber-950 flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>वीआईपी प्लान्स देखें</span>
          </button>
        </div>

        {/* Two cards per row grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 pt-1">
          {novels
            .filter((n) => n.isPremium)
            .slice(0, 4)
            .map((novel) => (
              <NovelCard
                key={novel.id}
                novel={novel}
                onSelect={onSelectNovel}
                onReadDirect={onReadDirect}
              />
            ))}
        </div>
      </section>
    </div>
  );
};
