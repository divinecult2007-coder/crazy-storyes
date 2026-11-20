import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { 
  Novel, 
  Chapter, 
  User, 
  PaymentRequest, 
  MembershipPlan, 
  SiteSettings, 
  SupportTicket,
  TelegramAccessRecord,
  TelegramLinkCode,
  TelegramAccessLog,
  TelegramPendingOperation,
  UserAuthLog,
  RevokedToken
} from './types.ts';

dotenv.config();

function classifySupabaseKey(key: string): 'secret' | 'service_role' | 'publishable' | 'unknown' {
  const clean = key.trim();
  if (!clean) return 'unknown';
  if (clean.startsWith('sb_publishable_')) return 'publishable';
  if (clean.startsWith('sb_secret_')) return 'secret';

  // Check JWT payload role if it is a legacy JWT key
  const parts = clean.split('.');
  if (parts.length === 3) {
    try {
      const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
      const payload = JSON.parse(payloadJson);
      if (payload?.role === 'service_role') return 'service_role';
      if (payload?.role === 'anon') return 'publishable';
    } catch {
      // Ignore invalid base64
    }
  }
  return 'unknown';
}

function isValidSupabaseUrl(rawUrl: string): boolean {
  const clean = rawUrl.trim();
  if (!clean || clean.includes('your-project-id')) return false;
  try {
    const parsed = new URL(clean);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const RAW_SECRET_KEY = (
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();
const RAW_LEGACY_KEY = (process.env.SUPABASE_KEY || '').trim();
const RAW_PUBLISHABLE_KEY = (
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  (RAW_LEGACY_KEY.startsWith('sb_publishable_') ? RAW_LEGACY_KEY : '')
).trim();

// Pick backend privileged key strictly (never accept a publishable/anon key as backend Secret Key)
let BACKEND_SECRET_KEY = '';
let DETECTED_KEY_TYPE: 'secret' | 'service_role' | 'publishable_only' | 'missing' = 'missing';

if (RAW_SECRET_KEY) {
  const kind = classifySupabaseKey(RAW_SECRET_KEY);
  if (kind === 'publishable') {
    DETECTED_KEY_TYPE = 'publishable_only';
  } else {
    BACKEND_SECRET_KEY = RAW_SECRET_KEY;
    DETECTED_KEY_TYPE = kind === 'service_role' ? 'service_role' : 'secret';
  }
} else if (RAW_LEGACY_KEY) {
  const kind = classifySupabaseKey(RAW_LEGACY_KEY);
  if (kind === 'publishable') {
    DETECTED_KEY_TYPE = 'publishable_only';
  } else {
    BACKEND_SECRET_KEY = RAW_LEGACY_KEY;
    DETECTED_KEY_TYPE = kind === 'service_role' ? 'service_role' : 'secret';
  }
} else if (RAW_PUBLISHABLE_KEY) {
  DETECTED_KEY_TYPE = 'publishable_only';
}

const HAS_VALID_URL = isValidSupabaseUrl(SUPABASE_URL);
const HAS_SECRET_KEY = Boolean(BACKEND_SECRET_KEY && BACKEND_SECRET_KEY.length > 20);
const HAS_PUBLISHABLE_KEY = Boolean(RAW_PUBLISHABLE_KEY && RAW_PUBLISHABLE_KEY.length > 15);

export let supabase: SupabaseClient | null = null;

if (HAS_VALID_URL && HAS_SECRET_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, BACKEND_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ Supabase backend client initialized with Secret Key for URL:', SUPABASE_URL);
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase client:', err);
    supabase = null;
  }
} else {
  const missingParts: string[] = [];
  if (!HAS_VALID_URL) missingParts.push('SUPABASE_URL');
  if (!HAS_SECRET_KEY) {
    missingParts.push(
      HAS_PUBLISHABLE_KEY
        ? 'SUPABASE_SECRET_KEY (only SUPABASE_PUBLISHABLE_KEY detected)'
        : 'SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  console.log(`ℹ️ Supabase not fully configured (missing: ${missingParts.join(', ')}). Using in-memory fallback store without guessing URL or keys.`);
}

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

export interface SupabaseHealth {
  configured: boolean;
  connected: boolean;
  hasUrl: boolean;
  hasKey: boolean;
  hasSecretKey: boolean;
  hasPublishableKey: boolean;
  keyType: 'secret' | 'service_role' | 'publishable_only' | 'missing';
  readQueryVerified: boolean;
  projectDomain?: string;
  latencyMs?: number;
  testedAt: string;
  tablesStatus?: Record<string, boolean>;
  storageStatus?: {
    bucket: string;
    accessible: boolean;
    isPublic?: boolean;
    error?: string;
  };
  paymentProofsStorageStatus?: {
    bucket: string;
    accessible: boolean;
    isPublic?: boolean;
    error?: string;
  };
  paymentsScreenshotColumnReady?: boolean;
  paymentsSchemaError?: string;
  membershipDiscountColumnsReady?: boolean;
  membershipSchemaError?: string;
  error?: string;
}

function isMissingTableError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg)
  );
}

const STORAGE_BUCKET_NAME = 'crazy-storyes-assets';
const PAYMENT_PROOFS_BUCKET_NAME = 'crazy-storyes-payment-proofs';

async function checkBucketReadOnly(
  client: SupabaseClient,
  bucketName: string,
  listPrefix: string = ''
): Promise<NonNullable<SupabaseHealth['storageStatus']>> {
  try {
    const [{ data: bucketData, error: bucketErr }, { error: listErr }] = await Promise.all([
      client.storage.getBucket(bucketName),
      client.storage.from(bucketName).list(listPrefix, { limit: 1 }),
    ]);

    const isPublic = bucketData ? Boolean(bucketData.public) : undefined;

    if (!listErr) {
      return {
        bucket: bucketName,
        accessible: true,
        ...(isPublic !== undefined ? { isPublic } : {}),
      };
    }

    return {
      bucket: bucketName,
      accessible: false,
      ...(isPublic !== undefined ? { isPublic } : {}),
      error: listErr.message || bucketErr?.message || 'Storage bucket unreadable',
    };
  } catch (err: any) {
    return {
      bucket: bucketName,
      accessible: false,
      error: err?.message || 'Storage bucket check failed',
    };
  }
}

async function checkPaymentsScreenshotColumnReadOnly(
  client: SupabaseClient
): Promise<{ ready: boolean; error?: string }> {
  try {
    const { error } = await client.from('payments').select('screenshot_path').limit(1);
    if (!error) return { ready: true };
    return {
      ready: false,
      error: error.code ? `${error.code}: ${error.message}` : error.message,
    };
  } catch (err: any) {
    return { ready: false, error: err?.message || 'payments.screenshot_path check failed' };
  }
}

export async function checkMembershipDiscountColumnsReadOnly(
  client: SupabaseClient = supabase!
): Promise<{ ready: boolean; error?: string }> {
  if (!client) return { ready: false, error: 'Supabase not initialized' };
  try {
    const { error } = await client
      .from('membership_plans')
      .select('original_price, discount_type, discount_percentage, discount_amount, updated_at')
      .limit(1);
    if (!error) return { ready: true };
    return {
      ready: false,
      error: error.code ? `${error.code}: ${error.message}` : error.message,
    };
  } catch (err: any) {
    return { ready: false, error: err?.message || 'membership_plans discount columns check failed' };
  }
}

/**
 * Tests the real live connection to Supabase via a safe read-only query.
 * Verifies key tables presence and measures roundtrip latency.
 * Never fabricates SUPABASE_URL, never uses Secret Key on frontend, and never exposes raw keys.
 */
export async function checkSupabaseConnection(): Promise<SupabaseHealth> {
  const hasUrl = HAS_VALID_URL;
  const hasSecretKey = HAS_SECRET_KEY;
  const hasPublishableKey = HAS_PUBLISHABLE_KEY;

  let projectDomain = '';
  if (hasUrl) {
    try {
      projectDomain = new URL(SUPABASE_URL).hostname;
    } catch {
      projectDomain = 'invalid-url';
    }
  }

  if (!hasUrl || !hasSecretKey || !supabase) {
    const reasons: string[] = [];
    if (!hasUrl) {
      reasons.push(
        'SUPABASE_URL उपलब्ध नहीं है। इसे Supabase Dashboard -> Project Settings -> Data API (या API) -> Project URL से कॉपी करके AI Studio Secrets में जोड़ें।'
      );
    }
    if (!hasSecretKey) {
      if (hasPublishableKey) {
        reasons.push(
          'SUPABASE_PUBLISHABLE_KEY पहचान ली गई है, लेकिन Backend डेटाबेस संचालन के लिए SUPABASE_SECRET_KEY (sb_secret_... या service_role key) आवश्यक है — कृपया इसे Supabase Dashboard -> Project Settings -> API Keys -> Secret keys से लेकर Secrets में जोड़ें।'
        );
      } else {
        reasons.push(
          'SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY वातावरण Secret अनुपलब्ध है। कृपया इसे केवल Backend Secrets में जोड़ें।'
        );
      }
    }

    return {
      configured: false,
      connected: false,
      hasUrl,
      hasKey: hasSecretKey,
      hasSecretKey,
      hasPublishableKey,
      keyType: DETECTED_KEY_TYPE,
      readQueryVerified: false,
      projectDomain: projectDomain || undefined,
      testedAt: new Date().toISOString(),
      storageStatus: {
        bucket: STORAGE_BUCKET_NAME,
        accessible: false,
        error: reasons.join(' | '),
      },
      paymentProofsStorageStatus: {
        bucket: PAYMENT_PROOFS_BUCKET_NAME,
        accessible: false,
        error: reasons.join(' | '),
      },
      paymentsScreenshotColumnReady: false,
      membershipDiscountColumnsReady: false,
      error: reasons.join(' | '),
    };
  }

  const start = Date.now();
  try {
    // 1. Safe read-only SELECT query on site_settings, with legacy app_settings fallback if site_settings is missing
    let primaryError: { code?: string; message: string } | null = null;
    const { error: siteErr } = await supabase.from('site_settings').select('id').limit(1);

    if (siteErr) {
      if (isMissingTableError(siteErr)) {
        const { error: appSettingsErr } = await supabase
          .from('app_settings')
          .select('*', { head: true, count: 'exact' });

        if (appSettingsErr) {
          primaryError = {
            code: appSettingsErr.code || siteErr.code,
            message: `site_settings: ${siteErr.message} | app_settings: ${appSettingsErr.message}`,
          };
        }
      } else {
        const latencyMs = Date.now() - start;
        return {
          configured: true,
          connected: false,
          hasUrl: true,
          hasKey: true,
          hasSecretKey: true,
          hasPublishableKey,
          keyType: DETECTED_KEY_TYPE,
          readQueryVerified: false,
          projectDomain,
          latencyMs,
          testedAt: new Date().toISOString(),
          error: `Supabase Read-Only क्वेरी विफल: ${siteErr.message} (कोड: ${siteErr.code || 'UNKNOWN'})`,
        };
      }
    }

    const latencyMs = Date.now() - start;

    // 2. Check read access across essential tables (HEAD count queries only — zero writes/deletes)
    const tableNames = [
      'site_settings',
      'app_settings',
      'users',
      'novels',
      'chapters',
      'payments',
      'membership_plans',
      'support_tickets',
      'telegram_users',
      'telegram_access',
      'telegram_link_codes',
      'telegram_access_logs',
      'telegram_pending_operations',
      'telegram_processed_updates',
      'user_auth_logs',
      'revoked_tokens',
    ];

    const tablesStatus: Record<string, boolean> = {};
    const [, storageStatus, paymentProofsStorageStatus, paymentColCheck, membershipColCheck] = await Promise.all([
      Promise.all(
        tableNames.map(async (tbl) => {
          try {
            const { error: tblErr } = await supabase!.from(tbl).select('*', { head: true, count: 'exact' });
            tablesStatus[tbl] = !tblErr;
          } catch {
            tablesStatus[tbl] = false;
          }
        })
      ),
      checkBucketReadOnly(supabase, STORAGE_BUCKET_NAME, ''),
      checkBucketReadOnly(supabase, PAYMENT_PROOFS_BUCKET_NAME, 'payment-proofs'),
      checkPaymentsScreenshotColumnReadOnly(supabase),
      checkMembershipDiscountColumnsReadOnly(supabase),
    ]);

    if (primaryError) {
      return {
        configured: true,
        connected: false,
        hasUrl: true,
        hasKey: true,
        hasSecretKey: true,
        hasPublishableKey,
        keyType: DETECTED_KEY_TYPE,
        readQueryVerified: false,
        projectDomain,
        latencyMs,
        testedAt: new Date().toISOString(),
        tablesStatus,
        storageStatus,
        paymentProofsStorageStatus,
        paymentsScreenshotColumnReady: paymentColCheck.ready,
        paymentsSchemaError: paymentColCheck.error,
        membershipDiscountColumnsReady: membershipColCheck.ready,
        membershipSchemaError: membershipColCheck.error,
        error: `Supabase Read-Only क्वेरी विफल: ${primaryError.message} (कोड: ${primaryError.code || 'UNKNOWN'})`,
      };
    }

    return {
      configured: true,
      connected: true,
      hasUrl: true,
      hasKey: true,
      hasSecretKey: true,
      hasPublishableKey,
      keyType: DETECTED_KEY_TYPE,
      readQueryVerified: true,
      projectDomain,
      latencyMs,
      testedAt: new Date().toISOString(),
      tablesStatus,
      storageStatus,
      paymentProofsStorageStatus,
      paymentsScreenshotColumnReady: paymentColCheck.ready,
      paymentsSchemaError: paymentColCheck.error,
      membershipDiscountColumnsReady: membershipColCheck.ready,
      membershipSchemaError: membershipColCheck.error,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      hasUrl: true,
      hasKey: true,
      hasSecretKey: true,
      hasPublishableKey,
      keyType: DETECTED_KEY_TYPE,
      readQueryVerified: false,
      projectDomain,
      latencyMs: Date.now() - start,
      testedAt: new Date().toISOString(),
      error: `Supabase नेटवर्क कनेक्शन त्रुटि: ${err?.message || 'अज्ञात त्रुटि'}`,
    };
  }
}

// -------------------------------------------------------------
// Row <-> TypeScript Object Mappers (snake_case <-> camelCase)
// -------------------------------------------------------------

export function userToRow(u: User): any {
  return {
    id: u.id,
    name: u.name,
    email: u.email.toLowerCase(),
    password_hash: u.passwordHash,
    role: u.role || 'reader',
    is_blocked: Boolean(u.isBlocked),
    membership: u.membership || { isActive: false },
    bookmarks: u.bookmarks || [],
    reading_history: u.readingHistory || [],
    telegram: u.telegram || null,
    last_login_at: u.lastLoginAt || null,
    last_logout_at: u.lastLogoutAt || null,
    created_at: u.createdAt || new Date().toISOString()
  };
}

export function userPartialToRow(u: Partial<User>): any {
  const row: any = {};
  if (u.name !== undefined) row.name = u.name;
  if (u.email !== undefined) row.email = u.email.toLowerCase();
  if (u.passwordHash !== undefined) row.password_hash = u.passwordHash;
  if (u.role !== undefined) row.role = u.role;
  if (u.isBlocked !== undefined) row.is_blocked = u.isBlocked;
  if (u.membership !== undefined) row.membership = u.membership;
  if (u.bookmarks !== undefined) row.bookmarks = u.bookmarks;
  if (u.readingHistory !== undefined) row.reading_history = u.readingHistory;
  if (u.telegram !== undefined) row.telegram = u.telegram;
  if (u.lastLoginAt !== undefined) row.last_login_at = u.lastLoginAt;
  if (u.lastLogoutAt !== undefined) row.last_logout_at = u.lastLogoutAt;
  return row;
}

function safeJsonObject<T extends Record<string, any>>(value: any, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      // Ignore invalid JSON
    }
  }
  return { ...fallback };
}

