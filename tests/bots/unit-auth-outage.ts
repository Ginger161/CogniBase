import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js';
import { assert, finish, group, test } from './harness';
import { isAuthOutage } from '../../lib/auth-outage';

group('Auth outage classifier');
(async () => {
  await test('no error is not an outage', async () => assert(isAuthOutage(null) === false, 'null'));
  await test('no session cookie means signed out, not an outage', async () => assert(isAuthOutage(new AuthSessionMissingError()) === false, 'session missing'));
  await test('an invalid or expired token (401) is signed out, not an outage', async () => assert(isAuthOutage(new AuthApiError('bad jwt', 401, 'bad_jwt')) === false, '401'));
  await test('a dropped connection is an outage', async () => assert(isAuthOutage(new AuthRetryableFetchError('fetch failed', 0)) === true, 'retryable'));
  await test('an auth-service 5xx is an outage', async () => assert(isAuthOutage(new AuthApiError('upstream', 503, 'unexpected_failure')) === true, '503'));
  await test('a thrown "fetch failed" TypeError is an outage', async () => assert(isAuthOutage(new TypeError('fetch failed')) === true, 'TypeError'));
  process.exit(finish('unit-auth-outage') ? 1 : 0);
})();
