import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Headphones, Crown, Layers, Flame, Zap, Check } from 'lucide-react';
import { Novel } from '../types.js';
import { NovelCard } from '../components/NovelCard.js';

interface ExploreViewProps {
  novels: Novel[];
  onSelectNovel: (novelId: string) => void;
  onReadDirect: (novelId: string) => void;
  initialCategory?: string;
  initialFilter?: string;
  initialQuery?: string;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  novels,
  onSelectNovel,
  onReadDirect,
  initialCategory,
  initialFilter,
  initialQuery
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery || '');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialFilter || 'all'); // all, free, premium, popular, latest
  const [selectedGenre, setSelectedGenre] = useState<string>(initialCategory || 'All');

  useEffect(() => {
    if (initialCategory) setSelectedGenre(initialCategory);
    if (initialFilter) setSelectedCategory(initialFilter);
    if (initialQuery !== undefined) setSearchQuery(initialQuery);
  }, [initialCategory, initialFilter, initialQuery]);

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

  // Immediate live filtering
  const filtered = useMemo(() => {
    let result = novels.filter((n) => n.isPublished);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.hindiTitle && n.hindiTitle.toLowerCase().includes(q)) ||
          n.categories.some((c) => c.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

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

    if (selectedGenre !== 'All') {
      result = result.filter((n) =>
        n.categories.some((c) => c.toLowerCase() === selectedGenre.toLowerCase())
      );
    }

    return result;
  }, [novels, searchQuery, selectedCategory, selectedGenre]);

  return (
    <div className="space-y-6 pb-16">
      {/* Page Title */}
      <div className="pb-3 border-b border-purple-900/40">
        <h1 className="text-2xl sm:text-3xl font-black text-white">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300">
            Explore Novels
          </span>{' '}
          – <span className="text-amber-400 text-3d-gold">उपन्यास खोजें</span>
        </h1>
        <p className="text-xs text-purple-300/80 mt-0.5">
          तुरंत फ़िल्टर करने के लिए श्रेणियों पर क्लिक करें
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative max-w-xl">
        <input
          type="text"
          placeholder="उपन्यास का नाम, श्रेणी (जैसे Rebirth, System, Action)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-white placeholder-purple-400/50 text-xs sm:text-sm focus:outline-none focus:border-purple-400 focus:bg-purple-950/70 transition shadow-inner"
        />
        <Search className="w-4 h-4 text-purple-400 absolute left-3.5 top-3 pointer-events-none" />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-2.5 text-xs font-bold text-purple-400 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. HORIZONTAL CATEGORY NAVIGATION BARS (LEFT TO RIGHT)   */}
      {/* ======================================================== */}
      <div className="space-y-2.5">
        {/* ROW 1: Categories (All, Free, VIP, Popular, Latest) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none touch-pan-x">
          {mainCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`btn-3d px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'btn-3d-gold text-amber-950 shadow-md scale-[1.02]'
                    : 'bg-[#180b2e] text-purple-200 hover:text-white border border-purple-500/30 hover:border-purple-400/50'
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

        {/* ROW 2: Genres (System, Action, Fantasy, Rebirth...) */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-none touch-pan-x">
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

      {/* Results Count & Reset */}
      <div className="flex items-center justify-between text-xs text-purple-300/80 px-1 pt-1">
        <span>
          कुल <strong className="text-white">{filtered.length}</strong> उपन्यास पाए गए
        </span>
        {(searchQuery || selectedCategory !== 'all' || selectedGenre !== 'All') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedGenre('All');
            }}
            className="text-amber-400 hover:underline font-bold"
          >
            फ़िल्टर रीसेट करें (Reset Filters)
          </button>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. NOVEL CARD GRID – STRICT TWO CARDS PER ROW ON MOBILE  */}
      {/* ======================================================== */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {filtered.map((novel) => (
            <NovelCard
              key={novel.id}
              novel={novel}
              onSelect={onSelectNovel}
              onReadDirect={onReadDirect}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center rounded-2xl bg-purple-950/20 border border-purple-500/20 p-8 space-y-2">
          <Headphones className="w-10 h-10 text-purple-400/40 mx-auto" />
          <h3 className="text-sm font-bold text-white">कोई उपन्यास नहीं मिला</h3>
          <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
            आपके खोज मानदंड के अनुरूप कोई परिणाम नहीं मिला। कृपया भिन्न श्रेणी या विधा चुनें।
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedGenre('All');
            }}
            className="btn-3d btn-3d-primary mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white"
          >
            सभी उपन्यास दिखाएं
          </button>
        </div>
      )}
    </div>
  );
};
