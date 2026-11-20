import express from 'express';
import { db } from '../db.ts';
import { authenticateToken, optionalAuth, type AuthRequest } from '../auth.ts';
import type { SupportTicket } from '../types.ts';

const router = express.Router();

const EXTERNAL_URL_REGEX = /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|wa\.me\/|whatsapp\.com|bit\.ly|tinyurl\.com|\b[a-zA-Z0-9-]+\.(com|in|net|org|xyz|io|co|top|site|club|vip|online|me|app|link|cc|to|tv|dev|info|biz|ru|cn|tk|ga|cf|ml|gq)\b)/i;

// Submit a support ticket or feedback
router.post('/tickets', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { name, email, category, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'सभी फ़ील्ड (नाम, ईमेल, विषय और संदेश) आवश्यक हैं' });
    }

    // Block external URLs for non-admin users
    if (req.user?.role !== 'admin' && (EXTERNAL_URL_REGEX.test(subject) || EXTERNAL_URL_REGEX.test(message))) {
      return res.status(400).json({
        error: 'संदेश या विषय में बाहरी लिंक, वेबसाइट या टेलीग्राम/व्हाट्सएप लिंक साझा करना सख्त मना है (External links and promotional URLs are prohibited)'
      });
    }

    const newTicket: SupportTicket = {
      id: `tick_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user?.id,
      userName: name.trim(),
      userEmail: req.user?.email ? req.user.email.toLowerCase() : email.trim().toLowerCase(),
      category: ['question', 'problem', 'feedback', 'payment'].includes(category) ? category : 'question',
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
      createdAt: new Date().toISOString()
    };

    const savedTicket = await db.addSupportTicket(newTicket);

    return res.status(201).json({
      message: 'आपका संदेश सफलतापूर्वक प्राप्त हुआ! हमारी टीम जल्द ही जवाब देगी।',
      ticket: savedTicket
    });
  } catch (err) {
    console.error('Support ticket error:', err);
    return res.status(500).json({ error: 'संदेश भेजने में विफलता' });
  }
});

// View My Support History (Authenticated user's own tickets only)
router.get('/my-tickets', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'सहायता टिकट इतिहास देखने के लिए लॉगिन आवश्यक है' });
    }

    const userEmail = req.user.email.toLowerCase();
    const allTickets = await db.getSupportTickets();
    const userTickets = allTickets.filter(
      (t) =>
        (t.userId && t.userId === req.user!.id) ||
        (!t.userId && t.userEmail.toLowerCase() === userEmail) ||
        t.userEmail.toLowerCase() === userEmail
    );

    return res.json({ tickets: userTickets });
  } catch (err) {
    console.error('Get my tickets error:', err);
    return res.status(500).json({ error: 'टिकट लोड करने में त्रुटि' });
  }
});

export default router;