function safeJsonArray<T = any>(value: any): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as T[];
    } catch {
      // Ignore invalid JSON
    }
  }
  return [];
}

export function rowToUser(r: any): User {
  const membershipObj = safeJsonObject(r.membership, { isActive: false });
  const telegramObj = r.telegram ? safeJsonObject<Record<string, any>>(r.telegram, {}) : null;

  return {
    id: String(r.id || ''),
    name: String(r.name || ''),
    email: String(r.email || ''),
    passwordHash:
      typeof r.password_hash === 'string'
        ? r.password_hash
        : typeof r.passwordHash === 'string'
          ? r.passwordHash
          : '',
    role: r.role === 'admin' ? 'admin' : 'reader',
    isBlocked: Boolean(r.is_blocked),
    membership: {
      ...membershipObj,
      isActive: Boolean(membershipObj.isActive)
    },
    bookmarks: safeJsonArray<string>(r.bookmarks),
    readingHistory: safeJsonArray(r.reading_history),
    telegram: telegramObj && typeof telegramObj.telegramUserId === 'number' ? (telegramObj as User['telegram']) : undefined,
    lastLoginAt: r.last_login_at || undefined,
    lastLogoutAt: r.last_logout_at || undefined,
    createdAt: r.created_at || new Date().toISOString()
  };
}

