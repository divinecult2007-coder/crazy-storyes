import React, { useState, useEffect } from 'react';
import { 
  Bookmark, 
  Clock, 
  CreditCard, 
  Crown, 
  BookOpen, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Timer,
  Play
} from 'lucide-react';
import { Novel, PaymentRequest } from '../types.js';
import { NovelCard } from '../components/NovelCard.js';
import { useAuth } from '../context/AuthContext.js';

interface LibraryViewProps {
  novels: Novel[];
  onSelectNovel: (novelId: string) => void;
  onReadDirect: (novelId: string) => void;
  onNavigate: (view: string, params?: any) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  novels,
  onSelectNovel,
  onReadDirect,
  onNavigate
}) => {
  const { user, isAuthenticated, token, setAuthModalOpen, setAuthModalMode, isVip } = useAuth();
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history' | 'payments' | 'membership'>('bookmarks');
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token && activeTab === 'payments') {
      setLoadingPayments(true);
      fetch('/api/payments/my-history', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          setPayments(data.payments || []);
          setLoadingPayments(false);
        })
        .catch((err) => {
          console.error('Failed to load user payments:', err);
          setLoadingPayments(false);
        });
    }
  }, [isAuthenticated, token, activeTab]);

  if (!isAuthenticated || !user) {
    return (
      <div className="py-20 text-center max-w-md mx-auto space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-purple-900/40 text-purple-300 border border-purple-500/30 flex items-center justify-center mx-auto shadow-lg">
          <Bookmark className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-white">मेरी लाइब्रेरी (My Library)</h2>
        <p className="text-xs text-purple-300/80 leading-relaxed">
          अपनी बुकमार्क की गई कहानियाँ, पढ़ने का इतिहास और वीआईपी सदस्यता की स्थिति देखने के लिए लॉगिन करें।
        </p>
        <button
          onClick={() => {
            setAuthModalMode('login');
            setAuthModalOpen(true);
          }}
          className="btn-3d btn-3d-primary px-6 py-2.5 rounded-xl text-xs font-bold text-white"
        >
          लॉगिन करें (Log In)
        </button>
      </div>
    );
  }

  // Filter bookmarked novels
  const bookmarkedNovels = novels.filter((n) => user.bookmarks?.includes(n.id));
  const readingHistory = user.readingHistory || [];

  return (
    <div className="space-y-8 pb-16">
      {/* Title */}
      <div className="pb-4 border-b border-purple-900/40 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-amber-300">
              My Library
            </span>{' '}
            – <span className="text-purple-300">मेरी लाइब्रेरी</span>
          </h1>
          <p className="text-xs sm:text-sm text-purple-300/80 mt-1">
            नमस्ते, <strong className="text-white">{user.name}</strong> • आपकी पसंदीदा कहानियाँ और इतिहास
          </p>
        </div>

        {/* Membership pill badge */}
        <div className="flex items-center gap-2">
          {isVip ? (
            <div className="vip-badge-3d px-3 py-1.5 rounded-xl text-xs font-black text-amber-950 flex items-center gap-1.5 shadow-md">
              <Crown className="w-4 h-4 fill-amber-950" />
              <span>VIP Active</span>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('premium')}
              className="btn-3d btn-3d-gold px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>वीआईपी बनें (Upgrade)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-purple-900/30">
        <button
          onClick={() => setActiveTab('bookmarks')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'bookmarks'
              ? 'btn-3d-primary text-white shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>बुकमार्क्स ({bookmarkedNovels.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'history'
              ? 'btn-3d-primary text-white shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>ऑडियो सुनने का इतिहास ({readingHistory.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('payments')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'payments'
              ? 'btn-3d-primary text-white shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>पेमेंट हिस्ट्री (Payment History)</span>
        </button>

        <button
          onClick={() => setActiveTab('membership')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'membership'
              ? 'btn-3d-gold text-amber-950 shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          <span>सदस्यता विवरण (Membership)</span>
        </button>
      </div>

      {/* TAB 1: BOOKMARKS */}
      {activeTab === 'bookmarks' && (
        <div>
          {bookmarkedNovels.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {bookmarkedNovels.map((novel) => (
                <NovelCard
                  key={novel.id}
                  novel={novel}
                  onSelect={onSelectNovel}
                  onReadDirect={onReadDirect}
                />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center rounded-2xl bg-purple-950/20 border border-purple-500/20 p-8 space-y-3">
              <Bookmark className="w-12 h-12 text-purple-400/40 mx-auto" />
              <h3 className="text-base font-bold text-white">कोई बुकमार्क नहीं है</h3>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                अपनी पसंदीदा कहानियों को बाद में सुनने के लिए बुकमार्क करें।
              </p>
              <button
                onClick={() => onNavigate('explore')}
                className="btn-3d btn-3d-primary px-5 py-2 rounded-xl text-xs font-bold text-white"
              >
                उपन्यास एक्सप्लोर करें
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LISTENING HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {readingHistory.length > 0 ? (
            readingHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-[#120726] border border-purple-500/20 hover:border-purple-400/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white line-clamp-1">{item.novelTitle}</h3>
                  <p className="text-xs text-purple-300/80 mt-0.5 line-clamp-1">
                    अध्याय #{item.chapterNumber}: {item.chapterTitle}
                  </p>
                  <span className="text-[10px] text-purple-400 font-mono mt-1 block">
                    अंतिम बार सुना गया: {new Date(item.updatedAt).toLocaleDateString('hi-IN')}
                  </span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="w-24 sm:w-32 bg-purple-950 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-amber-400 h-full rounded-full"
                      style={{ width: `${item.progressPercent || 20}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-purple-300 w-10 text-right">
                    {item.progressPercent}%
                  </span>

                  <button
                    onClick={() => onSelectNovel(item.novelId)}
                    className="btn-3d btn-3d-primary px-3.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>सुनना जारी रखें (Resume)</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 text-center rounded-2xl bg-purple-950/20 border border-purple-500/20 p-8 space-y-3">
              <Clock className="w-12 h-12 text-purple-400/40 mx-auto" />
              <h3 className="text-base font-bold text-white">अभी तक कोई कहानी नहीं सुनी गई</h3>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                जब आप कोई ऑडियो उपन्यास सुनना शुरू करेंगे, तो आपका इतिहास यहाँ दिखाई देगा।
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYMENT HISTORY */}
      {activeTab === 'payments' && (
        <div className="space-y-3">
          {loadingPayments ? (
            <div className="py-12 text-center text-xs text-purple-300">
              पेमेंट लोड हो रहे हैं...
            </div>
          ) : payments.length > 0 ? (
            payments.map((p) => {
              const statusMap = {
                approved: {
                  label: 'स्वीकृत (Approved)',
                  icon: CheckCircle,
                  class: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                },
                pending: {
                  label: 'लंबित सत्यापन (Pending)',
                  icon: Timer,
                  class: 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                },
                rejected: {
                  label: 'अस्वीकृत (Rejected)',
                  icon: AlertCircle,
                  class: 'bg-red-950/80 text-red-300 border-red-500/40'
                }
              };

              const StatusBadge = statusMap[p.status];
              const Icon = StatusBadge.icon;

              return (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-[#120726] border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{p.itemName}</h4>
                      <span className="text-sm font-black text-amber-400">₹{p.amount}</span>
                    </div>
                    <p className="text-xs text-purple-300/80 mt-0.5">
                      नाम: {p.userName} • {new Date(p.createdAt).toLocaleDateString('hi-IN')}
                    </p>
                    {p.utrNumber && (
                      <p className="text-[11px] font-mono text-purple-400">UTR: {p.utrNumber}</p>
                    )}
                    {p.rejectionReason && (
                      <p className="text-[11px] text-red-300 mt-1">
                        कारण: {p.rejectionReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${StatusBadge.class}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{StatusBadge.label}</span>
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-16 text-center rounded-2xl bg-purple-950/20 border border-purple-500/20 p-8 space-y-3">
              <CreditCard className="w-12 h-12 text-purple-400/40 mx-auto" />
              <h3 className="text-base font-bold text-white">कोई पेमेंट रिकॉर्ड नहीं है</h3>
              <p className="text-xs text-purple-300/70 max-w-sm mx-auto">
                जब आप वीआईपी प्लान के लिए यूपीआई से भुगतान करेंगे, तो यहाँ स्थिति ट्रैक होगी।
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MEMBERSHIP DETAILS */}
      {activeTab === 'membership' && (
        <div className="max-w-xl mx-auto rounded-3xl bg-[#120726] border border-purple-500/30 p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">सदस्यता स्थिति (Status)</h3>
              <p className="text-xs text-purple-300/80">Crazy Storyes VIP Account Details</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-3 text-xs text-purple-200">
            <div className="flex items-center justify-between py-1 border-b border-purple-900/40">
              <span className="text-purple-400">स्थिति:</span>
              <span className="font-bold">
                {isVip ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> एक्टिव वीआईपी (Active VIP)
                  </span>
                ) : (
                  <span className="text-purple-300">फ्री रीडर (Free Reader)</span>
                )}
              </span>
            </div>

            {isVip && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-purple-900/40">
                  <span className="text-purple-400">सक्रिय प्लान:</span>
                  <span className="font-bold text-white">
                    {user.membership?.planName || 'VIP Membership'}
                  </span>
                </div>
                {user.membership?.expiresAt && (
                  <div className="flex items-center justify-between py-1 border-b border-purple-900/40">
                    <span className="text-purple-400">वैधता समाप्ति (Expires):</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {new Date(user.membership.expiresAt).toLocaleDateString('hi-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between py-1">
              <span className="text-purple-400">ऑडियो प्लेयर स्पीड:</span>
              <span className="font-bold text-white">
                {isVip ? '3x मैक्सिमम स्पीड' : '1.5x (अपग्रेड करके 3x पाएं)'}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('premium')}
            className="w-full btn-3d btn-3d-gold py-3 rounded-xl font-black text-xs text-amber-950 flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>{isVip ? 'सदस्यता नवीनीकरण / अपग्रेड करें' : 'अभी वीआईपी बनें (Join VIP)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
