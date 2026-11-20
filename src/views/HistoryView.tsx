import React, { useState } from 'react';
import { History, Headphones, Trash2, Play, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Novel } from '../types.js';

interface HistoryViewProps {
  novels: Novel[];
  onSelectNovel: (novel: Novel) => void;
  onContinueChapter: (novelId: string, chapterId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  novels,
  onSelectNovel,
  onContinueChapter
}) => {
  const { user, token, refreshUser } = useAuth();
  const [clearing, setClearing] = useState(false);

  const history = (user?.readingHistory || []).slice(0, 5);

  const handleClearHistory = async () => {
    if (!token) return;
    try {
      setClearing(true);
      await fetch('/api/auth/reading-history', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await refreshUser();
    } catch (err) {
      console.error('Failed to clear history:', err);
    } finally {
      setClearing(false);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<'reading' | 'auth'>('reading');
  const [authLogs, setAuthLogs] = useState<any[]>([]);
  const [authLogsLoading, setAuthLogsLoading] = useState(false);
  const [sessionMeta, setSessionMeta] = useState<{ lastLoginAt?: string; lastLogoutAt?: string }>({});

  const loadMyAuthHistory = async () => {
    if (!token) return;
    setAuthLogsLoading(true);
    try {
      const res = await fetch('/api/auth/my-history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuthLogs(data.logs || []);
        setSessionMeta({
          lastLoginAt: data.lastLoginAt,
          lastLogoutAt: data.lastLogoutAt
        });
      }
    } catch (err) {
      console.error('Failed to load my auth history:', err);
    } finally {
      setAuthLogsLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeSubTab === 'auth') {
      loadMyAuthHistory();
    }
  }, [activeSubTab, token]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Sub Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b border-purple-900/40 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('reading')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeSubTab === 'reading'
              ? 'btn-3d-gold text-amber-950 shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <Headphones className="w-4 h-4" />
          <span>🎧 ऑडियो इतिहास (Listening History)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('auth')}
          className={`btn-3d px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 ${
            activeSubTab === 'auth'
              ? 'btn-3d-gold text-amber-950 shadow-md'
              : 'bg-purple-950/40 text-purple-300 hover:text-white border border-purple-500/20'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>🛡️ मेरा लॉगिन व सुरक्षा इतिहास (My Login History)</span>
        </button>
      </div>

      {activeSubTab === 'reading' ? (
        <>
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-purple-900/40">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-900/40 border border-purple-500/30 text-amber-400">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white">ऑडियो इतिहास (Listening History)</h1>
                <p className="text-xs text-purple-300/80">
                  हाल ही में सुने गए अंतिम 5 अनोखे उपन्यास (Last 5 Listened Novels)
                </p>
              </div>
            </div>

            {history.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={clearing}
                className="btn-3d px-4 py-2 rounded-xl text-xs font-bold bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-500/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{clearing ? 'साफ़ हो रहा है...' : 'इतिहास साफ़ करें (Clear History)'}</span>
              </button>
            )}
          </div>

          {!user ? (
            <div className="p-8 rounded-2xl bg-[#120726] border border-purple-500/30 text-center">
              <p className="text-purple-200 font-semibold">
                अपना ऑडियो इतिहास देखने के लिए कृपया लॉगिन करें।
              </p>
            </div>
          ) : history.length === 0 ? (
            <div className="p-10 rounded-2xl bg-[#120726] border border-purple-500/30 text-center space-y-2">
              <Clock className="w-10 h-10 text-purple-400 mx-auto opacity-70" />
              <p className="text-base font-bold text-white">अभी कोई ऑडियो इतिहास नहीं है</p>
              <p className="text-xs text-purple-300/70">
                जब आप कोई उपन्यास सुनेंगे, तो वह यहाँ दिखाई देगा।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {history.map((item) => {
            const matchedNovel = novels.find((n) => n.id === item.novelId);
            const cover =
              matchedNovel?.coverImage ||
              '/src/assets/images/novel_cover_immortal_rebirth_1794460891135.jpg';

            return (
              <div
                key={item.novelId}
                className="p-4 rounded-2xl bg-[#120726] border border-purple-500/30 hover:border-purple-400/60 transition flex gap-4 items-center shadow-lg"
              >
                <img
                  src={cover}
                  alt={item.novelTitle}
                  onClick={() => matchedNovel && onSelectNovel(matchedNovel)}
                  className="w-28 aspect-video object-cover rounded-xl border border-purple-500/30 shrink-0 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <h3
                    onClick={() => matchedNovel && onSelectNovel(matchedNovel)}
                    className="text-sm font-bold text-white truncate cursor-pointer hover:text-amber-300"
                  >
                    {item.novelTitle}
                  </h3>
                  <p className="text-xs text-purple-300 truncate mt-0.5">
                    अध्याय {item.chapterNumber}: {item.chapterTitle}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-950 border border-purple-500/30 text-[10px] font-semibold text-purple-200">
                      <Headphones className="w-3 h-3 text-amber-400" />
                      <span>Telegram Audio</span>
                    </span>
                    <span className="text-[11px] font-bold text-amber-400">
                      {Math.round(item.progressPercent || 0)}%
                    </span>
                  </div>

                  <div className="w-full h-1.5 bg-purple-950 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-amber-400"
                      style={{ width: `${Math.min(100, Math.max(0, item.progressPercent || 0))}%` }}
                    />
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={() => onContinueChapter(item.novelId, item.chapterId)}
                      className="btn-3d btn-3d-primary px-3.5 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>सुनना जारी रखें (Continue Listening)</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </>
      ) : (
        /* MY LOGIN & SECURITY HISTORY VIEW */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-900/40">
            <div>
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-400" />
                <span>सत्र व लॉगिन इतिहास (Session & Login History)</span>
              </h1>
              <p className="text-xs text-purple-300/80">
                आपके खाते के हालिया लॉगिन, लॉगआउट और सक्रिय सत्र रिकॉर्ड्स
              </p>
            </div>

            <button
              onClick={loadMyAuthHistory}
              disabled={authLogsLoading}
              className="btn-3d px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-950/60 hover:bg-purple-900 text-purple-200 border border-purple-500/30 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <span>{authLogsLoading ? 'लोड हो रहा है...' : '🔄 रिफ्रेश'}</span>
            </button>
          </div>

          {!user ? (
            <div className="p-8 rounded-2xl bg-[#120726] border border-purple-500/30 text-center">
              <p className="text-purple-200 font-semibold">
                अपना लॉगिन इतिहास देखने के लिए कृपया लॉगिन करें।
              </p>
            </div>
          ) : (
            <>
              {/* Account Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-[#120726] border border-purple-500/30 space-y-1">
                  <span className="text-[11px] font-bold text-purple-400 block">पंजीकृत ईमेल</span>
                  <div className="text-sm font-bold text-white font-mono truncate">{user.email}</div>
                  <span className="text-[10px] text-purple-300/70">रोल: {user.role === 'admin' ? 'व्यवस्थापक (Admin)' : 'पाठक (Reader)'}</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#120726] border border-purple-500/30 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-400 block">अंतिम सफल लॉगिन (Last Login)</span>
                  <div className="text-sm font-bold text-white">
                    {sessionMeta.lastLoginAt || user.lastLoginAt
                      ? new Date(sessionMeta.lastLoginAt || user.lastLoginAt!).toLocaleString('hi-IN')
                      : 'हाल ही में'}
                  </div>
                  <span className="text-[10px] text-emerald-400/70">सक्रिय सत्र (Active Session)</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#120726] border border-purple-500/30 space-y-1">
                  <span className="text-[11px] font-bold text-purple-400 block">अंतिम लॉगआउट (Last Logout)</span>
                  <div className="text-sm font-bold text-white">
                    {sessionMeta.lastLogoutAt || user.lastLogoutAt
                      ? new Date(sessionMeta.lastLogoutAt || user.lastLogoutAt!).toLocaleString('hi-IN')
                      : 'कोई पिछला रिकॉर्ड नहीं'}
                  </div>
                  <span className="text-[10px] text-purple-300/70">टोकन निरस्तीकरण सुरक्षित</span>
                </div>
              </div>

              {/* History Table */}
              <div className="rounded-2xl bg-[#120726] border border-purple-500/30 overflow-hidden shadow-xl">
                <div className="p-4 border-b border-purple-900/40 flex items-center justify-between">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    हालिया गतिविधि लॉग (केवल आपके खाते का इतिहास)
                  </span>
                  <span className="text-[11px] font-mono text-purple-400">{authLogs.length} रिकॉर्ड्स</span>
                </div>

                {authLogsLoading ? (
                  <div className="p-8 text-center text-xs text-purple-300">डेटा लोड हो रहा है...</div>
                ) : authLogs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-purple-400">कोई गतिविधि लॉग उपलब्ध नहीं है।</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-purple-200">
                      <thead className="bg-purple-950/60 text-purple-300 uppercase font-mono text-[10px] tracking-wider border-b border-purple-900/40">
                        <tr>
                          <th className="p-3">समय (Timestamp)</th>
                          <th className="p-3">घटना (Event)</th>
                          <th className="p-3">IP पता</th>
                          <th className="p-3">डिवाइस / ब्राउज़र</th>
                          <th className="p-3 text-right">स्थिति (Status)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-900/30 font-mono text-[11px]">
                        {authLogs.map((log: any) => {
                          const isSuccess = log.status === 'success';
                          const isFailed = log.eventType === 'failed_login';
                          const isLogout = log.eventType === 'logout';
                          const isReg = log.eventType === 'registration';

                          return (
                            <tr key={log.id} className="hover:bg-purple-900/20 transition">
                              <td className="p-3 text-purple-300 whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('hi-IN')}
                              </td>
                              <td className="p-3 font-bold">
                                {isReg ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-purple-900/60 text-purple-300 border border-purple-500/30">
                                    ✨ नया खाता पंजीकरण
                                  </span>
                                ) : isLogout ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-blue-950 text-blue-300 border border-blue-500/30">
                                    🚪 लॉगआउट (सत्र समाप्त)
                                  </span>
                                ) : isFailed ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-500/40">
                                    ❌ असफल लॉगिन प्रयास
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                    🔑 सफल लॉगिन
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-purple-400">{log.ipAddress || '-'}</td>
                              <td className="p-3 text-purple-300/90">{log.deviceInfo || log.userAgent?.slice(0, 30) || 'ब्राउज़र'}</td>
                              <td className="p-3 text-right">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    isSuccess
                                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-red-950/80 text-red-300 border border-red-500/40'
                                  }`}
                                >
                                  {isSuccess ? 'सफल' : 'विफल'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
