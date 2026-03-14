-- =============================================================================
-- Migration: 00006_vault_uuid_constraint.sql
-- Description: Add CHECK constraint to linked_accounts.plaid_access_token to
--              ensure it stores a Vault secret UUID rather than a raw Plaid
--              access token (which would start with "access-" or "access_").
-- =============================================================================

alter table public.linked_accounts
add constraint plaid_access_token_is_vault_uuid
check (plaid_access_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
