import express from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../db.ts';
import { authenticateToken, type AuthRequest } from '../auth.ts';
import { supabase } from '../supabase.ts';
import type { PaymentRequest } from '../types.ts';

const router = express.Router();

const PAYMENT_PROOFS_BUCKET = 'crazy-storyes-payment-proofs';
const PAYMENT_PROOFS_FOLDER = 'payment-proofs';
const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_SCREENSHOT_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const uploadScreenshot = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCREENSHOT_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (ALLOWED_SCREENSHOT_MIME_TYPES.has(mime)) {
      cb(null, true);
    } else {
      cb(new Error('केवल JPG, JPEG, PNG या WEBP स्क्रीनशॉट ही अपलोड करें'));
    }
  }
});

function detectImageFormatFromBuffer(
  buf: Buffer
): { mime: 'image/jpeg' | 'image/png' | 'image/webp'; ext: '.jpg' | '.png' | '.webp' } | null {
  if (!buf || buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // WebP: RIFF....WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' };
  }

  return null;
}

// Get UPI Payment Configuration (Public)
router.get('/config', async (req, res) => {
  try {
    const [settings, allPlans] = await Promise.all([
      db.getSettings(),
      db.getPlans()
    ]);
    const plans = allPlans.filter(p => p.isActive);

    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      upiId: settings.upiId || 'crazystoryes@upi',
      upiQrCodeUrl: settings.upiQrCodeUrl || '',
      websiteName: settings.websiteName,
      supportEmail: settings.supportEmail || 'divinecult2007@gmail.com',
      supportPhone: settings.supportPhone || '+91 8290188433',
      plans
    });
  } catch (err) {
    console.error('Payment config error:', err);
    return res.status(500).json({ error: 'कॉन्फ़िगरेशन लोड करने में त्रुटि' });
  }
});

