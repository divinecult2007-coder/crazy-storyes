import express from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import * as archiver from 'archiver';
import { db, UPLOADS_DIR } from '../db.ts';
import { optionalAuth, type AuthRequest } from '../auth.ts';
import type { Chapter, Novel } from '../types.ts';

const router = express.Router();

const PREMIUM_DENIED_MSG = 'This is a Premium Chapter. Upgrade your Membership to access this Download.';

async function isUserVipActive(req: AuthRequest): Promise<boolean> {
  if (!req.user) return false;
  if (req.user.role === 'admin') return true;
  const fullUser = await db.getUserById(req.user.id);
  if (!fullUser || fullUser.isBlocked) return false;
  if (!fullUser.membership?.isActive) return false;
  if (fullUser.membership.expiresAt && new Date(fullUser.membership.expiresAt) <= new Date()) {
    return false;
  }
  return true;
}

function sanitizeFilename(name: string): string {
  return (name || 'Crazy_Storyes')
    .replace(/[^a-zA-Z0-9\u0900-\u097F _-]+/g, '')
    .trim()
    .replace(/\s+/g, '_') || 'Crazy_Storyes';
}

function streamPdf(res: express.Response, title: string, chapters: Chapter[]) {
  const filename = `${sanitizeFilename(title)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(res);

  doc.fontSize(22).text(title, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#666666').text('Crazy Storyes — Premium Hindi Audio Novels & Audiobooks', { align: 'center' });
  doc.fillColor('#000000');
  doc.moveDown(1.5);

  doc.fontSize(14).text('Audio Chapters Catalog:');
  doc.moveDown(0.5);

  chapters.forEach((ch, index) => {
    doc.fontSize(12).text(`Chapter ${ch.chapterNumber}: ${ch.title}`);
    const duration = ch.audioDurationSeconds ? `${Math.floor(ch.audioDurationSeconds / 60)}m ${ch.audioDurationSeconds % 60}s` : 'Audio available on Telegram';
    const access = ch.isPremium ? 'VIP Audio' : 'FREE Audio';
    doc.fontSize(10).fillColor('#444444').text(`[${access}] Duration: ${duration}`);
    doc.fillColor('#000000');
    doc.moveDown(0.5);
  });

  doc.end();
}

function streamTxt(res: express.Response, title: string, chapters: Chapter[]) {
  const filename = `${sanitizeFilename(title)}.txt`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);

  const parts: string[] = [
    `==================================================`,
    `${title}`,
    `Crazy Storyes — Premium Hindi Audio Novels & Audiobooks`,
    `==================================================\n`
  ];

  for (const ch of chapters) {
    parts.push(`--------------------------------------------------`);
    parts.push(`Chapter ${ch.chapterNumber}: ${ch.title}`);
    const access = ch.isPremium ? 'VIP Audio' : 'FREE Audio';
    const duration = ch.audioDurationSeconds ? `${Math.floor(ch.audioDurationSeconds / 60)}m ${ch.audioDurationSeconds % 60}s` : 'Telegram Audio';
    parts.push(`Access: ${access} | Duration: ${duration}`);
    parts.push(`--------------------------------------------------\n`);
  }

  res.send(parts.join('\n'));
}

// 1. Download Single Chapter (PDF, TXT, or AUDIO)
router.get('/chapter/:novelId/:chapterId/:format', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { novelId, chapterId, format } = req.params;
    const fmt = format.toLowerCase();

    if (!['pdf', 'txt', 'audio'].includes(fmt)) {
      return res.status(400).json({ error: 'Unsupported format. Allowed: pdf, txt, audio' });
    }

    const novel = await db.getNovelById(novelId);
    if (!novel || (!novel.isPublished && req.user?.role !== 'admin')) {
      return res.status(404).json({ error: 'Novel not found' });
    }

    const chapter = await db.getChapterById(chapterId);
    if (!chapter || chapter.novelId !== novelId || (!chapter.isPublished && req.user?.role !== 'admin')) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    const isPremiumContent = Boolean(novel.isPremium || chapter.isPremium);
    const isVip = await isUserVipActive(req);

    if (isPremiumContent && !isVip) {
      return res.status(403).json({ error: PREMIUM_DENIED_MSG });
    }

    const novelTitle = novel.title || novel.hindiTitle || 'Novel';
    const chapterFileTitle = `${novelTitle}_Ch_${chapter.chapterNumber}_${chapter.title}`;

    if (fmt === 'pdf') {
      return streamPdf(res, chapterFileTitle, [chapter]);
    }

    if (fmt === 'txt') {
      return streamTxt(res, chapterFileTitle, [chapter]);
    }

    // fmt === 'audio'
    return res.status(400).json({
      error: 'वेबसाइट से डायरेक्ट ऑडियो डाउनलोडिंग बंद कर दी गई है। ऑडियो केवल Telegram पर उपलब्ध है।',
      telegramAudioOnly: true,
      telegramAudioConfigured: Boolean(chapter.telegramAudioConfigured || chapter.telegramMessageLink)
    });
  } catch (err) {
    console.error('Chapter download error:', err);
    return res.status(500).json({ error: 'डाउनलोड करने में त्रुटि' });
  }
});

// 2. Download Complete Novel (PDF or TXT)
router.get('/novel/:novelId/:format', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { novelId, format } = req.params;
    const scope = (req.query.scope as string) || 'complete'; // 'complete' | 'available'
    const fmt = format.toLowerCase();

    if (!['pdf', 'txt', 'audio'].includes(fmt)) {
      return res.status(400).json({ error: 'Unsupported format. Allowed: pdf, txt' });
    }

    if (fmt === 'audio') {
      return res.status(400).json({
        error: 'वेबसाइट से डायरेक्ट ऑडियो डाउनलोडिंग बंद कर दी गई है। सभी अध्यायों का ऑडियो केवल Telegram पर उपलब्ध है।',
        telegramAudioOnly: true
      });
    }

    const novel = await db.getNovelById(novelId);
    if (!novel || (!novel.isPublished && req.user?.role !== 'admin')) {
      return res.status(404).json({ error: 'Novel not found' });
    }

    const isVip = await isUserVipActive(req);

    if (scope === 'complete' && novel.isPremium && !isVip) {
      return res.status(403).json({ error: PREMIUM_DENIED_MSG });
    }

    const allNovelChapters = await db.getChapters(novelId);
    let chapters = allNovelChapters
      .filter((c) => c.isPublished || req.user?.role === 'admin')
      .sort((a, b) => a.chapterNumber - b.chapterNumber);

    if (scope === 'complete') {
      const hasPremiumChapter = chapters.some((c) => c.isPremium);
      if ((novel.isPremium || hasPremiumChapter) && !isVip) {
        return res.status(403).json({ error: PREMIUM_DENIED_MSG });
      }
    } else {
      // 'available' scope: filter to chapters the user is authorized to access
      chapters = chapters.filter((c) => !(novel.isPremium || c.isPremium) || isVip);
    }

    if (chapters.length === 0) {
      return res.status(403).json({ error: PREMIUM_DENIED_MSG });
    }

    const novelTitle = novel.title || novel.hindiTitle || 'Novel';

    if (fmt === 'pdf') {
      return streamPdf(res, novelTitle, chapters);
    }

    if (fmt === 'txt') {
      return streamTxt(res, novelTitle, chapters);
    }
  } catch (err) {
    console.error('Novel download error:', err);
    return res.status(500).json({ error: 'डाउनलोड करने में त्रुटि' });
  }
});

export default router;