export function novelToRow(n: Novel): any {
  return {
    id: n.id,
    title: n.title,
    hindi_title: n.hindiTitle || null,
    author: n.author || '',
    description: n.description,
    cover_image: n.coverImage,
    categories: n.categories || [],
    tags: n.tags || [],
    is_premium: Boolean(n.isPremium),
    is_published: n.isPublished !== false,
    is_featured: Boolean(n.isFeatured),
    is_trending: Boolean(n.isTrending),
    is_popular: Boolean(n.isPopular),
    views: Number(n.views) || 0,
    rating: Number(n.rating) || 5.0,
    rating_count: Number(n.ratingCount) || 0,
    user_ratings: n.userRatings || {},
    likes: Number(n.likes) || 0,
    liked_by: n.likedBy || [],
    reviews: n.reviews || [],
    total_chapters: Number(n.totalChapters) || 0,
    telegram_channel_privacy: n.telegramChannelPrivacy || (n.telegramChannelLink && !n.telegramChannelId ? 'public' : 'private'),
    telegram_channel_link: n.telegramChannelLink || null,
    telegram_channel_id: n.telegramChannelId || null,
    telegram_channel_name: n.telegramChannelName || null,
    telegram_channel_type: n.telegramChannelType || 'channel',
    telegram_access_type: n.telegramAccessType || (n.isPremium ? 'premium' : 'free'),
    telegram_integration_enabled: Boolean(n.telegramIntegrationEnabled),
    created_at: n.createdAt || new Date().toISOString(),
    updated_at: n.updatedAt || new Date().toISOString()
  };
}