// Submit Manual UPI Payment Request (Logged-in Reader)
router.post('/create', authenticateToken, (req: AuthRequest, res) => {
  uploadScreenshot.single('screenshot')(req, res, async (uploadErr: any) => {
    if (uploadErr) {
      if (uploadErr?.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'स्क्रीनशॉट का आकार 5MB से कम होना चाहिए' });
      }
      return res.status(400).json({ error: uploadErr.message || 'स्क्रीनशॉट अपलोड में त्रुटि' });
    }

    let uploadedStoragePath: string | null = null;

    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });

      const { fullName, itemType, itemId, itemName, amount, utrNumber } = req.body;

      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ error: 'कृपया अपना पूरा नाम दर्ज करें (Full Name is required)' });
      }

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'अमान्य भुगतान राशि (Invalid amount)' });
      }

      if (!itemType || !itemId || !itemName) {
        return res.status(400).json({ error: 'प्लान या उपन्यास का चयन आवश्यक है (Item details required)' });
      }

      const normalizedItemType: 'membership' | 'novel' = itemType === 'novel' ? 'novel' : 'membership';
      let authoritativeAmount = Number(amount);
      let authoritativeItemName = String(itemName).trim();

      if (normalizedItemType === 'membership') {
        const allPlans = await db.getPlans();
        const matchedPlan = allPlans.find(p => p.id === String(itemId).trim());
        if (!matchedPlan) {
          return res.status(400).json({
            error: 'चयनित सदस्यता प्लान डेटाबेस में नहीं मिला। कृपया पेज रीफ्रेश करें।'
          });
        }
        if (!matchedPlan.isActive) {
          return res.status(400).json({
            error: 'यह सदस्यता प्लान वर्तमान में निष्क्रिय है। कृपया कोई सक्रिय प्लान चुनें।'
          });
        }

        const expectedPrice = Number(matchedPlan.price);
        if (!Number.isFinite(expectedPrice) || expectedPrice <= 0) {
          return res.status(400).json({ error: 'प्लान मूल्य अमान्य है।' });
        }
        if (Math.abs(authoritativeAmount - expectedPrice) > 0.05) {
          return res.status(400).json({
            error: `भुगतान राशि (₹${authoritativeAmount}) प्लान की वर्तमान कीमत (₹${expectedPrice}) से मेल नहीं खाती। कृपया पेज रीफ्रेश करके सही राशि के साथ पुनः प्रयास करें।`
          });
        }
        authoritativeAmount = expectedPrice;
        authoritativeItemName = `${matchedPlan.name} (${matchedPlan.hindiName}) – Crazy Storyes`;
      }

      if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
        return res.status(400).json({ error: 'कृपया भुगतान का स्क्रीनशॉट अपलोड करें (Payment screenshot is required)' });
      }

      if (req.file.size > MAX_SCREENSHOT_SIZE_BYTES) {
        return res.status(400).json({ error: 'स्क्रीनशॉट का आकार 5MB से कम होना चाहिए' });
      }

      const detected = detectImageFormatFromBuffer(req.file.buffer);
      if (!detected) {
        return res.status(400).json({
          error: 'अमान्य स्क्रीनशॉट फ़ाइल: कृपया वास्तविक JPG, PNG या WEBP इमेज अपलोड करें'
        });
      }

      if (!supabase) {
        console.error('Payment screenshot upload aborted: Supabase client is not initialized.');
        return res.status(503).json({
          error: 'भुगतान स्क्रीनशॉट स्टोरेज सेवा अभी उपलब्ध नहीं है। कृपया कुछ देर बाद प्रयास करें।'
        });
      }

      const uniqueId = `${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const storagePath = `${PAYMENT_PROOFS_FOLDER}/pay_${uniqueId}${detected.ext}`;

      const { data: uploadData, error: storageErr } = await supabase.storage
        .from(PAYMENT_PROOFS_BUCKET)
        .upload(storagePath, req.file.buffer, {
          contentType: detected.mime,
          upsert: false
        });

      if (storageErr || !uploadData) {
        console.error('Supabase payment proof upload failed:', {
          bucket: PAYMENT_PROOFS_BUCKET,
          path: storagePath,
          statusCode: (storageErr as any)?.statusCode,
          message: storageErr?.message || 'Unknown storage upload error'
        });
        return res.status(502).json({
          error: 'भुगतान स्क्रीनशॉट सुरक्षित स्टोरेज में अपलोड नहीं हो सका। कृपया पुनः प्रयास करें।'
        });
      }

      uploadedStoragePath = uploadData.path || storagePath;

      const newPayment: PaymentRequest = {
        id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: user.id,
        userName: fullName.trim(),
        userEmail: user.email,
        itemType: normalizedItemType,
        itemId: String(itemId).trim(),
        itemName: authoritativeItemName,
        amount: authoritativeAmount,
        utrNumber: utrNumber ? utrNumber.trim() : undefined,
        screenshotPath: uploadedStoragePath,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      const savedPayment = await db.addPayment(newPayment);

      return res.status(201).json({
        message: 'भुगतान अनुरोध सफलतापूर्वक दर्ज किया गया! एडमिन द्वारा सत्यापन के बाद आपकी वीआईपी सदस्यता सक्रिय हो जाएगी। (Payment request submitted successfully)',
        payment: savedPayment
      });
    } catch (err: any) {
      // Roll back ONLY the newly uploaded object from this failed request
      if (uploadedStoragePath && supabase) {
        try {
          await supabase.storage.from(PAYMENT_PROOFS_BUCKET).remove([uploadedStoragePath]);
        } catch (cleanupErr: any) {
          console.warn('Payment proof rollback cleanup warning:', {
            bucket: PAYMENT_PROOFS_BUCKET,
            path: uploadedStoragePath,
            message: cleanupErr?.message || 'Cleanup failed'
          });
        }
      }

      const errCode = String(err?.code || '');
      const errMsg = String(err?.message || 'Unknown error');
      console.error('Payment request error:', {
        code: errCode || undefined,
        operation: err?.operation,
        message: errMsg
      });

      if ((errCode === 'PGRST204' || errCode === '42703') && errMsg.includes('screenshot_path')) {
        return res.status(500).json({
          error: 'भुगतान डेटाबेस में screenshot_path कॉलम मौजूद नहीं है — कृपया डेटाबेस स्कीमा अपडेट करें।',
          code: 'DB_SCHEMA_MISMATCH'
        });
      }

      return res.status(500).json({ error: 'भुगतान अनुरोध दर्ज करने में त्रुटि' });
    }
  });
});

// Get User's Own Payment History
router.get('/my-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });
    const allPayments = await db.getPayments();
    const userPayments = allPayments.filter(p => p.userId === req.user!.id);
    return res.json({ payments: userPayments });
  } catch (err) {
    console.error('Payment history error:', err);
    return res.status(500).json({ error: 'भुगतान इतिहास लोड करने में त्रुटि' });
  }
});

export default router;
