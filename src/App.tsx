import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Header } from './components/Header.js';
import { Footer } from './components/Footer.js';
import { AuthModal } from './components/AuthModal.js';
import { PaymentModal } from './components/PaymentModal.js';

import { HomeView } from './views/HomeView.js';
import { ExploreView } from './views/ExploreView.js';
import { NovelDetailView } from './views/NovelDetailView.js';
import { PremiumView } from './views/PremiumView.js';
import { LibraryView } from './views/LibraryView.js';
import { HistoryView } from './views/HistoryView.js';
import { CrazyAiView } from './views/CrazyAiView.js';
import { SupportView } from './views/SupportView.js';
import { AdminView } from './views/AdminView.js';

import { X, Sparkles, Play, Headphones } from 'lucide-react';
import { Novel, SiteSettings } from './types.js';
import { trigger3DClickFeedback } from './utils/feedback.js';

function MainApp() {
  const { user, isAdmin, setAuthModalOpen, setAuthModalMode } = useAuth();
  const [currentView, setCurrentView] = useState<string>('home');
  const [viewParams, setViewParams] = useState<any>({});
  const [novels, setNovels] = useState<Novel[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [showContinuePopup, setShowContinuePopup] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, [role="button"], .btn-3d')) {
        trigger3DClickFeedback();
      }
    };
    document.addEventListener('click', handleGlobalClick, { passive: true });
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    if (user?.id) {
      setShowWelcomePopup(true);
      const latest = user.readingHistory?.[0];
      const alreadyShown = sessionStorage.getItem('cs_continue_popup_shown');
      if (latest && (latest.progressPercent ?? 0) < 100 && !alreadyShown) {
        setShowContinuePopup(true);
        sessionStorage.setItem('cs_continue_popup_shown', '1');
      }
    }
  }, [user?.id]);

  // Fetch novels and settings
  const fetchInitialData = () => {
    fetch('/api/novels')
      .then((res) => res.json())
      .then((data) => setNovels(data.novels || []))
      .catch((err) => console.error('Failed to load novels:', err));

    fetch('/api/payments/config')
      .then((res) => res.json())
      .then((data) => {
        setSettings({
          websiteName: data.websiteName || 'Crazy Storyes',
          tagline: 'प्रीमियम हिंदी उपन्यास और ऑडियोबुक्स',
          adminEmail: '',
          upiId: data.upiId || 'crazystoryes@upi',
          upiQrCodeUrl: data.upiQrCodeUrl || '',
          announcement: '🎉 Crazy Storyes में आपका स्वागत है! नए 16:9 उपन्यास और ऑडियोबुक्स जोड़े गए हैं।',
          announcementActive: true,
          supportEmail: data.supportEmail || 'divinecult2007@gmail.com',
          supportPhone: data.supportPhone || '+91 8290188433',
          enableAiAssistant: true
        });
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const navigateTo = (view: string, params: any = {}) => {
    // If navigating to admin and not admin, prompt admin login
    if (view === 'admin' && !isAdmin) {
      setAuthModalMode('admin-login');
      setAuthModalOpen(true);
      return;
    }
    setCurrentView(view);
    setViewParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectNovel = (novelId: string) => {
    navigateTo('detail', { novelId });
  };

  const handleListenDirect = (novelId: string) => {
    navigateTo('detail', { novelId });
  };

  const handleSearch = (query: string) => {
    navigateTo('explore', { query });
  };

  return (
    <div className="min-h-screen bg-[#080312] text-[#f3e8ff] flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Header */}
      <Header
        currentView={currentView}
        onNavigate={navigateTo}
        onSearch={handleSearch}
        novels={novels}
        onSelectNovel={handleSelectNovel}
        announcement={settings?.announcement}
        announcementActive={settings?.announcementActive}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-4 pt-3 pb-8 min-w-0">
        {currentView === 'home' && (
          <HomeView
            novels={novels}
            onSelectNovel={handleSelectNovel}
            onReadDirect={handleListenDirect}
            onNavigate={navigateTo}
          />
        )}

        {currentView === 'explore' && (
          <ExploreView
            novels={novels}
            onSelectNovel={handleSelectNovel}
            onReadDirect={handleListenDirect}
            initialCategory={viewParams.category}
            initialFilter={viewParams.filter}
            initialQuery={viewParams.query}
          />
        )}

        {currentView === 'detail' && viewParams.novelId && (
          <NovelDetailView
            novelId={viewParams.novelId}
            onBack={() => navigateTo('home')}
            onNavigate={navigateTo}
          />
        )}

        {currentView === 'premium' && <PremiumView onNavigate={navigateTo} />}

        {currentView === 'library' && (
          <LibraryView
            novels={novels}
            onSelectNovel={handleSelectNovel}
            onReadDirect={handleListenDirect}
            onNavigate={navigateTo}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            novels={novels}
            onSelectNovel={(novel) => handleSelectNovel(novel.id)}
            onContinueChapter={handleListenDirect}
          />
        )}

        {currentView === 'ai' && (
          <CrazyAiView
            initialNovelId={viewParams.novelId}
            initialChapterId={viewParams.chapterId}
            onNavigate={navigateTo}
          />
        )}

        {currentView === 'support' && <SupportView />}

        {currentView === 'admin' && isAdmin && (
          <AdminView initialTab={viewParams?.tab as any} />
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={navigateTo}
        supportEmail={settings?.supportEmail}
        supportPhone={settings?.supportPhone}
      />

      {/* Global Modals */}
      <AuthModal />
      <PaymentModal />

      {/* Automatic Continue Reading Popup (Once per session for unfinished reading/listening) */}
      {!showWelcomePopup && showContinuePopup && user?.readingHistory?.[0] && (() => {
        const latest = user.readingHistory[0];
        if ((latest.progressPercent ?? 0) >= 100) return null;
        const matchedNovel = novels.find((n) => n.id === latest.novelId);
        const cover =
          matchedNovel?.coverImage ||
          '/src/assets/images/novel_cover_immortal_rebirth_1794460891135.jpg';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1e0b3b] to-[#0f051e] border border-purple-400/50 overflow-hidden shadow-2xl p-5">
              <button
                onClick={() => setShowContinuePopup(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-black/40 text-purple-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 mb-3">
                <Headphones className="w-4 h-4" />
                <span>जहाँ छोड़ा था वहाँ से ऑडियो जारी रखें (Continue Audio Session)</span>
              </div>
              <div className="flex gap-3.5 items-center">
                <img
                  src={cover}
                  alt={latest.novelTitle}
                  className="w-24 aspect-video object-cover rounded-xl border border-purple-500/30 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-white truncate">{latest.novelTitle}</h3>
                  <p className="text-xs text-purple-300 truncate mt-0.5">
                    अध्याय {latest.chapterNumber}: {latest.chapterTitle}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-purple-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-amber-400"
                        style={{ width: `${Math.min(100, Math.max(0, latest.progressPercent || 0))}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-amber-400">
                      {Math.round(latest.progressPercent || 0)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex gap-2.5">
                <button
                  onClick={() => {
                    setShowContinuePopup(false);
                    handleListenDirect(latest.novelId);
                  }}
                  className="flex-1 btn-3d btn-3d-gold py-2.5 rounded-xl font-bold text-xs text-amber-950 flex items-center justify-center gap-1.5"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>सुनना जारी रखें (Continue Listening)</span>
                </button>
                <button
                  onClick={() => setShowContinuePopup(false)}
                  className="px-4 py-2.5 rounded-xl bg-purple-950/70 border border-purple-500/30 text-xs font-semibold text-purple-200 hover:text-white"
                >
                  बंद करें
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Featured Novel Popup on App Start & Login */}
      {showWelcomePopup && (() => {
        const featured = novels.find((n) => n.isFeatured) || novels[0];
        if (!featured) return null;
        const featuredTitle = featured.title || featured.hindiTitle || '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-md rounded-2xl bg-gradient-to-b from-[#1e0b3b] to-[#0f051e] border border-amber-400/50 overflow-hidden shadow-2xl">
              <button
                onClick={() => setShowWelcomePopup(false)}
                aria-label="Cancel"
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/70 hover:bg-purple-800 text-white border border-purple-400/40 transition"
              >
                <X className="w-4 h-4" />
              </button>

              {/* 16:9 Cover */}
              <div className="relative aspect-video w-full bg-black">
                <img
                  src={featured.coverImage}
                  alt={featuredTitle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f051e] via-transparent to-black/30" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950 shadow">
                    ⭐ Featured Novel
                  </span>
                  {featured.isPremium && (
                    <span className="vip-badge-3d px-2 py-0.5 rounded-full text-[10px] font-black text-amber-950 flex items-center gap-1">
                      <img
                        src="/assets/aistudio/photo_2026-11-04_13-38-45_aa9b961d.jpg"
                        alt="VIP"
                        className="w-3 h-3 rounded-full object-cover"
                      />
                      <span>VIP</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-5 space-y-3">
                <h3 className="text-base sm:text-lg font-black text-white line-clamp-1">
                  {featuredTitle}
                </h3>
                <p className="text-xs text-purple-200/80 line-clamp-2 leading-relaxed">
                  {featured.description}
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowWelcomePopup(false);
                      handleListenDirect(featured.id);
                    }}
                    className="flex-1 btn-3d btn-3d-gold py-2 rounded-xl text-xs font-black text-amber-950"
                  >
                    अभी सुनें (Listen Audio)
                  </button>
                  <button
                    onClick={() => setShowWelcomePopup(false)}
                    className="px-4 py-2 rounded-xl bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-500/30 text-xs font-bold"
                  >
                    बंद करें (Cancel)
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
