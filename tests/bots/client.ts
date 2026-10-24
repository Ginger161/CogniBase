import { config } from 'dotenv';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

config({ path: '.env.local', quiet: true });
config({ path: '.env.test', quiet: true });

export const BASE_URL = process.env.BASE_URL || 'http://localhost:3111';

export type Reply = { status: number; json: any; text: string; headers: Headers };

export type Bot = {
  name: string;
  email: string;
  userId: string;
  supabase: SupabaseClient;
  /** Call an app route as this signed-in user. */
  call: (method: string, path: string, body?: unknown, init?: { raw?: boolean }) => Promise<Reply>;
};

/** Sign in like a browser does: the session lives in cookies the app's server code reads. */
export async function signIn(name: string, email: string, password: string): Promise<Bot> {
  const jar = new Map<string, string>();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`${name} could not sign in: ${error?.message}`);

  const call: Bot['call'] = async (method, path, body, init) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(BASE_URL + path, {
      method,
      redirect: 'manual',
      headers: { cookie, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body === undefined ? undefined : typeof body === 'string' && init?.raw ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* not JSON (stream, HTML) */
    }
    return { status: res.status, json, text, headers: res.headers };
  };

  return { name, email, userId: data.user.id, supabase: supabase as unknown as SupabaseClient, call };
}

/** Anonymous call (no cookies). */
export async function anon(method: string, path: string, body?: unknown): Promise<Reply> {
  const res = await fetch(BASE_URL + path, {
    method,
    redirect: 'manual',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  return { status: res.status, json, text, headers: res.headers };
}

/** Parse a UI-message / progress stream (server-sent events) into its events. */
export function sseEvents(text: string): any[] {
  return text
    .split('\n')
    .filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]')
    .map((l) => {
      try {
        return JSON.parse(l.slice(6));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function chatText(text: string): { answer: string; tools: string[]; error: string } {
  const events = sseEvents(text);
  return {
    error: events.filter((e) => e.type === 'error').map((e) => e.errorText).join(' '),
    answer: events.filter((e) => e.type === 'text-delta').map((e) => e.delta).join(''),
    tools: [...new Set(events.filter((e) => String(e.type).startsWith('tool-input')).map((e) => e.toolName).filter(Boolean))],
  };
}
