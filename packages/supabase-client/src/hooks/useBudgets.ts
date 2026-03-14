import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../client';
import { toBudgetWithProgress, getCurrentPeriod } from '@budget-tracker/shared';
import type { Budget, BudgetWithProgress, BudgetPeriodType } from '@budget-tracker/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Fetch all active budgets with current period progress
// ─────────────────────────────────────────────────────────────────────────────

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: async (): Promise<BudgetWithProgress[]> => {
      const { data: budgets, error } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!budgets || budgets.length === 0) return [];

      const today = new Date();

      // Fetch current budget periods for all active budgets
      const budgetIds = budgets.map((b) => b.id);
      const { data: periods, error: periodError } = await supabase
        .from('budget_periods')
        .select('*')
        .in('budget_id', budgetIds);

      if (periodError) throw periodError;

      // Map budget_id → current period
      const periodMap = new Map<string, (typeof periods)[number]>();
      for (const budget of budgets as Budget[]) {
        const { start } = getCurrentPeriod(budget, today);
        const period = (periods ?? []).find(
          (p) => p.budget_id === budget.id && p.period_start === start
        );
        if (period) periodMap.set(budget.id, period);
      }

      return (budgets as Budget[]).map((b) =>
        toBudgetWithProgress(b, periodMap.get(b.id) ?? null)
      );
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create budget
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category_id?: string;
      amount: number;
      period_type: BudgetPeriodType;
      period_anchor?: number;
      account_id?: string;
      alert_thresholds?: number[];
    }) => {
      const { error } = await supabase.from('budgets').insert({
        ...input,
        alert_thresholds: input.alert_thresholds ?? [50, 80, 100],
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Update budget
// ─────────────────────────────────────────────────────────────────────────────

export function useUpdateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Budget> & { id: string }) => {
      const { error } = await supabase.from('budgets').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete (deactivate) budget
// ─────────────────────────────────────────────────────────────────────────────

export function useDeleteBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (budgetId: string) => {
      const { error } = await supabase
        .from('budgets')
        .update({ is_active: false })
        .eq('id', budgetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}
