/**
 * Edge Function: send-notification
 *
 * Unified notification dispatcher. Sends to:
 * - in_app: inserts a row into the notifications table (Supabase Realtime picks it up)
 * - push:   Expo Push Notifications API (free, no per-message cost)
 * - telegram: Telegram Bot API (free, no per-message cost)
 *
 * Respects per-user notification_preferences per event_type.
 *
 * POST /functions/v1/send-notification
 * Body: { user_id, type, title, body, data? }
 * Auth: INTERNAL_API_SECRET — must NOT be called directly from the client.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  isInternalRequest,
  isValidUUID,
  unauthorizedResponse,
  securityHeaders,
} from '../_shared/security.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';
const EXPO_PUSH_URL   = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: securityHeaders });
  }

  // ── Internal auth guard ───────────────────────────────────────────────────
  if (!isInternalRequest(req)) {
    console.error('[send-notification] SECURITY: Rejected unauthorized request');
    return unauthorizedResponse();
  }
  // ─────────────────────────────────────────────────────────────────────────

  const rawBody = await req.json() as {
    user_id: unknown;
    type: unknown;
    title: unknown;
    body: unknown;
    data?: Record<string, unknown>;
  };

  if (!isValidUUID(rawBody.user_id)) {
    return new Response(JSON.stringify({ error: 'Invalid user_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...securityHeaders },
    });
  }

  const user_id = rawBody.user_id;
  const type    = rawBody.type    as string;
  const title   = rawBody.title   as string;
  const body    = rawBody.body    as string;
  const data    = rawBody.data;

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch user profile (push token + telegram chat id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('push_token, telegram_chat_id, telegram_enabled')
    .eq('id', user_id)
    .single();

  // Fetch notification preferences for this event type
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('push_enabled, telegram_enabled, in_app_enabled')
    .eq('user_id', user_id)
    .eq('event_type', type)
    .single();

  const pushEnabled     = prefs?.push_enabled     ?? true;
  const telegramEnabled = prefs?.telegram_enabled  ?? false;
  const inAppEnabled    = prefs?.in_app_enabled    ?? true;

  const promises: Promise<unknown>[] = [];

  // ─── In-App ────────────────────────────────────────────────────────────────
  if (inAppEnabled) {
    promises.push(
      supabase.from('notifications').insert({
        user_id,
        type,
        title,
        body,
        data: data ?? null,
        channel: 'in_app',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
    );
  }

  // ─── Expo Push ─────────────────────────────────────────────────────────────
  if (pushEnabled && profile?.push_token) {
    promises.push(
      (async () => {
        const pushResp = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
          },
          body: JSON.stringify({
            to: profile.push_token,
            title,
            body,
            data: data ?? {},
            sound: 'default',
            priority: 'high',
          }),
        });

        const pushResult = await pushResp.json();
        const status = pushResult?.data?.status === 'ok' ? 'sent' : 'failed';

        await supabase.from('notifications').insert({
          user_id,
          type,
          title,
          body,
          data: data ?? null,
          channel: 'push',
          status,
          sent_at: new Date().toISOString(),
        });
      })()
    );
  }

  // ─── Telegram ──────────────────────────────────────────────────────────────
  if (telegramEnabled && profile?.telegram_enabled && profile?.telegram_chat_id && TELEGRAM_BOT_TOKEN) {
    promises.push(
      (async () => {
        const message = `*${escapeMarkdown(title)}*\n${escapeMarkdown(body)}`;
        const telegramResp = await fetch(
          `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: profile.telegram_chat_id,
              text: message,
              parse_mode: 'MarkdownV2',
            }),
          }
        );

        const telegramResult = await telegramResp.json();
        const status = telegramResult.ok ? 'sent' : 'failed';

        await supabase.from('notifications').insert({
          user_id,
          type,
          title,
          body,
          data: data ?? null,
          channel: 'telegram',
          status,
          sent_at: new Date().toISOString(),
        });
      })()
    );
  }

  await Promise.allSettled(promises);

  console.log(`[send-notification] Dispatched "${type}" to user ${user_id}`);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', ...securityHeaders },
  });
});

/** Escape special characters for Telegram MarkdownV2 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}
