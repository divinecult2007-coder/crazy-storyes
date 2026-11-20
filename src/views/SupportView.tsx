import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Send, 
  MessageSquare, 
  AlertCircle, 
  CheckCircle, 
  Mail, 
  Phone, 
  Clock, 
  MessageCircle 
} from 'lucide-react';
import { SupportTicket } from '../types.js';
import { useAuth } from '../context/AuthContext.js';

export const SupportView: React.FC = () => {
  const { user, token } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [category, setCategory] = useState<'question' | 'problem' | 'feedback' | 'payment'>('question');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const fetchMyTickets = () => {
    if (!token) {
      setTickets([]);
      return;
    }

    fetch('/api/support/my-tickets', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => (res.ok ? res.json() : { tickets: [] }))
      .then((data) => setTickets(data.tickets || []))
      .catch((err) => console.error('Failed to load tickets:', err));
  };

  useEffect(() => {
    fetchMyTickets();
  }, [token, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, email, category, subject, message })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'संदेश भेजने में विफलता');

      setSubmitted(true);
      setSubject('');
      setMessage('');
      if (token) {
        fetchMyTickets();
      } else if (data.ticket) {
        setTickets((prev) => [data.ticket, ...prev]);
      }
    } catch (err: any) {
      setError(err?.message || 'त्रुटि उत्पन्न हुई');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-16">
      {/* Header */}
      <div className="text-center space-y-2 pb-4 border-b border-purple-900/40">
        <h1 className="text-3xl sm:text-4xl font-black text-white">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
            Help & Support
          </span>{' '}
          – <span className="text-amber-400 text-3d-gold">सहायता केंद्र</span>
        </h1>
        <p className="text-xs sm:text-sm text-purple-300/80 max-w-xl mx-auto">
          कोई समस्या है या प्रश्न पूछना चाहते हैं? हमारी टीम आपकी सहायता के लिए सदैव तत्पर है।
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Support Form */}
        <div className="lg:col-span-7 rounded-3xl bg-[#120726] border border-purple-500/30 p-6 sm:p-8 shadow-2xl space-y-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <span>संदेश भेजें (Submit Message)</span>
          </h2>

          {submitted ? (
            <div className="p-6 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">संदेश प्राप्त हुआ!</h3>
              <p className="text-xs text-purple-200/90 leading-relaxed">
                आपका संदेश सफलतापूर्वक दर्ज कर लिया गया है। एडमिन का उत्तर नीचे 'मेरी सहायता हिस्ट्री' में दिखाई देगा।
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="btn-3d btn-3d-primary px-5 py-2 rounded-xl text-xs font-bold text-white mt-2"
              >
                नया संदेश भेजें
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    आपका नाम (Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-xs sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-purple-200 mb-1">
                    ईमेल पता (Email) *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  श्रेणी (Category)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'question', label: '❓ सवाल' },
                    { id: 'problem', label: '⚠️ समस्या' },
                    { id: 'payment', label: '💳 पेमेंट' },
                    { id: 'feedback', label: '💡 सुझाव' }
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id as any)}
                      className={`p-2 rounded-xl text-xs font-bold border transition ${
                        category === cat.id
                          ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                          : 'bg-purple-950/40 border-purple-500/20 text-purple-300 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  विषय (Subject) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. VIP सदस्यता एक्टिव नहीं हुई"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-xs sm:text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  विस्तृत संदेश (Message) *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="कृपया अपनी समस्या या सवाल विस्तार से लिखें..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-xs sm:text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-3d btn-3d-primary py-3 rounded-xl font-bold text-xs sm:text-sm text-white flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>भेजा जा रहा है...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>संदेश भेजें (Send Message)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Support History & Direct Contacts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Contact Card */}
          <div className="p-5 rounded-3xl bg-[#120726] border border-purple-500/20 space-y-3.5">
            <h3 className="text-base font-bold text-white">सीधा संपर्क (Direct Contact)</h3>
            <div className="space-y-2.5 text-xs text-purple-200">
              <a
                href="mailto:divinecult2007@gmail.com"
                className="flex items-center gap-2 hover:text-white transition"
              >
                <Mail className="w-4 h-4 text-purple-400" />
                <span>divinecult2007@gmail.com</span>
              </a>
              <a
                href="tel:+918290188433"
                className="flex items-center gap-2 hover:text-white transition"
              >
                <Phone className="w-4 h-4 text-purple-400" />
                <span>+91 8290188433</span>
              </a>
              <a
                href="https://wa.me/918290188433"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-semibold transition"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>व्हाट्सएप पर चैट करें (WhatsApp Chat)</span>
              </a>
              <p className="flex items-center gap-2 text-purple-300/80 pt-1">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>सोमवार से शनिवार: 10:00 AM - 8:00 PM IST</span>
              </p>
            </div>
          </div>

          {/* Ticket History */}
          <div className="rounded-3xl bg-[#120726] border border-purple-500/20 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-purple-900/40">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-purple-400" />
                <span>मेरी सहायता हिस्ट्री ({tickets.length})</span>
              </h3>
            </div>

            {tickets.length > 0 ? (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white truncate">{t.subject}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.status === 'answered'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {t.status === 'answered' ? 'उत्तर प्राप्त' : 'ओपन'}
                      </span>
                    </div>

                    <p className="text-purple-300/80 leading-relaxed text-[11px]">{t.message}</p>

                    {t.adminReply && (
                      <div className="p-2.5 rounded-xl bg-purple-900/60 border border-purple-400/40 space-y-1">
                        <span className="text-[10px] font-bold text-amber-400 block">
                          🛡️ एडमिन का उत्तर (Admin Reply):
                        </span>
                        <p className="text-white text-xs">{t.adminReply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-purple-400/70 py-4 text-center">
                आपके द्वारा भेजा गया कोई संदेश अभी तक दर्ज नहीं है।
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
