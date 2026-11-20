import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Download, Check, ShieldCheck, QrCode, AlertCircle, ArrowRight, Upload, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { MembershipPlan } from '../types.js';

function formatMoneyINR(value: number): string {
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export const PaymentModal: React.FC = () => {
  const { paymentModalOpen, setPaymentModalOpen, selectedPayment, token, user } = useAuth();
  const [config, setConfig] = useState<{
    upiId: string;
    upiQrCodeUrl: string;
    websiteName: string;
    plans?: MembershipPlan[];
  } | null>(null);
  const [fullName, setFullName] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentModalOpen) {
      fetch('/api/payments/config', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => setConfig(data))
        .catch((err) => console.error('Failed to load UPI config:', err));

      if (user?.name) {
        setFullName(user.name);
      }
      setScreenshotFile(null);
      setScreenshotPreview(null);
      setSuccessMessage(null);
      setError(null);
    }
  }, [paymentModalOpen, user]);

  if (!paymentModalOpen || !selectedPayment) return null;

  const livePlan =
    selectedPayment.itemType === 'membership'
      ? config?.plans?.find((p) => p.id === selectedPayment.itemId)
      : undefined;

  const upiId = config?.upiId || 'crazystoryes@upi';
  const amount = livePlan ? Number(livePlan.price) : selectedPayment.amount;
  const originalPrice =
    livePlan && livePlan.originalPrice && livePlan.originalPrice > amount ? livePlan.originalPrice : null;
  const itemName = livePlan
    ? `${livePlan.name} (${livePlan.hindiName}) – Crazy Storyes`
    : selectedPayment.itemName;

  // Generate dynamic QR code URL with exact amount and UPI intent
  const upiIntentString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    config?.websiteName || 'Crazy Storyes'
  )}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(itemName)}`;

  // Use dynamic QR generator if no uploaded custom QR or offer crisp QR
  const dynamicQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(
    upiIntentString
  )}&format=png&color=120726`;

  const activeQrImage = config?.upiQrCodeUrl || dynamicQrUrl;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDownloadQr = async () => {
    try {
      // Fetch original image blob to preserve high quality
      const response = await fetch(activeQrImage);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'Crazy-Storyes-UPI-QR.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback
      const link = document.createElement('a');
      link.href = activeQrImage;
      link.download = 'Crazy-Storyes-UPI-QR.png';
      link.target = '_blank';
      link.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setError('केवल JPG, JPEG, PNG या WEBP स्क्रीनशॉट ही अपलोड करें');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('स्क्रीनशॉट का आकार 5MB से कम होना चाहिए');
      return;
    }
    setError(null);
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('कृपया अपना पूरा नाम दर्ज करें (Full Name is required)');
      return;
    }
    if (!screenshotFile) {
      setError('कृपया भुगतान का स्क्रीनशॉट अपलोड करें (Payment screenshot is required)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('amount', String(amount));
      formData.append('itemType', selectedPayment.itemType);
      formData.append('itemId', selectedPayment.itemId);
      formData.append('itemName', itemName);
      formData.append('screenshot', screenshotFile);

      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'भुगतान अनुरोध दर्ज करने में विफलता');
      }

      setSuccessMessage(
        'आपका भुगतान अनुरोध दर्ज हो गया है! एडमिन द्वारा सत्यापन के तुरंत बाद आपकी VIP सदस्यता सक्रिय कर दी जाएगी।'
      );
      setIsSubmitting(false);
    } catch (err: any) {
      setError(err?.message || 'त्रुटि हुई');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#120726] border border-purple-500/40 p-6 shadow-2xl flex flex-col max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={() => setPaymentModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-purple-400 hover:text-white hover:bg-purple-900/40 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2.5 pb-4 border-b border-purple-900/50">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              UPI स्कैन और भुगतान – Scan & Pay
            </h2>
            <p className="text-xs text-purple-300/80">
              सुरक्षित मैनुअल यूपीआई भुगतान • Instant Verification
            </p>
          </div>
        </div>

        {successMessage ? (
          <div className="py-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">अनुरोध दर्ज किया गया!</h3>
            <p className="text-sm text-purple-200/90 max-w-sm mb-6 leading-relaxed">
              {successMessage}
            </p>
            <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/30 text-xs text-purple-300 mb-6">
              स्थिति: <span className="text-amber-400 font-bold">लंबित (Pending Verification)</span> •
              आप अपनी प्रोफ़ाइल में पेमेंट हिस्ट्री देख सकते हैं।
            </div>
            <button
              onClick={() => setPaymentModalOpen(false)}
              className="btn-3d btn-3d-primary px-8 py-2.5 rounded-xl font-bold text-sm text-white"
            >
              ठीक है (Close)
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Amount & Plan Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/80 to-[#1e0d38] border border-purple-500/30 flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-300/80 block">चयनित योजना (Selected Item)</span>
                <span className="text-base font-bold text-white">{itemName}</span>
                {livePlan && (
                  <span className="text-[11px] text-purple-300/80 block">
                    वैधता: {livePlan.durationDays} दिन
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-xs text-purple-300/80 block">भुगतान राशि (Amount)</span>
                {originalPrice && (
                  <span className="text-xs text-purple-400 line-through font-semibold block">
                    ₹{formatMoneyINR(originalPrice)}
                  </span>
                )}
                <span className="text-2xl font-black text-amber-400 text-3d-gold">
                  ₹{formatMoneyINR(amount)}
                </span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 border border-purple-500/20">
              <div className="p-3 rounded-xl bg-white shadow-xl border-4 border-purple-400/30">
                <img
                  src={activeQrImage}
                  alt="UPI QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/70 border border-purple-500/30 text-xs font-semibold text-purple-200 transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Download QR Code (Crazy-Storyes-UPI-QR.png)</span>
                </button>
              </div>
            </div>

            {/* UPI ID Copy Field */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-950/40 border border-purple-500/20">
              <div className="flex-1 min-w-0">
                <span className="text-[11px] text-purple-400 block font-medium">Crazy Storyes UPI ID:</span>
                <span className="text-sm font-mono font-bold text-white select-all">{upiId}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyUpi}
                className="btn-3d btn-3d-subtle px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-200 flex items-center gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">कॉपी हुआ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-purple-400" />
                    <span>Copy UPI ID</span>
                  </>
                )}
              </button>
            </div>

            {/* Instructions */}
            <div className="text-xs text-purple-300/80 space-y-1 bg-purple-950/20 p-3 rounded-xl border border-purple-500/10">
              <p className="font-semibold text-purple-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> भुगतान निर्देश (Instructions):
              </p>
              <p>1. Google Pay, PhonePe, Paytm या किसी भी UPI ऐप से QR कोड स्कैन करें।</p>
              <p>2. सटीक राशि <strong>₹{formatMoneyINR(amount)}</strong> का भुगतान करें।</p>
              <p>3. भुगतान के बाद नीचे अपना पूरा नाम दर्ज कर सबमिट करें।</p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Confirmation Form */}
            <form onSubmit={handleSubmitPayment} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  आपका पूरा नाम (Full Name) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="अपना वास्तविक नाम दर्ज करें (e.g. Rahul Sharma)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-white placeholder-purple-400/40 focus:outline-none focus:border-purple-400 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-purple-200 mb-1">
                  भुगतान स्क्रीनशॉट अपलोड करें (Payment Screenshot) <span className="text-amber-400">*</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {screenshotPreview ? (
                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 flex items-center gap-3">
                    <img
                      src={screenshotPreview}
                      alt="Payment Screenshot Preview"
                      className="w-16 h-16 object-cover rounded-lg border border-purple-400/30 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{screenshotFile?.name}</p>
                      <p className="text-[11px] text-emerald-400">स्क्रीनशॉट तैयार है</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-xs font-semibold text-purple-200 flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>बदलें (Replace)</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 px-4 rounded-xl border-2 border-dashed border-purple-500/40 hover:border-amber-400/60 bg-purple-950/30 hover:bg-purple-950/50 transition flex flex-col items-center justify-center gap-1.5 text-purple-300"
                  >
                    <Upload className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-semibold text-white">स्क्रीनशॉट चुनें (JPG, PNG, WEBP)</span>
                    <span className="text-[11px] text-purple-400">अधिकतम आकार: 5MB</span>
                  </button>
                )}
                <p className="mt-1.5 text-[11px] text-amber-300/80 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                  <span>सुरक्षा चेतावनी: कृपया OTP, पासवर्ड, CVV या कार्ड नंबर वाला स्क्रीनशॉट अपलोड न करें।</span>
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-3d btn-3d-gold py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {isSubmitting ? (
                  <span>सबमिट हो रहा है...</span>
                ) : (
                  <>
                    <span>मैंने भुगतान कर दिया है (Submit Payment Request)</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
