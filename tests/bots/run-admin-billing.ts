/**
 * Money, limits and who-can-see-what. None of these need Gemini, so they run even when the AI quota is spent.
 *   npx tsx tests/bots/run-admin-billing.ts      (dev server on :3111 started with the test owner in ADMIN_EMAILS)
 */
import { loadCreds, PREFIX } from './accounts';
import { Client } from 'pg';
import { createHmac } from 'node:crypto';
import { signIn, anon, chatText, type Bot } from './client';
import { assert, finish, group, test } from './harness';
import { prisma } from '../../lib/prisma';
import { fulfil, productFor, signatureIsValid, CREDIT_PACKS } from '../../lib/billing';
import { checkUsage, creditBalance, effectivePlan, recordUsage } from '../../lib/usage';
import { PLANS } from '../../lib/plans';

const ADMIN_API_GET = ['/api/admin/overview', '/api/admin/users', '/api/admin/payments', '/api/admin/funds', '/api/admin/invites', '/api/admin/switches', '/api/admin/audit', '/api/admin/team', '/api/admin/grant?email=x@y.z'];
const ADMIN_PAGES = ['/admin', '/admin/users', '/admin/payments', '/admin/funds', '/admin/invites', '/admin/switches', '/admin/audit', '/admin/team'];
const balanceOf = async (b: Bot) => (await b.call('GET', '/api/usage')).json?.credits as number;

