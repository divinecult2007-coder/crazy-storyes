import React from 'react';
import {
  X,
  Home,
  Compass,
  Crown,
  Sparkles,
  Library,
  History,
  HelpCircle,
  Download,
  Shield,
  BookOpen,
  Layers,
  CreditCard,
  Users,
  Settings,
  MessageSquare,
  LogOut,
  LogIn,
  UserPlus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface NavigationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
}

const APK_DOWNLOAD_URL =
  'https://github.com/divinecult2007-coder/crazy-storyes/releases/download/v1.0.0/app-debug.apk';

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  isOpen,
  onClose,
  currentView,
  onNavigate
}) => {
  const { user, isAuthenticated, isAdmin, isVip, logout, setAuthModalOpen, setAuthModalMode } = useAuth();

  if (!isOpen) return null;

  const handleLinkClick = (view: string, params?: any) => {
    onNavigate(view, params);
    onClose(); // Automatically close mobile drawer/slider on click
  };

  const mainNavItems = [
    { id: 'home', label: 'होम (Home)', icon: Home },
    { id: 'explore', label: 'उपन्यास खोजें (Explore)', icon: Compass },
    { id: 'premium', label: 'वीआईपी सदस्यता (VIP Plans)', icon: Crown, highlight: true },
    { id: 'ai', label: 'Crazy AI सहायक', icon: Sparkles, badge: 'AI' },
    { id: 'library', label: 'मेरी लाइब्रेरी (Library)', icon: Library },
    { id: 'history', label: 'पठन इतिहास (History)', icon: History },
    { id: 'support', label: 'सहायता एवं समर्थन (Help)', icon: HelpCircle }
  ];

  // Admin items strictly restricted to user.role === 'admin'
  const adminNavItems = [
    { id: 'admin', tab: 'stats', label: 'एडमिन डैशबोर्ड (Overview)', icon: Shield },
    { id: 'admin', tab: 'novels', label: 'उपन्यास प्रबंधन (Novels)', icon: BookOpen },
    { id: 'admin', tab: 'chapters', label: 'अध्याय प्रबंधन (Chapters)', icon: Layers },
    { id: 'admin', tab: 'payments', label: 'भुगतान व UTR सत्यापन (Payments)', icon: CreditCard },
    { id: 'admin', tab: 'users', label: 'उपयोगकर्ता व रोल प्रबंधन (Users)', icon: Users },
    { id: 'admin', tab: 'telegram', label: '✈️ Telegram VIP प्रबंधन (Channels)', icon: MessageSquare },
    { id: 'admin', tab: 'settings', label: 'वेबसाइट व UPI सेटिंग्स (Settings)', icon: Settings },
    { id: 'admin', tab: 'tickets', label: 'सपोर्ट टिकट (Tickets)', icon: MessageSquare }
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex" aria-modal="true" role="dialog">
      {/* Backdrop overlay - click to close */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Container (Sliding from Left) */}
      <aside className="relative z-10 w-80 max-w-[85vw] h-[100dvh] bg-[#0d041c] border-r border-purple-500/30 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-left duration-200">
        
        {/* Top Header & Branding */}
        <div>
          <div className="p-4 border-b border-purple-900/50 flex items-center justify-between">
            <div
              onClick={() => handleLinkClick('home')}
              className="flex items-center gap-2.5 cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-purple-400 shadow-md shrink-0 bg-black">
                <img
                  src="/assets/aistudio/photo_2026-11-04_13-38-45_aa9b961d.jpg"
                  alt="Crazy Storyes Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <span className="text-lg font-black text-white flex items-center gap-1 font-serif">
                  <span>Crazy</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300">
                    Storyes
                  </span>
                </span>
                <p className="text-[10px] text-purple-300/70 font-medium">हिंदी उपन्यास & ऑडियो</p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900 border border-purple-500/30 text-purple-300 hover:text-white transition"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Card (if logged in) */}
          {isAuthenticated && user && (
            <div
              onClick={() => handleLinkClick('library')}
              className="p-4 bg-purple-950/40 border-b border-purple-900/40 cursor-pointer hover:bg-purple-900/30 transition"
              title="अपनी लाइब्रेरी और इतिहास देखें"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 via-indigo-600 to-amber-500 flex items-center justify-center text-sm font-black text-white shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{user.name}</div>
                  <div className="text-[11px] text-purple-300/70 truncate">{user.email}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {/* Role badge */}
                    {user.role === 'admin' ? (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        🛡️ ADMIN
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-900/60 text-purple-300 border border-purple-500/30">
                        📖 READER
                      </span>
                    )}

                    {/* VIP badge */}
                    {isVip && (
                      <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-950 text-amber-400 border border-amber-500/40 flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5 fill-current" /> VIP
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links List */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-purple-400/80">
              मुख्य मेनू (Main Menu)
            </div>

            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.id)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition flex items-center justify-between group ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-800/70 to-indigo-900/70 text-white border border-purple-400/60 shadow-[0_0_15px_rgba(168,85,247,0.25)] font-bold'
                      : item.highlight
                      ? 'text-amber-300 hover:text-amber-200 hover:bg-amber-950/30 border border-amber-500/20'
                      : 'text-purple-200 hover:text-white hover:bg-purple-950/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 transition ${
                        isActive
                          ? 'text-amber-300 scale-110'
                          : item.highlight
                          ? 'text-amber-400'
                          : 'text-purple-400 group-hover:text-purple-200'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-gradient-to-r from-pink-500 to-purple-500 text-white">
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]" />
                    )}
                  </div>
                </button>
              );
            })}

            {/* Download App Button */}
            <a
              href={APK_DOWNLOAD_URL}
              download="CrazyStoryes.apk"
              onClick={onClose}
              className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center justify-between group text-emerald-300 hover:text-emerald-200 bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-500/30 mt-1"
            >
              <div className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
                <span>ऐप डाउनलोड करें (Download APK)</span>
              </div>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                APK
              </span>
            </a>

            {/* ADMIN SECTION — STRICTLY RESTRICTED TO user.role === 'admin' */}
            {isAdmin && user?.role === 'admin' && (
              <div className="pt-3 mt-3 border-t border-purple-900/50">
                <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-amber-400" />
                  <span>एडमिन नियंत्रण (Admin Tools)</span>
                </div>

                <div className="space-y-1 mt-1">
                  {adminNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === 'admin';

                    return (
                      <button
                        key={`${item.id}-${item.tab}`}
                        onClick={() => handleLinkClick('admin', { tab: item.tab })}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold text-left transition flex items-center justify-between group ${
                          isActive
                            ? 'bg-gradient-to-r from-amber-950/60 to-purple-950/80 text-amber-200 border border-amber-500/40'
                            : 'text-purple-200 hover:text-white hover:bg-purple-900/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-3.5 h-3.5 text-amber-400" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Area with Auth Action Buttons */}
        <div className="p-4 border-t border-purple-900/50 bg-[#090214]">
          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-red-950/50 hover:bg-red-900/80 border border-red-500/30 text-xs font-bold text-red-200 flex items-center justify-center gap-2 transition"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>लॉगआउट करें (Logout)</span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                  onClose();
                }}
                className="w-full py-2 px-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-xs font-bold text-purple-200 flex items-center justify-center gap-1.5 transition"
              >
                <LogIn className="w-4 h-4 text-purple-400" />
                <span>लॉगिन (Login)</span>
              </button>
              <button
                onClick={() => {
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                  onClose();
                }}
                className="w-full btn-3d btn-3d-primary py-2 px-3 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>नया खाता बनाएं (Register Free)</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
