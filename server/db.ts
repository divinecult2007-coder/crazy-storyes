import path from 'path';
import fs from 'fs';
import {
  supabase,
  isSupabaseConfigured,
  userToRow,
  userPartialToRow,
  rowToUser,
  novelToRow,
  novelPartialToRow,
  rowToNovel,
  chapterToRow,
  chapterPartialToRow,
  rowToChapter,
  paymentToRow,
  paymentPartialToRow,
  rowToPayment,
  planToRow,
  rowToPlan,
  settingsToRow,
  settingsPartialToRow,
  rowToSettings,
  ticketToRow,
  rowToTicket,
  telegramAccessToRow,
  rowToTelegramAccess,
  telegramLinkCodeToRow,
  rowToTelegramLinkCode,
  telegramLogToRow,
  rowToTelegramLog,
  telegramPendingOpToRow,
  rowToTelegramPendingOp,
  authLogToRow,
  rowToAuthLog,
  revokedTokenToRow,
  rowToRevokedToken
} from './supabase.ts';
import type {
  DatabaseSchema,
  Novel,
  Chapter,
  User,
  MembershipPlan,
  SiteSettings,
  PaymentRequest,
  SupportTicket,
  TelegramAccessRecord,
  TelegramLinkCode,
  TelegramAccessLog,
  TelegramPendingOperation,
  UserAuthLog,
  RevokedToken
} from './types.ts';
import {
  initialSettings,
  initialPlans,
  initialNovels,
  initialChapters,
  initialUsers
} from './seedData.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const PRIVATE_SCREENSHOTS_DIR = path.join(DATA_DIR, 'private_screenshots');

// Ensure directories exist for binary file uploads (images/audio/screenshots)
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PRIVATE_SCREENSHOTS_DIR)) {
  fs.mkdirSync(PRIVATE_SCREENSHOTS_DIR, { recursive: true });
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function createDatabaseError(operation: string, err: any): Error & {
  code?: string;
  details?: string;
  hint?: string;
  operation?: string;
} {
  const message = err?.message || 'Unknown database error';
  const dbErr = new Error(`Supabase error (${operation}): ${message}`) as Error & {
    code?: string;
    details?: string;
    hint?: string;
    operation?: string;
  };
  if (err?.code) dbErr.code = String(err.code);
  if (err?.details) dbErr.details = String(err.details);
  if (err?.hint) dbErr.hint = String(err.hint);
  dbErr.operation = operation;
  return dbErr;
}

const OPTIONAL_USER_TRACKING_COLUMNS = ['last_login_at', 'last_logout_at', 'telegram'] as const;

function detectMissingOptionalUserColumn(err: any): string | null {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  const isMissingColumnError =
    code === 'PGRST204' ||
    code === '42703' ||
    /could not find the '[^']+' column/i.test(msg) ||
    /column [^ ]+ does not exist/i.test(msg);

  if (!isMissingColumnError) return null;

  for (const col of OPTIONAL_USER_TRACKING_COLUMNS) {
    if (msg.includes(col)) {
      return col;
    }
  }
  return null;
}

const OPTIONAL_PAYMENT_COLUMNS = [
  'utr_number',
  'payment_proof_url',
  'rejection_reason',
  'admin_note',
  'reviewed_at',
  'reviewed_by'
] as const;

function detectMissingOptionalPaymentColumn(err: any): string | null {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  const isMissingColumnError =
    code === 'PGRST204' ||
    code === '42703' ||
    /could not find the '[^']+' column/i.test(msg) ||
    /column [^ ]+ does not exist/i.test(msg);

  if (!isMissingColumnError) return null;

  for (const col of OPTIONAL_PAYMENT_COLUMNS) {
    if (msg.includes(col)) {
      return col;
    }
  }
  return null;
}

const OPTIONAL_PLAN_DISCOUNT_COLUMNS = [
  'original_price',
  'discount_type',
  'discount_percentage',
  'discount_amount',
  'updated_at'
] as const;

function detectMissingOptionalPlanColumn(err: any): string | null {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  const isMissingColumnError =
    code === 'PGRST204' ||
    code === '42703' ||
    /could not find the '[^']+' column/i.test(msg) ||
    /column [^ ]+ does not exist/i.test(msg);

  if (!isMissingColumnError) return null;

  for (const col of OPTIONAL_PLAN_DISCOUNT_COLUMNS) {
    if (msg.includes(col)) {
      return col;
    }
  }
  return null;
}

function stripOptionalPlanColumns(row: Record<string, any>): Record<string, any> {
  const {
    original_price: _op,
    discount_type: _dt,
    discount_percentage: _dp,
    discount_amount: _da,
    updated_at: _ua,
    ...baseRow
  } = row;
  return baseRow;
}

function planNeedsDiscountColumns(p: MembershipPlan): boolean {
  if (p.discountType === 'percentage' || p.discountType === 'fixed') return true;
  if ((Number(p.discountPercentage) || 0) > 0) return true;
  if ((Number(p.discountAmount) || 0) > 0) return true;
  if (p.originalPrice !== undefined && Math.abs(Number(p.originalPrice) - Number(p.price)) > 0.01) {
    return true;
  }
  return false;
}

function sortPlansConsistent(plans: MembershipPlan[]): MembershipPlan[] {
  return [...plans].sort((a, b) => {
    const durDiff = (Number(a.durationDays) || 0) - (Number(b.durationDays) || 0);
    if (durDiff !== 0) return durDiff;
    const priceDiff = (Number(a.price) || 0) - (Number(b.price) || 0);
    if (priceDiff !== 0) return priceDiff;
    return (a.name || '').localeCompare(b.name || '');
  });
}

function isTableMissingError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '');
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    /relation .* does not exist/i.test(msg) ||
    /could not find the table/i.test(msg)
  );
}

class Database {
  // In-memory synchronized store (zero JSON file writes)
  private cache: DatabaseSchema = {
    users: [...initialUsers],
    novels: [...initialNovels],
    chapters: [...initialChapters],
    payments: [],
    membershipPlans: [...initialPlans],
    settings: { ...initialSettings },
    supportTickets: [],
    telegramLinkCodes: [],
    telegramAccess: [],
    telegramAccessLogs: [],
    telegramPendingOperations: [],
    userAuthLogs: [],
    revokedTokens: []
  };

  private initPromise: Promise<void> | null = null;
  private isInitialized = false;
  private initErrors: Array<{ table: string; operation: 'select' | 'seed' | 'check' | 'sync'; code?: string; message: string }> = [];
  private warnedMissingTables = new Set<string>();

  private warnMissingTable(table: string, operation: string) {
    if (!this.warnedMissingTables.has(table)) {
      this.warnedMissingTables.add(table);
      console.warn(
        `⚠️ Supabase table "public.${table}" is missing (first encountered in ${operation}) — using in-memory fallback until supabase_security_rls_consolidated.sql is run in Supabase SQL Editor.`
      );
    }
  }

