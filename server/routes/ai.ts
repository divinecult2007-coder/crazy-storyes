import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db.ts';
import { optionalAuth, type AuthRequest } from '../auth.ts';

const router = express.Router();

// Crazy AI Status check
router.get('/status', async (req, res) => {
  try {
    const isKeyPresent = Boolean(process.env.GEMINI_API_KEY);
    const settings = await db.getSettings();
    return res.json({
      configured: isKeyPresent,
      enabled: settings.enableAiAssistant !== false,
      model: 'gemini-3.8-flash'
    });
  } catch (err: any) {
    console.error('Crazy AI status error:', err);
    return res.status(500).json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      enabled: false,
      error: 'AI स्थिति जांचने में त्रुटि'
    });
  }
});

// Crazy AI Chat endpoint
router.post('/chat', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        configured: false,
        error: 'Crazy AI कॉन्फ़िगर नहीं है: सर्वर में GEMINI_API_KEY मौजूद नहीं है। कृपया AI Studio Secrets या पर्यावरण में GEMINI_API_KEY सेट करें। (GEMINI_API_KEY not configured)'
      });
    }

    const { message, contextNovelId, contextChapterId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'संदेश (message) आवश्यक है' });
    }

    // Prepare context of available novels
    const allNovels = await db.getNovels();
    const novels = allNovels.filter(n => n.isPublished);
    const novelsSummary = novels.map(n => 
      `- ${n.title} (${n.hindiTitle || ''}) by ${n.author} [श्रेणी: ${n.categories.join(', ')}] [प्रकार: ${n.isPremium ? 'VIP' : 'FREE'}]`
    ).join('\n');

    let chapterContext = '';
    if (contextNovelId && contextChapterId) {
      const chapter = await db.getChapterById(contextChapterId);
      if (chapter && chapter.isPublished) {
        // Enforce user authorization: Only summarize or answer about VIP chapters if user is VIP or admin!
        const isAuthorized = !chapter.isPremium || req.user?.role === 'admin' || req.user?.membership?.isActive;
        if (isAuthorized) {
          const contentSnippet = chapter.content ? chapter.content.slice(0, 1500) : 'ऑडियो अध्याय (Audio Chapter)';
          chapterContext = `\nवर्तमान अध्याय का संदर्भ:\nशीर्षक: ${chapter.title}\nसामग्री: ${contentSnippet}`;
        } else {
          chapterContext = `\nवर्तमान अध्याय का संदर्भ: [यह एक VIP प्रीमियम अध्याय है। उपयोगकर्ता के पास VIP सदस्यता नहीं है, इसलिए पूर्ण सामग्री का विवरण न दें।]`;
        }
      }
    }

    const systemInstruction = `
आप "Crazy AI" हैं, जो "Crazy Storyes" (प्रीमियम हिंदी उपन्यास और ऑडियोबुक्स प्लेटफ़ॉर्म) के आधिकारिक और अत्यधिक विनम्र, बुद्धिमान एआई सहायक हैं।

आपकी मुख्य जिम्मेदारियां:
1. पाठकों के सवालों के जवाब हिंदी और स्वाभाविक हिंग्लिश (English + Hindi) में देना।
2. पाठकों की रुचि के आधार पर Crazy Storyes के उपन्यासों की सिफारिश करना।
3. उपन्यासों में आने वाले कठिन हिंदी, उर्दू, संस्कृत या अंग्रेजी शब्दों (जैसे 'साधना', 'प्राण ऊर्जा', 'काया शोधन', 'सिंडिकेट') का सरल और सुंदर अर्थ समझाना।
4. यदि उपयोगकर्ता किसी अध्याय का सारांश पूछे, तो उसे संक्षिप्त और रोमांचक सारांश प्रदान करना।
5. वेबसाइट की विशेषताओं (फ्री उपन्यास, वीआईपी सदस्यता, 16:9 कवर, ऑडियो प्लेयर, यूपीआई भुगतान) में नेविगेट करने में सहायता करना।

वेबसाइट पर उपलब्ध चुनिंदा उपन्यास:
${novelsSummary}
${chapterContext}

व्यवहार और शैली:
- गर्मजोशी से भरी, सम्मानजनक और आकर्षक भाषा का प्रयोग करें।
- यदि कोई VIP सामग्री मांगता है और उसके पास अनुमति नहीं है, तो उसे विनम्रता से VIP सदस्यता लेने की सलाह दें।
- उत्तर को संक्षिप्त (लगभग 150-300 शब्दों के भीतर), स्पष्ट, आकर्षक और पठनीय रखें।
`;

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    let replyText = '';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: message,
        config: {
          systemInstruction,
        }
      });
      replyText = response.text || '';
    } catch (err: any) {
      console.warn('Gemini 3.8 Flash error:', err?.message || err);
      // Graceful high-demand fallback
      replyText = '🙏 नमस्ते! Crazy Storyes में आपका स्वागत है। मैं आपका AI सहायक हूँ। इस समय Crazy Storyes पर सबसे लोकप्रिय उपन्यास **"अमर पुनर्जन्म: सम्राट की वापसी" (Immortal Rebirth)** और **"अनंत सम्राट की प्रणाली" (System of the Infinite Emperor)** हैं। आप होमपेज से इनका आनंद ले सकते हैं!';
    }

    return res.json({
      configured: true,
      reply: replyText
    });
  } catch (err: any) {
    console.error('Crazy AI error:', err);
    return res.status(500).json({
      error: 'Crazy AI से संपर्क करने में समस्या हुई।',
      details: err?.message || String(err)
    });
  }
});

export default router;
