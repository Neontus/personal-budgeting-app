-- =============================================================================
-- Migration: 00005_fix_function_idor.sql
-- Description: Fix IDOR vulnerabilities in SECURITY DEFINER functions by
--              enforcing auth.uid() ownership checks.
--
-- Security issues fixed:
--   MEDIUM — get_spending_by_category: any user could query another user's data
--   MEDIUM — recalculate_budget_spent: any user could query another user's budget
--   LOW    — seed_notification_preferences: any user could seed prefs for others
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- get_spending_by_category: override p_user_id with auth.uid() for
-- authenticated users. Service-role calls (auth.uid() IS NULL) still pass
-- the explicit p_user_id.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.get_spending_by_category(
  p_user_id    uuid,
  p_start_date date,
  p_end_date   date,
  p_account_id uuid default null
)
returns table (
  category_id   uuid,
  category_name text,
  category_color text,
  category_icon text,
  total_spent   numeric,
  transaction_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce ownership: authenticated users can only query their own data
  if auth.uid() is not null then
    p_user_id := auth.uid();
  end if;

  return query
  select
    c.id            as category_id,
    c.name          as category_name,
    c.color         as category_color,
    c.icon          as category_icon,
    sum(t.amount)   as total_spent,
    count(t.id)     as transaction_count
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.user_id = p_user_id
    and t.date between p_start_date and p_end_date
    and t.pending = false
    and t.amount > 0
    and (p_account_id is null or t.account_id = p_account_id)
  group by c.id, c.name, c.color, c.icon
  order by total_spent desc;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- recalculate_budget_spent: verify the budget belongs to the calling user.
-- Service-role calls bypass the check (auth.uid() IS NULL).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.recalculate_budget_spent(
  p_budget_id   uuid,
  p_period_start date,
  p_period_end  date
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_budget  public.budgets%rowtype;
  v_spent   numeric;
begin
  select * into v_budget from public.budgets where id = p_budget_id;

  if not found then
    raise exception 'Budget not found: %', p_budget_id;
  end if;

  -- Ownership check: authenticated users can only recalculate their own budgets
  if auth.uid() is not null and v_budget.user_id != auth.uid() then
    raise exception 'Access denied: budget does not belong to current user';
  end if;

  select coalesce(sum(t.amount), 0) into v_spent
  from public.transactions t
  where t.user_id = v_budget.user_id
    and t.date between p_period_start and p_period_end
    and t.pending = false
    and t.amount > 0   -- only count debits
    and (v_budget.category_id is null or t.category_id = v_budget.category_id)
    and (v_budget.account_id  is null or t.account_id  = v_budget.account_id);

  -- Upsert the budget_period row
  insert into public.budget_periods (budget_id, period_start, period_end, spent)
  values (p_budget_id, p_period_start, p_period_end, v_spent)
  on conflict (budget_id, period_start)
  do update set spent = excluded.spent;

  return v_spent;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- seed_notification_preferences: override p_user_id with auth.uid() for
-- authenticated users.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.seed_notification_preferences(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce ownership: authenticated users can only seed their own preferences
  if auth.uid() is not null then
    p_user_id := auth.uid();
  end if;

  insert into public.notification_preferences (user_id, event_type, push_enabled, telegram_enabled, in_app_enabled)
  values
    (p_user_id, 'budget_alert',          true,  false, true),
    (p_user_id, 'bill_due',              true,  false, true),
    (p_user_id, 'subscription_renewal',  true,  false, true),
    (p_user_id, 'weekly_report',         true,  false, true),
    (p_user_id, 'monthly_report',        true,  false, true)
  on conflict (user_id, event_type) do nothing;
end;
$$;
