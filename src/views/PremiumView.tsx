import React, { useState, useEffect } from 'react';
import { Crown, Check, Sparkles, Zap, ShieldCheck, Tag } from 'lucide-react';
import { MembershipPlan } from '../types.js';
import { useAuth } from '../context/AuthContext.js';

interface PremiumViewProps {
  onNavigate: (view: string, params?: any) => void;
}

function formatMoneyINR(value: number): string {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatPlanDuration(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return 'अनिर्धारित';
  if (days % 365 === 0) {
    const years = days / 365;
    return `${days} दिन (${years} वर्ष)`;
  }
  if (days % 30 === 0) {
    const months = days / 30;
    return `${days} दिन (${months} ${months === 1 ? 'माह' : 'माह'})`;
  }
  return `${days} दिन`;
}

export const PremiumView: React.FC<PremiumViewProps> = ({ onNavigate }) => {
  const { user, isVip, openPayment } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/payments/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setPlans(data.plans || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load plans:', err);
        setLoading(false);
      });
  }, []);

  const handleSelectPlan = (plan: MembershipPlan) => {
    openPayment({
      itemType: 'membership',
      itemId: plan.id,
      itemName: `${plan.name} (${plan.hindiName}) – Crazy Storyes`,
      amount: plan.price
    });
  };

  const gridClass =
    plans.length === 1
      ? 'grid grid-cols-1 max-w-md mx-auto gap-6'
      : plans.length === 2
        ? 'grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6'
        : 'grid grid-cols-1 md:grid-cols-3 max-w-5xl mx-auto gap-6';

  return (
    <div className="space-y-12 pb-16">
      {/* Premium Hero */}
      <div className="text-center space-y-4 max-w-2xl mx-auto pt-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/40 text-amber-300 text-xs font-black shadow-lg">
          <Crown className="w-4 h-4 fill-amber-400 text-amber-400" />
          <span>Crazy Storyes VIP Membership – प्रीमियम सदस्यता</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          अनंत कहानियाँ, <span className="text-3d-gold text-amber-400">असीमित रोमांच</span>
        </h1>

        <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
          सभी वीआईपी अध्यायों को तुरंत अनलॉक करें, 3x सुपरफास्ट ऑडियो प्लेयर की गति का आनंद लें और बिना किसी रुकावट के हिंदी उपन्यासों की दुनिया में खो जाएं।
        </p>

        {isVip && (
          <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-semibold inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>
              बधाई! आपके पास सक्रिय वीआईपी सदस्यता है{' '}
              {user?.membership?.expiresAt &&
                `(${new Date(user.membership.expiresAt).toLocaleDateString('hi-IN')} तक वैध)`}
            </span>
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-purple-300">प्लान लोड हो रहे हैं...</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-[#120726] border border-purple-500/30 text-center space-y-2">
          <Crown className="w-8 h-8 text-amber-400 mx-auto" />
          <p className="text-sm font-bold text-white">अभी कोई सक्रिय सदस्यता प्लान उपलब्ध नहीं है</p>
          <p className="text-xs text-purple-300/80">कृपया कुछ समय बाद पुनः प्रयास करें या सहायता से संपर्क करें।</p>
        </div>
      ) : (
        <div className={gridClass}>
          {plans.map((plan) => {
            const isPopular =
              plan.badgeText?.toUpperCase() === 'POPULAR' ||
              plan.badgeText?.toUpperCase() === 'BEST VALUE' ||
              plan.id.includes('quarterly');
            const originalPrice =
              plan.originalPrice !== undefined && plan.originalPrice > 0 ? plan.originalPrice : plan.price;
            const hasDiscount = originalPrice > plan.price;
            const discountLabel =
              plan.discountType === 'percentage' && (plan.discountPercentage || 0) > 0
                ? `${formatMoneyINR(plan.discountPercentage || 0)}% OFF`
                : hasDiscount
                  ? `₹${formatMoneyINR(originalPrice - plan.price)} OFF`
                  : null;

            return (
              <div
                key={plan.id}
                className={`card-3d relative rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
                  isPopular && plans.length >= 3
                    ? 'bg-gradient-to-b from-[#220d3d] to-[#120626] border-2 border-amber-500/60 shadow-2xl md:scale-105'
                    : isPopular
                      ? 'bg-gradient-to-b from-[#220d3d] to-[#120626] border-2 border-amber-500/60 shadow-2xl'
                      : 'bg-gradient-to-b from-[#16092e] to-[#0c0419] border border-purple-500/30 shadow-xl'
                }`}
              >
                {/* Badge */}
                {plan.badgeText && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`px-3 py-0.5 rounded-full text-[10px] font-black tracking-wider shadow-md whitespace-nowrap ${
                        isPopular
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-amber-950'
                          : 'bg-purple-600 text-white'
                      }`}
                    >
                      {plan.badgeText}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-black text-white">{plan.name}</h3>
                    <span className="text-xs font-bold text-amber-400">{plan.hindiName}</span>
                  </div>

                  <p className="text-xs text-purple-300/80 mb-4 min-h-[36px]">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 mb-6 space-y-1.5">
                    {hasDiscount && discountLabel && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-purple-400 line-through font-bold">
                          ₹{formatMoneyINR(originalPrice)}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black">
                          <Tag className="w-2.5 h-2.5" />
                          {discountLabel}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-black text-amber-400 text-3d-gold">
                        ₹{formatMoneyINR(plan.price)}
                      </span>
                      <span className="text-xs text-purple-300/70 font-semibold">
                        / {formatPlanDuration(plan.durationDays)}
                      </span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 mb-6 text-xs text-purple-200">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Plan Button */}
                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`w-full btn-3d py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg ${
                    isPopular ? 'btn-3d-gold' : 'btn-3d-primary text-white'
                  }`}
                >
                  <Crown className="w-3.5 h-3.5" />
                  <span>अभी वीआईपी बनें (₹{formatMoneyINR(plan.price)})</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature Highlights Grid */}
      <div className="max-w-4xl mx-auto rounded-3xl bg-[#120726] border border-purple-500/20 p-6 sm:p-8 space-y-6 shadow-xl">
        <h2 className="text-xl sm:text-2xl font-black text-white text-center">
          वीआईपी सदस्यता क्यों चुनें? (Why Go VIP?)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Crown className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">सभी VIP अध्याय अनलॉक</h4>
            <p className="text-xs text-purple-300/80 leading-relaxed">
              सर्वश्रेष्ठ हिंदी उपन्यासों के सभी प्रीमियम चैप्टर्स बिना किसी सीमा के Telegram पर सुनें।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">3x सुपरफास्ट ऑडियो</h4>
            <p className="text-xs text-purple-300/80 leading-relaxed">
              फ्री यूजर्स के लिए 1.5x की सीमा से आगे बढ़कर 2x, 2.5x और 3x गति से ऑडियो सुनें।
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-500/20 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Crazy AI असीमित उपयोग</h4>
            <p className="text-xs text-purple-300/80 leading-relaxed">
              कठिन हिंदी शब्दों के अर्थ, अध्यायों के तुरंत सारांश और व्यक्तिगत सिफारिशें प्राप्त करें।
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-purple-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>
              100% सुरक्षित मैनुअल UPI भुगतान • कोई आवर्ती डेबिट नहीं (No Auto-Debit)
            </span>
          </div>
          <button
            onClick={() => onNavigate('support')}
            className="text-amber-400 hover:underline font-bold shrink-0"
          >
            कोई प्रश्न है? संपर्क करें →
          </button>
        </div>
      </div>
    </div>
  );
};
