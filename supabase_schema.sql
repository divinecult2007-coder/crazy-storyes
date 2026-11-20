-- ============================================================
-- CRAZY STORYES — COMPLETE SUPABASE DATABASE SCHEMA MIGRATION
-- Safe for both fresh installations and existing databases
-- Run this in the Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ============================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'reader',
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  membership JSONB NOT NULL DEFAULT '{"isActive": false}'::jsonb,
  bookmarks JSONB NOT NULL DEFAULT '[]'::jsonb,
  reading_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  telegram JSONB DEFAULT NULL,
  last_login_at TIMESTAMPTZ DEFAULT NULL,
  last_logout_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist when upgrading an existing users table (preserves all rows)
ALTER TABLE IF EXISTS public.users
  ADD COLUMN IF NOT EXISTS telegram JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_logout_at TIMESTAMPTZ DEFAULT NULL;

-- Indexes for fast email lookups and authentication
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

-- 2. NOVELS TABLE
CREATE TABLE IF NOT EXISTS public.novels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  hindi_title TEXT,
  author TEXT,
  description TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  categories JSONB NOT NULL DEFAULT '["Action"]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_trending BOOLEAN NOT NULL DEFAULT FALSE,
  is_popular BOOLEAN NOT NULL DEFAULT FALSE,
  views INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC NOT NULL DEFAULT 5.0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  user_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
  likes INTEGER NOT NULL DEFAULT 0,
  liked_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviews JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_chapters INTEGER NOT NULL DEFAULT 0,
  telegram_channel_privacy TEXT DEFAULT 'public',
  telegram_channel_link TEXT DEFAULT NULL,
  telegram_channel_id TEXT DEFAULT NULL,
  telegram_channel_name TEXT DEFAULT NULL,
  telegram_channel_type TEXT DEFAULT 'channel',
  telegram_access_type TEXT DEFAULT 'free',
  telegram_integration_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.novels
  ADD COLUMN IF NOT EXISTS telegram_channel_privacy TEXT DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS telegram_channel_link TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_name TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_channel_type TEXT DEFAULT 'channel',
  ADD COLUMN IF NOT EXISTS telegram_access_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS telegram_integration_enabled BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_novels_published ON public.novels (is_published);
CREATE INDEX IF NOT EXISTS idx_novels_premium ON public.novels (is_premium);
CREATE INDEX IF NOT EXISTS idx_novels_rating ON public.novels (rating DESC);
CREATE INDEX IF NOT EXISTS idx_novels_views ON public.novels (views DESC);

-- 3. CHAPTERS TABLE (Telegram Audio Chapters)
CREATE TABLE IF NOT EXISTS public.chapters (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL REFERENCES public.novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  telegram_message_link TEXT,
  telegram_message_id BIGINT,
  telegram_chat_id TEXT,
  telegram_destination_type TEXT DEFAULT 'channel',
  telegram_audio_access_type TEXT DEFAULT 'free',
  telegram_audio_configured BOOLEAN DEFAULT FALSE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.chapters
  ADD COLUMN IF NOT EXISTS telegram_message_link TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_message_id BIGINT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS telegram_destination_type TEXT DEFAULT 'channel',
  ADD COLUMN IF NOT EXISTS telegram_audio_access_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS telegram_audio_configured BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_chapters_novel_id ON public.chapters (novel_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON public.chapters (novel_id, chapter_number ASC);

-- 4. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  utr_number TEXT,
  payment_proof_url TEXT,
  screenshot_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason TEXT,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments (created_at DESC);

-- 5. MEMBERSHIP PLANS TABLE
CREATE TABLE IF NOT EXISTS public.membership_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hindi_name TEXT NOT NULL,
  original_price NUMERIC,
  price NUMERIC NOT NULL,
  duration_days INTEGER NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'none',
  discount_percentage NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  badge_text TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.membership_plans
  ADD COLUMN IF NOT EXISTS original_price NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 6. SITE SETTINGS TABLE
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

-- 7. SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_email ON public.support_tickets (LOWER(user_email));
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets (status);

-- 8. TELEGRAM INTEGRATION TABLES
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

CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code ON public.telegram_link_codes(code);
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires ON public.telegram_link_codes(expires_at, used_at);

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

CREATE INDEX IF NOT EXISTS idx_telegram_access_user ON public.telegram_access(user_id, status);
CREATE INDEX IF NOT EXISTS idx_telegram_access_novel ON public.telegram_access(novel_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_channel ON public.telegram_access(channel_id, telegram_user_id);

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

CREATE INDEX IF NOT EXISTS idx_telegram_logs_time ON public.telegram_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_logs_user ON public.telegram_access_logs(user_id);

CREATE TABLE IF NOT EXISTS public.telegram_pending_operations (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL DEFAULT 'remove_member',
  user_id TEXT NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  channel_id TEXT NOT NULL,
  novel_id TEXT NOT NULL,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_pending_status ON public.telegram_pending_operations(status);

CREATE TABLE IF NOT EXISTS public.telegram_processed_updates (
  update_id BIGINT PRIMARY KEY,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. USER AUTH AUDIT LOGS & REVOKED TOKENS
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

CREATE INDEX IF NOT EXISTS idx_user_auth_logs_user ON public.user_auth_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_auth_logs_event ON public.user_auth_logs(event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_token ON public.revoked_tokens(token);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expiry ON public.revoked_tokens(expires_at);

-- Enable Row Level Security (server uses service role / secret key)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_pending_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_processed_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_membership_plans_active ON public.membership_plans (is_active);
CREATE INDEX IF NOT EXISTS idx_revoked_tokens_user ON public.revoked_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_access_invite_link ON public.telegram_access (invite_link);

-- Revoke excessive grants from PUBLIC, anon, authenticated & enforce strict service_role policies
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
    'membership_plans',
    'site_settings',
    'support_tickets',
    'telegram_users',
    'telegram_link_codes',
    'telegram_access',
    'telegram_access_logs',
    'telegram_pending_operations',
    'telegram_processed_updates',
    'user_auth_logs',
    'revoked_tokens'
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
