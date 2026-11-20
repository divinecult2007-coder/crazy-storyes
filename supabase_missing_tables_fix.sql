-- ==============================================================================
-- CRAZY STORYES — SAFE MISSING TABLES & SCHEMA REPAIR MIGRATION
-- Target: Existing Supabase PostgreSQL database
-- Safety:
--   * NEVER drops, truncates, or recreates existing tables
--   * NEVER deletes, resets, or overwrites existing users or data
--   * Safe & idempotent (can be executed multiple times)
--   * Enforces strict service_role RLS on sensitive tables (no public access)
-- ==============================================================================

-- ==============================================================================
-- PART 1: SAFELY ENSURE REQUIRED COLUMNS ON EXISTING TABLES (NON-DESTRUCTIVE)
-- ==============================================================================

-- 1A. Existing table: public.users
-- Preserve all existing rows & password hashes; add missing optional/tracking columns
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS telegram JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- 1B. Existing table: public.novels
-- Add Telegram channel configuration columns required by novelToRow/rowToNovel
ALTER TABLE IF EXISTS public.novels
  ADD COLUMN IF NOT EXISTS telegram_channel_privacy TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS telegram_channel_link TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_type TEXT DEFAULT 'channel',
  ADD COLUMN IF NOT EXISTS telegram_access_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS telegram_integration_enabled BOOLEAN DEFAULT FALSE;

-- 1C. Existing table: public.chapters
-- Add Telegram chapter audio delivery columns required by chapterToRow/rowToChapter
ALTER TABLE IF EXISTS public.chapters
  ADD COLUMN IF NOT EXISTS telegram_message_link TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_destination_type TEXT DEFAULT 'channel',
  ADD COLUMN IF NOT EXISTS telegram_audio_access_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS telegram_audio_configured BOOLEAN DEFAULT FALSE;

-- 1D. Existing table: public.payments
ALTER TABLE IF EXISTS public.payments
  ADD COLUMN IF NOT EXISTS utr_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_path TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- ==============================================================================
-- PART 2: CREATE THE 10 MISSING TABLES
-- ==============================================================================

-- 1. MEMBERSHIP PLANS
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hindi_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  badge_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_membership_plans_active
  ON public.membership_plans (is_active);

-- 2. SITE SETTINGS
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  website_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  upi_id TEXT NOT NULL,
  upi_qr_code_url TEXT,
  announcement TEXT,
  announcement_active BOOLEAN NOT NULL DEFAULT TRUE,
  support_email TEXT NOT NULL,
  support_phone TEXT NOT NULL,
  enable_ai_assistant BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. REVOKED TOKENS (Secure backend logout & JWT invalidation)
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token
  ON public.revoked_tokens (token);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry
  ON public.revoked_tokens (expires_at);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user
  ON public.revoked_tokens (user_id);

-- 4. USER AUTH AUDIT LOGS (Login, Logout, Registration & Failed Login Audit)
CREATE TABLE IF NOT EXISTS public.user_auth_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  event_type TEXT NOT NULL, -- 'registration' | 'login' | 'logout' | 'failed_login' | 'token_revoked'
  ip TEXT,
  user_agent TEXT,
  device_info TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_logs_user
  ON public.user_auth_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_auth_logs_event
  ON public.user_auth_logs (event_type, created_at DESC);

-- 5. TELEGRAM USERS (1-to-1 Telegram User ID <-> Crazy Storyes User Mapping)
CREATE TABLE IF NOT EXISTS public.telegram_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id
  ON public.telegram_users (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_tg_id
  ON public.telegram_users (telegram_user_id);

-- 6. TELEGRAM LINK CODES (Single-use expiring deep-link verification codes)
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_email TEXT,
  user_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code
  ON public.telegram_link_codes (code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires
  ON public.telegram_link_codes (expires_at, used_at);

-- 7. TELEGRAM ACCESS RECORDS (Private Group/Channel Invite & Membership Access)
CREATE TABLE IF NOT EXISTS public.telegram_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  novel_id TEXT NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  novel_title TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  access_type TEXT NOT NULL DEFAULT 'free', -- 'free' | 'premium'
  invite_link TEXT,
  status TEXT NOT NULL DEFAULT 'active',    -- 'pending' | 'active' | 'expired' | 'revoked' | 'rejected'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_access_user
  ON public.telegram_access (user_id, status);
CREATE INDEX IF NOT EXISTS idx_telegram_access_novel
  ON public.telegram_access (novel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_channel
  ON public.telegram_access (channel_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_invite_link
  ON public.telegram_access (invite_link);

-- 8. TELEGRAM ACCESS AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.telegram_access_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_user_id BIGINT,
  channel_id TEXT,
  novel_id TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_logs_time
  ON public.telegram_access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user
  ON public.telegram_access_logs (user_id);

-- 9. TELEGRAM PENDING RETRY OPERATIONS QUEUE
CREATE TABLE IF NOT EXISTS public.telegram_pending_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL DEFAULT 'remove_member',
  user_id TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  channel_id TEXT NOT NULL,
  novel_id TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_pending_status
  ON public.telegram_pending_operations (status);

-- 10. TELEGRAM PROCESSED WEBHOOK UPDATES (Webhook Deduplication)
CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- PART 3: SECURE ROW LEVEL SECURITY (RLS) & GRANT HARDENING
-- ==============================================================================
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

DO $$
DECLARE
  target_tables TEXT[] := ARRAY[
    'app_settings',
    'users',
    'novels',
    'chapters',
    'payments',
    'support_tickets',
    'membership_plans',
    'site_settings',
    'revoked_tokens',
    'user_auth_logs',
    'telegram_users',
    'telegram_link_codes',
    'telegram_access',
    'telegram_access_logs',
    'telegram_pending_operations',
    'telegram_processed_updates'
  ];
  tbl TEXT;
  pol RECORD;
BEGIN
  FOREACH tbl IN ARRAY target_tables
  LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', tbl);
      EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', tbl);
      FOR pol IN
        SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
      END LOOP;
      EXECUTE format(
        'CREATE POLICY %I ON public.%I AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true)',
        'service_role_all_' || tbl,
        tbl
      );
    END IF;
  END LOOP;
END $$;
