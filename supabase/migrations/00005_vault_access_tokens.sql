-- =============================================================================
-- Migration: 00005_vault_access_tokens.sql
-- Description: Encrypt Plaid access tokens using Supabase Vault (pgsodium).
--
-- Before this migration:  linked_accounts.plaid_access_token = raw token string
-- After  this migration:  linked_accounts.plaid_access_token = vault secret UUID
--
-- IMPORTANT: Any existing linked_accounts rows were created in local dev with
-- raw tokens.  After running this migration those rows are unusable until the
-- account is re-linked (the raw token string is not a valid UUID).  Drop and
-- re-link all dev accounts after deploying.
-- =============================================================================

-- Supabase Cloud ships with supabase_vault enabled; this is a no-op if already on.
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- =============================================================================
-- Public wrapper functions
--
-- vault.* live in the vault schema and require the definer's privileges.
-- We expose thin SECURITY DEFINER wrappers in public so edge functions can call
-- them via .rpc() with the service_role client.
-- =============================================================================

-- Store a new secret; returns the vault UUID that must be saved in the DB.
CREATE OR REPLACE FUNCTION public.create_plaid_vault_secret(
  p_secret text,
  p_name   text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT vault.create_secret(p_secret, p_name);
$$;

-- Retrieve a decrypted secret by its vault UUID.
-- Returns NULL if the ID does not exist.
CREATE OR REPLACE FUNCTION public.get_plaid_vault_secret(p_secret_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;
$$;

-- =============================================================================
-- Trigger: clean up vault secret when a linked_account row is deleted
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_linked_account_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
  BEGIN
    -- plaid_access_token is a vault secret UUID after migration 00005.
    -- In local dev it may still be a raw token string; catch the cast failure
    -- gracefully so DELETE still succeeds.
    IF OLD.plaid_access_token IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = OLD.plaid_access_token::uuid;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Raw dev token — no vault entry to clean up.
    NULL;
  END;
  RETURN OLD;
END;
$$;

CREATE TRIGGER on_linked_account_deleted
  BEFORE DELETE ON public.linked_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_linked_account_delete();

-- Update column comment to reflect the new storage semantics.
COMMENT ON COLUMN public.linked_accounts.plaid_access_token IS
  'Vault secret UUID (references vault.secrets). Decrypted at runtime by '
  'service_role via get_plaid_vault_secret(). Never returned to clients. '
  'Stored via create_plaid_vault_secret() in plaid-exchange-token.';
