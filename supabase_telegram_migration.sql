-- ==============================================================================
-- CRAZY STORYES: TELEGRAM CHANNEL & VIP MEMBERSHIP INTEGRATION MIGRATION
-- Database: Supabase (PostgreSQL)
-- Description: Creates tables, alters novel and user schemas, configures indexes
--              and RLS policies for Telegram Channel delivery and Bot management.
-- ==============================================================================

-- 1. EXTEND USERS TABLE FOR TELEGRAM INTEGRATION
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS telegram JSONB DEFAULT NULL;

-- Dedicated table for 1-to-1 Telegram User ID to Crazy Storyes User mapping
CREATE TABLE IF NOT EXISTS public.telegram_users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  telegram_username TEXT,
  telegram_first_name TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_user_id ON public.telegram_users(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_tg_id ON public.telegram_users(telegram_user_id);

-- 2. EXTEND NOVELS TABLE FOR PUBLIC & PRIVATE TELEGRAM CHANNEL DELIVERY
ALTER TABLE IF EXISTS public.novels
  ADD COLUMN IF NOT EXISTS telegram_channel_privacy TEXT DEFAULT 'public', -- 'public' | 'private'
  ADD COLUMN IF NOT EXISTS telegram_channel_link TEXT DEFAULT NULL,       -- e.g. 'https://t.me/CrazyStoryesOfficial'
  ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT DEFAULT NULL,         -- e.g. '-1001234567890' (for private channels)
  ADD COLUMN IF NOT EXISTS telegram_channel_name TEXT DEFAULT NULL,       -- e.g. 'Crazy Storyes - अमर योद्धा'
  ADD COLUMN IF NOT EXISTS telegram_channel_type TEXT DEFAULT 'channel',  -- 'channel' | 'supergroup'
  ADD COLUMN IF NOT EXISTS telegram_access_type TEXT DEFAULT 'free',      -- 'free' | 'premium'
  ADD COLUMN IF NOT EXISTS telegram_integration_enabled BOOLEAN DEFAULT FALSE;

-- 2B. EXTEND CHAPTERS TABLE FOR CHAPTER-WISE TELEGRAM AUDIO
ALTER TABLE IF EXISTS public.chapters
  ADD COLUMN IF NOT EXISTS telegram_message_link TEXT DEFAULT NULL,       -- e.g. 'https://t.me/c/1234567890/42' or 'https://t.me/channel_name/42'
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT NULL,       -- e.g. 42
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL,           -- e.g. '-1001234567890' or '@channel_name'
  ADD COLUMN IF NOT EXISTS telegram_destination_type TEXT DEFAULT 'channel', -- 'channel' | 'supergroup' | 'group'
  ADD COLUMN IF NOT EXISTS telegram_audio_access_type TEXT DEFAULT 'free', -- 'free' | 'premium'
  ADD COLUMN IF NOT EXISTS telegram_audio_configured BOOLEAN DEFAULT FALSE;

-- 3. EXPIRING TELEGRAM LINKING CODES (Single-use, 15 minute expiry)
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
  ON public.telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires 
  ON public.telegram_link_codes(expires_at, used_at);

-- 4. TELEGRAM ACCESS RECORDS (Tracks who was granted access to which private channel)
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
  status TEXT NOT NULL DEFAULT 'active',    -- 'active' | 'expired' | 'revoked'
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_access_user 
  ON public.telegram_access(user_id, status);
CREATE INDEX IF NOT EXISTS idx_telegram_access_novel 
  ON public.telegram_access(novel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_channel 
  ON public.telegram_access(channel_id, telegram_user_id);

-- 5. TELEGRAM AUDIT & ACTION LOGS
CREATE TABLE IF NOT EXISTS public.telegram_access_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  telegram_user_id BIGINT,
  channel_id TEXT,
  novel_id TEXT,
  action TEXT NOT NULL,   -- 'link_generated' | 'member_joined' | 'member_removed' | 'removal_failed' | 'retry_removal' | 'unlinked' | 'account_linked'
  status TEXT NOT NULL DEFAULT 'success', -- 'success' | 'failed' | 'pending'
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_logs_time 
  ON public.telegram_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user 
  ON public.telegram_access_logs(user_id);

-- 6. TELEGRAM PENDING RETRY OPERATIONS QUEUE (For auto-expiry kick retry resilience)
CREATE TABLE IF NOT EXISTS public.telegram_pending_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL DEFAULT 'remove_member', -- 'remove_member'
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
  ON public.telegram_pending_operations(status);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_pending_operations ENABLE ROW LEVEL SECURITY;

-- Allow server backend (Service Role) full control over all Telegram tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_users') THEN
    CREATE POLICY service_role_all_telegram_users ON public.telegram_users FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_link_codes') THEN
    CREATE POLICY service_role_all_telegram_link_codes ON public.telegram_link_codes FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_access') THEN
    CREATE POLICY service_role_all_telegram_access ON public.telegram_access FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_logs') THEN
    CREATE POLICY service_role_all_telegram_logs ON public.telegram_access_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_pending_ops') THEN
    CREATE POLICY service_role_all_telegram_pending_ops ON public.telegram_pending_operations FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. TELEGRAM PROCESSED UPDATES (For reliable webhook deduplication)
CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_telegram_processed_updates') THEN
    CREATE POLICY service_role_all_telegram_processed_updates ON public.telegram_processed_updates FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. USER LOGIN / LOGOUT & SECURITY AUDIT LOGS
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
  ON public.user_auth_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_auth_logs_event 
  ON public.user_auth_logs(event_type, created_at DESC);

-- 10. REVOKED SESSIONS / TOKENS (For secure backend logout & session termination)
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token 
  ON public.revoked_tokens(token);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry 
  ON public.revoked_tokens(expires_at);

-- 11. EXTEND USERS TABLE FOR LOGIN & LOGOUT TIMESTAMPS
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.user_auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_user_auth_logs') THEN
    CREATE POLICY service_role_all_user_auth_logs ON public.user_auth_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_revoked_tokens') THEN
    CREATE POLICY service_role_all_revoked_tokens ON public.revoked_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

