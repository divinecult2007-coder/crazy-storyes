import React from 'react';
import { BookOpen, Crown, Heart, Shield, Sparkles, Mail, Phone } from 'lucide-react';

interface FooterProps {
  onNavigate: (view: string, params?: any) => void;
  supportEmail?: string;
  supportPhone?: string;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, supportEmail, supportPhone }) => {
  const categories = [
    'System', 'Action', 'Fantasy', 'Adventure', 
    'Rebirth', 'Cultivation', 'Romance', 'Comedy', 
    'Supernatural', 'Martial Arts', 'Modern', 'Mystery'
  ];

  return (
    <footer className="mt-20 border-t border-purple-900/40 bg-gradient-to-b from-[#090314] to-[#040108] text-purple-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('home')}>
              <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-md">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="text-xl font-black text-white font-serif">
                Crazy <span className="text-purple-400">Storyes</span>
              </span>
            </div>
            <p className="text-xs text-purple-300/80 leading-relaxed">
              भारत का सर्वश्रेष्ठ प्रीमियम हिंदी उपन्यास और ऑडियोबुक्स प्लेटफ़ॉर्म। 16:9 एचडी कवर्स, इमर्सिव ऑडियो प्लेयर, और विशेष VIP कहानियाँ।
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="px-2.5 py-1 rounded-md bg-purple-900/40 border border-purple-500/20 text-[11px] font-semibold text-purple-200 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" /> VIP Access
              </span>
              <span className="px-2.5 py-1 rounded-md bg-purple-900/40 border border-purple-500/20 text-[11px] font-semibold text-purple-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-pink-400" /> Crazy AI
              </span>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-1.5">
              <span>श्रेणियां (Categories)</span>
            </h4>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {categories.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  onClick={() => onNavigate('explore', { category: cat })}
                  className="text-left text-purple-300/70 hover:text-white hover:translate-x-1 transition-transform truncate"
                >
                  • {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-sm font-bold text-white mb-3">त्वरित लिंक (Quick Links)</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => onNavigate('home')} className="hover:text-white transition">
                  मुख्य पृष्ठ (Home)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('explore')} className="hover:text-white transition">
                  सभी उपन्यास (All Novels)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('premium')} className="hover:text-amber-400 transition flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>वीआईपी सदस्यता (VIP Plans)</span>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('ai')} className="hover:text-pink-400 transition flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-pink-400" />
                  <span>Crazy AI सहायक</span>
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('library')} className="hover:text-white transition">
                  मेरी लाइब्रेरी (My Library)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('support')} className="hover:text-white transition">
                  सहायता और प्रतिक्रिया (Help & Support)
                </button>
              </li>
            </ul>
          </div>

          {/* Support & Payments */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white mb-2">संपर्क और सुरक्षा (Support)</h4>
            <div className="space-y-1.5 text-xs text-purple-300/80">
              <a
                href={`mailto:${supportEmail || 'divinecult2007@gmail.com'}`}
                className="flex items-center gap-2 hover:text-white transition"
              >
                <Mail className="w-3.5 h-3.5 text-purple-400" />
                <span>{supportEmail || 'divinecult2007@gmail.com'}</span>
              </a>
              <a
                href={`tel:${(supportPhone || '+91 8290188433').replace(/\s+/g, '')}`}
                className="flex items-center gap-2 hover:text-white transition"
              >
                <Phone className="w-3.5 h-3.5 text-purple-400" />
                <span>{supportPhone || '+91 8290188433'}</span>
              </a>
            </div>
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/20 text-xs">
              <span className="font-semibold text-purple-200 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" /> 100% सुरक्षित मैनुअल UPI
              </span>
              <p className="text-[11px] text-purple-300/70 mt-1">
                सत्यापित QR कोड और UPI ID के माध्यम से सीधा सुरक्षित भुगतान।
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-10 pt-6 border-t border-purple-900/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-purple-400/70">
          <p>© {new Date().getFullYear()} Crazy Storyes. सर्वाधिकार सुरक्षित। All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>प्रीमियम हिंदी कहानियां</span>
            <span>•</span>
            <span>Strict 16:9 Dimensions</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-purple-300">
              Made with <Heart className="w-3 h-3 text-pink-500 fill-pink-500" /> for Hindi Readers
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
