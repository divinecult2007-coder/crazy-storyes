import React from 'react';
import { Headphones, Star, Eye, Bookmark, BookmarkCheck } from 'lucide-react';
import { Novel } from '../types.js';
import { useAuth } from '../context/AuthContext.js';

interface NovelCardProps {
  novel: Novel;
  onSelect: (novelId: string) => void;
  onReadDirect?: (novelId: string) => void;
}

export const NovelCard: React.FC<NovelCardProps> = ({ novel, onSelect, onReadDirect }) => {
  const { user, toggleBookmark } = useAuth();
  const isBookmarked = user?.bookmarks?.includes(novel.id) || false;
  // Display title in single language only (never bilingual duplicate)
  const displayTitle = novel.title || novel.hindiTitle || '';

  return (
    <div
      onClick={() => onSelect(novel.id)}
      className="card-3d group relative flex flex-col rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#180b2e] to-[#0f051e] border border-purple-500/20 hover:border-purple-400/50 overflow-hidden cursor-pointer shadow-md sm:shadow-lg"
    >
      {/* 16:9 Cover Image Container */}
      <div className="relative w-full aspect-video overflow-hidden bg-purple-950/40">
        <img
          src={novel.coverImage}
          alt={displayTitle}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        {/* Gradient Overlay for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f051e] via-transparent to-black/30" />

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
          {novel.isPremium ? (
            <div className="vip-badge-3d px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wide text-amber-950 flex items-center gap-1 shadow-md">
              <img
                src="/assets/aistudio/photo_2026-11-04_13-38-45_aa9b961d.jpg"
                alt="VIP"
                className="w-3.5 h-3.5 rounded-full object-cover border border-amber-950/40"
              />
              <span>VIP</span>
            </div>
          ) : (
            <div className="free-badge-3d px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold tracking-wide text-white flex items-center gap-0.5 shadow-md">
              <span>FREE</span>
            </div>
          )}

          {novel.isFeatured && (
            <div className="hidden xs:inline-block px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-purple-600/90 text-white border border-purple-400/40">
              चुनिंदा
            </div>
          )}
        </div>

        {/* Top Right Stats: Chapters Count */}
        <div className="absolute top-2 right-2 z-10">
          <div className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-purple-500/30 text-[9px] sm:text-[10px] font-mono text-purple-200 flex items-center gap-1">
            <Headphones className="w-2.5 h-2.5 text-sky-400" />
            <span>{novel.totalChapters} Ch</span>
          </div>
        </div>

        {/* Bottom Rating & Views */}
        <div className="absolute bottom-1.5 left-2 flex items-center gap-2 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-0.5 text-amber-400 font-bold drop-shadow">
            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
            <span>{novel.rating.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-0.5 text-purple-300/80 drop-shadow">
            <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>{(novel.views / 1000).toFixed(1)}k</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between gap-2">
        <div>
          {/* Categories / Tags */}
          <div className="flex flex-wrap items-center gap-1 mb-1">
            {novel.categories.slice(0, 1).map((cat) => (
              <span
                key={cat}
                className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium bg-purple-900/40 text-purple-300 border border-purple-500/20"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* Single Language Novel Title */}
          <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1 leading-snug">
            {displayTitle}
          </h3>

          {/* Short Description (no author name) */}
          <p className="text-[10px] sm:text-xs text-purple-200/70 line-clamp-2 mt-1 leading-relaxed">
            {novel.description}
          </p>
        </div>

        {/* Actions Button */}
        <div className="pt-2 border-t border-purple-900/30 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(novel.id);
            }}
            title={isBookmarked ? 'बुकमार्क हटाएं' : 'बुकमार्क करें'}
            className={`p-1.5 rounded-lg border transition ${
              isBookmarked
                ? 'bg-purple-600/40 border-purple-400/60 text-amber-300'
                : 'bg-purple-950/40 border-purple-500/20 text-purple-300 hover:text-white'
            }`}
          >
            {isBookmarked ? (
              <BookmarkCheck className="w-3.5 h-3.5" />
            ) : (
              <Bookmark className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onReadDirect) {
                onReadDirect(novel.id);
              } else {
                onSelect(novel.id);
              }
            }}
            className="btn-3d btn-3d-subtle px-2.5 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold text-white flex items-center gap-1 group-hover:border-purple-400 shrink-0"
          >
            <Headphones className="w-3 h-3 text-sky-400" />
            <span>सुनें</span>
          </button>
        </div>
      </div>
    </div>
  );
};
