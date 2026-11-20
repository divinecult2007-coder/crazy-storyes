import React, { useState } from 'react';
import { 
  BookOpen, 
  Search, 
  Crown, 
  Sparkles, 
  Library, 
  Menu, 
  X, 
  User as UserIcon, 
  LogOut, 
  LogIn,
  Shield,
  History,
  Volume2, 
  Compass, 
  HelpCircle,
  Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Novel } from '../types.js';
import { getFeedbackSettings, saveFeedbackSettings } from '../utils/feedback.js';
import { NavigationSidebar } from './NavigationSidebar.js';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  onSearch: (query: string) => void;
  novels?: Novel[];
  onSelectNovel?: (novelId: string) => void;
  announcement?: string;
  announcementActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onNavigate,
  onSearch,
  novels = [],
  onSelectNovel,
  announcement,
  announcementActive
}) => {
  const { user, isAuthenticated, isAdmin, isVip, logout, setAuthModalOpen, setAuthModalMode } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchResults = React.useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    return novels
      .filter(
        (n) =>
          n.isPublished &&
          ((n.title && n.title.toLowerCase().includes(q)) ||
            (n.hindiTitle && n.hindiTitle.toLowerCase().includes(q)) ||
            (n.author && n.author.toLowerCase().includes(q)))
      )
      .slice(0, 6);
  }, [novels, searchInput]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      onNavigate('explore', { query: searchInput.trim() });
      setSearchFocused(false);
    }
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) {
      return (
        <div className="p-4 text-center text-xs text-purple-300/70">
          कोई उपन्यास नहीं मिला
        </div>
      );
    }
    return (
      <div className="divide-y divide-purple-900/40">
        {searchResults.map((item) => (
          <button
            key={item.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setSearchFocused(false);
              setSearchInput('');
              if (onSelectNovel) {
                onSelectNovel(item.id);
              } else {
                onNavigate('detail', { novelId: item.id });
              }
            }}
            className="w-full p-2.5 flex items-center gap-2.5 hover:bg-purple-900/40 transition text-left"
          >
            <img
              src={item.coverImage}
              alt={item.title || item.hindiTitle}
              className="w-12 aspect-video rounded-lg object-cover shrink-0 border border-purple-500/30"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white line-clamp-1">
                {item.title || item.hindiTitle}
              </p>
              <div className="flex items-center gap-2 text-[10px] text-purple-300/80 mt-0.5">
                <span>📖 {item.totalChapters} Ch</span>
                {item.isPremium && (
                  <span className="text-amber-400 font-bold">• VIP</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const navLinks = [
    { id: 'home', label: 'होम (Home)' },
    { id: 'explore', label: 'उपन्यास खोजें (Explore)' },
    { id: 'premium', label: 'प्रीमियम (VIP)', icon: Crown, highlight: true },
    { id: 'ai', label: 'Crazy AI', icon: Sparkles, badge: 'AI' },
    { id: 'library', label: 'मेरी लाइब्रेरी (Library)', icon: Library },
    { id: 'history', label: 'इतिहास (History)', icon: History },
    { id: 'support', label: 'सहायता (Help)' }
  ];

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#090314]/95 border-b border-purple-500/20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Main Header Bar */}
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          
          {/* Left: Mobile Hamburger & Logo */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mobile hamburger menu button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-200 hover:text-white transition"
              title="Open Navigation Menu"
              aria-label="Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <div
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2 cursor-pointer group shrink-0"
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden shadow-lg border-2 border-purple-400/70 group-hover:scale-105 transition duration-200 bg-black shrink-0">
                <img
                  src="/assets/aistudio/photo_2026-11-04_13-38-45_aa9b961d.jpg"
                  alt="Crazy Storyes Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-base sm:text-xl font-black tracking-tight text-white flex items-center gap-1 font-serif">
                  <span>Crazy</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
                    Storyes
                  </span>
                </span>
                <span className="hidden sm:inline-block text-[10px] text-purple-300/70 -mt-1 font-medium tracking-wide">
                  हिंदी उपन्यास & ऑडियो
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = currentView === link.id;
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => onNavigate(link.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-purple-600/40 text-white border border-purple-400/40 shadow-sm'
                      : link.highlight
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-500/10'
                      : 'text-purple-200/80 hover:text-white hover:bg-purple-900/30'
                  }`}
                >
                  {Icon && (
                    <Icon
                      className={`w-3.5 h-3.5 ${
                        link.highlight ? 'text-amber-400' : 'text-purple-400'
                      }`}
                    />
                  )}
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm">
                      {link.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop Persistent Search Bar */}
          <div className="hidden md:block relative flex-1 max-w-xs">
            <form onSubmit={handleSearchSubmit} className="flex items-center w-full relative">
              <input
                type="text"
                placeholder="उपन्यास या लेखक खोजें..."
                value={searchInput}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setSearchFocused(true);
                }}
                className="w-full pl-8 pr-7 py-1.5 rounded-full bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/50 text-xs focus:outline-none focus:border-purple-400 focus:bg-purple-950/80 transition"
              />
              <Search className="w-3.5 h-3.5 text-purple-400 absolute left-2.5 pointer-events-none" />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 text-purple-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            {/* Desktop Live Search Dropdown */}
            {searchFocused && searchInput.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-[#14072b] border border-purple-500/40 shadow-2xl overflow-hidden z-50 max-h-80 overflow-y-auto">
                {renderSearchResults()}
              </div>
            )}
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Sound & Haptic Settings */}
            <SoundSettingsButton />

            {/* Admin Dashboard shortcut (desktop only) */}
            {isAdmin && (
              <button
                onClick={() => onNavigate('admin')}
                className="hidden sm:flex btn-3d btn-3d-gold px-3 py-1.5 rounded-xl text-xs font-bold items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </button>
            )}

            {/* User Profile or Auth Buttons */}
            {isAuthenticated && user ? (
              <>
                {/* On Mobile: Tapping Profile opens the Navigation Drawer */}
                <button
                  onClick={() => setMobileMenuOpen(true)}
                  className="md:hidden flex items-center gap-1 p-1 rounded-xl bg-purple-950/60 border border-purple-500/40 hover:border-purple-400 transition"
                  title="प्रोफाइल & मेनू खोलें"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-xs font-black text-white shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  {isVip && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 mr-0.5" />}
                </button>

                {/* On Desktop: Full Profile Dropdown */}
                <div className="hidden md:block relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 p-1.5 rounded-xl bg-purple-950/50 border border-purple-500/30 hover:border-purple-400/60 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-800 flex items-center justify-center text-xs font-black text-white shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden xl:flex flex-col text-left pr-1">
                      <span className="text-xs font-bold text-white max-w-[90px] truncate">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-0.5">
                        {isVip ? (
                          <>
                            <Crown className="w-2.5 h-2.5 fill-amber-400" /> VIP सदस्य
                          </>
                        ) : (
                          'नि:शुल्क पाठक'
                        )}
                      </span>
                    </div>
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div 
                      className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#120726] border border-purple-500/30 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150"
                      onMouseLeave={() => setUserMenuOpen(false)}
                    >
                      <div className="px-3 py-2 border-b border-purple-900/40">
                        <p className="text-xs font-bold text-white truncate">{user.name}</p>
                        <p className="text-[11px] text-purple-400 truncate">{user.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-900/60 text-purple-200 border border-purple-500/30">
                          {user.role === 'admin' ? '🛡️ वेबसाइट एडमिन' : isVip ? '👑 VIP Member' : '📖 Reader'}
                        </span>
                      </div>

                      <div className="py-1">
                        <button
                          onClick={() => {
                            onNavigate('library');
                            setUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-purple-200 hover:text-white hover:bg-purple-900/40 flex items-center gap-2"
                        >
                          <Library className="w-3.5 h-3.5 text-purple-400" />
                          <span>मेरी लाइब्रेरी & इतिहास</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => {
                              onNavigate('admin');
                              setUserMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 flex items-center gap-2"
                          >
                            <Shield className="w-3.5 h-3.5 text-amber-400" />
                            <span>Admin Dashboard</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onNavigate('premium');
                            setUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-950/40 flex items-center gap-2"
                        >
                          <Crown className="w-3.5 h-3.5 text-amber-400" />
                          <span>वीआईपी सदस्यता (VIP Plans)</span>
                        </button>

                        <button
                          onClick={() => {
                            logout();
                            setUserMenuOpen(false);
                          }}
                          className="w-full px-3 py-2 rounded-xl text-left text-xs font-medium text-red-300 hover:text-red-200 hover:bg-red-950/40 flex items-center gap-2 mt-1 border-t border-purple-900/40"
                        >
                          <LogOut className="w-3.5 h-3.5 text-red-400" />
                          <span>लॉगआउट (Logout)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setAuthModalMode('login');
                    setAuthModalOpen(true);
                  }}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-200 hover:text-white hover:bg-purple-900/30 transition flex items-center gap-1"
                >
                  <LogIn className="w-3.5 h-3.5 text-amber-400 sm:hidden" />
                  <span>लॉगिन</span>
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode('register');
                    setAuthModalOpen(true);
                  }}
                  className="hidden sm:inline-flex btn-3d btn-3d-primary px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm"
                >
                  पंजीकरण (Free)
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dedicated Full-Width Mobile Search Bar (Never crushed or hidden) */}
        <div className="md:hidden pb-2.5 pt-0.5 relative">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full relative">
            <input
              type="text"
              placeholder="उपन्यास या लेखक खोजें..."
              value={searchInput}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setSearchFocused(true);
              }}
              className="w-full pl-8 pr-7 py-1.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-white placeholder-purple-400/50 text-xs focus:outline-none focus:border-purple-400 focus:bg-purple-950/90 transition shadow-inner"
            />
            <Search className="w-3.5 h-3.5 text-purple-400 absolute left-2.5 pointer-events-none" />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 text-purple-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Mobile Live Search Dropdown */}
          {searchFocused && searchInput.trim().length > 0 && (
            <div className="absolute left-3 right-3 mt-1.5 rounded-2xl bg-[#14072b] border border-purple-500/40 shadow-2xl overflow-hidden z-50 max-h-72 overflow-y-auto">
              {renderSearchResults()}
            </div>
          )}
        </div>
      </div>

      {/* Navigation Sidebar Drawer */}
      <NavigationSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        currentView={currentView}
        onNavigate={onNavigate}
      />
    </header>
  );
};

const SoundSettingsButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(() => getFeedbackSettings());

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveFeedbackSettings(next);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="ध्वनि और हैप्टिक सेटिंग्स (Sound & Haptic Settings)"
        className="p-2 rounded-xl bg-purple-950/50 border border-purple-500/30 hover:border-purple-400/60 text-purple-300 hover:text-white transition"
      >
        <Volume2 className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#120726] border border-purple-500/40 p-4 shadow-2xl z-50 space-y-3">
          <div className="flex items-center justify-between border-b border-purple-900/50 pb-2">
            <span className="text-xs font-bold text-white">ध्वनि और हैप्टिक (Sound & Haptic)</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-purple-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <label className="flex items-center justify-between text-xs text-purple-200 cursor-pointer">
            <span>इंटरफ़ेस ध्वनि (Interface Sound)</span>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => update({ soundEnabled: e.target.checked })}
              className="accent-amber-400"
            />
          </label>
          <label className="flex items-center justify-between text-xs text-purple-200 cursor-pointer">
            <span>हैप्टिक वाइब्रेशन (Haptic Feedback)</span>
            <input
              type="checkbox"
              checked={settings.hapticEnabled}
              onChange={(e) => update({ hapticEnabled: e.target.checked })}
              className="accent-amber-400"
            />
          </label>
          <div>
            <div className="flex justify-between text-[11px] text-purple-300 mb-1">
              <span>क्लिक वॉल्यूम (Click Volume)</span>
              <span>{Math.round(settings.soundVolume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.soundVolume}
              onChange={(e) => update({ soundVolume: parseFloat(e.target.value) })}
              className="w-full accent-amber-400"
            />
          </div>
        </div>
      )}
    </div>
  );
};
