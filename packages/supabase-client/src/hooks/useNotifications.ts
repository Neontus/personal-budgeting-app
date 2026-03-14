import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../client';
import type { AppNotification } from '@budget-tracker/shared';

// ─────────────────────────────────────────────────────────────────────────────
// Fetch in-app notifications
// ─────────────────────────────────────────────────────────────────────────────

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: async (): Promise<AppNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('channel', 'in_app')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Realtime: push new in-app notifications to the query cache
// ─────────────────────────────────────────────────────────────────────────────

export function useRealtimeNotifications(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (_payload) => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Unread count (for badge)
// ─────────────────────────────────────────────────────────────────────────────

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('channel', 'in_app')
        .is('read_at', null);

      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mark notification as read
// ─────────────────────────────────────────────────────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString(), status: 'read' })
        .eq('id', notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
