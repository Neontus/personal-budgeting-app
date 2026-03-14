import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../client';
import type { Transaction } from '@budget-tracker/shared';

interface UseTransactionsOptions {
  accountId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
}

/** Escape PostgREST filter metacharacters to prevent filter injection. */
function sanitizePostgRESTValue(value: string): string {
  return value.replace(/[\\,.()*%]/g, '\\$&');
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch transactions for the current user
// ─────────────────────────────────────────────────────────────────────────────

export function useTransactions(options: UseTransactionsOptions = {}) {
  return useQuery({
    queryKey: ['transactions', options],
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase
        .from('transactions')
        .select('*, category:categories(*)')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (options.accountId) query = query.eq('account_id', options.accountId);
      if (options.categoryId) query = query.eq('category_id', options.categoryId);
      if (options.startDate) query = query.gte('date', options.startDate);
      if (options.endDate) query = query.lte('date', options.endDate);
      if (options.search) {
        const safeSearch = sanitizePostgRESTValue(options.search);
        query = query.or(
          `merchant_name.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%`
        );
      }
      if (options.limit) query = query.limit(options.limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime subscription: auto-prepend new transactions
// ─────────────────────────────────────────────────────────────────────────────

export function useRealtimeTransactions(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (_payload) => {
          // Invalidate all transaction queries so they refetch with the new row
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation: recategorize a transaction (and optionally learn the rule)
// ─────────────────────────────────────────────────────────────────────────────

export function useRecategorizeTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transactionId,
      categoryId,
      merchantName,
      learnRule = true,
    }: {
      transactionId: string;
      categoryId: string;
      merchantName: string | null;
      learnRule?: boolean;
    }) => {
      // 1. Update the transaction
      const { error: txError } = await supabase
        .from('transactions')
        .update({ category_id: categoryId, auto_categorized: false })
        .eq('id', transactionId);
      if (txError) throw txError;

      // 2. Upsert category rule so future transactions with same merchant auto-categorize
      if (learnRule && merchantName) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const { error: ruleError } = await supabase
          .from('category_rules')
          .upsert(
            { user_id: user.id, merchant_pattern: merchantName, category_id: categoryId },
            { onConflict: 'user_id,merchant_pattern' }
          );
        if (ruleError) throw ruleError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutation: update transaction notes
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateTransactionNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ transactionId, notes }: { transactionId: string; notes: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ notes })
        .eq('id', transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
