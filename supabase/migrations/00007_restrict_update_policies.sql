-- =============================================================================
-- Migration: 00004_restrict_update_policies.sql
-- Description: Restrict UPDATE policies on transactions and notifications to
--              prevent users from modifying immutable/system-owned columns.
--
-- Security issues fixed:
--   HIGH   — transactions: users could update amount, account_id,
--            plaid_transaction_id, user_id (now silently preserved)
--   MEDIUM — notifications: users could update any column including type,
--            title, body, data, channel (now silently preserved)
-- =============================================================================

-- Drop the overly-permissive UPDATE policies
drop policy if exists "transactions: users can update own" on public.transactions;
drop policy if exists "notifications: users can update own (mark read)" on public.notifications;

-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE UPDATE trigger: transactions
-- Only category_id, notes, auto_categorized may change
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.restrict_transaction_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id              := old.user_id;
  new.account_id           := old.account_id;
  new.plaid_transaction_id := old.plaid_transaction_id;
  new.amount               := old.amount;
  new.merchant_name        := old.merchant_name;
  new.name                 := old.name;
  new.plaid_category       := old.plaid_category;
  new.pending              := old.pending;
  new.date                 := old.date;
  new.authorized_date      := old.authorized_date;
  new.created_at           := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_restrict_transaction_update on public.transactions;
create trigger trg_restrict_transaction_update
  before update on public.transactions for each row
  execute function public.restrict_transaction_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- BEFORE UPDATE trigger: notifications
-- Only read_at and status may change
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.restrict_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id    := old.user_id;
  new.type       := old.type;
  new.title      := old.title;
  new.body       := old.body;
  new.data       := old.data;
  new.channel    := old.channel;
  new.sent_at    := old.sent_at;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_restrict_notification_update on public.notifications;
create trigger trg_restrict_notification_update
  before update on public.notifications for each row
  execute function public.restrict_notification_update();

-- Re-create UPDATE policies (row-level ownership; column restriction via triggers above)
create policy "transactions: users can update own (category/notes only)"
  on public.transactions for update using (auth.uid() = user_id);

create policy "notifications: users can update own (read_at/status only)"
  on public.notifications for update using (auth.uid() = user_id);