export function novelPartialToRow(n: Partial<Novel>): any {
  const row: any = { updated_at: new Date().toISOString() };
  if (n.title !== undefined) row.title = n.title;
  if (n.hindiTitle !== undefined) row.hindi_title = n.hindiTitle;
  if (n.author !== undefined) row.author = n.author;
  if (n.description !== undefined) row.description = n.description;
  if (n.coverImage !== undefined) row.cover_image = n.coverImage;
  if (n.categories !== undefined) row.categories = n.categories;
  if (n.tags !== undefined) row.tags = n.tags;
  if (n.isPremium !== undefined) row.is_premium = n.isPremium;
  if (n.isPublished !== undefined) row.is_published = n.isPublished;
  if (n.isFeatured !== undefined) row.is_featured = n.isFeatured;
  if (n.isTrending !== undefined) row.is_trending = n.isTrending;
  if (n.isPopular !== undefined) row.is_popular = n.isPopular;
  if (n.views !== undefined) row.views = n.views;
  if (n.rating !== undefined) row.rating = n.rating;
  if (n.ratingCount !== undefined) row.rating_count = n.ratingCount;
  if (n.userRatings !== undefined) row.user_ratings = n.userRatings;
  if (n.likes !== undefined) row.likes = n.likes;
  if (n.likedBy !== undefined) row.liked_by = n.likedBy;
  if (n.reviews !== undefined) row.reviews = n.reviews;
  if (n.totalChapters !== undefined) row.total_chapters = n.totalChapters;
  if (n.telegramChannelPrivacy !== undefined) row.telegram_channel_privacy = n.telegramChannelPrivacy;
  if (n.telegramChannelLink !== undefined) row.telegram_channel_link = n.telegramChannelLink || null;
  if (n.telegramChannelId !== undefined) row.telegram_channel_id = n.telegramChannelId || null;
  if (n.telegramChannelName !== undefined) row.telegram_channel_name = n.telegramChannelName || null;
  if (n.telegramChannelType !== undefined) row.telegram_channel_type = n.telegramChannelType;
  if (n.telegramAccessType !== undefined) row.telegram_access_type = n.telegramAccessType;
  if (n.telegramIntegrationEnabled !== undefined) row.telegram_integration_enabled = n.telegramIntegrationEnabled;
  return row;
}

