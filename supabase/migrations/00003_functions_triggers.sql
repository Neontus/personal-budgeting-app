-- =============================================================================
-- Migration: 00003_functions_triggers.sql
-- Description: Database functions, triggers, and scheduled jobs
-- =============================================================================

-- =============================================================================
-- TRIGGER: Auto-create profile on new auth.users row
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- TRIGGER: Auto-update updated_at timestamps
-- =============================================================================

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_accounts_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.handle_updated_at();

create trigger set_budgets_updated_at
  before update on public.budgets
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- FUNCTION: Recalculate budget period spent
-- Called by budget-check edge function after new transactions are synced
-- =============================================================================

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

-- =============================================================================
-- FUNCTION: Seed default notification preferences for a new user
-- Called after profile creation
-- =============================================================================

create or replace function public.seed_notification_preferences(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

-- Trigger: seed notification preferences when profile is created
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_notification_preferences(new.id);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- =============================================================================
-- FUNCTION: Get spending summary by category for a date range (for reports)
-- =============================================================================

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
