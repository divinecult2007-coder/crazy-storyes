import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.ts';
import type { User } from './types.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'crazy_storyes_ultra_secure_jwt_secret_key_2026';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash || typeof hash !== 'string') {
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch (err: any) {
    console.error('comparePassword error:', { message: err?.message });
    return false;
  }
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ error: 'लॉगिन आवश्यक है (Authentication token required)' });
    }

    // Check if token has been revoked / logged out
    const isRevoked = await db.isTokenRevoked(token);
    if (isRevoked) {
      return res.status(401).json({
        error: 'सत्र समाप्त या टोकन रद्द कर दिया गया है। कृपया दोबारा लॉगिन करें। (Session has been logged out/revoked. Please login again.)',
        isRevoked: true
      });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'सत्र समाप्त या अमान्य टोकन (Invalid or expired token)' });
    }

    const user = await db.getUserById(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'उपयोगकर्ता नहीं मिला (User not found)' });
    }

    if (user.isBlocked) {
      return res.status(403).json({ error: 'आपका खाता अवरुद्ध है (Your account has been blocked by Admin)' });
    }

    // Check membership expiry dynamically
    if (user.membership?.isActive && user.membership.expiresAt) {
      if (new Date(user.membership.expiresAt).getTime() < Date.now()) {
        user.membership.isActive = false;
        user.membership.planName = undefined;
        await db.updateUser(user.id, { membership: user.membership });
      }
    }

    req.user = user;
    next();
  } catch (err: any) {
    console.error('authenticateToken error:', {
      code: err?.code,
      message: err?.message || 'Unknown authentication error'
    });
    return res.status(500).json({ error: 'प्रमाणीकरण त्रुटि (Authentication error)' });
  }
}

export async function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (token) {
      const isRevoked = await db.isTokenRevoked(token);
      if (!isRevoked) {
        const payload = verifyToken(token);
        if (payload) {
          const user = await db.getUserById(payload.id);
          if (user && !user.isBlocked) {
            if (user.membership?.isActive && user.membership.expiresAt) {
              if (new Date(user.membership.expiresAt).getTime() < Date.now()) {
                user.membership.isActive = false;
                await db.updateUser(user.id, { membership: user.membership });
              }
            }
            req.user = user;
          }
        }
      }
    }
    next();
  } catch (err) {
    console.error('optionalAuth error:', err);
    next();
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  authenticateToken(req, res, async () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'अनाधिकृत पहुंच: केवल वेबसाइट एडमिन ही यह कार्य कर सकते हैं (Admin access required)'
      });
    }
    next();
  });
}
