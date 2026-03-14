import { useQuery } from '@tanstack/react-query';
import { supabase } from '../client';
import type { Account, LinkedAccount } from '@budget-tracker/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all financial accounts (with linked account info)
// ─────────────────────────────────────────────────────────────────────────────

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async (): Promise<(Account & { linked_account: LinkedAccount })[]> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*, linked_account:linked_accounts(*)')
        .order('name', { ascending: true });

      if (error) throw error;
      return (data ?? []) as (Account & { linked_account: LinkedAccount })[];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch a single account by id
// ─────────────────────────────────────────────────────────────────────────────

export function useAccount(accountId: string | undefined) {
  return useQuery({
    queryKey: ['accounts', accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<Account | null> => {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('id', accountId!)
        .single();

      if (error) throw error;
      return data as Account;
    },
  });
}
