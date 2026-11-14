/**
 * Throwaway accounts for the bots. Every one has an email starting with `cb-test-` so cleanup can never touch a real user.
 *
 *   npx tsx tests/bots/accounts.ts create   -> makes the accounts, writes tests/bots/reports/accounts.json (git-ignored)
 *   npx tsx tests/bots/accounts.ts delete   -> removes every cb-test-* account and its app data
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';

config({ path: '.env.local', quiet: true });
config({ path: '.env.test', quiet: true });

export const PREFIX = 'cb-test-';
export const ROLES = ['student-a', 'student-b', 'free-student', 'moderator', 'owner'] as const;
export type Role = (typeof ROLES)[number];
export type Creds = Record<Role, { email: string; password: string }>;
export const CREDS_FILE = path.join(process.cwd(), 'tests', 'bots', 'reports', 'accounts.json');
export const emailFor = (role: Role) => `${PREFIX}${role}@example.com`;

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

export async function removeTestAccounts(): Promise<number> {
  const sb = admin();
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  let removed = 0;
  try {
    // App rows first (they cascade), only for addresses that start with the test prefix.
    await db.query(`delete from "User" where email like $1`, [`${PREFIX}%`]);
    for (let page = 1; ; page++) {
      const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) {
        if (u.email?.startsWith(PREFIX)) {
          const r = await sb.auth.admin.deleteUser(u.id);
          if (r.error) throw r.error;
          removed++;
        }
      }
      if (data.users.length < 200) break;
    }
  } finally {
    await db.end();
  }
  return removed;
}

export async function createTestAccounts(): Promise<Creds> {
  await removeTestAccounts();
  const sb = admin();
  const creds = {} as Creds;
  for (const role of ROLES) {
    const email = emailFor(role);
    const password = crypto.randomBytes(12).toString('base64url') + 'aA1!';
    const { error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw new Error(`Could not create ${email}: ${error.message}`);
    creds[role] = { email, password };
  }
  fs.mkdirSync(path.dirname(CREDS_FILE), { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(creds, null, 2));
  return creds;
}

/** Put a test account on a plan (month-long expiry). Only ever touches addresses with the test prefix. */
export async function setPlan(email: string, tier: 'FREE' | 'PRO' | 'X'): Promise<void> {
  if (!email.startsWith(PREFIX)) throw new Error('setPlan only works on test accounts');
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    const expires = tier === 'FREE' ? null : new Date(Date.now() + 30 * 86400_000);
    const r = await db.query(`update "User" set "planTier"=$1, "planExpiresAt"=$2 where email=$3`, [tier, expires, email]);
    if (r.rowCount !== 1) throw new Error(`No app user for ${email} yet (sign in and call the app once first)`);
  } finally {
    await db.end();
  }
}

export function loadCreds(): Creds {
  return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')) as Creds;
}

if (process.argv[1]?.endsWith('accounts.ts')) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === 'create') {
      const c = await createTestAccounts();
      console.log(`Created ${Object.keys(c).length} accounts: ${ROLES.map(emailFor).join(', ')}`);
    } else if (cmd === 'delete') {
      console.log(`Removed ${await removeTestAccounts()} test accounts.`);
    } else {
      console.log('usage: accounts.ts create | delete');
    }
  })().catch((e) => {
    console.error('accounts failed:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
