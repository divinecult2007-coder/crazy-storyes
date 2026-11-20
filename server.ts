import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { db, UPLOADS_DIR } from './server/db.ts';
import authRouter from './server/routes/auth.ts';
import novelsRouter from './server/routes/novels.ts';
import paymentsRouter from './server/routes/payments.ts';
import adminRouter from './server/routes/admin.ts';
import aiRouter from './server/routes/ai.ts';
import supportRouter from './server/routes/support.ts';
import downloadsRouter from './server/routes/downloads.ts';
import telegramRouter from './server/routes/telegram.ts';
import { telegramService } from './server/telegram.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  await db.init();

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('trust proxy', 1);

  // Allow same-origin, AI Studio Cloud Run preview/shared URLs, and configured APP_URL cleanly
  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
      const isAllowedOrigin =
        origin === appUrl ||
        /^https:\/\/[a-z0-9-]+\.asia-[a-z0-9-]+\.run\.app$/i.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.a\.run\.app$/i.test(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

      if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Static uploads and generated cover images serving
  app.use('/uploads', express.static(UPLOADS_DIR));
  app.use('/src/assets/images', express.static(path.resolve(__dirname, 'src/assets/images')));

  // Mount API endpoints
  app.use('/api/auth', authRouter);
  app.use('/api/novels', novelsRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/downloads', downloadsRouter);
  app.use('/api/telegram', telegramRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    const initErrors = db.getInitErrors();
    res.json({
      status: initErrors.length === 0 ? 'ok' : 'degraded',
      dbInitErrorsCount: initErrors.length,
      time: new Date().toISOString()
    });
  });

  // Catch-all 404 for any unmatched /api route (ensures API requests NEVER return Vite HTML)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Global Express error handler for API requests
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', {
      method: req.method,
      path: req.originalUrl,
      code: err?.code,
      message: err?.message || 'Unknown error'
    });
    if (res.headersSent) return next(err);
    res.status(err?.statusCode || 500).json({ error: err?.message || 'Internal server error' });
  });

  if (!isProduction) {
    // In dev mode, attach Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Crazy Storyes server running on http://0.0.0.0:${PORT}`);

    // Schedule background VIP membership expiry and Telegram access check every 5 minutes
    const RUNNER_INTERVAL_MS = 5 * 60 * 1000;
    setTimeout(() => {
      telegramService.processMembershipExpiries().catch((err) => {
        console.error('Error in initial Telegram expiry check:', err);
      });
    }, 15000); // 15 seconds after boot

    setInterval(() => {
      telegramService.processMembershipExpiries().catch((err) => {
        console.error('Error in scheduled Telegram expiry check:', err);
      });
    }, RUNNER_INTERVAL_MS);
  });
}

startServer().catch(err => {
  console.error('Fatal server start error:', err);
  process.exit(1);
});
