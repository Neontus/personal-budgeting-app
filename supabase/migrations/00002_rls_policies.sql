-- =============================================================================
-- Migration: 00002_rls_policies.sql
-- Description: Row Level Security policies — users only access their own data
-- =============================================================================

-- Enable RLS on all user-data tables
alter table public.profiles enable row level security;
alter table public.linked_accounts enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.category_rules enable row level security;
alter table public.budgets enable row level security;
alter table public.budget_periods enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- =============================================================================
-- PROFILES
-- =============================================================================

create policy "profiles: users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- =============================================================================
-- LINKED ACCOUNTS
-- =============================================================================

create policy "linked_accounts: users can view own"
  on public.linked_accounts for select
  using (auth.uid() = user_id);

-- Inserts/updates done by edge functions (service role) only — no client policy needed

-- =============================================================================
-- ACCOUNTS
-- =============================================================================

create policy "accounts: users can view own"
  on public.accounts for select
  using (auth.uid() = user_id);

-- =============================================================================
-- CATEGORIES
-- =============================================================================

create policy "categories: users can view system + own"
  on public.categories for select
  using (is_system = true or auth.uid() = user_id);

create policy "categories: users can insert own"
  on public.categories for insert
  with check (auth.uid() = user_id and is_system = false);

create policy "categories: users can update own"
  on public.categories for update
  using (auth.uid() = user_id and is_system = false);

create policy "categories: users can delete own"
  on public.categories for delete
  using (auth.uid() = user_id and is_system = false);

-- =============================================================================
-- TRANSACTIONS
-- =============================================================================

create policy "transactions: users can view own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions: users can update own"
  on public.transactions for update
  using (auth.uid() = user_id);

-- Inserts done by edge functions (service role) — synced from Plaid

-- =============================================================================
-- CATEGORY RULES
-- =============================================================================

create policy "category_rules: users can view own"
  on public.category_rules for select
  using (auth.uid() = user_id);

create policy "category_rules: users can insert own"
  on public.category_rules for insert
  with check (auth.uid() = user_id);

create policy "category_rules: users can update own"
  on public.category_rules for update
  using (auth.uid() = user_id);

create policy "category_rules: users can delete own"
  on public.category_rules for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- BUDGETS
-- =============================================================================

create policy "budgets: users can view own"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "budgets: users can insert own"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "budgets: users can update own"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "budgets: users can delete own"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- BUDGET PERIODS
-- =============================================================================

create policy "budget_periods: users can view own"
  on public.budget_periods for select
  using (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and b.user_id = auth.uid()
    )
  );

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

create policy "notifications: users can view own"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "notifications: users can update own (mark read)"
  on public.notifications for update
  using (auth.uid() = user_id);

-- =============================================================================
-- NOTIFICATION PREFERENCES
-- =============================================================================

create policy "notification_preferences: users can view own"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "notification_preferences: users can insert own"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "notification_preferences: users can update own"
  on public.notification_preferences for update
  using (auth.uid() = user_id);
