import express from 'express';
import { db } from '../db.ts';
import { generateToken, verifyToken, hashPassword, comparePassword, authenticateToken, type AuthRequest } from '../auth.ts';
import type { User, UserAuthLog } from '../types.ts';

const router = express.Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getClientInfo(req: express.Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  let deviceInfo = 'Desktop Browser';
  if (/mobile/i.test(userAgent)) deviceInfo = 'Mobile Browser';
  if (/android/i.test(userAgent)) deviceInfo = 'Android Device';
  if (/iphone|ipad|ipod/i.test(userAgent)) deviceInfo = 'iOS Device';

  return { ip, userAgent, deviceInfo };
}

function logAuthError(route: string, err: any, meta?: Record<string, unknown>) {
  console.error(`[Auth Error] ${route}:`, {
    message: err?.message || 'Unknown error',
    code: err?.code,
    details: err?.details,
    hint: err?.hint,
    operation: err?.operation,
    ...(meta || {})
  });
}

function getSafeAuthErrorResponse(err: any, fallbackHindi: string): { status: number; error: string; code?: string } {
  const code = String(err?.code || '');
  const message = String(err?.message || '');

  if (code === '23505' || /duplicate key value/i.test(message)) {
    return {
      status: 400,
      error: 'यह ईमेल पहले से पंजीकृत है (Email already registered)',
      code: 'EMAIL_EXISTS'
    };
  }

  if (code === 'PGRST204' || code === '42703' || /column .* does not exist/i.test(message) || /could not find the '[^']+' column/i.test(message)) {
    return {
      status: 500,
      error: `${fallbackHindi}: डेटाबेस स्कीमा कॉलम अपडेट आवश्यक है (Database column mismatch — run updated supabase_schema.sql)`,
      code: 'DB_SCHEMA_MISMATCH'
    };
  }

  if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist/i.test(message) || /could not find the table/i.test(message)) {
    return {
      status: 500,
      error: `${fallbackHindi}: डेटाबेस टेबल मौजूद नहीं है (Database table missing — run supabase_missing_tables_fix.sql)`,
      code: 'DB_TABLE_MISSING'
    };
  }

  if (
    code === '42501' ||
    /invalid api key/i.test(message) ||
    /jwt/i.test(message) ||
    /row-level security/i.test(message) ||
    /permission denied/i.test(message)
  ) {
    return {
      status: 500,
      error: `${fallbackHindi}: डेटाबेस अनुमति या कॉन्फ़िगरेशन त्रुटि (Database authorization error)`,
      code: 'DB_AUTH_ERROR'
    };
  }

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    /fetch failed/i.test(message) ||
    /network/i.test(message)
  ) {
    return {
      status: 503,
      error: `${fallbackHindi}: डेटाबेस से कनेक्ट नहीं हो पा रहा है (Database connection failed)`,
      code: 'DB_CONNECTION_ERROR'
    };
  }

  if (message.startsWith('Supabase error')) {
    return {
      status: 500,
      error: `${fallbackHindi}: डेटाबेस क्वेरी त्रुटि (${code || 'DB_ERROR'})`,
      code: code || 'DB_ERROR'
    };
  }

  return {
    status: 500,
    error: `${fallbackHindi} (Internal server error)`,
    code: 'INTERNAL_ERROR'
  };
}

async function safeAddAuthLog(input: Omit<UserAuthLog, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  try {
    await db.addAuthLog(input);
  } catch (err: any) {
    logAuthError('addAuthLog', err, { eventType: input.eventType, userId: input.userId });
  }
}

