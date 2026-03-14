-- =============================================================================
-- Migration: 00004_security_hardening.sql
-- Description: Security hardening pass — fixes RLS gaps, SECURITY DEFINER
--              privilege escalation, and column-level exposure of secrets.
-- =============================================================================

-- =============================================================================
-- FIX 1: Revoke plaid_access_token column from the authenticated role.
--
-- The SELECT policy on linked_accounts currently returns every column, including
-- the raw Plaid access token.  A Plaid access_token grants API-level read access
-- to the user's real bank account data — it must never leave the server.
--
-- Column-level REVOKE lets authenticated users still SELECT other columns (name,
-- status, institution_name, etc.) while the token column returns NULL.
-- The service_role bypasses column-level grants, so edge functions are unaffected.
-- =============================================================================

REVOKE SELECT (plaid_access_token) ON public.linked_accounts FROM authenticated;

-- While we're here, also hide the raw cursor (Plaid sync state — no client need):
REVOKE SELECT (cursor) ON public.linked_accounts FROM authenticated;

-- =============================================================================
-- FIX 2: Add WITH CHECK to every UPDATE policy.
--
-- Without WITH CHECK, a user can UPDATE their own row and set user_id to another
-- user's UUID, transferring the row out from under RLS.  WITH CHECK re-evaluates
-- the predicate against the *new* row values after the update is applied.
-- =============================================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles: users can update own profile" ON public.profiles;
CREATE POLICY "profiles: users can update own profile"
  ON public.profiles FOR UPDATE
  USING     (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── transactions ─────────────────────────────────────────────────────────────
-- Users may update category, notes, and auto_categorized only.
-- WITH CHECK prevents changing user_id or account_id to another user's values.
DROP POLICY IF EXISTS "transactions: users can update own" ON public.transactions;
CREATE POLICY "transactions: users can update own"
  ON public.transactions FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── category_rules ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "category_rules: users can update own" ON public.category_rules;
CREATE POLICY "category_rules: users can update own"
  ON public.category_rules FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── budgets ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "budgets: users can update own" ON public.budgets;
CREATE POLICY "budgets: users can update own"
  ON public.budgets FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── notifications ─────────────────────────────────────────────────────────────
-- The only legitimate client update is marking a notification as read.
-- WITH CHECK ensures the user_id cannot be changed.
DROP POLICY IF EXISTS "notifications: users can update own (mark read)" ON public.notifications;
CREATE POLICY "notifications: users can update own (mark read)"
  ON public.notifications FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── notification_preferences ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "notification_preferences: users can update own" ON public.notification_preferences;
CREATE POLICY "notification_preferences: users can update own"
  ON public.notification_preferences FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- FIX 3: Add missing action policies.
--
-- linked_accounts:  Users must be able to DELETE their own linked account (unlink
--                   a card).  No UPDATE — that stays server-side only.
-- accounts:         Users need UPDATE to set bill_due_date / statement_close_date
--                   which they configure manually in the app.
-- =============================================================================

CREATE POLICY "linked_accounts: users can delete own"
  ON public.linked_accounts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "accounts: users can update own"
  ON public.accounts FOR UPDATE
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- FIX 4: Fix SECURITY DEFINER functions that accept arbitrary user IDs.
--
-- Both get_spending_by_category and recalculate_budget_spent run with elevated
-- privileges (SECURITY DEFINER) and accept caller-supplied UUIDs with no
-- ownership check.  A client can pass any user_id / budget_id and read or mutate
-- another user's financial data.
--
-- Fix: when the caller is an authenticated user (auth.uid() IS NOT NULL), enforce
-- that they can only operate on their own data.  Service-role calls (edge
-- functions) have auth.uid() = NULL and are allowed to pass any ID.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_budget_spent(
  p_budget_id    uuid,
  p_period_start date,
  p_period_end   date
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_budget  public.budgets%rowtype;
  v_spent   numeric;
BEGIN
  SELECT * INTO v_budget FROM public.budgets WHERE id = p_budget_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget not found';  -- intentionally vague for security
  END IF;

  -- ── SECURITY: enforce caller ownership ────────────────────────────────────
  -- auth.uid() is NULL when called via service_role (edge functions) — allow.
  -- auth.uid() is set when called by an authenticated client — must match.
  IF auth.uid() IS NOT NULL AND v_budget.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

  SELECT COALESCE(SUM(t.amount), 0) INTO v_spent
  FROM public.transactions t
  WHERE t.user_id = v_budget.user_id
    AND t.date    BETWEEN p_period_start AND p_period_end
    AND t.pending = false
    AND t.amount  > 0
    AND (v_budget.category_id IS NULL OR t.category_id = v_budget.category_id)
    AND (v_budget.account_id  IS NULL OR t.account_id  = v_budget.account_id);

  INSERT INTO public.budget_periods (budget_id, period_start, period_end, spent)
  VALUES (p_budget_id, p_period_start, p_period_end, v_spent)
  ON CONFLICT (budget_id, period_start)
  DO UPDATE SET spent = EXCLUDED.spent;

  RETURN v_spent;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_spending_by_category(
  p_user_id    uuid,
  p_start_date date,
  p_end_date   date,
  p_account_id uuid DEFAULT NULL
)
RETURNS TABLE (
  category_id        uuid,
  category_name      text,
  category_color     text,
  category_icon      text,
  total_spent        numeric,
  transaction_count  bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ── SECURITY: enforce caller ownership ────────────────────────────────────
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  -- ─────────────────────────────────────────────────────────────────────────

  RETURN QUERY
  SELECT
    c.id           AS category_id,
    c.name         AS category_name,
    c.color        AS category_color,
    c.icon         AS category_icon,
    SUM(t.amount)  AS total_spent,
    COUNT(t.id)    AS transaction_count
  FROM public.transactions t
  LEFT JOIN public.categories c ON c.id = t.category_id
  WHERE t.user_id = p_user_id
    AND t.date    BETWEEN p_start_date AND p_end_date
    AND t.pending = false
    AND t.amount  > 0
    AND (p_account_id IS NULL OR t.account_id = p_account_id)
  GROUP BY c.id, c.name, c.color, c.icon
  ORDER BY total_spent DESC;
END;
$$;

-- =============================================================================
-- FIX 5: Add SET search_path to handle_updated_at.
--
-- Every other SECURITY DEFINER function explicitly pins search_path = public.
-- handle_updated_at was the only one missing this, leaving it vulnerable to
-- search_path injection if the public schema search order is ever changed.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- FIX 6: Length constraints on free-text columns.
--
-- Unbounded text inputs can be used for storage exhaustion or injection
-- payloads.  These limits are generous enough for real use but cap abuse.
-- =============================================================================

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 100),
  ADD CONSTRAINT profiles_push_token_length   CHECK (char_length(push_token)   <= 200),
  ADD CONSTRAINT profiles_telegram_chat_length CHECK (char_length(telegram_chat_id) <= 50);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_notes_length        CHECK (char_length(notes) <= 1000),
  ADD CONSTRAINT transactions_merchant_name_length CHECK (char_length(merchant_name) <= 200),
  ADD CONSTRAINT transactions_name_length         CHECK (char_length(name) <= 200);

ALTER TABLE public.category_rules
  ADD CONSTRAINT category_rules_pattern_length CHECK (char_length(merchant_pattern) BETWEEN 1 AND 200);

ALTER TABLE public.categories
  ADD CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 1 AND 100);

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_title_length CHECK (char_length(title) <= 200),
  ADD CONSTRAINT notifications_body_length  CHECK (char_length(body)  <= 1000);

-- =============================================================================
-- FIX 7: Disable signup after your own account is created.
--
-- For a personal app, you do not want strangers signing up on your Supabase
-- project.  After running your first migration and creating your account, run
-- this to close off new registrations:
--
--   UPDATE auth.config SET enable_signup = false;
--
-- Or set it in the Supabase dashboard under Authentication → Settings →
-- "Disable email signups".
--
-- Reminder kept as a comment — do NOT run this now or you won't be able to
-- create your first account.
-- =============================================================================
