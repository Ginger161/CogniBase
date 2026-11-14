import { isAuthRetryableFetchError } from '@supabase/supabase-js';

/** What a student sees when the sign-in service cannot be reached (not the same as being signed out). */
export const AUTH_OUTAGE_MESSAGE = 'We could not reach the sign-in service. Check your connection and try again.';

/**
 * True when a failed `auth.getUser()` means "we could not check", not "this person is not signed in".
 * A dropped connection or an auth-service 5xx must not log a student out or send them to the login page.
 */
export function isAuthOutage(error: unknown): boolean {
  if (!error) return false;
  if (isAuthRetryableFetchError(error)) return true;
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 500) return true;
  // A thrown network failure ("fetch failed") rather than an auth answer.
  return error instanceof TypeError;
}
