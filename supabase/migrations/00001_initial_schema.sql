-- =============================================================================
-- Migration: 00001_initial_schema.sql
-- Description: Core tables for the budget tracker app
-- =============================================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- fuzzy text search on merchant names

-- =============================================================================
-- PROFILES (extends Supabase auth.users)
-- =============================================================================

create table public.profiles (
  id                uuid        primary key references auth.users(id) on delete cascade,
  display_name      text,
  avatar_url        text,
  timezone          text        not null default 'America/New_York',
  push_token        text,                           -- Expo push token
  telegram_chat_id  text,                           -- Telegram chat ID for bot alerts
  telegram_enabled  boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is 'User profile data extending auth.users';

-- =============================================================================
-- LINKED ACCOUNTS (Plaid Items — one per institution connection)
-- =============================================================================

create table public.linked_accounts (
  id                    uuid        primary key default uuid_generate_v4(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  plaid_item_id         text        not null unique,
  -- NOTE: plaid_access_token is stored via Supabase Vault in production.
  -- During local dev, stored directly (never commit real tokens).
  plaid_access_token    text        not null,
  institution_name      text,
  institution_id        text,
  status                text        not null default 'active'
                          check (status in ('active', 'error', 'disconnected')),
  consent_expires_at    timestamptz,
  cursor                text,                       -- Plaid /transactions/sync cursor
  last_synced_at        timestamptz,
  error_code            text,                       -- Populated when status = 'error'
  created_at            timestamptz not null default now()
);

comment on table public.linked_accounts is 'Plaid Items — one per institution link';
comment on column public.linked_accounts.cursor is 'Plaid cursor for /transactions/sync endpoint';

-- =============================================================================
-- FINANCIAL ACCOUNTS (individual accounts within a Plaid Item)
-- =============================================================================

create table public.accounts (
  id                    uuid        primary key default uuid_generate_v4(),
  user_id               uuid        not null references public.profiles(id) on delete cascade,
  linked_account_id     uuid        not null references public.linked_accounts(id) on delete cascade,
  plaid_account_id      text        not null unique,
  name                  text        not null,
  official_name         text,
  type                  text        not null
                          check (type in ('depository', 'credit', 'loan', 'investment')),
  subtype               text,
  mask                  text,                       -- last 4 digits
  current_balance       numeric(12, 2),
  available_balance     numeric(12, 2),
  credit_limit          numeric(12, 2),
  iso_currency_code     text        not null default 'USD',
  bill_due_date         int         check (bill_due_date between 1 and 31),
  statement_close_date  int         check (statement_close_date between 1 and 31),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on table public.accounts is 'Individual financial accounts from Plaid';
comment on column public.accounts.bill_due_date is 'Day of month (1-31) when credit card payment is due';
comment on column public.accounts.statement_close_date is 'Day of month (1-31) when statement closes';

-- =============================================================================
-- CATEGORIES
-- =============================================================================

create table public.categories (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        references public.profiles(id) on delete cascade,  -- null = system default
  name        text        not null,
  icon        text,                                 -- Ionicons name
  color       text,                                 -- hex color string
  parent_id   uuid        references public.categories(id),
  is_system   boolean     not null default false,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

comment on table public.categories is 'Spending categories — system defaults (user_id IS NULL) and user-defined';

-- =============================================================================
-- TRANSACTIONS
-- =============================================================================

create table public.transactions (
  id                      uuid        primary key default uuid_generate_v4(),
  user_id                 uuid        not null references public.profiles(id) on delete cascade,
  account_id              uuid        not null references public.accounts(id) on delete cascade,
  plaid_transaction_id    text        unique,
  amount                  numeric(12, 2) not null,  -- positive = expense, negative = credit/refund
  merchant_name           text,
  name                    text        not null,      -- Plaid's raw transaction name
  category_id             uuid        references public.categories(id),
  plaid_category          text[],                   -- Raw Plaid personal_finance_category path
  pending                 boolean     not null default false,
  date                    date        not null,
  authorized_date         date,
  auto_categorized        boolean     not null default true,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table public.transactions is 'Financial transactions synced from Plaid';
comment on column public.transactions.amount is 'Positive = debit/expense, negative = credit/refund';
comment on column public.transactions.auto_categorized is 'False when user has manually set the category';

-- Indexes for common access patterns
create index idx_transactions_user_date       on public.transactions (user_id, date desc);
create index idx_transactions_user_category   on public.transactions (user_id, category_id);
create index idx_transactions_account         on public.transactions (account_id, date desc);
create index idx_transactions_pending         on public.transactions (user_id, pending);
create index idx_transactions_merchant_trgm   on public.transactions using gin (merchant_name gin_trgm_ops);

-- =============================================================================
-- CATEGORY RULES (learned from user corrections)
-- =============================================================================

create table public.category_rules (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  merchant_pattern  text        not null,           -- matched case-insensitively against merchant_name
  category_id       uuid        not null references public.categories(id),
  priority          int         not null default 0, -- higher = evaluated first
  created_at        timestamptz not null default now(),
  unique (user_id, merchant_pattern)
);

comment on table public.category_rules is 'User-defined categorization rules learned from manual corrections';

-- =============================================================================
-- BUDGETS
-- =============================================================================

create table public.budgets (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references public.profiles(id) on delete cascade,
  category_id       uuid        references public.categories(id),  -- null = overall budget
  amount            numeric(12, 2) not null check (amount > 0),
  period_type       text        not null
                      check (period_type in ('weekly', 'monthly', 'statement_cycle')),
  period_anchor     int,        -- day of week (0-6) for weekly; day of month (1-31) for monthly/statement
  account_id        uuid        references public.accounts(id),    -- null = all accounts
  alert_thresholds  int[]       not null default '{50,80,100}',    -- % thresholds that trigger alerts
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.budgets is 'Spending budgets with configurable periods and alert thresholds';
comment on column public.budgets.category_id is 'NULL = overall budget across all categories';
comment on column public.budgets.period_anchor is 'Day-of-week (0=Sun) for weekly; day-of-month (1-31) for monthly/statement';

-- =============================================================================
-- BUDGET PERIODS (materialized per-period tracking)
-- =============================================================================

create table public.budget_periods (
  id            uuid        primary key default uuid_generate_v4(),
  budget_id     uuid        not null references public.budgets(id) on delete cascade,
  period_start  date        not null,
  period_end    date        not null,
  spent         numeric(12, 2) not null default 0,
  alerted_at    jsonb       not null default '{}',  -- { "50": "<timestamp>", "80": null, "100": null }
  created_at    timestamptz not null default now(),
  unique (budget_id, period_start)
);

comment on table public.budget_periods is 'Materialized spending totals per budget period';
comment on column public.budget_periods.alerted_at is 'Timestamps of when each threshold alert was sent — key = threshold %';

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

create table public.notifications (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  type        text        not null
                check (type in ('budget_alert', 'bill_due', 'subscription_renewal', 'weekly_report', 'monthly_report')),
  title       text        not null,
  body        text        not null,
  data        jsonb,                                -- arbitrary payload (budget_id, account_id, etc.)
  channel     text        not null
                check (channel in ('push', 'telegram', 'in_app')),
  status      text        not null default 'pending'
                check (status in ('pending', 'sent', 'failed', 'read')),
  sent_at     timestamptz,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.notifications is 'Notification log for all channels (push, telegram, in_app)';

create index idx_notifications_user_created on public.notifications (user_id, created_at desc);
create index idx_notifications_unread       on public.notifications (user_id, read_at) where read_at is null;

-- =============================================================================
-- NOTIFICATION PREFERENCES
-- =============================================================================

create table public.notification_preferences (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  event_type      text        not null,
  push_enabled    boolean     not null default true,
  telegram_enabled boolean    not null default false,
  in_app_enabled  boolean     not null default true,
  unique (user_id, event_type)
);

comment on table public.notification_preferences is 'Per-user, per-event notification channel preferences';
