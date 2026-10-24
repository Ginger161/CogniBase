/** An error whose message was written for the user, so it is safe to show as is. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserError';
  }
}

const OFFLINE = "You're offline. Check your connection and try again.";
const UNREACHABLE = "Couldn't reach CogniBase. Check your connection and try again.";

const BY_STATUS: Record<number, string> = {
  401: 'Your session has expired. Sign in again to keep going.',
  413: 'That file is too large.',
  429: "You're going a little fast. Wait a moment and try again.",
  502: 'Something went wrong on our side. Please try again.',
  503: 'The service is busy. Please try again in a moment.',
  504: 'That took too long. Try again, or use a smaller source.',
};

/** Builds a safe error from a failed response: our own message when the API sent one, otherwise a friendly one by status. */
export async function readApiError(res: Response, fallback: string): Promise<UserError> {
  const data = await res.json().catch(() => null);
  const message = data && typeof data.error === 'string' && data.error ? data.error : BY_STATUS[res.status] || fallback;
  return new UserError(message);
}

/** Storage errors are technical; keep the cases a person can act on and hide the rest. */
export function storageUploadMessage(raw: string | undefined): string {
  const m = (raw || '').toLowerCase();
  if (m.includes('maximum allowed size') || m.includes('too large') || m.includes('payload')) return 'That file is too large.';
  if (m.includes('already exists')) return 'A file with that name was just uploaded. Try again.';
  return 'Upload failed. Check your connection and try again.';
}

/** Turns a Supabase auth error into something a person can act on. */
export function authErrorMessage(error: { message?: string; status?: number } | null | undefined, fallback: string): string {
  const m = (error?.message || '').toLowerCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE;
  if (m.includes('invalid login credentials')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Confirm your email first, then sign in.';
  if (m.includes('already registered')) return 'This email is already registered. Try signing in.';
  if (m.includes('different from the old password')) return "Choose a password you haven't used before.";
  if (m.includes('password should be') || m.includes('weak password')) return 'Choose a stronger password of at least 8 characters.';
  if (m.includes('valid email') || m.includes('invalid email')) return 'Enter a valid email address.';
  if (error?.status === 429 || m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a few minutes and try again.';
  if (m.includes('fetch') || error?.status === 0) return UNREACHABLE;
  return fallback;
}

/** The text to show for anything a catch block receives. Never exposes a raw library or network message. */
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof UserError) return e.message;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE;
  // fetch() rejects with a TypeError when the request never completed.
  if (e instanceof TypeError) return UNREACHABLE;
  return fallback;
}
