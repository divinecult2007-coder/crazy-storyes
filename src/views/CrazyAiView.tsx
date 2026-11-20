import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  BookOpen, 
  HelpCircle, 
  Flame, 
  Compass, 
  AlertTriangle,
  RefreshCw,
  Crown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

interface CrazyAiViewProps {
  initialNovelId?: string;
  initialChapterId?: string;
  onNavigate: (view: string, params?: any) => void;
}

export const CrazyAiView: React.FC<CrazyAiViewProps> = ({
  initialNovelId,
  initialChapterId,
  onNavigate
}) => {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: 'नमस्ते! मैं आपका **Crazy AI** सहायक हूँ। 🙏✨\n\nमैं Crazy Storyes के उपन्यासों की सिफारिश करने, कठिन शब्दों के अर्थ समझाने, अध्यायों का सारांश देने और वेबसाइट पर नेविगेट करने में आपकी सहायता कर सकता हूँ। आज आप क्या जानना चाहते हैं?',
      timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiConfig, setAiConfig] = useState<{ configured: boolean; enabled: boolean; model: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((res) => res.json())
      .then((data) => setAiConfig(data))
      .catch((err) => console.error('AI status error:', err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const quickPrompts = [
    { text: 'मुझे एक रोमांचक Cultivation उपन्यास सुझाएं', icon: Flame },
    { text: "'प्राण ऊर्जा' और 'काया शोधन' का क्या अर्थ है?", icon: HelpCircle },
    { text: 'अमर पुनर्जन्म उपन्यास का मुख्य कथानक क्या है?', icon: BookOpen },
    { text: 'Crazy Storyes पर VIP सदस्यता कैसे लें?', icon: Crown }
  ];

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMsg.text,
          contextNovelId: initialNovelId,
          contextChapterId: initialChapterId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'उत्तर प्राप्त करने में असमर्थ');
      }

      const aiMsg: Message = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: data.reply,
        timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err_${Date.now()}`,
        sender: 'ai',
        text: `⚠️ **त्रुटि:** ${err.message || 'Crazy AI इस समय उत्तर नहीं दे सका।'}`,
        timestamp: new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-purple-900/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-pink-600 via-purple-600 to-indigo-600 text-white shadow-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Crazy AI – <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-amber-300">उपन्यास सहायक</span>
            </h1>
          </div>
          <p className="text-xs text-purple-300/80 mt-1">
            उपन्यासों के सवाल पूछें, कठिन शब्दों के अर्थ समझें और नए उपन्यासों की सिफारिश लें
          </p>
        </div>

        {aiConfig && (
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                aiConfig.configured
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/30'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  aiConfig.configured ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>{aiConfig.configured ? 'Gemini 3.8 Flash Online' : 'API Key Required'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Configuration Alert if GEMINI_API_KEY is missing */}
      {aiConfig && !aiConfig.configured && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-300">GEMINI_API_KEY पर्यावरण चर की आवश्यकता है</h4>
            <p className="text-purple-200/90 leading-relaxed">
              सर्वर-साइड AI का उपयोग करने के लिए AI Studio Secrets या .env फ़ाइल में <code className="bg-amber-950 px-1.5 py-0.5 rounded text-amber-300 font-mono">GEMINI_API_KEY</code> जोड़ें। बिना वैध कुंजी के AI नकली उत्तर नहीं देगा।
            </p>
          </div>
        </div>
      )}

      {/* Quick Prompts Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {quickPrompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSend(p.text)}
              disabled={loading}
              className="btn-3d px-3.5 py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 border border-purple-500/20 hover:border-purple-400/40 text-xs font-medium text-purple-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 transition"
            >
              <Icon className="w-3.5 h-3.5 text-pink-400" />
              <span>{p.text}</span>
            </button>
          );
        })}
      </div>

      {/* Chat Messages Feed Container */}
      <div className="rounded-3xl bg-[#120726] border border-purple-500/30 p-4 sm:p-6 shadow-2xl h-[480px] flex flex-col justify-between overflow-hidden">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    isUser
                      ? 'bg-purple-600 text-white'
                      : 'bg-gradient-to-tr from-pink-600 to-purple-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-md ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-tr-none'
                      : 'bg-purple-950/70 border border-purple-500/30 text-purple-100 rounded-tl-none whitespace-pre-line'
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`block text-[10px] mt-1.5 font-mono ${
                      isUser ? 'text-purple-200 text-right' : 'text-purple-400 text-left'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-pink-400" />
                <span>Crazy AI उत्तर तैयार कर रहा है...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="mt-4 pt-4 border-t border-purple-900/40 flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Crazy AI से कोई भी सवाल पूछें (e.g. इस उपन्यास का क्या अर्थ है?)..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 rounded-2xl bg-purple-950/60 border border-purple-500/30 text-white placeholder-purple-400/40 text-xs sm:text-sm focus:outline-none focus:border-purple-400 focus:bg-purple-950/80 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="btn-3d btn-3d-primary p-3 rounded-2xl text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};