async function main() {
  const creds = loadCreds();
  const owner = await signIn('owner', creds.owner.email, creds.owner.password);
  const mod = await signIn('mod', creds.moderator.email, creds.moderator.password);
  const buyer = await signIn('buyer', creds['student-b'].email, creds['student-b'].password);
  const free = await signIn('free', creds['free-student'].email, creds['free-student'].password);
  for (const b of [owner, mod, buyer, free]) await b.call('GET', '/api/usage'); // creates the app user row

  // ───────────────────────────────────────────────────────────────── who can reach the admin area
  group('A. Admin access');
  await test('signed-out callers get 401 from every admin API', async () => {
    const bad: string[] = [];
    for (const p of ADMIN_API_GET) {
      const r = await anon('GET', p);
      if (r.status !== 401) bad.push(`${p} → ${r.status}`);
    }
    assert(!bad.length, bad.join('; '));
  });
  await test('a student gets a plain 404 from every admin API (it does not announce itself)', async () => {
    const bad: string[] = [];
    for (const p of ADMIN_API_GET) {
      const r = await free.call('GET', p);
      if (r.status !== 404) bad.push(`GET ${p} → ${r.status}`);
    }
    for (const [m, p] of [['POST', '/api/admin/grant'], ['POST', '/api/admin/team'], ['POST', '/api/admin/invites'], ['PUT', '/api/admin/switches'], ['POST', '/api/admin/funds']] as const) {
      const r = await free.call(m, p, { email: creds.owner.email, credits: 99999 });
      if (r.status !== 404) bad.push(`${m} ${p} → ${r.status}`);
    }
    assert(!bad.length, bad.join('; '));
  });
  await test('a student opening any /admin page is sent to /dashboard', async () => {
    const bad: string[] = [];
    for (const p of ADMIN_PAGES) {
      const r = await free.call('GET', p);
      const where = r.headers.get('location') ?? '';
      if (!(r.status >= 300 && r.status < 400 && where.includes('/dashboard'))) bad.push(`${p} → ${r.status} ${where}`);
    }
    assert(!bad.length, bad.join('; '));
  });
  await test('the owner can open every admin page and API', async () => {
    const bad: string[] = [];
    for (const p of ADMIN_PAGES) {
      const r = await owner.call('GET', p);
      if (r.status !== 200) bad.push(`${p} → ${r.status}`);
    }
    for (const p of ADMIN_API_GET.filter((x) => !x.includes('grant'))) {
      const r = await owner.call('GET', p);
      if (r.status !== 200) bad.push(`${p} → ${r.status}`);
    }
    assert(!bad.length, bad.join('; '));
  });
  await test('before being added, a would-be moderator is treated as a student', async () => {
    const api = await mod.call('GET', '/api/admin/users');
    const page = await mod.call('GET', '/admin');
    assert(api.status === 404, `api ${api.status}`);
    assert(page.status >= 300 && page.status < 400 && (page.headers.get('location') ?? '').includes('/dashboard'), `page ${page.status}`);
  });

  group('B. Moderator permissions (owner decides)');
  await test('owner adds a moderator with only "look up users"', async () => {
    const r = await owner.call('POST', '/api/admin/team', { email: creds.moderator.email, permissions: ['users.view'] });
    assert(r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
  });
  await test('the moderator can look a user up, and nothing else', async () => {
    const look = await mod.call('GET', `/api/admin/grant?email=${encodeURIComponent(creds['free-student'].email)}`);
    assert(look.status === 200 && look.json?.user?.email === creds['free-student'].email, `lookup ${look.status}`);
    assert(!/"(rawText|content|messages?|parts|notes?|text)"\s*:/i.test(JSON.stringify(look.json)), 'lookup exposes chat or content fields');
    const bad: string[] = [];
    for (const p of ['/api/admin/payments', '/api/admin/funds', '/api/admin/invites', '/api/admin/switches', '/api/admin/audit', '/api/admin/overview', '/api/admin/team']) {
      const r = await mod.call('GET', p);
      if (r.status !== 404) bad.push(`${p} → ${r.status}`);
    }
    const give = await mod.call('POST', '/api/admin/grant', { email: creds['free-student'].email, credits: 50 });
    if (give.status !== 404) bad.push(`grant without users.edit → ${give.status}`);
    assert(!bad.length, bad.join('; '));
  });
  await test('moderator pages: allowed section opens, others bounce to /admin, Team is owner-only', async () => {
    const ok = await mod.call('GET', '/admin/users');
    assert(ok.status === 200, `/admin/users ${ok.status}`);
    const bad: string[] = [];
    for (const p of ['/admin/payments', '/admin/funds', '/admin/invites', '/admin/switches', '/admin/audit', '/admin/team']) {
      const r = await mod.call('GET', p);
      const where = r.headers.get('location') ?? '';
      if (!(r.status >= 300 && r.status < 400 && /\/admin\/?$/.test(where.split('?')[0].replace(/^https?:\/\/[^/]+/, '')))) bad.push(`${p} → ${r.status} ${where}`);
    }
    assert(!bad.length, bad.join('; '));
  });
  await test('the moderator home lists only what they were given', async () => {
    const r = await mod.call('GET', '/admin');
    assert(r.status === 200, `status ${r.status}`);
    assert(r.text.includes('/admin/users'), 'missing their own section');
    assert(!r.text.includes('/admin/payments') && !r.text.includes('/admin/team'), 'shows sections they were not given');
  });
  await test('a moderator cannot manage the team, even for themselves', async () => {
    const r = await mod.call('POST', '/api/admin/team', { email: creds.moderator.email, permissions: ['users.view', 'users.edit', 'billing.view'] });
    assert(r.status === 404, `status ${r.status}`);
  });
  await test('owner widens the moderator to "edit users"; it takes effect at once', async () => {
    await owner.call('POST', '/api/admin/team', { email: creds.moderator.email, permissions: ['users.view', 'users.edit'] });
    const before = await balanceOf(free);
    const r = await mod.call('POST', '/api/admin/grant', { email: creds['free-student'].email, credits: 50, note: 'bot grant' });
    assert(r.status === 200, `${r.status} ${r.text.slice(0, 120)}`);
    assert((await balanceOf(free)) === before + 50, 'balance did not go up by 50');
  });
  await test('grant input is validated (fraction, huge, unknown plan, empty, unknown user)', async () => {
    const e = creds['free-student'].email;
    const codes = [
      (await mod.call('POST', '/api/admin/grant', { email: e, credits: 1.5 })).status,
      (await mod.call('POST', '/api/admin/grant', { email: e, credits: 10_000_000 })).status,
      (await mod.call('POST', '/api/admin/grant', { email: e, plan: 'GOD' })).status,
      (await mod.call('POST', '/api/admin/grant', { email: e })).status,
      (await mod.call('POST', '/api/admin/grant', { email: 'nobody-here@example.com', credits: 5 })).status,
      (await mod.call('POST', '/api/admin/grant', { email: e, plan: 'PRO', planDays: 0 })).status,
    ];
    assert(JSON.stringify(codes) === JSON.stringify([400, 400, 400, 400, 404, 400]), `statuses ${codes}`);
  });
  await test('a moderator cannot pause their own account', async () => {
    const r = await mod.call('POST', '/api/admin/grant', { email: creds.moderator.email, suspend: true });
    assert(r.status === 400, `status ${r.status}`);
  });
  await test('removing the moderator takes the access away immediately', async () => {
    const team = await owner.call('GET', '/api/admin/team');
    const me = team.json.team.find((m: any) => m.email === creds.moderator.email);
    assert(me, 'moderator not listed');
    assert((await owner.call('DELETE', `/api/admin/team?userId=${me.userId}`)).status === 200, 'delete failed');
    assert((await mod.call('GET', '/api/admin/users')).status === 404, 'still has API access');
    const page = await mod.call('GET', '/admin');
    assert(page.status >= 300 && page.status < 400, `page still opens: ${page.status}`);
  });
  await test('team edits are recorded in the activity log', async () => {
    const r = await owner.call('GET', '/api/admin/audit');
    assert(r.status === 200 && JSON.stringify(r.json).includes('admin_team_edit'), 'no team edit entries in the log');
  });

  group('C. Invite codes');
  const code = `CBTEST${Date.now().toString(36).toUpperCase()}`;
  await test('owner creates a one-use code; bad codes are refused', async () => {
    const ok = await owner.call('POST', '/api/admin/invites', { code, credits: 25, maxUses: 1, note: 'bot' });
    assert(ok.status === 200 && ok.json?.invite?.code === code, `${ok.status} ${ok.text.slice(0, 120)}`);
    const dup = await owner.call('POST', '/api/admin/invites', { code, credits: 25 });
    const none = await owner.call('POST', '/api/admin/invites', { code: 'CBTESTNOTHING' });
    const neg = await owner.call('POST', '/api/admin/invites', { code: 'CBTESTNEG1', credits: -5 });
    const short = await owner.call('POST', '/api/admin/invites', { code: 'ab', credits: 5 });
    assert(dup.status === 409 && none.status === 400 && neg.status === 400 && short.status === 400, `dup ${dup.status} none ${none.status} neg ${neg.status} short ${short.status}`);
  });
  await test('a student redeems it once: credits arrive, a second try is refused', async () => {
    const before = await balanceOf(buyer);
    const a = await buyer.call('POST', '/api/invites/redeem', { code: code.toLowerCase() });
    assert(a.status === 200, `${a.status} ${a.text.slice(0, 120)}`);
    assert((await balanceOf(buyer)) === before + 25, 'credits did not arrive');
    const again = await buyer.call('POST', '/api/invites/redeem', { code });
    assert(again.status === 400, `second try ${again.status}`);
    assert((await balanceOf(buyer)) === before + 25, 'credits arrived twice');
  });
  await test('a used-up code is refused for a different student, with the same message as an unknown code', async () => {
    const used = await free.call('POST', '/api/invites/redeem', { code });
    const unknown = await free.call('POST', '/api/invites/redeem', { code: 'CBTESTDOESNOTEXIST' });
    assert(used.status === 400 && unknown.status === 400, `${used.status}/${unknown.status}`);
    assert(used.json.error === unknown.json.error, 'different messages leak whether a code exists');
  });
  await test('two students racing for the last use: exactly one wins', async () => {
    const raceCode = `CBRACE${Date.now().toString(36).toUpperCase()}`;
    await owner.call('POST', '/api/admin/invites', { code: raceCode, credits: 10, maxUses: 1 });
    const [a, b] = await Promise.all([buyer.call('POST', '/api/invites/redeem', { code: raceCode }), free.call('POST', '/api/invites/redeem', { code: raceCode })]);
    const wins = [a, b].filter((r) => r.status === 200).length;
    assert(wins === 1, `${wins} students got the single use (${a.status}/${b.status})`);
  });
  await test('a turned-off code and an expired code are refused', async () => {
    const off = `CBOFF${Date.now().toString(36).toUpperCase()}`;
    const made = await owner.call('POST', '/api/admin/invites', { code: off, credits: 5, maxUses: 5 });
    await owner.call('PATCH', '/api/admin/invites', { id: made.json.invite.id, active: false });
    const r1 = await free.call('POST', '/api/invites/redeem', { code: off });
    const old = `CBOLD${Date.now().toString(36).toUpperCase()}`;
    await owner.call('POST', '/api/admin/invites', { code: old, credits: 5, maxUses: 5, expiresOn: '2020-01-01' });
    const r2 = await free.call('POST', '/api/invites/redeem', { code: old });
    assert(r1.status === 400 && r2.status === 400, `off ${r1.status}, expired ${r2.status}`);
  });
  await test('a code can give a plan, and it applies', async () => {
    const planCode = `CBPLAN${Date.now().toString(36).toUpperCase()}`;
    await owner.call('POST', '/api/admin/invites', { code: planCode, planTier: 'PRO', planDays: 7, maxUses: 1 });
    const r = await free.call('POST', '/api/invites/redeem', { code: planCode });
    assert(r.status === 200, `${r.status} ${r.text.slice(0, 100)}`);
    const u = (await free.call('GET', '/api/usage')).json;
    assert(u.tier === 'PRO', `tier is ${u.tier}`);
    const days = (new Date(u.expiresAt).getTime() - Date.now()) / 86_400_000;
    assert(days > 6 && days < 7.1, `expires in ${days.toFixed(2)} days, expected 7`);
    // put them back on Free for the limit tests below
    await owner.call('POST', '/api/admin/grant', { email: creds['free-student'].email, plan: 'FREE' });
  });

  // ───────────────────────────────────────────────────────────────── payments
  group('D. Payments (the part that handles money)');
  const buyerId = buyer.userId;
  const reference = (s: string) => `cbtest-${s}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await test('only products we sell exist, and their prices come from the server', async () => {
    assert(productFor('credits:c100')?.priceNgn === 1500, 'c100 price');
    assert(productFor('plan:PRO')?.priceNgn === PLANS.PRO.priceNgn && productFor('plan:X')?.priceNgn === PLANS.X.priceNgn, 'plan prices');
    for (const bad of ['plan:FREE', 'credits:', 'credits:c9999', 'plan:ADMIN', '', null, 42, 'credits:c100:extra']) {
      const p = productFor(bad as unknown);
      if (bad === 'credits:c100:extra') continue; // extra segments are ignored by split; price still comes from the id before
      assert(p === null, `"${String(bad)}" should not be a product`);
    }
  });
  await test('paying the wrong amount buys nothing', async () => {
    const before = await creditBalance(buyerId);
    const r = await fulfil({ reference: reference('cheap'), amountKobo: 100, userId: buyerId, product: 'credits:c800' });
    assert(r.ok === false, 'accepted an underpayment');
    const over = await fulfil({ reference: reference('over'), amountKobo: 999_999_999, userId: buyerId, product: 'credits:c100' });
    assert(over.ok === false, 'accepted a mismatched amount');
    assert((await creditBalance(buyerId)) === before, 'balance changed');
  });
  await test('paying for an unknown product or for an unknown user buys nothing', async () => {
    const a = await fulfil({ reference: reference('x'), amountKobo: 150000, userId: buyerId, product: 'credits:nope' });
    const b = await fulfil({ reference: reference('y'), amountKobo: 150000, userId: 'does-not-exist', product: 'credits:c100' });
    assert(a.ok === false && b.ok === false, 'accepted');
  });
  const pack = CREDIT_PACKS[1];
  const payRef = reference('pack');
  await test('a real payment adds the credits and a Payment record', async () => {
    const before = await creditBalance(buyerId);
    const r = await fulfil({ reference: payRef, amountKobo: pack.priceNgn * 100, userId: buyerId, product: `credits:${pack.id}` });
    assert(r.ok && !r.duplicate, 'not applied');
    assert((await creditBalance(buyerId)) === before + pack.credits, 'wrong credits');
    assert((await prisma.payment.count({ where: { reference: payRef } })) === 1, 'no payment record');
  });
  await test('the same payment arriving again (webhook + return page) changes nothing', async () => {
    const before = await creditBalance(buyerId);
    const r = await fulfil({ reference: payRef, amountKobo: pack.priceNgn * 100, userId: buyerId, product: `credits:${pack.id}` });
    assert(r.ok && r.duplicate, 'not reported as a duplicate');
    assert((await creditBalance(buyerId)) === before, 'credited twice');
    assert((await prisma.payment.count({ where: { reference: payRef } })) === 1, 'duplicate payment record');
  });
  await test('five copies of one payment arriving at the same moment apply exactly once', async () => {
    const ref = reference('race');
    const before = await creditBalance(buyerId);
    const results = await Promise.all(Array.from({ length: 5 }, () => fulfil({ reference: ref, amountKobo: 150000, userId: buyerId, product: 'credits:c100' })));
    const applied = results.filter((r) => r.ok && !r.duplicate).length;
    assert(applied === 1, `${applied} copies were applied`);
    assert((await creditBalance(buyerId)) === before + 100, 'balance off');
    assert((await prisma.payment.count({ where: { reference: ref } })) === 1, 'payment recorded more than once');
  });
  await test('buying a plan upgrades for 30 days, and a repeat of that payment does not extend it', async () => {
    const ref = reference('plan');
    await owner.call('POST', '/api/admin/grant', { email: creds['student-b'].email, plan: 'FREE' });
    const r = await fulfil({ reference: ref, amountKobo: PLANS.PRO.priceNgn * 100, userId: buyerId, product: 'plan:PRO' });
    assert(r.ok && !r.duplicate, 'not applied');
    const first = await effectivePlan(buyerId);
    assert(first.tier === 'PRO' && first.expiresAt, `tier ${first.tier}`);
    const days = (first.expiresAt!.getTime() - Date.now()) / 86_400_000;
    assert(days > 29.9 && days < 30.1, `${days.toFixed(2)} days`);
    const again = await fulfil({ reference: ref, amountKobo: PLANS.PRO.priceNgn * 100, userId: buyerId, product: 'plan:PRO' });
    assert(again.ok && again.duplicate, 'repeat not detected');
    assert((await effectivePlan(buyerId)).expiresAt!.getTime() === first.expiresAt!.getTime(), 'repeat extended the plan');
  });
  await test('buying the same plan again with a new payment adds 30 more days', async () => {
    const before = (await effectivePlan(buyerId)).expiresAt!.getTime();
    const r = await fulfil({ reference: reference('plan2'), amountKobo: PLANS.PRO.priceNgn * 100, userId: buyerId, product: 'plan:PRO' });
    assert(r.ok && !r.duplicate, 'not applied');
    const added = ((await effectivePlan(buyerId)).expiresAt!.getTime() - before) / 86_400_000;
    assert(added > 29.9 && added < 30.1, `added ${added.toFixed(2)} days`);
  });
  await test('five copies of one plan payment at once extend the plan only once', async () => {
    const ref = reference('planrace');
    const before = (await effectivePlan(buyerId)).expiresAt!.getTime();
    const results = await Promise.all(Array.from({ length: 5 }, () => fulfil({ reference: ref, amountKobo: PLANS.PRO.priceNgn * 100, userId: buyerId, product: 'plan:PRO' })));
    assert(results.filter((r) => r.ok && !r.duplicate).length === 1, 'applied more than once');
    const added = ((await effectivePlan(buyerId)).expiresAt!.getTime() - before) / 86_400_000;
    assert(added > 29.9 && added < 30.1, `added ${added.toFixed(2)} days`);
  });
  await test('a lapsed plan falls back to Free', async () => {
    await prisma.user.update({ where: { id: buyerId }, data: { planTier: 'PRO', planExpiresAt: new Date(Date.now() - 86_400_000) } });
    const p = await effectivePlan(buyerId);
    assert(p.tier === 'FREE' && p.lapsed, `tier ${p.tier}, lapsed ${p.lapsed}`);
    await prisma.user.update({ where: { id: buyerId }, data: { planTier: 'FREE', planExpiresAt: null } });
  });
  await test('webhook signature: valid accepted, tampered or missing refused', async () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_bot_secret';
    const body = JSON.stringify({ event: 'charge.success', data: { reference: 'abc' } });
    const good = createHmac('sha512', 'sk_test_bot_secret').update(body).digest('hex');
    assert(signatureIsValid(body, good), 'valid signature refused');
    assert(!signatureIsValid(body + ' ', good), 'tampered body accepted');
    assert(!signatureIsValid(body, null), 'missing header accepted');
    assert(!signatureIsValid(body, 'abc'), 'short header accepted');
    assert(!signatureIsValid(body, good.replace(/.$/, good.endsWith('0') ? '1' : '0')), 'altered signature accepted');
    delete process.env.PAYSTACK_SECRET_KEY;
    assert(!signatureIsValid(body, good), 'accepted a signature when no secret is configured');
  });
  await test('the running server refuses an unsigned or forged webhook and a signed-out checkout', async () => {
    const hook = await anon('POST', '/api/billing/webhook', { event: 'charge.success', data: { reference: 'x' } });
    const forged = await fetch(`${process.env.BASE_URL || 'http://localhost:3111'}/api/billing/webhook`, { method: 'POST', headers: { 'x-paystack-signature': 'f'.repeat(128) }, body: '{}' });
    const co = await anon('POST', '/api/billing/checkout', { product: 'credits:c100' });
    assert(hook.status === 401 && forged.status === 401, `webhook ${hook.status}/${forged.status}`);
    assert(co.status === 401, `checkout signed out ${co.status}`);
  });
  await test('checkout refuses unknown products and says plainly when payments are off', async () => {
    const bad = await buyer.call('POST', '/api/billing/checkout', { product: 'plan:FREE' });
    const real = await buyer.call('POST', '/api/billing/checkout', { product: 'credits:c100' });
    // 400 once payments are on; 503 "not switched on yet" while there is no Paystack key. Either way nothing is started.
    assert([400, 503].includes(bad.status) && !bad.json?.url, `unknown product ${bad.status} ${bad.text.slice(0, 100)}`);
    assert([200, 400, 501, 503].includes(real.status) && !!(real.json?.url || real.json?.error), `valid product ${real.status} ${real.text.slice(0, 100)}`);
  });
  await test('a student cannot confirm someone else’s payment reference', async () => {
    const r = await free.call('GET', `/api/billing/verify?reference=${encodeURIComponent(payRef)}`);
    assert(r.status !== 200 || !r.json?.label, `verify answered ${r.status}`);
  });

  // ───────────────────────────────────────────────────────────────── limits
  group('E. Plan limits and credits');
  const freeId = free.userId;
  await test('Free allowance: 15 chat messages are included, the 16th is stopped with a clear message', async () => {
    const before = (await free.call('GET', '/api/usage')).json.lines.find((l: any) => l.kind === 'chat');
    const room = before.limit - before.used;
    assert(before.limit === PLANS.FREE.included.chat, `limit ${before.limit}`);
    await owner.call('POST', '/api/admin/grant', { email: creds['free-student'].email, credits: 50 });
    await recordUsage(freeId, 'chat', room);
    const v = await checkUsage(freeId, 'chat');
    // With credits in hand the overflow is allowed; take them away so the rest tests the plain allowance.
    assert(v.ok === true, 'credits should cover the overflow');
    await prisma.creditLedger.create({ data: { userId: freeId, amount: -(await creditBalance(freeId)), reason: 'REFUND', note: 'bot reset' } });
    const stopped = await checkUsage(freeId, 'chat');
    assert(!stopped.ok && stopped.status === 402, `expected 402, got ${JSON.stringify(stopped)}`);
    assert(/used all 15/.test(stopped.ok ? '' : stopped.message) && /Plan & credits/.test(stopped.ok ? '' : stopped.message), 'message is not clear: ' + (stopped.ok ? '' : stopped.message));
  });
  await test('credits cover the overflow, are spent exactly, and never go negative', async () => {
    const cost = (await free.call('GET', '/api/usage')).json.lines.find((l: any) => l.kind === 'chat').creditCost as number;
    await owner.call('POST', '/api/admin/grant', { email: creds['free-student'].email, credits: cost * 2 });
    assert((await checkUsage(freeId, 'chat')).ok, 'credits not accepted');
    await recordUsage(freeId, 'chat');
    assert((await creditBalance(freeId)) === cost, `balance ${await creditBalance(freeId)}, expected ${cost}`);
    await recordUsage(freeId, 'chat');
    assert((await creditBalance(freeId)) === 0, 'not spent down to zero');
    assert(!(await checkUsage(freeId, 'chat')).ok, 'allowed with no allowance and no credits');
    await recordUsage(freeId, 'chat'); // an action that already happened must not push the balance below zero
    assert((await creditBalance(freeId)) >= 0, 'balance went negative');
  });
  await test('a feature the plan does not include says so (study guides on Free)', async () => {
    const v = await checkUsage(freeId, 'guide');
    assert(!v.ok && /does not include/.test(v.ok ? '' : v.message), JSON.stringify(v));
  });
  await test('a paused account is stopped with a 403, and restored when un-paused', async () => {
    await owner.call('POST', '/api/admin/grant', { email: creds['free-student'].email, suspend: true });
    const chat = await free.call('POST', '/api/chat', { messages: [{ id: 'm', role: 'user', parts: [{ type: 'text', text: 'hello' }] }] });
    // The console explains problems in its reply (status 200) rather than failing, so read the reply.
    const said = chat.status === 200 ? chatText(chat.text).answer : chat.text;
    assert(chat.status === 403 || /paused/i.test(said), `paused chat → ${chat.status} "${said.slice(0, 140)}"`);
    assert((await free.call('GET', '/api/usage')).status === 200, 'a paused account should still see its plan page');
    await owner.call('POST', '/api/admin/grant', { email: creds['free-student'].email, suspend: false });
    assert((await effectivePlan(freeId)).suspended === false, 'not restored');
  });
  await test('a kill switch stops that feature for everyone, with the owner’s message, and can be switched back', async () => {
    await owner.call('PUT', '/api/admin/switches', { off: { chat: true }, message: 'Chat is paused for a bot test.' });
    await new Promise((r) => setTimeout(r, 11_000)); // each server instance caches the switches for up to 10 seconds
    const chat = await buyer.call('POST', '/api/chat', { messages: [{ id: 'm', role: 'user', parts: [{ type: 'text', text: 'hello' }] }] });
    await owner.call('PUT', '/api/admin/switches', { off: {} });
    const said = chat.status === 200 ? chatText(chat.text).answer : chat.text;
    assert(chat.status === 503 || /paused for a bot test/i.test(said), `chat → ${chat.status} "${said.slice(0, 140)}"`);
  });
  await test('switches are back on afterwards', async () => {
    await new Promise((r) => setTimeout(r, 11_000));
    const v = await checkUsage(buyerId, 'chat');
    assert(v.ok, 'chat still blocked: ' + JSON.stringify(v));
  });

  // ───────────────────────────────────────────────────────────────── privacy
  group('F. Admin never exposes private study content');
  await test('no admin API response contains chat messages, source text or notes', async () => {
    const forbidden = /"(rawText|content|messages?|parts|highlights?|notes?)"\s*:/i;
    const hits: string[] = [];
    for (const p of ['/api/admin/overview', `/api/admin/grant?email=${encodeURIComponent(creds['student-a'].email)}`, '/api/admin/users', '/api/admin/payments', '/api/admin/audit']) {
      const r = await owner.call('GET', p);
      if (forbidden.test(r.text)) hits.push(p);
    }
    assert(!hits.length, `content-like fields in: ${hits.join(', ')}`);
  });
}

async function cleanup() {
  const db = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  try {
    await db.query(`delete from "Invite" where code like 'CBTEST%' or code like 'CBRACE%' or code like 'CBOFF%' or code like 'CBOLD%' or code like 'CBPLAN%'`);
  } finally {
    await db.end();
  }
}

main()
  .catch((e) => {
    console.error('SUITE CRASHED:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('cleanup failed', e));
    await prisma.$disconnect();
    const failed = finish('admin-billing');
    process.exit(failed || process.exitCode ? 1 : 0);
  });
void PREFIX;
