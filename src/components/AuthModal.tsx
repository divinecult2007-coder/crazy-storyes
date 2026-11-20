import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User as UserIcon, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const AuthModal: React.FC = () => {
  const { authModalOpen, setAuthModalOpen, authModalMode, setAuthModalMode, login } = useAuth();

  const [activeTab, setActiveTab] = useState<'reader' | 'admin'>('reader');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [isAdminSetup, setIsAdminSetup] = useState<boolean>(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [adminStatus, setAdminStatus] = useState<{ hasAdmin: boolean; authorizedAdminEmail: string } | null>(null);

  const safeJsonParse = async (res: Response) => {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      if (!res.ok) {
        if (res.status === 403 && text.includes('<html')) {
          throw new Error('प्रवेश अस्वीकृत (403 Forbidden): कृपया पेज रिफ्रेश करें या ब्राउज़र कुकीज़/सत्र अनुमति जांचें।');
        }
        throw new Error(`सर्वर त्रुटि (${res.status}): कृपया पुनः प्रयास करें।`);
      }
      throw new Error('सर्वर से अमान्य प्रतिक्रिया मिली।');
    }
  };

  useEffect(() => {
    if (authModalOpen) {
      setError(null);
      setSuccess(null);
      setPassword('');
      setConfirmPassword('');

      // Check admin status
      fetch('/api/auth/admin-status')
        .then(async (res) => {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            return res.json();
          }
          return { hasAdmin: false, authorizedAdminEmail: '' };
        })
        .then((data) => {
          setAdminStatus(data);
          if (data.hasAdmin) {
            setIsAdminSetup(false);
          } else if (authModalMode.includes('admin')) {
            setIsAdminSetup(true);
            setActiveTab('admin');
          }
        })
        .catch((err) => console.error('Admin status error:', err));

      if (authModalMode === 'register') {
        setActiveTab('reader');
        setIsRegistering(true);
      } else if (authModalMode === 'admin-login') {
        setActiveTab('admin');
        setIsAdminSetup(false);
      } else if (authModalMode === 'admin-setup') {
        setActiveTab('admin');
        setIsAdminSetup(true);
      } else {
        setActiveTab('reader');
        setIsRegistering(false);
      }
    }
  }, [authModalOpen, authModalMode]);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError('ईमेल और पासवर्ड आवश्यक हैं');
      return;
    }

    if ((isRegistering || isAdminSetup) && password.length < 6) {
      setError('पासवर्ड कम से कम 6 अक्षरों का होना चाहिए');
      return;
    }

    if ((isRegistering || isAdminSetup) && confirmPassword && password !== confirmPassword) {
      setError('पासवर्ड मेल नहीं खा रहे हैं (Passwords do not match)');
      return;
    }

    setLoading(true);

    try {
      if (activeTab === 'admin') {
        if (isAdminSetup) {
          // Admin first-time setup
          const res = await fetch('/api/auth/admin-setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email.trim(),
              password,
              name: name.trim() || 'Owner Admin'
            })
          });

          const data = await safeJsonParse(res);
          if (!res.ok) throw new Error(data.error || 'एडमिन सेटअप में त्रुटि');

          login(data.token, data.user);
          setSuccess('एडमिन खाता सफलतापूर्वक सेटअप हुआ!');
          setTimeout(() => setAuthModalOpen(false), 1200);
        } else {
          // Admin login
          const res = await fetch('/api/auth/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
          });

          const data = await safeJsonParse(res);
          if (!res.ok) throw new Error(data.error || 'एडमिन लॉगिन विफल');

          login(data.token, data.user);
          setSuccess('एडमिन लॉगिन सफल!');
          setTimeout(() => setAuthModalOpen(false), 1000);
        }
      } else {
        // Reader Flow
        if (isRegistering) {
          if (!name.trim()) {
            setError('कृपया अपना नाम दर्ज करें');
            setLoading(false);
            return;
          }

          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), email: email.trim(), password })
          });

          const data = await safeJsonParse(res);
          if (!res.ok) throw new Error(data.error || 'पंजीकरण विफल');

          login(data.token, data.user);
          setSuccess('पंजीकरण सफल! आपका स्वागत है।');
          setTimeout(() => setAuthModalOpen(false), 1000);
        } else {
          // Reader Login
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim(), password })
          });

          const data = await safeJsonParse(res);
          if (!res.ok) throw new Error(data.error || 'लॉगिन विफल');

          login(data.token, data.user);
          setSuccess('लॉगिन सफल!');
          setTimeout(() => setAuthModalOpen(false), 1000);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'त्रुटि उत्पन्न हुई');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl flex flex-col">
        {/* Close Button */}
        <button
          onClick={() => setAuthModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/40 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switch between Reader and Admin */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-purple-950/60 border border-purple-500/20 mb-5">
          <button
            type="button"
            onClick={() => {
              setActiveTab('reader');
              setError(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'reader'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-purple-300 hover:text-white'
            }`}
          >
            📖 पाठक (Reader)
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin');
              setError(null);
              if (!adminStatus?.hasAdmin) {
                setIsAdminSetup(true);
              }
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-amber-400/80 hover:text-amber-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>एडमिन (Admin)</span>
          </button>
        </div>

        {/* Modal Header */}
        <div className="mb-4">
          <h2 className="text-xl font-black text-white">
            {activeTab === 'admin'
              ? isAdminSetup
                ? '🛡️ एडमिन खाता सेटअप (Owner Setup)'
                : '🛡️ सुरक्षित एडमिन लॉगिन (Admin Login)'
              : isRegistering
              ? '✨ नया पाठक खाता बनाएं (Register)'
              : '🔑 पाठक लॉगिन (Reader Login)'}
          </h2>
          <p className="text-xs text-purple-300/80 mt-1">
            {activeTab === 'admin'
              ? isAdminSetup
                ? 'वेबसाइट ओनर / एडमिन खाता बनाएं • अपनी ईमेल और सुरक्षित पासवर्ड दर्ज करें'
                : 'केवल अधिकृत वेबसाइट मालिक के लिए'
              : 'Crazy Storyes में सभी फ्री ऑडियो उपन्यास और ऑडियोबुक्स सुनें'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{success}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {(isRegistering || isAdminSetup) && (
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">
                पूरा नाम (Full Name)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm"
                />
                <UserIcon className="w-4 h-4 text-purple-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1">
              ईमेल पता (Email Address)
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder={
                  activeTab === 'admin'
                    ? adminStatus?.hasAdmin
                      ? adminStatus?.authorizedAdminEmail || 'admin@example.com'
                      : 'admin@yourdomain.com'
                    : 'your.email@example.com'
                }
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm"
              />
              <Mail className="w-4 h-4 text-purple-400 absolute left-3 top-3 pointer-events-none" />
            </div>
            {activeTab === 'admin' && adminStatus?.hasAdmin && adminStatus?.authorizedAdminEmail && (
              <p className="text-[11px] text-amber-300/80 mt-1">
                ℹ️ पंजीकृत एडमिन ईमेल: <strong>{adminStatus.authorizedAdminEmail}</strong>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1">
              पासवर्ड (Password)
            </label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder="कम से कम 6 अक्षर"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm"
              />
              <Lock className="w-4 h-4 text-purple-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          {(isRegistering || isAdminSetup) && (
            <div>
              <label className="block text-xs font-semibold text-purple-200 mb-1">
                पासवर्ड दोबारा पुष्टि करें (Confirm Password)
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="वही पासवर्ड दोबारा लिखें"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm"
                />
                <Lock className="w-4 h-4 text-purple-400 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full btn-3d py-3 rounded-xl font-bold text-sm text-white mt-3 flex items-center justify-center gap-2 ${
              activeTab === 'admin' ? 'btn-3d-gold' : 'btn-3d-primary'
            }`}
          >
            {loading ? (
              <span>प्रक्रिया जारी है...</span>
            ) : activeTab === 'admin' ? (
              isAdminSetup ? 'एडमिन पासवर्ड बनाएं (Create Admin Account)' : 'एडमिन लॉगिन करें (Admin Login)'
            ) : isRegistering ? (
              'खाता बनाएं (Create Free Account)'
            ) : (
              'लॉगिन करें (Log In)'
            )}
          </button>
        </form>

        {/* Toggle between register and login */}
        {activeTab === 'reader' ? (
          <div className="mt-4 pt-3 border-t border-purple-900/40 text-center text-xs text-purple-300">
            {isRegistering ? (
              <span>
                पहले से खाता है?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(null);
                  }}
                  className="font-bold text-amber-400 hover:underline ml-1"
                >
                  लॉगिन करें (Log In)
                </button>
              </span>
            ) : (
              <span>
                नया पाठक हैं?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setError(null);
                  }}
                  className="font-bold text-amber-400 hover:underline ml-1"
                >
                  मुफ़्त पंजीकरण करें (Register Free)
                </button>
              </span>
            )}
          </div>
        ) : (
          <div className="mt-4 pt-3 border-t border-purple-900/40 text-center text-xs text-purple-300">
            {isAdminSetup ? (
              <span>
                पहले से एडमिन पासवर्ड बना चुके हैं?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminSetup(false);
                    setError(null);
                  }}
                  className="font-bold text-amber-400 hover:underline ml-1"
                >
                  एडमिन लॉगिन करें
                </button>
              </span>
            ) : !adminStatus?.hasAdmin ? (
              <span>
                पहला सेटअप करना चाहते हैं?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminSetup(true);
                    setError(null);
                  }}
                  className="font-bold text-amber-400 hover:underline ml-1"
                >
                  एडमिन पासवर्ड बनाएं (First-time setup)
                </button>
              </span>
            ) : (
              <span className="text-purple-400/80">
                एडमिन खाता पहले से पंजीकृत है • कृपया एडमिन लॉगिन करें
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