export function rowToNovel(r: any): Novel {
  return {
    id: r.id,
    title: r.title,
    hindiTitle: r.hindi_title || undefined,
    author: r.author || '',
    description: r.description,
    coverImage: r.cover_image,
    categories: safeJsonArray<string>(r.categories),
    tags: safeJsonArray<string>(r.tags),
    isPremium: Boolean(r.is_premium),
    isPublished: r.is_published !== false,
    isFeatured: Boolean(r.is_featured),
    isTrending: Boolean(r.is_trending),
    isPopular: Boolean(r.is_popular),
    views: Number(r.views) || 0,
    rating: Number(r.rating) || 5.0,
    ratingCount: Number(r.rating_count) || 0,
    userRatings: safeJsonObject<Record<string, number>>(r.user_ratings, {}),
    likes: Number(r.likes) || 0,
    likedBy: safeJsonArray<string>(r.liked_by),
    reviews: safeJsonArray(r.reviews),
    totalChapters: Number(r.total_chapters) || 0,
    telegramChannelPrivacy: r.telegram_channel_privacy || (r.telegram_channel_link && !r.telegram_channel_id ? 'public' : 'private'),
    telegramChannelLink: r.telegram_channel_link || undefined,
    telegramChannelId: r.telegram_channel_id || undefined,
    telegramChannelName: r.telegram_channel_name || undefined,
    telegramChannelType: r.telegram_channel_type || undefined,
    telegramAccessType: r.telegram_access_type || undefined,
    telegramIntegrationEnabled: Boolean(r.telegram_integration_enabled),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function chapterToRow(c: Chapter): any {
  return {
    id: c.id,
    novel_id: c.novelId,
    chapter_number: Number(c.chapterNumber),
    title: c.title,
    content: c.content || '',
    audio_url: c.audioUrl || null,
    audio_duration_seconds: c.audioDurationSeconds || null,
    is_premium: Boolean(c.isPremium),
    is_published: c.isPublished !== false,
    telegram_message_link: c.telegramMessageLink || null,
    telegram_message_id: c.telegramMessageId || null,
    telegram_chat_id: c.telegramChatId || null,
    telegram_destination_type: c.telegramDestinationType || 'channel',
    telegram_audio_access_type: c.telegramAudioAccessType || (c.isPremium ? 'premium' : 'free'),
    telegram_audio_configured: Boolean(c.telegramMessageLink),
    created_at: c.createdAt || new Date().toISOString(),
    updated_at: c.updatedAt || new Date().toISOString()
  };
}

export function chapterPartialToRow(c: Partial<Chapter>): any {
  const row: any = { updated_at: new Date().toISOString() };
  if (c.novelId !== undefined) row.novel_id = c.novelId;
  if (c.chapterNumber !== undefined) row.chapter_number = Number(c.chapterNumber);
  if (c.title !== undefined) row.title = c.title;
  if (c.content !== undefined) row.content = c.content || '';
  if (c.audioUrl !== undefined) row.audio_url = c.audioUrl || null;
  if (c.audioDurationSeconds !== undefined) row.audio_duration_seconds = c.audioDurationSeconds;
  if (c.isPremium !== undefined) row.is_premium = c.isPremium;
  if (c.isPublished !== undefined) row.is_published = c.isPublished;
  if (c.telegramMessageLink !== undefined) {
    row.telegram_message_link = c.telegramMessageLink || null;
    row.telegram_audio_configured = Boolean(c.telegramMessageLink);
  }
  if (c.telegramMessageId !== undefined) row.telegram_message_id = c.telegramMessageId || null;
  if (c.telegramChatId !== undefined) row.telegram_chat_id = c.telegramChatId || null;
  if (c.telegramDestinationType !== undefined) row.telegram_destination_type = c.telegramDestinationType;
  if (c.telegramAudioAccessType !== undefined) row.telegram_audio_access_type = c.telegramAudioAccessType;
  if (c.telegramAudioConfigured !== undefined) row.telegram_audio_configured = c.telegramAudioConfigured;
  return row;
}

export function rowToChapter(r: any): Chapter {
  const hasTgLink = Boolean(r.telegram_message_link);
  return {
    id: r.id,
    novelId: r.novel_id,
    chapterNumber: Number(r.chapter_number),
    title: r.title,
    content: r.content || '',
    audioUrl: r.audio_url || undefined,
    audioDurationSeconds: r.audio_duration_seconds ? Number(r.audio_duration_seconds) : undefined,
    isPremium: Boolean(r.is_premium),
    isPublished: r.is_published !== false,
    telegramMessageLink: r.telegram_message_link || undefined,
    telegramMessageId: r.telegram_message_id ? Number(r.telegram_message_id) : undefined,
    telegramChatId: r.telegram_chat_id || undefined,
    telegramDestinationType: r.telegram_destination_type || 'channel',
    telegramAudioAccessType: r.telegram_audio_access_type || (r.is_premium ? 'premium' : 'free'),
    telegramAudioConfigured: r.telegram_audio_configured !== undefined ? Boolean(r.telegram_audio_configured) : hasTgLink,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}


export function paymentToRow(p: PaymentRequest): any {
  const row: any = {
    id: p.id,
    user_id: p.userId,
    user_name: p.userName,
    user_email: p.userEmail,
    item_type: p.itemType,
    item_id: p.itemId,
    item_name: p.itemName,
    amount: Number(p.amount),
    status: p.status || 'pending',
    created_at: p.createdAt || new Date().toISOString()
  };

  if (p.utrNumber !== undefined && p.utrNumber !== '') row.utr_number = p.utrNumber;
  if (p.paymentProofUrl !== undefined && p.paymentProofUrl !== '') row.payment_proof_url = p.paymentProofUrl;
  if (p.screenshotPath !== undefined && p.screenshotPath !== '') row.screenshot_path = p.screenshotPath;
  if (p.rejectionReason !== undefined && p.rejectionReason !== '') row.rejection_reason = p.rejectionReason;
  if (p.adminNote !== undefined && p.adminNote !== '') row.admin_note = p.adminNote;
  if (p.reviewedAt !== undefined && p.reviewedAt !== '') row.reviewed_at = p.reviewedAt;
  if (p.reviewedBy !== undefined && p.reviewedBy !== '') row.reviewed_by = p.reviewedBy;

  return row;
}

export function paymentPartialToRow(p: Partial<PaymentRequest>): any {
  const row: any = {};
  if (p.status !== undefined) row.status = p.status;
  if (p.rejectionReason !== undefined) row.rejection_reason = p.rejectionReason;
  if (p.adminNote !== undefined) row.admin_note = p.adminNote;
  if (p.utrNumber !== undefined) row.utr_number = p.utrNumber;
  if (p.screenshotPath !== undefined) row.screenshot_path = p.screenshotPath;
  if (p.reviewedAt !== undefined) row.reviewed_at = p.reviewedAt;
  if (p.reviewedBy !== undefined) row.reviewed_by = p.reviewedBy;
  return row;
}

export function rowToPayment(r: any): PaymentRequest {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userEmail: r.user_email,
    itemType: r.item_type as 'membership' | 'novel',
    itemId: r.item_id,
    itemName: r.item_name,
    amount: Number(r.amount),
    utrNumber: r.utr_number || undefined,
    paymentProofUrl: r.payment_proof_url || undefined,
    screenshotPath: r.screenshot_path || undefined,
    status: r.status as 'pending' | 'approved' | 'rejected',
    rejectionReason: r.rejection_reason || undefined,
    adminNote: r.admin_note || undefined,
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at || undefined,
    reviewedBy: r.reviewed_by || undefined
  };
}

function roundPlanMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function planToRow(p: MembershipPlan): any {
  const finalPrice = roundPlanMoney(Number(p.price) || 0);
  const origPrice =
    p.originalPrice !== undefined && p.originalPrice !== null && Number(p.originalPrice) > 0
      ? roundPlanMoney(Number(p.originalPrice))
      : finalPrice;
  const dType: 'none' | 'percentage' | 'fixed' =
    p.discountType === 'percentage' || p.discountType === 'fixed' ? p.discountType : 'none';
  const dPct = dType === 'percentage' ? roundPlanMoney(Number(p.discountPercentage) || 0) : 0;
  const dAmt = dType === 'fixed' ? roundPlanMoney(Number(p.discountAmount) || 0) : 0;

  return {
    id: p.id,
    name: p.name,
    hindi_name: p.hindiName,
    original_price: origPrice,
    price: finalPrice,
    duration_days: Math.round(Number(p.durationDays) || 30),
    discount_type: dType,
    discount_percentage: dPct,
    discount_amount: dAmt,
    description: p.description,
    features: p.features || [],
    is_active: p.isActive !== false,
    badge_text: p.badgeText || null,
    updated_at: p.updatedAt || new Date().toISOString()
  };
}

export function rowToPlan(r: any): MembershipPlan {
  const price = roundPlanMoney(Number(r.price) || 0);
  const originalPrice =
    r.original_price !== undefined && r.original_price !== null && Number(r.original_price) > 0
      ? roundPlanMoney(Number(r.original_price))
      : price;
  const rawPct =
    r.discount_percentage !== undefined && r.discount_percentage !== null
      ? roundPlanMoney(Number(r.discount_percentage))
      : 0;
  const rawAmt =
    r.discount_amount !== undefined && r.discount_amount !== null
      ? roundPlanMoney(Number(r.discount_amount))
      : 0;

  let discountType: 'none' | 'percentage' | 'fixed' = 'none';
  if (r.discount_type === 'percentage' && rawPct > 0) {
    discountType = 'percentage';
  } else if (r.discount_type === 'fixed' && rawAmt > 0) {
    discountType = 'fixed';
  } else if (rawPct > 0) {
    discountType = 'percentage';
  } else if (rawAmt > 0) {
    discountType = 'fixed';
  } else if (originalPrice > price) {
    discountType = 'fixed';
  }

  const discountPercentage = discountType === 'percentage' ? rawPct : 0;
  const discountAmount =
    discountType === 'fixed'
      ? (rawAmt > 0 ? rawAmt : roundPlanMoney(Math.max(0, originalPrice - price)))
      : 0;

  return {
    id: r.id,
    name: r.name,
    hindiName: r.hindi_name,
    originalPrice,
    price,
    durationDays: Number(r.duration_days),
    discountType,
    discountPercentage,
    discountAmount,
    description: r.description,
    features: safeJsonArray<string>(r.features),
    isActive: r.is_active !== false,
    badgeText: r.badge_text || undefined,
    updatedAt: r.updated_at || undefined
  };
}

export function settingsToRow(s: SiteSettings): any {
  return {
    id: 'current',
    website_name: s.websiteName,
    tagline: s.tagline,
    admin_email: s.adminEmail,
    upi_id: s.upiId,
    upi_qr_code_url: s.upiQrCodeUrl || null,
    announcement: s.announcement || '',
    announcement_active: s.announcementActive !== false,
    support_email: s.supportEmail,
    support_phone: s.supportPhone,
    enable_ai_assistant: s.enableAiAssistant !== false,
    updated_at: new Date().toISOString()
  };
}

export function settingsPartialToRow(s: Partial<SiteSettings>): any {
  const row: any = { updated_at: new Date().toISOString() };
  if (s.websiteName !== undefined) row.website_name = s.websiteName;
  if (s.tagline !== undefined) row.tagline = s.tagline;
  if (s.adminEmail !== undefined) row.admin_email = s.adminEmail;
  if (s.upiId !== undefined) row.upi_id = s.upiId;
  if (s.upiQrCodeUrl !== undefined) row.upi_qr_code_url = s.upiQrCodeUrl;
  if (s.announcement !== undefined) row.announcement = s.announcement;
  if (s.announcementActive !== undefined) row.announcement_active = s.announcementActive;
  if (s.supportEmail !== undefined) row.support_email = s.supportEmail;
  if (s.supportPhone !== undefined) row.support_phone = s.supportPhone;
  if (s.enableAiAssistant !== undefined) row.enable_ai_assistant = s.enableAiAssistant;
  return row;
}

export function rowToSettings(r: any): SiteSettings {
  return {
    websiteName: r.website_name || 'Crazy Storyes',
    tagline: r.tagline || 'प्रीमियम हिंदी उपन्यास और ऑडियोबुक्स',
    adminEmail: r.admin_email || '',
    upiId: r.upi_id || 'crazystoryes@upi',
    upiQrCodeUrl: r.upi_qr_code_url || '',
    announcement: r.announcement || '',
    announcementActive: r.announcement_active !== false,
    supportEmail: r.support_email || 'divinecult2007@gmail.com',
    supportPhone: r.support_phone || '+91 8290188433',
    enableAiAssistant: r.enable_ai_assistant !== false
  };
}

export function ticketToRow(t: SupportTicket): any {
  return {
    id: t.id,
    user_id: t.userId || null,
    user_name: t.userName,
    user_email: t.userEmail,
    category: t.category,
    subject: t.subject,
    message: t.message,
    admin_reply: t.adminReply || null,
    status: t.status || 'open',
    created_at: t.createdAt || new Date().toISOString(),
    replied_at: t.repliedAt || null
  };
}

export function rowToTicket(r: any): SupportTicket {
  return {
    id: r.id,
    userId: r.user_id || undefined,
    userName: r.user_name,
    userEmail: r.user_email,
    category: r.category as 'question' | 'problem' | 'feedback' | 'payment',
    subject: r.subject,
    message: r.message,
    adminReply: r.admin_reply || undefined,
    status: r.status as 'open' | 'answered' | 'closed',
    createdAt: r.created_at,
    repliedAt: r.replied_at || undefined
  };
}

// -------------------------------------------------------------
// Telegram Mappers
// -------------------------------------------------------------

export function telegramAccessToRow(a: TelegramAccessRecord): any {
  return {
    id: a.id,
    user_id: a.userId,
    telegram_user_id: a.telegramUserId,
    novel_id: a.novelId,
    novel_title: a.novelTitle || null,
    channel_id: a.channelId,
    channel_name: a.channelName || null,
    access_type: a.accessType,
    invite_link: a.inviteLink || null,
    status: a.status,
    joined_at: a.joinedAt || new Date().toISOString(),
    expires_at: a.expiresAt || null,
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: a.updatedAt || new Date().toISOString()
  };
}

export function rowToTelegramAccess(r: any): TelegramAccessRecord {
  return {
    id: r.id,
    userId: r.user_id,
    telegramUserId: Number(r.telegram_user_id),
    novelId: r.novel_id,
    novelTitle: r.novel_title || undefined,
    channelId: r.channel_id,
    channelName: r.channel_name || undefined,
    accessType: r.access_type,
    inviteLink: r.invite_link || undefined,
    status: r.status,
    joinedAt: r.joined_at,
    expiresAt: r.expires_at || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function telegramLinkCodeToRow(c: TelegramLinkCode): any {
  return {
    id: c.id,
    code: c.code,
    user_id: c.userId,
    user_email: c.userEmail,
    user_name: c.userName,
    expires_at: c.expiresAt,
    used_at: c.usedAt || null,
    created_at: c.createdAt || new Date().toISOString()
  };
}

export function rowToTelegramLinkCode(r: any): TelegramLinkCode {
  return {
    id: r.id,
    code: r.code,
    userId: r.user_id,
    userEmail: r.user_email || '',
    userName: r.user_name || '',
    expiresAt: r.expires_at,
    usedAt: r.used_at || undefined,
    createdAt: r.created_at
  };
}

export function telegramLogToRow(l: TelegramAccessLog): any {
  return {
    id: l.id,
    user_id: l.userId,
    telegram_user_id: l.telegramUserId || null,
    channel_id: l.channelId || null,
    novel_id: l.novelId || null,
    action: l.action,
    status: l.status,
    details: l.details || null,
    created_at: l.createdAt || new Date().toISOString()
  };
}

export function rowToTelegramLog(r: any): TelegramAccessLog {
  return {
    id: r.id,
    userId: r.user_id,
    telegramUserId: r.telegram_user_id ? Number(r.telegram_user_id) : undefined,
    channelId: r.channel_id || undefined,
    novelId: r.novel_id || undefined,
    action: r.action,
    status: r.status,
    details: r.details || undefined,
    createdAt: r.created_at
  };
}

export function telegramPendingOpToRow(p: TelegramPendingOperation): any {
  return {
    id: p.id,
    operation_type: p.operationType,
    user_id: p.userId,
    telegram_user_id: p.telegramUserId,
    channel_id: p.channelId,
    novel_id: p.novelId,
    retry_count: p.retryCount || 0,
    last_error: p.lastError || null,
    status: p.status,
    created_at: p.createdAt || new Date().toISOString(),
    updated_at: p.updatedAt || new Date().toISOString()
  };
}

export function rowToTelegramPendingOp(r: any): TelegramPendingOperation {
  return {
    id: r.id,
    operationType: r.operation_type,
    userId: r.user_id,
    telegramUserId: Number(r.telegram_user_id),
    channelId: r.channel_id,
    novelId: r.novel_id,
    retryCount: Number(r.retry_count) || 0,
    lastError: r.last_error || undefined,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

export function authLogToRow(l: UserAuthLog): any {
  return {
    id: l.id,
    user_id: l.userId || null,
    user_email: l.userEmail || l.email || null,
    user_name: l.userName || null,
    event_type: l.eventType,
    ip: l.ip || l.ipAddress || null,
    user_agent: l.userAgent || null,
    device_info: l.deviceInfo || null,
    details: l.details || l.failureReason || null,
    created_at: l.createdAt || l.timestamp || new Date().toISOString()
  };
}

export function rowToAuthLog(r: any): UserAuthLog {
  const email = r.user_email || undefined;
  const ip = r.ip || undefined;
  const details = r.details || undefined;
  const createdAt = r.created_at;
  const status = r.event_type === 'failed_login' ? 'failed' : 'success';
  return {
    id: r.id,
    userId: r.user_id || undefined,
    userEmail: email,
    email,
    userName: r.user_name || undefined,
    eventType: r.event_type,
    ip,
    ipAddress: ip,
    userAgent: r.user_agent || undefined,
    deviceInfo: r.device_info || undefined,
    status,
    details,
    failureReason: details,
    createdAt,
    timestamp: createdAt
  };
}

export function revokedTokenToRow(t: RevokedToken): any {
  return {
    id: t.id,
    token: t.token,
    user_id: t.userId || null,
    expires_at: t.expiresAt,
    revoked_at: t.revokedAt || new Date().toISOString(),
    reason: t.reason || null
  };
}

export function rowToRevokedToken(r: any): RevokedToken {
  return {
    id: r.id,
    token: r.token,
    userId: r.user_id || undefined,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    reason: r.reason || undefined
  };
}