  private async tryReadLegacyAppSettings(): Promise<SiteSettings | null> {
    if (!isSupabaseConfigured() || !supabase) return null;
    try {
      const { data, error } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
      if (error || !data) return null;

      // Support either site_settings-shaped columns or nested settings JSON
      const candidate =
        data.settings && typeof data.settings === 'object'
          ? data.settings
          : data.value && typeof data.value === 'object'
            ? data.value
            : data;

      if (candidate.website_name || candidate.upi_id || candidate.admin_email || candidate.websiteName || candidate.upiId) {
        return {
          websiteName: candidate.websiteName || candidate.website_name || this.cache.settings.websiteName,
          tagline: candidate.tagline || this.cache.settings.tagline,
          adminEmail: candidate.adminEmail || candidate.admin_email || this.cache.settings.adminEmail,
          upiId: candidate.upiId || candidate.upi_id || this.cache.settings.upiId,
          upiQrCodeUrl: candidate.upiQrCodeUrl || candidate.upi_qr_code_url || this.cache.settings.upiQrCodeUrl,
          announcement: candidate.announcement ?? this.cache.settings.announcement,
          announcementActive:
            candidate.announcementActive !== undefined
              ? Boolean(candidate.announcementActive)
              : candidate.announcement_active !== undefined
                ? Boolean(candidate.announcement_active)
                : this.cache.settings.announcementActive,
          supportEmail: candidate.supportEmail || candidate.support_email || this.cache.settings.supportEmail,
          supportPhone: candidate.supportPhone || candidate.support_phone || this.cache.settings.supportPhone,
          enableAiAssistant:
            candidate.enableAiAssistant !== undefined
              ? Boolean(candidate.enableAiAssistant)
              : candidate.enable_ai_assistant !== undefined
                ? Boolean(candidate.enable_ai_assistant)
                : this.cache.settings.enableAiAssistant
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  constructor() {
    this.init().catch(err => {
      console.error('Error during database initialization:', {
        code: err?.code,
        message: err?.message || err
      });
    });
  }

  public getInitErrors() {
    return [...this.initErrors];
  }

  /**
   * Initializes database with Supabase tables.
   * If tables are genuinely empty (no query error), seeds initial data directly into Supabase.
   */
  public init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  private async _init(): Promise<void> {
    if (this.isInitialized) return;
    this.initErrors = [];

    if (!isSupabaseConfigured() || !supabase) {
      this.isInitialized = true;
      console.log('⚡ Running on in-memory store (zero local JSON file writes). Supabase URL & Key can be configured in .env.');
      return;
    }

    try {
      console.log('🔄 Syncing with Supabase database...');

      // 1. Check & Seed Settings
      const { data: settingsData, error: settingsErr } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (settingsErr) {
        this.initErrors.push({ table: 'site_settings', operation: 'select', code: settingsErr.code, message: settingsErr.message });
        console.error('Supabase init site_settings select error:', {
          code: settingsErr.code,
          message: settingsErr.message,
          hint: settingsErr.hint
        });
      } else if (!settingsData) {
        console.log('🌱 Seeding initial settings to Supabase...');
        const { error: upsertErr } = await supabase
          .from('site_settings')
          .upsert(settingsToRow(this.cache.settings));
        if (upsertErr) {
          this.initErrors.push({ table: 'site_settings', operation: 'seed', code: upsertErr.code, message: upsertErr.message });
          console.error('Supabase init site_settings upsert error:', {
            code: upsertErr.code,
            message: upsertErr.message
          });
        }
      } else {
        this.cache.settings = rowToSettings(settingsData);
      }

      // 2. Check & Seed Membership Plans (only if table is genuinely empty — never overwrite existing plans)
      const { data: plansData, error: plansErr } = await supabase.from('membership_plans').select('*');
      if (plansErr) {
        this.initErrors.push({ table: 'membership_plans', operation: 'select', code: plansErr.code, message: plansErr.message });
        console.error('Supabase init membership_plans select error:', {
          code: plansErr.code,
          message: plansErr.message
        });
      } else if (!plansData || plansData.length === 0) {
        console.log('🌱 Seeding initial membership plans to Supabase...');
        const seedPlanRows = this.cache.membershipPlans.map(planToRow);
        const { error: upsertErr } = await supabase
          .from('membership_plans')
          .upsert(seedPlanRows);
        if (upsertErr) {
          if (detectMissingOptionalPlanColumn(upsertErr)) {
            const { error: fallbackErr } = await supabase
              .from('membership_plans')
              .upsert(seedPlanRows.map(stripOptionalPlanColumns));
            if (fallbackErr) {
              this.initErrors.push({ table: 'membership_plans', operation: 'seed', code: fallbackErr.code, message: fallbackErr.message });
            }
          } else {
            this.initErrors.push({ table: 'membership_plans', operation: 'seed', code: upsertErr.code, message: upsertErr.message });
            console.error('Supabase init membership_plans upsert error:', {
              code: upsertErr.code,
              message: upsertErr.message
            });
          }
        }
      } else {
        this.cache.membershipPlans = sortPlansConsistent(plansData.map(rowToPlan));
      }

      // 3. Check & Seed Users (only if query succeeded and table is empty — never overwrite existing users)
      const { data: usersData, error: usersErr } = await supabase.from('users').select('*');
      if (usersErr) {
        this.initErrors.push({ table: 'users', operation: 'select', code: usersErr.code, message: usersErr.message });
        console.error('Supabase init users select error:', {
          code: usersErr.code,
          message: usersErr.message,
          details: usersErr.details,
          hint: usersErr.hint
        });
      } else if (!usersData || usersData.length === 0) {
        console.log('🌱 Seeding initial users to Supabase...');
        const seedRows = this.cache.users.map(userToRow);
        const { error: upsertErr } = await supabase.from('users').upsert(seedRows);
        if (upsertErr) {
          const missingCol = detectMissingOptionalUserColumn(upsertErr);
          if (missingCol) {
            this.initErrors.push({ table: 'users', operation: 'seed', code: upsertErr.code, message: `Missing column "${missingCol}" on public.users` });
            console.error(
              `⚠️ Supabase schema mismatch during user seed: column "${missingCol}" missing on public.users. Run supabase_missing_tables_fix.sql in Supabase SQL Editor. Retrying seed without optional tracking columns.`
            );
            const fallbackRows = seedRows.map(({ last_login_at, last_logout_at, telegram, ...rest }) => rest);
            const { error: retryErr } = await supabase.from('users').upsert(fallbackRows);
            if (retryErr) {
              this.initErrors.push({ table: 'users', operation: 'seed', code: retryErr.code, message: retryErr.message });
              console.error('Supabase init users fallback upsert error:', {
                code: retryErr.code,
                message: retryErr.message
              });
            }
          } else {
            this.initErrors.push({ table: 'users', operation: 'seed', code: upsertErr.code, message: upsertErr.message });
            console.error('Supabase init users upsert error:', {
              code: upsertErr.code,
              message: upsertErr.message
            });
          }
        }
      } else {
        this.cache.users = usersData.map(rowToUser);
      }

      // 4. Check & Seed Novels
      const { data: novelsData, error: novelsErr } = await supabase.from('novels').select('*');
      if (novelsErr) {
        this.initErrors.push({ table: 'novels', operation: 'select', code: novelsErr.code, message: novelsErr.message });
        console.error('Supabase init novels select error:', {
          code: novelsErr.code,
          message: novelsErr.message
        });
      } else if (!novelsData || novelsData.length === 0) {
        console.log('🌱 Seeding initial novels to Supabase...');
        const { error: upsertErr } = await supabase
          .from('novels')
          .upsert(this.cache.novels.map(novelToRow));
        if (upsertErr) {
          this.initErrors.push({ table: 'novels', operation: 'seed', code: upsertErr.code, message: upsertErr.message });
          console.error('Supabase init novels upsert error:', {
            code: upsertErr.code,
            message: upsertErr.message
          });
        }
      } else {
        this.cache.novels = novelsData.map(rowToNovel);
        const n2 = this.cache.novels.find(n => n.id === 'novel_2');
        if (n2 && (n2.coverImage.includes('photo-1509198397868') || !n2.coverImage)) {
          n2.coverImage = '/src/assets/images/novel_cover_himalayan_martial_1794460892442.jpg';
          await supabase.from('novels').update({ cover_image: n2.coverImage }).eq('id', 'novel_2');
        }
      }

      // 5. Check & Seed Chapters
      const { data: chaptersData, error: chaptersErr } = await supabase.from('chapters').select('*');
      if (chaptersErr) {
        this.initErrors.push({ table: 'chapters', operation: 'select', code: chaptersErr.code, message: chaptersErr.message });
        console.error('Supabase init chapters select error:', {
          code: chaptersErr.code,
          message: chaptersErr.message
        });
      } else if (!chaptersData || chaptersData.length === 0) {
        console.log('🌱 Seeding initial chapters to Supabase...');
        const { error: upsertErr } = await supabase
          .from('chapters')
          .upsert(this.cache.chapters.map(chapterToRow));
        if (upsertErr) {
          this.initErrors.push({ table: 'chapters', operation: 'seed', code: upsertErr.code, message: upsertErr.message });
          console.error('Supabase init chapters upsert error:', {
            code: upsertErr.code,
            message: upsertErr.message
          });
        }
      } else {
        this.cache.chapters = chaptersData.map(rowToChapter);
      }

      // 6. Load Payments
      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (paymentsErr) {
        this.initErrors.push({ table: 'payments', operation: 'select', code: paymentsErr.code, message: paymentsErr.message });
        console.error('Supabase init payments select error:', {
          code: paymentsErr.code,
          message: paymentsErr.message
        });
      } else if (paymentsData) {
        this.cache.payments = paymentsData.map(rowToPayment);
      }

      // 7. Load Support Tickets
      const { data: ticketsData, error: ticketsErr } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (ticketsErr) {
        this.initErrors.push({ table: 'support_tickets', operation: 'select', code: ticketsErr.code, message: ticketsErr.message });
        console.error('Supabase init support_tickets select error:', {
          code: ticketsErr.code,
          message: ticketsErr.message
        });
      } else if (ticketsData) {
        this.cache.supportTickets = ticketsData.map(rowToTicket);
      }

      // 8. Verify presence of security, auth audit, and Telegram tables (HEAD count checks)
      const auxiliaryTables = [
        'revoked_tokens',
        'user_auth_logs',
        'telegram_users',
        'telegram_link_codes',
        'telegram_access',
        'telegram_access_logs',
        'telegram_pending_operations',
        'telegram_processed_updates'
      ];

      await Promise.all(
        auxiliaryTables.map(async (table) => {
          const { error: checkErr } = await supabase!.from(table).select('*', { head: true, count: 'exact' });
          if (checkErr) {
            this.initErrors.push({
              table,
              operation: 'check',
              code: checkErr.code,
              message: checkErr.message
            });
          }
        })
      );

      this.isInitialized = true;
      if (this.initErrors.length > 0) {
        const missingList = this.initErrors.map(e => `${e.table} (${e.code || 'ERR'})`).join(', ');
        console.error(
          `⚠️ Supabase schema/table errors detected during startup [${this.initErrors.length}]: ${missingList}. Run supabase_security_rls_consolidated.sql in Supabase SQL Editor.`
        );
      } else {
        console.log(`✅ Supabase database synchronized (all 15 tables verified): ${this.cache.novels.length} novels, ${this.cache.chapters.length} chapters, ${this.cache.users.length} users, ${this.cache.payments.length} payments.`);
      }
    } catch (err: any) {
      this.isInitialized = true;
      this.initErrors.push({
        table: 'database',
        operation: 'sync',
        code: err?.code,
        message: err?.message || 'Unexpected Supabase sync error'
      });
      console.error('Error during Supabase sync:', {
        code: err?.code,
        message: err?.message || err
      });
    }
  }

  // -------------------------------------------------------------
  // USERS
  // -------------------------------------------------------------
  public async getUsers(): Promise<User[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getUsers error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw createDatabaseError('getUsers', error);
      }
      if (data) {
        this.cache.users = data.map(rowToUser);
      }
    }
    return this.cache.users;
  }

  public getUsersSync(): User[] {
    return this.cache.users;
  }

  public async getUserById(id: string): Promise<User | undefined> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getUserById error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: id
        });
        throw createDatabaseError('getUserById', error);
      }
      if (data) {
        const u = rowToUser(data);
        const idx = this.cache.users.findIndex(x => x.id === id);
        if (idx !== -1) this.cache.users[idx] = u;
        else this.cache.users.push(u);
        return u;
      }
      this.cache.users = this.cache.users.filter(x => x.id !== id);
      return undefined;
    }
    return this.cache.users.find(u => u.id === id);
  }

  public getUserByIdSync(id: string): User | undefined {
    return this.cache.users.find(u => u.id === id);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return undefined;

    if (isSupabaseConfigured() && supabase) {
      const escapedEmail = escapeLikePattern(cleanEmail);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', escapedEmail)
        .limit(1);

      if (error) {
        console.error('Supabase getUserByEmail error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          email: cleanEmail
        });
        throw createDatabaseError('getUserByEmail', error);
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        const u = rowToUser(row);
        const idx = this.cache.users.findIndex(x => x.id === u.id);
        if (idx !== -1) this.cache.users[idx] = u;
        else this.cache.users.push(u);
        return u;
      }
      return undefined;
    }
    return this.cache.users.find(u => u.email.toLowerCase() === cleanEmail);
  }

  public async addUser(user: User): Promise<User> {
    if (isSupabaseConfigured() && supabase) {
      const row = userToRow(user);
      const { data, error } = await supabase.from('users').insert(row).select().single();
      if (error) {
        const missingCol = detectMissingOptionalUserColumn(error);
        if (missingCol) {
          console.error(
            `⚠️ Supabase addUser schema mismatch: missing column "${missingCol}" in public.users. Run updated supabase_schema.sql in Supabase SQL Editor. Retrying insert without optional tracking columns.`
          );
          const { last_login_at, last_logout_at, telegram, ...safeRow } = row;
          const { data: retryData, error: retryError } = await supabase
            .from('users')
            .insert(safeRow)
            .select()
            .single();
          if (retryError) {
            console.error('Supabase addUser retry error:', {
              code: retryError.code,
              message: retryError.message,
              details: retryError.details,
              hint: retryError.hint,
              email: user.email
            });
            throw createDatabaseError('addUser', retryError);
          }
          if (retryData) {
            const saved = rowToUser(retryData);
            this.cache.users.push(saved);
            return saved;
          }
        }

        console.error('Supabase addUser error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          email: user.email
        });
        throw createDatabaseError('addUser', error);
      }
      if (data) {
        const saved = rowToUser(data);
        this.cache.users.push(saved);
        return saved;
      }
    }

    this.cache.users.push(user);
    return user;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const idx = this.cache.users.findIndex(u => u.id === id);

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates = userPartialToRow(updates);
      if (Object.keys(rowUpdates).length === 0) {
        return idx !== -1 ? this.cache.users[idx] : await this.getUserById(id);
      }

      const { data, error } = await supabase
        .from('users')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        const missingCol = detectMissingOptionalUserColumn(error);
        if (missingCol) {
          console.error(
            `⚠️ Supabase updateUser schema mismatch: missing column "${missingCol}" in public.users. Run supabase_security_rls_consolidated.sql in Supabase SQL Editor.`
          );
          const { last_login_at, last_logout_at, telegram, ...safeUpdates } = rowUpdates;
          if (Object.keys(safeUpdates).length === 0) {
            // Only optional tracking timestamps/telegram were being updated; keep cache in sync without failing login/logout
            if (idx !== -1) {
              this.cache.users[idx] = { ...this.cache.users[idx], ...updates };
              return this.cache.users[idx];
            }
            return await this.getUserById(id);
          }

          const { data: retryData, error: retryError } = await supabase
            .from('users')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .maybeSingle();
          if (retryError) {
            console.error('Supabase updateUser retry error:', {
              code: retryError.code,
              message: retryError.message,
              details: retryError.details,
              hint: retryError.hint,
              userId: id
            });
            throw createDatabaseError('updateUser', retryError);
          }
          if (retryData) {
            const updated = rowToUser(retryData);
            if (idx !== -1) this.cache.users[idx] = updated;
            else this.cache.users.push(updated);
            return updated;
          }
        }

        console.error('Supabase updateUser error:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: id
        });
        throw createDatabaseError('updateUser', error);
      }

      if (data) {
        const updated = rowToUser(data);
        if (idx !== -1) this.cache.users[idx] = updated;
        else this.cache.users.push(updated);
        return updated;
      }
      return undefined;
    }

    if (idx !== -1) {
      this.cache.users[idx] = { ...this.cache.users[idx], ...updates };
      return this.cache.users[idx];
    }
    return undefined;
  }

  public async deleteUser(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteUser error:', {
          code: error.code,
          message: error.message,
          userId: id
        });
        throw createDatabaseError('deleteUser', error);
      }
    }
    this.cache.users = this.cache.users.filter(u => u.id !== id);
    return true;
  }

  // -------------------------------------------------------------
  // NOVELS
  // -------------------------------------------------------------
  public async getNovels(): Promise<Novel[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('novels').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getNovels error:', { code: error.code, message: error.message });
        throw createDatabaseError('getNovels', error);
      }
      if (data) {
        this.cache.novels = data.map(rowToNovel);
      }
    }
    return this.cache.novels;
  }

  public getNovelsSync(): Novel[] {
    return this.cache.novels;
  }

  public async getNovelById(id: string): Promise<Novel | undefined> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('novels').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getNovelById error:', { code: error.code, message: error.message, novelId: id });
        throw createDatabaseError('getNovelById', error);
      }
      if (data) {
        const n = rowToNovel(data);
        const idx = this.cache.novels.findIndex(x => x.id === id);
        if (idx !== -1) this.cache.novels[idx] = n;
        else this.cache.novels.push(n);
        return n;
      }
      this.cache.novels = this.cache.novels.filter(x => x.id !== id);
      return undefined;
    }
    return this.cache.novels.find(n => n.id === id);
  }

  public getNovelByIdSync(id: string): Novel | undefined {
    return this.cache.novels.find(n => n.id === id);
  }

  public async addNovel(novel: Novel): Promise<Novel> {
    if (isSupabaseConfigured() && supabase) {
      const row = novelToRow(novel);
      const { data, error } = await supabase.from('novels').insert(row).select().single();
      if (error) {
        console.error('Supabase addNovel error:', { code: error.code, message: error.message });
        throw createDatabaseError('addNovel', error);
      }
      if (data) {
        const saved = rowToNovel(data);
        this.cache.novels.unshift(saved);
        return saved;
      }
    }
    this.cache.novels.unshift(novel);
    return novel;
  }

  public async updateNovel(id: string, updates: Partial<Novel>): Promise<Novel | undefined> {
    const idx = this.cache.novels.findIndex(n => n.id === id);

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates = novelPartialToRow(updates);
      const { data, error } = await supabase
        .from('novels')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) {
        console.error('Supabase updateNovel error:', { code: error.code, message: error.message, novelId: id });
        throw createDatabaseError('updateNovel', error);
      }
      if (data) {
        const updated = rowToNovel(data);
        if (idx !== -1) this.cache.novels[idx] = updated;
        else this.cache.novels.unshift(updated);
        return updated;
      }
      return undefined;
    }

    if (idx !== -1) {
      this.cache.novels[idx] = {
        ...this.cache.novels[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return this.cache.novels[idx];
    }
    return undefined;
  }

  public async deleteNovel(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const existing = await this.getNovelById(id);
      if (!existing) return false;

      const { error: chErr } = await supabase.from('chapters').delete().eq('novel_id', id);
      if (chErr) {
        console.error('Supabase delete chapters for novel error:', { code: chErr.code, message: chErr.message, novelId: id });
        throw createDatabaseError('deleteChapters', chErr);
      }
      const { error } = await supabase.from('novels').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteNovel error:', { code: error.code, message: error.message, novelId: id });
        throw createDatabaseError('deleteNovel', error);
      }
      this.cache.novels = this.cache.novels.filter(n => n.id !== id);
      this.cache.chapters = this.cache.chapters.filter(c => c.novelId !== id);
      return true;
    }

    const existed = this.cache.novels.some(n => n.id === id);
    if (!existed) return false;
    this.cache.novels = this.cache.novels.filter(n => n.id !== id);
    this.cache.chapters = this.cache.chapters.filter(c => c.novelId !== id);
    return true;
  }

  // -------------------------------------------------------------
  // CHAPTERS
  // -------------------------------------------------------------
  public async getChapters(novelId?: string): Promise<Chapter[]> {
    if (isSupabaseConfigured() && supabase) {
      let query = supabase.from('chapters').select('*').order('chapter_number', { ascending: true });
      if (novelId) query = query.eq('novel_id', novelId);
      const { data, error } = await query;
      if (error) {
        console.error('Supabase getChapters error:', { code: error.code, message: error.message, novelId });
        throw createDatabaseError('getChapters', error);
      }
      if (data) {
        const fetched = data.map(rowToChapter);
        if (novelId) {
          this.cache.chapters = [
            ...this.cache.chapters.filter(c => c.novelId !== novelId),
            ...fetched
          ];
        } else {
          this.cache.chapters = fetched;
        }
        return fetched;
      }
    }

    if (novelId) {
      return this.cache.chapters
        .filter(c => c.novelId === novelId)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
    return this.cache.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  public getChaptersSync(novelId?: string): Chapter[] {
    if (novelId) {
      return this.cache.chapters
        .filter(c => c.novelId === novelId)
        .sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
    return this.cache.chapters.sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  public async getChapterById(id: string): Promise<Chapter | undefined> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('chapters').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getChapterById error:', { code: error.code, message: error.message, chapterId: id });
        throw createDatabaseError('getChapterById', error);
      }
      if (data) {
        const ch = rowToChapter(data);
        const idx = this.cache.chapters.findIndex(c => c.id === id);
        if (idx !== -1) this.cache.chapters[idx] = ch;
        else this.cache.chapters.push(ch);
        return ch;
      }
      this.cache.chapters = this.cache.chapters.filter(c => c.id !== id);
      return undefined;
    }
    return this.cache.chapters.find(c => c.id === id);
  }

  public getChapterByIdSync(id: string): Chapter | undefined {
    return this.cache.chapters.find(c => c.id === id);
  }

  public async addChapter(chapter: Chapter): Promise<Chapter> {
    if (isSupabaseConfigured() && supabase) {
      const row = chapterToRow(chapter);
      const { data, error } = await supabase.from('chapters').insert(row).select().single();
      if (error) {
        console.error('Supabase addChapter error:', { code: error.code, message: error.message });
        throw createDatabaseError('addChapter', error);
      }
      const saved = data ? rowToChapter(data) : chapter;
      this.cache.chapters.push(saved);
      const novelChapters = await this.getChapters(chapter.novelId);
      await this.updateNovel(chapter.novelId, { totalChapters: novelChapters.length });
      return saved;
    }

    this.cache.chapters.push(chapter);
    const count = this.cache.chapters.filter(c => c.novelId === chapter.novelId).length;
    await this.updateNovel(chapter.novelId, { totalChapters: count });
    return chapter;
  }

  public async updateChapter(id: string, updates: Partial<Chapter>): Promise<Chapter | undefined> {
    const idx = this.cache.chapters.findIndex(c => c.id === id);

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates = chapterPartialToRow(updates);
      const { data, error } = await supabase
        .from('chapters')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) {
        console.error('Supabase updateChapter error:', { code: error.code, message: error.message, chapterId: id });
        throw createDatabaseError('updateChapter', error);
      }
      if (data) {
        const updated = rowToChapter(data);
        if (idx !== -1) this.cache.chapters[idx] = updated;
        else this.cache.chapters.push(updated);
        return updated;
      }
      return undefined;
    }

    if (idx !== -1) {
      this.cache.chapters[idx] = {
        ...this.cache.chapters[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      return this.cache.chapters[idx];
    }
    return undefined;
  }

  public async deleteChapter(id: string): Promise<boolean> {
    const chapter = await this.getChapterById(id);
    if (!chapter) return false;
    const novelId = chapter.novelId;

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('chapters').delete().eq('id', id);
      if (error) {
        console.error('Supabase deleteChapter error:', { code: error.code, message: error.message, chapterId: id });
        throw createDatabaseError('deleteChapter', error);
      }
      this.cache.chapters = this.cache.chapters.filter(c => c.id !== id);
      const remaining = await this.getChapters(novelId);
      await this.updateNovel(novelId, { totalChapters: remaining.length });
      return true;
    }

    this.cache.chapters = this.cache.chapters.filter(c => c.id !== id);
    const count = this.cache.chapters.filter(c => c.novelId === novelId).length;
    await this.updateNovel(novelId, { totalChapters: count });
    return true;
  }

  // -------------------------------------------------------------
  // PAYMENTS
  // -------------------------------------------------------------
  public async getPayments(): Promise<PaymentRequest[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getPayments error:', { code: error.code, message: error.message });
        throw createDatabaseError('getPayments', error);
      }
      if (data) {
        this.cache.payments = data.map(rowToPayment);
      }
    }
    return this.cache.payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getPaymentsSync(): PaymentRequest[] {
    return this.cache.payments.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async getPaymentById(id: string): Promise<PaymentRequest | undefined> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.error('Supabase getPaymentById error:', { code: error.code, message: error.message, paymentId: id });
        throw createDatabaseError('getPaymentById', error);
      }
      if (data) {
        const p = rowToPayment(data);
        const idx = this.cache.payments.findIndex(x => x.id === id);
        if (idx !== -1) this.cache.payments[idx] = p;
        else this.cache.payments.unshift(p);
        return p;
      }
      this.cache.payments = this.cache.payments.filter(x => x.id !== id);
      return undefined;
    }
    return this.cache.payments.find(p => p.id === id);
  }

  public async addPayment(payment: PaymentRequest): Promise<PaymentRequest> {
    if (isSupabaseConfigured() && supabase) {
      const retryRow: Record<string, any> = { ...paymentToRow(payment) };

      for (let attempt = 0; attempt <= OPTIONAL_PAYMENT_COLUMNS.length; attempt++) {
        const { data, error } = await supabase.from('payments').insert(retryRow).select().single();
        if (!error && data) {
          const saved = rowToPayment(data);
          if (payment.screenshotPath && !saved.screenshotPath) {
            throw createDatabaseError('addPayment', {
              code: 'DB_SCREENSHOT_PATH_NOT_SAVED',
              message: 'Payment screenshot path was not persisted in public.payments'
            });
          }
          this.cache.payments.unshift(saved);
          return saved;
        }

        const missingCol = error ? detectMissingOptionalPaymentColumn(error) : null;
        if (missingCol && Object.prototype.hasOwnProperty.call(retryRow, missingCol)) {
          console.warn(
            `⚠️ Supabase addPayment schema mismatch: missing column "${missingCol}" on public.payments. Run supabase_missing_tables_fix.sql in Supabase SQL Editor. Retrying insert without "${missingCol}".`
          );
          delete retryRow[missingCol];
          continue;
        }

        if (error) {
          console.error('Supabase addPayment error:', { code: error.code, message: error.message });
          throw createDatabaseError('addPayment', error);
        }
      }
    }
    this.cache.payments.unshift(payment);
    return payment;
  }

  public async updatePayment(id: string, updates: Partial<PaymentRequest>): Promise<PaymentRequest | undefined> {
    const idx = this.cache.payments.findIndex(p => p.id === id);

    if (isSupabaseConfigured() && supabase) {
      const retryUpdates: Record<string, any> = { ...paymentPartialToRow(updates) };

      for (let attempt = 0; attempt <= OPTIONAL_PAYMENT_COLUMNS.length; attempt++) {
        if (Object.keys(retryUpdates).length === 0) {
          if (idx !== -1) {
            this.cache.payments[idx] = { ...this.cache.payments[idx], ...updates };
            return this.cache.payments[idx];
          }
          return await this.getPaymentById(id);
        }

        const { data, error } = await supabase
          .from('payments')
          .update(retryUpdates)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error) {
          if (data) {
            const updated = rowToPayment(data);
            const mergedUpdated: PaymentRequest = {
              ...updated,
              ...(updates.rejectionReason && !updated.rejectionReason ? { rejectionReason: updates.rejectionReason } : {}),
              ...(updates.adminNote && !updated.adminNote ? { adminNote: updates.adminNote } : {}),
              ...(updates.screenshotPath && !updated.screenshotPath ? { screenshotPath: updates.screenshotPath } : {})
            };
            if (idx !== -1) this.cache.payments[idx] = mergedUpdated;
            else this.cache.payments.unshift(mergedUpdated);
            return mergedUpdated;
          }
          return undefined;
        }

        const missingCol = detectMissingOptionalPaymentColumn(error);
        if (missingCol && Object.prototype.hasOwnProperty.call(retryUpdates, missingCol)) {
          console.warn(
            `⚠️ Supabase updatePayment schema mismatch: missing column "${missingCol}" on public.payments. Run supabase_missing_tables_fix.sql in Supabase SQL Editor. Retrying update without "${missingCol}".`
          );
          delete retryUpdates[missingCol];
          continue;
        }

        console.error('Supabase updatePayment error:', { code: error.code, message: error.message, paymentId: id });
        throw createDatabaseError('updatePayment', error);
      }
    }

    if (idx !== -1) {
      this.cache.payments[idx] = { ...this.cache.payments[idx], ...updates };
      return this.cache.payments[idx];
    }
    return undefined;
  }

  // -------------------------------------------------------------
  // MEMBERSHIP PLANS
  // -------------------------------------------------------------
  public async getPlans(): Promise<MembershipPlan[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('membership_plans').select('*');
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'getPlans');
          return sortPlansConsistent(this.cache.membershipPlans);
        }
        console.error('Supabase getPlans error:', { code: error.code, message: error.message });
        throw createDatabaseError('getPlans', error);
      }
      if (data) {
        this.cache.membershipPlans = sortPlansConsistent(data.map(rowToPlan));
      }
    }
    return sortPlansConsistent(this.cache.membershipPlans);
  }

  public getPlansSync(): MembershipPlan[] {
    return sortPlansConsistent(this.cache.membershipPlans);
  }

  public async getPlanById(id: string): Promise<MembershipPlan | undefined> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'getPlanById');
          return this.cache.membershipPlans.find(p => p.id === id);
        }
        console.error('Supabase getPlanById error:', { code: error.code, message: error.message, planId: id });
        throw createDatabaseError('getPlanById', error);
      }
      if (data) {
        const plan = rowToPlan(data);
        const idx = this.cache.membershipPlans.findIndex(p => p.id === id);
        if (idx !== -1) this.cache.membershipPlans[idx] = plan;
        else this.cache.membershipPlans.push(plan);
        return plan;
      }
      this.cache.membershipPlans = this.cache.membershipPlans.filter(p => p.id !== id);
      return undefined;
    }
    return this.cache.membershipPlans.find(p => p.id === id);
  }

  public async addPlan(plan: MembershipPlan): Promise<MembershipPlan> {
    if (isSupabaseConfigured() && supabase) {
      const fullRow = planToRow(plan);
      const { data, error } = await supabase
        .from('membership_plans')
        .insert(fullRow)
        .select()
        .single();

      if (error) {
        const missingCol = detectMissingOptionalPlanColumn(error);
        if (missingCol) {
          if (planNeedsDiscountColumns(plan)) {
            throw createDatabaseError('addPlan', {
              code: 'DISCOUNT_COLUMNS_MISSING',
              message: `Supabase membership_plans टेबल में "${missingCol}" कॉलम मौजूद नहीं है। Discount सहेजने के लिए कृपया SQL Migration चलाएं।`
            });
          }
          const { data: retryData, error: retryErr } = await supabase
            .from('membership_plans')
            .insert(stripOptionalPlanColumns(fullRow))
            .select()
            .single();
          if (retryErr) {
            throw createDatabaseError('addPlan', retryErr);
          }
          const saved = retryData ? rowToPlan(retryData) : plan;
          this.cache.membershipPlans = sortPlansConsistent([...this.cache.membershipPlans, saved]);
          return saved;
        }
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'addPlan');
          this.cache.membershipPlans = sortPlansConsistent([...this.cache.membershipPlans, plan]);
          return plan;
        }
        console.error('Supabase addPlan error:', { code: error.code, message: error.message });
        throw createDatabaseError('addPlan', error);
      }

      const saved = data ? rowToPlan(data) : plan;
      this.cache.membershipPlans = sortPlansConsistent([...this.cache.membershipPlans, saved]);
      return saved;
    }

    this.cache.membershipPlans = sortPlansConsistent([...this.cache.membershipPlans, plan]);
    return plan;
  }

  public async updatePlan(id: string, plan: MembershipPlan): Promise<MembershipPlan | undefined> {
    const idx = this.cache.membershipPlans.findIndex(p => p.id === id);

    if (isSupabaseConfigured() && supabase) {
      const fullRow = planToRow({ ...plan, id });
      const { id: _ignoreId, ...updateFields } = fullRow;
      const { data, error } = await supabase
        .from('membership_plans')
        .update(updateFields)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        const missingCol = detectMissingOptionalPlanColumn(error);
        if (missingCol) {
          if (planNeedsDiscountColumns(plan)) {
            throw createDatabaseError('updatePlan', {
              code: 'DISCOUNT_COLUMNS_MISSING',
              message: `Supabase membership_plans टेबल में "${missingCol}" कॉलम मौजूद नहीं है। Discount सहेजने के लिए कृपया SQL Migration चलाएं।`
            });
          }
          const { data: retryData, error: retryErr } = await supabase
            .from('membership_plans')
            .update(stripOptionalPlanColumns(updateFields))
            .eq('id', id)
            .select()
            .maybeSingle();
          if (retryErr) {
            throw createDatabaseError('updatePlan', retryErr);
          }
          if (retryData) {
            const updated = rowToPlan(retryData);
            if (idx !== -1) this.cache.membershipPlans[idx] = updated;
            else this.cache.membershipPlans.push(updated);
            this.cache.membershipPlans = sortPlansConsistent(this.cache.membershipPlans);
            return updated;
          }
          return undefined;
        }
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'updatePlan');
          if (idx !== -1) {
            this.cache.membershipPlans[idx] = { ...plan, id };
            return this.cache.membershipPlans[idx];
          }
          return undefined;
        }
        console.error('Supabase updatePlan error:', { code: error.code, message: error.message, planId: id });
        throw createDatabaseError('updatePlan', error);
      }

      if (data) {
        const updated = rowToPlan(data);
        if (idx !== -1) this.cache.membershipPlans[idx] = updated;
        else this.cache.membershipPlans.push(updated);
        this.cache.membershipPlans = sortPlansConsistent(this.cache.membershipPlans);
        return updated;
      }
      return undefined;
    }

    if (idx !== -1) {
      this.cache.membershipPlans[idx] = { ...plan, id };
      this.cache.membershipPlans = sortPlansConsistent(this.cache.membershipPlans);
      return this.cache.membershipPlans[idx];
    }
    return undefined;
  }

  public async deletePlan(id: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase) {
      const existing = await this.getPlanById(id);
      if (!existing) return false;

      const { error } = await supabase.from('membership_plans').delete().eq('id', id);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'deletePlan');
          this.cache.membershipPlans = this.cache.membershipPlans.filter(p => p.id !== id);
          return true;
        }
        console.error('Supabase deletePlan error:', { code: error.code, message: error.message, planId: id });
        throw createDatabaseError('deletePlan', error);
      }
      this.cache.membershipPlans = this.cache.membershipPlans.filter(p => p.id !== id);
      return true;
    }

    const existed = this.cache.membershipPlans.some(p => p.id === id);
    if (!existed) return false;
    this.cache.membershipPlans = this.cache.membershipPlans.filter(p => p.id !== id);
    return true;
  }

  public async updatePlans(plans: MembershipPlan[]): Promise<MembershipPlan[]> {
    if (isSupabaseConfigured() && supabase) {
      const rows = plans.map(planToRow);
      const { data, error } = await supabase.from('membership_plans').upsert(rows).select();
      if (error) {
        const missingCol = detectMissingOptionalPlanColumn(error);
        if (missingCol) {
          if (plans.some(planNeedsDiscountColumns)) {
            throw createDatabaseError('updatePlans', {
              code: 'DISCOUNT_COLUMNS_MISSING',
              message: `Supabase membership_plans टेबल में "${missingCol}" कॉलम मौजूद नहीं है। Discount सहेजने के लिए कृपया SQL Migration चलाएं।`
            });
          }
          const { data: retryData, error: retryErr } = await supabase
            .from('membership_plans')
            .upsert(rows.map(stripOptionalPlanColumns))
            .select();
          if (retryErr) {
            throw createDatabaseError('updatePlans', retryErr);
          }
          if (retryData) {
            this.cache.membershipPlans = sortPlansConsistent(retryData.map(rowToPlan));
            return this.cache.membershipPlans;
          }
        }
        if (isTableMissingError(error)) {
          this.warnMissingTable('membership_plans', 'updatePlans');
          this.cache.membershipPlans = sortPlansConsistent(plans);
          return this.cache.membershipPlans;
        }
        console.error('Supabase updatePlans error:', { code: error.code, message: error.message });
        throw createDatabaseError('updatePlans', error);
      }
      if (data && data.length > 0) {
        this.cache.membershipPlans = sortPlansConsistent(data.map(rowToPlan));
        return this.cache.membershipPlans;
      }
    }
    this.cache.membershipPlans = sortPlansConsistent(plans);
    return this.cache.membershipPlans;
  }

  // -------------------------------------------------------------
  // SETTINGS
  // -------------------------------------------------------------
  public async getSettings(): Promise<SiteSettings> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', 'current').maybeSingle();
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('site_settings', 'getSettings');
          const legacySettings = await this.tryReadLegacyAppSettings();
          if (legacySettings) {
            this.cache.settings = legacySettings;
          }
          return this.cache.settings;
        }
        console.error('Supabase getSettings error:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw createDatabaseError('getSettings', error);
      }
      if (data) {
        this.cache.settings = rowToSettings(data);
      }
    }
    return this.cache.settings;
  }

  public getSettingsSync(): SiteSettings {
    return this.cache.settings;
  }

  public async updateSettings(updates: Partial<SiteSettings>): Promise<SiteSettings> {
    if (isSupabaseConfigured() && supabase) {
      const { data: existingRow, error: readError } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'current')
        .maybeSingle();

      if (readError) {
        if (isTableMissingError(readError)) {
          this.warnMissingTable('site_settings', 'updateSettings');
          this.cache.settings = { ...this.cache.settings, ...updates };
          return this.cache.settings;
        }
        console.error('Supabase updateSettings pre-read error:', {
          code: readError.code,
          message: readError.message,
          details: readError.details
        });
        throw createDatabaseError('updateSettings', readError);
      }

      const baseSettings = existingRow ? rowToSettings(existingRow) : this.cache.settings;
      const mergedSettings: SiteSettings = { ...baseSettings, ...updates };
      const upsertRow = settingsToRow(mergedSettings);

      const { data, error } = await supabase
        .from('site_settings')
        .upsert(upsertRow, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('site_settings', 'updateSettings');
          this.cache.settings = mergedSettings;
          return this.cache.settings;
        }
        console.error('Supabase updateSettings error:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw createDatabaseError('updateSettings', error);
      }
      if (data) {
        this.cache.settings = rowToSettings(data);
        return this.cache.settings;
      }
    }
    this.cache.settings = { ...this.cache.settings, ...updates };
    return this.cache.settings;
  }

  // -------------------------------------------------------------
  // SUPPORT TICKETS
  // -------------------------------------------------------------
  public async getSupportTickets(): Promise<SupportTicket[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Supabase getSupportTickets error:', { code: error.code, message: error.message });
        throw createDatabaseError('getSupportTickets', error);
      }
      if (data) {
        this.cache.supportTickets = data.map(rowToTicket);
      }
    }
    return this.cache.supportTickets.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async addSupportTicket(ticket: SupportTicket): Promise<SupportTicket> {
    if (isSupabaseConfigured() && supabase) {
      const row = ticketToRow(ticket);
      const { data, error } = await supabase.from('support_tickets').insert(row).select().single();
      if (error) {
        console.error('Supabase addSupportTicket error:', { code: error.code, message: error.message });
        throw createDatabaseError('addSupportTicket', error);
      }
      if (data) {
        const saved = rowToTicket(data);
        this.cache.supportTickets.unshift(saved);
        return saved;
      }
    }
    this.cache.supportTickets.unshift(ticket);
    return ticket;
  }

  public async updateSupportTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const idx = this.cache.supportTickets.findIndex(t => t.id === id);

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates: any = {};
      if (updates.adminReply !== undefined) rowUpdates.admin_reply = updates.adminReply;
      if (updates.status !== undefined) rowUpdates.status = updates.status;
      if (updates.repliedAt !== undefined) rowUpdates.replied_at = updates.repliedAt;

      const { data, error } = await supabase
        .from('support_tickets')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) {
        console.error('Supabase updateSupportTicket error:', { code: error.code, message: error.message, ticketId: id });
        throw createDatabaseError('updateSupportTicket', error);
      }
      if (data) {
        const updated = rowToTicket(data);
        if (idx !== -1) this.cache.supportTickets[idx] = updated;
        else this.cache.supportTickets.unshift(updated);
        return updated;
      }
      return undefined;
    }

    if (idx !== -1) {
      this.cache.supportTickets[idx] = { ...this.cache.supportTickets[idx], ...updates };
      return this.cache.supportTickets[idx];
    }
    return undefined;
  }

  // -------------------------------------------------------------
  // TELEGRAM INTEGRATION METHODS
  // -------------------------------------------------------------

  public async createTelegramLinkCode(codeItem: TelegramLinkCode): Promise<TelegramLinkCode> {
    if (isSupabaseConfigured() && supabase) {
      const row = telegramLinkCodeToRow(codeItem);
      const { error } = await supabase.from('telegram_link_codes').insert(row);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_link_codes', 'createTelegramLinkCode');
        } else {
          console.error('Supabase telegram_link_codes insert error:', error);
          throw new Error(`Failed to persist telegram link code: ${error.message}`);
        }
      }
    }

    this.cache.telegramLinkCodes = this.cache.telegramLinkCodes.filter(
      c => c.userId !== codeItem.userId && new Date(c.expiresAt).getTime() > Date.now()
    );
    this.cache.telegramLinkCodes.push(codeItem);
    return codeItem;
  }

  public async getTelegramLinkCode(code: string): Promise<TelegramLinkCode | null> {
    if (!code) return null;
    const cleanCode = code.trim().toLowerCase();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('telegram_link_codes')
          .select('*')
          .ilike('code', cleanCode)
          .is('used_at', null)
          .maybeSingle();

        if (error) {
          if (isTableMissingError(error)) {
            this.warnMissingTable('telegram_link_codes', 'getTelegramLinkCode');
          } else {
            console.error('Supabase getTelegramLinkCode query error:', error);
            throw new Error(`Failed to read telegram link code: ${error.message}`);
          }
        } else if (data) {
          const item = rowToTelegramLinkCode(data);
          if (new Date(item.expiresAt).getTime() > Date.now()) {
            return item;
          }
        }
      } catch (err: any) {
        if (err.message?.includes('Failed to read telegram link code')) throw err;
        console.warn('Supabase getTelegramLinkCode error:', err);
      }
    }

    const cached = this.cache.telegramLinkCodes.find(
      c => c && c.code && c.code.toLowerCase() === cleanCode && !c.usedAt
    );
    if (cached && new Date(cached.expiresAt).getTime() > Date.now()) {
      return cached;
    }
    return null;
  }

  public async markTelegramLinkCodeUsed(idOrCode: string): Promise<void> {
    const clean = idOrCode.trim();
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('telegram_link_codes')
        .update({ used_at: nowIso })
        .or(`id.eq.${clean},code.ilike.${clean}`);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_link_codes', 'markTelegramLinkCodeUsed');
        } else {
          console.error('Supabase markTelegramLinkCodeUsed error:', error);
          throw new Error(`Failed to mark telegram link code used: ${error.message}`);
        }
      }
    }

    const idx = this.cache.telegramLinkCodes.findIndex(
      c => c && (c.id === clean || (c.code && c.code.toLowerCase() === clean.toLowerCase()))
    );
    if (idx !== -1) {
      this.cache.telegramLinkCodes[idx].usedAt = nowIso;
    }
  }

  public async getUserByTelegramId(telegramUserId: number): Promise<User | null> {
    const numId = Number(telegramUserId);
    if (isSupabaseConfigured() && supabase) {
      try {
        // 1. Try dedicated telegram_users table
        const { data: tgUser } = await supabase
          .from('telegram_users')
          .select('user_id')
          .eq('telegram_user_id', numId)
          .maybeSingle();

        if (tgUser?.user_id) {
          const user = await this.getUserById(tgUser.user_id);
          if (user) return user;
        }

        // 2. Try JSON telegram field on users table
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .filter('telegram->>telegramUserId', 'eq', String(numId))
          .maybeSingle();

        if (userData) {
          return rowToUser(userData);
        }
      } catch (err) {
        console.warn('Supabase getUserByTelegramId error:', err);
      }
    }

    const found = this.cache.users.find(
      u => u.telegram?.telegramUserId === numId
    );
    return found || null;
  }

  public async linkUserTelegram(
    userId: string,
    data: { telegramUserId: number; telegramUsername?: string; telegramFirstName?: string }
  ): Promise<User | null> {
    const nowIso = new Date().toISOString();
    const tgId = Number(data.telegramUserId);
    const telegramPayload = {
      telegramUserId: tgId,
      telegramUsername: data.telegramUsername ? data.telegramUsername.replace(/^@/, '') : undefined,
      telegramFirstName: data.telegramFirstName,
      linkedAt: nowIso
    };

    // Enforce strict 1-to-1 Telegram ID <-> App User mapping
    // Detach this telegramUserId from any previously linked user record so two accounts never share one TG ID
    const conflictingUsers = this.cache.users.filter(
      u => u.id !== userId && u.telegram?.telegramUserId === tgId
    );
    for (const other of conflictingUsers) {
      await this.updateUser(other.id, { telegram: undefined }).catch(() => {});
    }

    if (isSupabaseConfigured() && supabase) {
      // Also find any Supabase users holding the same telegramUserId in case cache was stale
      try {
        const { data: conflictRows } = await supabase
          .from('telegram_users')
          .select('user_id')
          .eq('telegram_user_id', tgId);
        if (conflictRows) {
          for (const row of conflictRows) {
            if (row.user_id && row.user_id !== userId) {
              await this.updateUser(row.user_id, { telegram: undefined }).catch(() => {});
            }
          }
        }
      } catch {
        // Non-blocking cleanup check
      }

      // Remove prior rows for either this user_id or this telegram_user_id to avoid unique constraint errors
      await supabase.from('telegram_users').delete().eq('user_id', userId);
      await supabase.from('telegram_users').delete().eq('telegram_user_id', tgId);

      const { error: insertErr } = await supabase.from('telegram_users').insert({
        user_id: userId,
        telegram_user_id: telegramPayload.telegramUserId,
        telegram_username: telegramPayload.telegramUsername || null,
        telegram_first_name: telegramPayload.telegramFirstName || null,
        linked_at: nowIso
      });
      if (insertErr) {
        if (isTableMissingError(insertErr)) {
          this.warnMissingTable('telegram_users', 'linkUserTelegram');
        } else {
          console.error('Supabase telegram_users insert error:', insertErr);
          throw new Error(`Failed to persist telegram user link: ${insertErr.message}`);
        }
      }
    }

    // Update in user record (which also enforces Supabase persistence)
    const updatedUser = await this.updateUser(userId, { telegram: telegramPayload });

    await this.addTelegramLog({
      id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      telegramUserId: telegramPayload.telegramUserId,
      action: 'account_linked',
      status: 'success',
      details: `Telegram account @${telegramPayload.telegramUsername || telegramPayload.telegramUserId} linked to Crazy Storyes account`,
      createdAt: nowIso
    });

    return updatedUser || null;
  }

  public async unlinkUserTelegram(userId: string): Promise<User | null> {
    const user = await this.getUserById(userId);
    const tgUserId = user?.telegram?.telegramUserId;
    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('telegram_users').delete().eq('user_id', userId);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_users', 'unlinkUserTelegram');
        } else {
          console.error('Supabase telegram_users delete error:', error);
          throw new Error(`Failed to delete from telegram_users: ${error.message}`);
        }
      }
    }

    const updatedUser = await this.updateUser(userId, { telegram: undefined });

    await this.addTelegramLog({
      id: `tlog_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId,
      telegramUserId: tgUserId,
      action: 'unlinked',
      status: 'success',
      details: `Telegram account unlinked from Crazy Storyes account`,
      createdAt: nowIso
    });

    return updatedUser || null;
  }

  public async getTelegramAccess(userId: string, novelId: string): Promise<TelegramAccessRecord | null> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access')
        .select('*')
        .eq('user_id', userId)
        .eq('novel_id', novelId)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'getTelegramAccess');
          return this.cache.telegramAccess.find(a => a.userId === userId && a.novelId === novelId) || null;
        }
        console.error('Supabase getTelegramAccess error:', { code: error.code, message: error.message });
        throw createDatabaseError('getTelegramAccess', error);
      }
      return data ? rowToTelegramAccess(data) : null;
    }

    const found = this.cache.telegramAccess.find(
      a => a.userId === userId && a.novelId === novelId
    );
    return found || null;
  }

  public async findTelegramAccessByInviteLink(inviteLink: string): Promise<TelegramAccessRecord | null> {
    const clean = inviteLink.trim();
    if (!clean) return null;

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access')
        .select('*')
        .eq('invite_link', clean)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'findTelegramAccessByInviteLink');
          return this.cache.telegramAccess.find(a => (a.inviteLink || '').trim() === clean) || null;
        }
        console.error('Supabase findTelegramAccessByInviteLink error:', { code: error.code, message: error.message });
        throw createDatabaseError('findTelegramAccessByInviteLink', error);
      }
      return data ? rowToTelegramAccess(data) : null;
    }

    const found = this.cache.telegramAccess.find(
      a => (a.inviteLink || '').trim() === clean
    );
    return found || null;
  }

  public async getChannelTelegramAccesses(channelId: string): Promise<TelegramAccessRecord[]> {
    const cleanChannel = String(channelId).trim();
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access')
        .select('*')
        .eq('channel_id', cleanChannel)
        .order('updated_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'getChannelTelegramAccesses');
          return this.cache.telegramAccess.filter(a => String(a.channelId).trim() === cleanChannel);
        }
        console.error('Supabase getChannelTelegramAccesses error:', { code: error.code, message: error.message });
        throw createDatabaseError('getChannelTelegramAccesses', error);
      }
      return (data || []).map(rowToTelegramAccess);
    }

    return this.cache.telegramAccess.filter(a => String(a.channelId).trim() === cleanChannel);
  }

  public async getUserTelegramAccesses(userId: string): Promise<TelegramAccessRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'getUserTelegramAccesses');
          return this.cache.telegramAccess.filter(a => a.userId === userId);
        }
        console.error('Supabase getUserTelegramAccesses error:', { code: error.code, message: error.message });
        throw createDatabaseError('getUserTelegramAccesses', error);
      }
      return (data || []).map(rowToTelegramAccess);
    }

    return this.cache.telegramAccess.filter(a => a.userId === userId);
  }

  public async saveTelegramAccess(access: TelegramAccessRecord): Promise<TelegramAccessRecord> {
    if (isSupabaseConfigured() && supabase) {
      const row = telegramAccessToRow(access);
      const { data, error } = await supabase
        .from('telegram_access')
        .upsert(row)
        .select()
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'saveTelegramAccess');
        } else {
          console.error('Supabase saveTelegramAccess error:', error);
          throw createDatabaseError('saveTelegramAccess', error);
        }
      } else if (data) {
        const saved = rowToTelegramAccess(data);
        const idx = this.cache.telegramAccess.findIndex(a => a.id === access.id || (a.userId === access.userId && a.novelId === access.novelId));
        if (idx !== -1) {
          this.cache.telegramAccess[idx] = saved;
        } else {
          this.cache.telegramAccess.unshift(saved);
        }
        return saved;
      }
    }

    const idx = this.cache.telegramAccess.findIndex(a => a.id === access.id || (a.userId === access.userId && a.novelId === access.novelId));
    if (idx !== -1) {
      this.cache.telegramAccess[idx] = access;
    } else {
      this.cache.telegramAccess.unshift(access);
    }
    return access;
  }

  public async updateTelegramAccess(id: string, patch: Partial<TelegramAccessRecord>): Promise<TelegramAccessRecord | null> {
    const nowIso = new Date().toISOString();
    let updated: TelegramAccessRecord | null = null;

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates: any = { updated_at: nowIso };
      if (patch.status !== undefined) rowUpdates.status = patch.status;
      if (patch.expiresAt !== undefined) rowUpdates.expires_at = patch.expiresAt || null;
      if (patch.inviteLink !== undefined) rowUpdates.invite_link = patch.inviteLink || null;
      if (patch.joinedAt !== undefined) rowUpdates.joined_at = patch.joinedAt;
      if (patch.telegramUserId !== undefined) rowUpdates.telegram_user_id = patch.telegramUserId;
      if (patch.channelId !== undefined) rowUpdates.channel_id = patch.channelId;
      if (patch.channelName !== undefined) rowUpdates.channel_name = patch.channelName || null;
      if (patch.accessType !== undefined) rowUpdates.access_type = patch.accessType;

      const { data, error } = await supabase
        .from('telegram_access')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'updateTelegramAccess');
        } else {
          console.error('Supabase updateTelegramAccess error:', error);
          throw createDatabaseError('updateTelegramAccess', error);
        }
      } else if (data) {
        updated = rowToTelegramAccess(data);
      }
    }

    const idx = this.cache.telegramAccess.findIndex(a => a.id === id);
    if (idx !== -1) {
      this.cache.telegramAccess[idx] = {
        ...this.cache.telegramAccess[idx],
        ...patch,
        updatedAt: nowIso
      };
      if (!updated) updated = this.cache.telegramAccess[idx];
    }

    return updated;
  }

  public async getAllTelegramAccesses(): Promise<TelegramAccessRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access', 'getAllTelegramAccesses');
          return this.cache.telegramAccess;
        }
        console.error('Supabase getAllTelegramAccesses error:', { code: error.code, message: error.message });
        throw createDatabaseError('getAllTelegramAccesses', error);
      }
      if (data) {
        this.cache.telegramAccess = data.map(rowToTelegramAccess);
      }
    }
    return this.cache.telegramAccess;
  }

  public async addTelegramLog(log: TelegramAccessLog): Promise<TelegramAccessLog> {
    this.cache.telegramAccessLogs.unshift(log);
    if (this.cache.telegramAccessLogs.length > 500) {
      this.cache.telegramAccessLogs.pop();
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const row = telegramLogToRow(log);
        const { error } = await supabase.from('telegram_access_logs').insert(row);
        if (error) {
          if (isTableMissingError(error)) {
            this.warnMissingTable('telegram_access_logs', 'addTelegramLog');
          } else {
            console.warn('Supabase addTelegramLog notice:', { code: error.code, message: error.message });
          }
        }
      } catch (err) {
        console.warn('Supabase addTelegramLog error:', err);
      }
    }
    return log;
  }

  public async getTelegramLogs(limit = 100): Promise<TelegramAccessLog[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_access_logs', 'getTelegramLogs');
          return this.cache.telegramAccessLogs.slice(0, limit);
        }
        console.error('Supabase getTelegramLogs error:', { code: error.code, message: error.message });
        throw createDatabaseError('getTelegramLogs', error);
      }
      return (data || []).map(rowToTelegramLog);
    }
    return this.cache.telegramAccessLogs.slice(0, limit);
  }

  public async addTelegramPendingOp(op: TelegramPendingOperation): Promise<TelegramPendingOperation> {
    if (isSupabaseConfigured() && supabase) {
      const row = telegramPendingOpToRow(op);
      const { error } = await supabase.from('telegram_pending_operations').insert(row);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_pending_operations', 'addTelegramPendingOp');
        } else {
          console.error('Supabase addTelegramPendingOp error:', error);
          throw createDatabaseError('addTelegramPendingOp', error);
        }
      }
    }

    const existingIdx = this.cache.telegramPendingOperations.findIndex(
      o => o.channelId === op.channelId && o.telegramUserId === op.telegramUserId && o.status === 'pending'
    );
    if (existingIdx !== -1) {
      this.cache.telegramPendingOperations[existingIdx].retryCount += 1;
      this.cache.telegramPendingOperations[existingIdx].lastError = op.lastError;
      this.cache.telegramPendingOperations[existingIdx].updatedAt = new Date().toISOString();
      return this.cache.telegramPendingOperations[existingIdx];
    }

    this.cache.telegramPendingOperations.push(op);
    return op;
  }

  public async getPendingTelegramOps(): Promise<TelegramPendingOperation[]> {
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('telegram_pending_operations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_pending_operations', 'getPendingTelegramOps');
          return this.cache.telegramPendingOperations.filter(o => o.status === 'pending');
        }
        console.error('Supabase getPendingTelegramOps error:', { code: error.code, message: error.message });
        throw createDatabaseError('getPendingTelegramOps', error);
      }
      return (data || []).map(rowToTelegramPendingOp);
    }
    return this.cache.telegramPendingOperations.filter(o => o.status === 'pending');
  }

  public async updateTelegramPendingOp(id: string, patch: Partial<TelegramPendingOperation>): Promise<TelegramPendingOperation | null> {
    const nowIso = new Date().toISOString();
    let updated: TelegramPendingOperation | null = null;

    if (isSupabaseConfigured() && supabase) {
      const rowUpdates: any = { updated_at: nowIso };
      if (patch.status !== undefined) rowUpdates.status = patch.status;
      if (patch.retryCount !== undefined) rowUpdates.retry_count = patch.retryCount;
      if (patch.lastError !== undefined) rowUpdates.last_error = patch.lastError;

      const { data, error } = await supabase
        .from('telegram_pending_operations')
        .update(rowUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('telegram_pending_operations', 'updateTelegramPendingOp');
        } else {
          console.error('Supabase updateTelegramPendingOp error:', error);
          throw new Error(`Failed to update telegram pending operation: ${error.message}`);
        }
      } else if (data) {
        updated = rowToTelegramPendingOp(data);
      }
    }

    const idx = this.cache.telegramPendingOperations.findIndex(o => o.id === id);
    if (idx !== -1) {
      this.cache.telegramPendingOperations[idx] = {
        ...this.cache.telegramPendingOperations[idx],
        ...patch,
        updatedAt: nowIso
      };
      if (!updated) updated = this.cache.telegramPendingOperations[idx];
    }

    return updated;
  }

  // -------------------------------------------------------------
  // TELEGRAM WEBHOOK UPDATE DEDUPLICATION
  // -------------------------------------------------------------
  private processedUpdateIds = new Set<number>();
  private processedUpdateQueue: number[] = [];

  public async isTelegramUpdateProcessed(updateId: number): Promise<boolean> {
    if (!updateId) return false;
    if (this.processedUpdateIds.has(updateId)) return true;

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data } = await supabase
          .from('telegram_processed_updates')
          .select('update_id')
          .eq('update_id', updateId)
          .maybeSingle();

        if (data?.update_id) {
          this.processedUpdateIds.add(updateId);
          return true;
        }
      } catch (err) {
        // Table may not exist yet if user hasn't run migration; in-memory set handles deduplication
        console.warn('Supabase isTelegramUpdateProcessed check notice:', err);
      }
    }

    return false;
  }

  public async markTelegramUpdateProcessed(updateId: number): Promise<void> {
    if (!updateId) return;
    this.processedUpdateIds.add(updateId);
    this.processedUpdateQueue.push(updateId);
    if (this.processedUpdateQueue.length > 10000) {
      const oldest = this.processedUpdateQueue.shift();
      if (oldest) this.processedUpdateIds.delete(oldest);
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('telegram_processed_updates')
          .insert({ update_id: updateId });
      } catch (err: any) {
        // Ignore duplicate key errors (code 23505)
        if (err?.code !== '23505') {
          console.warn('Supabase markTelegramUpdateProcessed notice:', err);
        }
      }
    }
  }

  // -------------------------------------------------------------
  // USER AUTH & SECURITY AUDIT LOGS
  // -------------------------------------------------------------
  public async addAuthLog(
    input: Omit<UserAuthLog, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
  ): Promise<UserAuthLog> {
    const now = input.createdAt || input.timestamp || new Date().toISOString();
    const email = input.email || input.userEmail;
    const ip = input.ipAddress || input.ip;
    const details = input.failureReason || input.details;
    const status = input.status || (input.eventType === 'failed_login' ? 'failed' : 'success');

    const log: UserAuthLog = {
      ...input,
      id: input.id || `auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email,
      userEmail: email,
      ip,
      ipAddress: ip,
      status,
      details,
      failureReason: details,
      createdAt: now,
      timestamp: now
    };

    this.cache.userAuthLogs.unshift(log);
    // Keep in-memory cache bounded
    if (this.cache.userAuthLogs.length > 5000) {
      this.cache.userAuthLogs.pop();
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        const row = authLogToRow(log);
        const { error } = await supabase.from('user_auth_logs').insert(row);
        if (error) {
          console.warn('Supabase addAuthLog notice:', error.message);
        }
      } catch (err: any) {
        console.warn('Supabase addAuthLog error:', err.message);
      }
    }

    return log;
  }

  public async getAuthLogs(options?: { userId?: string; eventType?: string; limit?: number }): Promise<UserAuthLog[]> {
    const limit = options?.limit || 100;

    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('user_auth_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.userId) {
        query = query.eq('user_id', options.userId);
      }
      if (options?.eventType && options.eventType !== 'all') {
        query = query.eq('event_type', options.eventType);
      }

      const { data, error } = await query;
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('user_auth_logs', 'getAuthLogs');
        } else {
          console.error('Supabase getAuthLogs error:', { code: error.code, message: error.message });
          throw createDatabaseError('getAuthLogs', error);
        }
      } else {
        return (data || []).map(rowToAuthLog);
      }
    }

    let logs = [...this.cache.userAuthLogs];
    if (options?.userId) {
      logs = logs.filter(l => l.userId === options.userId);
    }
    if (options?.eventType && options.eventType !== 'all') {
      logs = logs.filter(l => l.eventType === options.eventType);
    }
    return logs.slice(0, limit);
  }

  // -------------------------------------------------------------
  // REVOKED TOKENS / SESSION REVOCATION
  // -------------------------------------------------------------
  public async revokeToken(record: RevokedToken): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const row = revokedTokenToRow(record);
      const { error } = await supabase.from('revoked_tokens').upsert(row);
      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('revoked_tokens', 'revokeToken');
        } else {
          console.error('Supabase revokeToken error:', { code: error.code, message: error.message });
          throw createDatabaseError('revokeToken', error);
        }
      }
    }
    this.cache.revokedTokens.push(record);
  }

  public async isTokenRevoked(token: string): Promise<boolean> {
    if (!token) return true;

    const inMemory = this.cache.revokedTokens.find(r => r.token === token);
    if (inMemory) {
      // Check if expired
      if (new Date(inMemory.expiresAt).getTime() < Date.now()) {
        this.cache.revokedTokens = this.cache.revokedTokens.filter(r => r.token !== token);
        return false;
      }
      return true;
    }

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('revoked_tokens')
        .select('id, expires_at')
        .eq('token', token)
        .maybeSingle();

      if (error) {
        if (isTableMissingError(error)) {
          this.warnMissingTable('revoked_tokens', 'isTokenRevoked');
          return false;
        }
        console.error('Supabase isTokenRevoked error:', { code: error.code, message: error.message });
        throw createDatabaseError('isTokenRevoked', error);
      }

      if (data) {
        if (new Date(data.expires_at).getTime() < Date.now()) {
          return false;
        }
        return true;
      }
    }

    return false;
  }
}

export const db = new Database();