// Check Admin configuration status (Never expose admin email publicly)
router.get('/admin-status', async (req, res) => {
  try {
    const users = await db.getUsers();
    const adminUser = users.find(u => u.role === 'admin');

    return res.json({
      hasAdmin: Boolean(adminUser),
      authorizedAdminEmail: ''
    });
  } catch (err: any) {
    logAuthError('GET /admin-status', err);
    const safe = getSafeAuthErrorResponse(err, 'एडमिन स्थिति जांच में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// First-time Admin Account Setup (Owner Setup)
router.post('/admin-setup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();

    if (!cleanEmail || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'ईमेल और पासवर्ड आवश्यक हैं (Email and password are required)' });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'कृपया एक मान्य ईमेल पता दर्ज करें (Invalid email address)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए (Password must be at least 6 characters)' });
    }

    const users = await db.getUsers();
    const existingAdmin = users.find(u => u.role === 'admin');
    const settings = await db.getSettings();

    // Security: Once an admin account exists, reject unauthenticated /admin-setup attempts!
    let isCallerAuthenticatedAdmin = false;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (bearerToken) {
      const revoked = await db.isTokenRevoked(bearerToken);
      const payload = !revoked ? verifyToken(bearerToken) : null;
      if (payload) {
        const caller = await db.getUserById(payload.id);
        if (caller && caller.role === 'admin' && !caller.isBlocked) {
          isCallerAuthenticatedAdmin = true;
        }
      }
    }

    if (existingAdmin && !isCallerAuthenticatedAdmin) {
      return res.status(403).json({
        error: 'एडमिन खाता पहले ही सेटअप हो चुका है। कृपया एडमिन लॉगिन का उपयोग करें।'
      });
    }

    // Save/update settings with this admin email
    await db.updateSettings({ adminEmail: cleanEmail });

    // Check if user already exists, upgrade or create new admin
    const existingUser = await db.getUserByEmail(cleanEmail);
    const passwordHash = await hashPassword(password);

    if (existingUser) {
      // During unauthenticated first-time setup, only allow upgrading an existing user if they match configured owner email or prove existing password
      if (!isCallerAuthenticatedAdmin) {
        const isConfiguredOwnerEmail = cleanEmail === (settings.adminEmail || '').toLowerCase();
        const passwordMatchesExisting = await comparePassword(password, existingUser.passwordHash);
        if (!isConfiguredOwnerEmail && !passwordMatchesExisting) {
          return res.status(400).json({
            error: 'यह ईमेल पहले से किसी पाठक खाते में पंजीकृत है। कृपया नया एडमिन ईमेल चुनें या मौजूदा पासवर्ड का उपयोग करें।'
          });
        }
      }

      const patch: Partial<User> = {
        role: 'admin',
        passwordHash,
        membership: { isActive: true, planName: 'Owner VIP' }
      };
      if (typeof name === 'string' && name.trim()) {
        patch.name = name.trim();
      }
      const updated = await db.updateUser(existingUser.id, patch);
      const targetUser = updated || { ...existingUser, ...patch };
      const token = generateToken(targetUser);
      return res.json({
        message: 'एडमिन खाता सफलतापूर्वक सेटअप हुआ! (Admin account setup successful)',
        token,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          membership: targetUser.membership,
          bookmarks: targetUser.bookmarks,
          readingHistory: targetUser.readingHistory
        }
      });
    }

    const now = new Date().toISOString();
    const newAdmin: User = {
      id: `admin_${Date.now()}`,
      name: (typeof name === 'string' && name.trim()) || 'Website Owner',
      email: cleanEmail,
      passwordHash,
      role: 'admin',
      isBlocked: false,
      membership: {
        isActive: true,
        planName: 'Owner VIP'
      },
      bookmarks: [],
      readingHistory: [],
      lastLoginAt: now,
      createdAt: now
    };

    const createdAdmin = await db.addUser(newAdmin);
    const token = generateToken(createdAdmin);

    return res.status(201).json({
      message: 'एडमिन खाता सफलतापूर्वक बनाया गया (Admin account created successfully)',
      token,
      user: {
        id: createdAdmin.id,
        name: createdAdmin.name,
        email: createdAdmin.email,
        role: createdAdmin.role,
        membership: createdAdmin.membership,
        bookmarks: createdAdmin.bookmarks,
        readingHistory: createdAdmin.readingHistory
      }
    });
  } catch (err: any) {
    logAuthError('POST /admin-setup', err);
    const safe = getSafeAuthErrorResponse(err, 'एडमिन सेटअप में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();
    const client = getClientInfo(req);

    if (!cleanEmail || !password || typeof password !== 'string') {
      await safeAddAuthLog({
        email: cleanEmail,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'ईमेल या पासवर्ड अनुपलब्ध (Missing email or password)'
      });
      return res.status(400).json({ error: 'ईमेल और पासवर्ड आवश्यक हैं (Email and password are required)' });
    }

    const user = await db.getUserByEmail(cleanEmail);
    if (!user || user.role !== 'admin') {
      await safeAddAuthLog({
        userId: user?.id,
        email: cleanEmail,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: !user ? 'खाता मौजूद नहीं है' : 'अनधिकृत गैर-व्यवस्थापक रोल'
      });
      return res.status(401).json({
        error: 'एडमिन क्रेडेंशियल्स अमान्य हैं या यह खाता एडमिन के रूप में पंजीकृत नहीं है। (Invalid admin credentials or setup needed)'
      });
    }

    if (user.isBlocked) {
      await safeAddAuthLog({
        userId: user.id,
        email: user.email,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'खाता अवरुद्ध है (Account blocked)'
      });
      return res.status(403).json({ error: 'यह खाता अवरुद्ध है (Account blocked)' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await safeAddAuthLog({
        userId: user.id,
        email: cleanEmail,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'गलत पासवर्ड (Incorrect password)'
      });
      return res.status(401).json({ error: 'गलत पासवर्ड (Incorrect password)' });
    }

    const now = new Date().toISOString();
    try {
      await db.updateUser(user.id, { lastLoginAt: now });
    } catch (updateErr: any) {
      // Non-fatal if only optional lastLoginAt timestamp update fails after password verification
      logAuthError('POST /admin-login updateUser(lastLoginAt)', updateErr, { userId: user.id });
    }
    user.lastLoginAt = now;

    await safeAddAuthLog({
      userId: user.id,
      email: user.email,
      eventType: 'login',
      ipAddress: client.ip,
      userAgent: client.userAgent,
      deviceInfo: client.deviceInfo,
      status: 'success'
    });

    const token = generateToken(user);
    return res.json({
      message: 'एडमिन लॉगिन सफल (Admin login successful)',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
        bookmarks: user.bookmarks,
        readingHistory: user.readingHistory,
        lastLoginAt: user.lastLoginAt,
        lastLogoutAt: user.lastLogoutAt
      }
    });
  } catch (err: any) {
    logAuthError('POST /admin-login', err);
    const safe = getSafeAuthErrorResponse(err, 'एडमिन लॉगिन में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Regular Reader Registration (ALWAYS assigns role: 'reader')
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    const client = getClientInfo(req);

    if (!name || typeof name !== 'string' || !name.trim() || !email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'नाम, ईमेल और पासवर्ड आवश्यक हैं (Name, email and password required)' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ error: 'कृपया एक मान्य ईमेल पता दर्ज करें (Invalid email address)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए (Password must be at least 6 characters)' });
    }

    const existing = await db.getUserByEmail(cleanEmail);
    if (existing) {
      return res.status(400).json({ error: 'यह ईमेल पहले से पंजीकृत है (Email already registered)' });
    }

    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'reader', // Strictly forced reader role
      isBlocked: false,
      membership: {
        isActive: false
      },
      bookmarks: [],
      readingHistory: [],
      lastLoginAt: now,
      createdAt: now
    };

    const savedUser = await db.addUser(newUser);

    // Record registration & initial login audit logs (non-fatal)
    await safeAddAuthLog({
      userId: savedUser.id,
      email: savedUser.email,
      eventType: 'registration',
      ipAddress: client.ip,
      userAgent: client.userAgent,
      deviceInfo: client.deviceInfo,
      status: 'success'
    });

    await safeAddAuthLog({
      userId: savedUser.id,
      email: savedUser.email,
      eventType: 'login',
      ipAddress: client.ip,
      userAgent: client.userAgent,
      deviceInfo: client.deviceInfo,
      status: 'success'
    });

    const token = generateToken(savedUser);

    return res.status(201).json({
      message: 'पंजीकरण सफल (Registration successful)',
      token,
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        membership: savedUser.membership,
        bookmarks: savedUser.bookmarks,
        readingHistory: savedUser.readingHistory,
        lastLoginAt: savedUser.lastLoginAt || now,
        lastLogoutAt: savedUser.lastLogoutAt
      }
    });
  } catch (err: any) {
    logAuthError('POST /register', err);
    const safe = getSafeAuthErrorResponse(err, 'पंजीकरण में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Reader / General Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const client = getClientInfo(req);
    const cleanEmail = (typeof email === 'string' ? email : '').trim().toLowerCase();

    if (!cleanEmail || !password || typeof password !== 'string') {
      await safeAddAuthLog({
        email: cleanEmail,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'ईमेल या पासवर्ड अनुपलब्ध (Missing email or password)'
      });
      return res.status(400).json({ error: 'ईमेल और पासवर्ड आवश्यक हैं (Email and password required)' });
    }

    const user = await db.getUserByEmail(cleanEmail);
    if (!user) {
      await safeAddAuthLog({
        email: cleanEmail,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'उपयोगकर्ता पंजीकृत नहीं है (User not found)'
      });
      return res.status(401).json({ error: 'ईमेल या पासवर्ड गलत है (Invalid email or password)' });
    }

    if (user.isBlocked) {
      await safeAddAuthLog({
        userId: user.id,
        email: user.email,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'खाता अवरुद्ध है (Account blocked)'
      });
      return res.status(403).json({ error: 'यह खाता अवरुद्ध है (Account blocked)' });
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      await safeAddAuthLog({
        userId: user.id,
        email: user.email,
        eventType: 'failed_login',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'failed',
        failureReason: 'गलत पासवर्ड (Incorrect password)'
      });
      return res.status(401).json({ error: 'ईमेल या पासवर्ड गलत है (Invalid email or password)' });
    }

    const now = new Date().toISOString();
    try {
      await db.updateUser(user.id, { lastLoginAt: now });
    } catch (updateErr: any) {
      // Non-fatal if tracking timestamp column update fails after password verification
      logAuthError('POST /login updateUser(lastLoginAt)', updateErr, { userId: user.id });
    }
    user.lastLoginAt = now;

    await safeAddAuthLog({
      userId: user.id,
      email: user.email,
      eventType: 'login',
      ipAddress: client.ip,
      userAgent: client.userAgent,
      deviceInfo: client.deviceInfo,
      status: 'success'
    });

    const token = generateToken(user);
    return res.json({
      message: 'लॉगिन सफल (Login successful)',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
        bookmarks: user.bookmarks,
        readingHistory: user.readingHistory,
        lastLoginAt: user.lastLoginAt,
        lastLogoutAt: user.lastLogoutAt
      }
    });
  } catch (err: any) {
    logAuthError('POST /login', err);
    const safe = getSafeAuthErrorResponse(err, 'लॉगिन में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Logout and Invalidate Active Token Session
router.post('/logout', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    const client = getClientInfo(req);
    const now = new Date().toISOString();

    if (token && req.user) {
      const decoded = verifyToken(token);
      const expiresAt = decoded && (decoded as any).exp
        ? new Date((decoded as any).exp * 1000).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();

      await db.revokeToken({
        id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        token,
        userId: req.user.id,
        expiresAt,
        revokedAt: now,
        reason: 'User logged out'
      });

      try {
        await db.updateUser(req.user.id, { lastLogoutAt: now });
      } catch (updateErr: any) {
        logAuthError('POST /logout updateUser(lastLogoutAt)', updateErr, { userId: req.user.id });
      }

      await safeAddAuthLog({
        userId: req.user.id,
        email: req.user.email,
        eventType: 'logout',
        ipAddress: client.ip,
        userAgent: client.userAgent,
        deviceInfo: client.deviceInfo,
        status: 'success'
      });
    }

    return res.json({
      success: true,
      message: 'सफलतापूर्वक लॉगआउट किया गया (Logged out successfully)'
    });
  } catch (err: any) {
    logAuthError('POST /logout', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'लॉगआउट में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// User's Own Login / Logout / Session History (Strictly Isolated)
router.get('/my-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });
    const logs = await db.getAuthLogs({ userId: req.user.id, limit: 50 });
    const freshUser = await db.getUserById(req.user.id);

    return res.json({
      logs,
      lastLoginAt: freshUser?.lastLoginAt || req.user.lastLoginAt,
      lastLogoutAt: freshUser?.lastLogoutAt || req.user.lastLogoutAt
    });
  } catch (err: any) {
    logAuthError('GET /my-history', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'लॉगिन इतिहास लोड करने में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Current User Profile
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'उपयोगकर्ता नहीं मिला' });
    const freshUser = await db.getUserById(req.user.id);
    const user = freshUser || req.user;
    const { passwordHash, ...safeUser } = user;
    return res.json({ user: safeUser });
  } catch (err: any) {
    logAuthError('GET /me', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'प्रोफ़ाइल लोड करने में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Toggle Bookmark
router.post('/bookmarks/:novelId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });
    const novelId = req.params.novelId;
    const bookmarks = req.user.bookmarks || [];
    const exists = bookmarks.includes(novelId);
    const updatedBookmarks = exists ? bookmarks.filter(id => id !== novelId) : [...bookmarks, novelId];

    await db.updateUser(req.user.id, { bookmarks: updatedBookmarks });
    return res.json({ bookmarks: updatedBookmarks, isBookmarked: !exists });
  } catch (err: any) {
    logAuthError('POST /bookmarks/:novelId', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'बुकमार्क सहेजने में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Save Reading Progress
router.post('/reading-progress', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });
    const { novelId, chapterId, chapterNumber, novelTitle, chapterTitle, progressPercent, mode } = req.body || {};

    if (!novelId || !chapterId) {
      return res.status(400).json({ error: 'novelId और chapterId आवश्यक हैं' });
    }

    const history = req.user.readingHistory || [];
    const filtered = history.filter(h => h.novelId !== novelId);
    filtered.unshift({
      novelId,
      chapterId,
      chapterNumber: Number(chapterNumber) || 1,
      novelTitle: novelTitle || '',
      chapterTitle: chapterTitle || '',
      progressPercent: Math.min(100, Math.max(0, Number(progressPercent) || 0)),
      mode: mode === 'audio' ? 'audio' : 'text',
      updatedAt: new Date().toISOString()
    });

    const slicedHistory = filtered.slice(0, 5); // keep last 5 unique novels
    await db.updateUser(req.user.id, { readingHistory: slicedHistory });
    return res.json({ success: true, readingHistory: slicedHistory });
  } catch (err: any) {
    logAuthError('POST /reading-progress', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'प्रगति सहेजने में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

// Clear Reading History
router.delete('/reading-history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'लॉगिन आवश्यक है' });
    await db.updateUser(req.user.id, { readingHistory: [] });
    return res.json({ success: true, readingHistory: [] });
  } catch (err: any) {
    logAuthError('DELETE /reading-history', err, { userId: req.user?.id });
    const safe = getSafeAuthErrorResponse(err, 'इतिहास हटाने में त्रुटि');
    return res.status(safe.status).json({ error: safe.error, code: safe.code });
  }
});

export default router;
