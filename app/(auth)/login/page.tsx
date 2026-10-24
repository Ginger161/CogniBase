"use client";

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';
import { authErrorMessage } from '@/lib/client-errors';
import { AuthShell, AuthError, AuthField, OrDivider, authInput, authPrimary, authSecondary } from '@/components/auth/AuthShell';

// Reads ?error=... left by a failed OAuth callback. Isolated so the form itself renders without waiting on it.
function CallbackError() {
  const failed = useSearchParams().get('error');
  return failed ? <AuthError message="Sign-in did not complete. Please try again." /> : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authErrorMessage(authError, 'Could not sign in. Please try again.'));
        setIsLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(authErrorMessage(null, 'Could not sign in. Please try again.'));
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) setError('Google sign-in failed. Please try again.');
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <Suspense fallback={null}>
        <CallbackError />
      </Suspense>
      <AuthError message={error} />
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <AuthField id="email" label="Email">
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </AuthField>
        <AuthField id="password" label="Password">
          <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
        </AuthField>
        <button type="submit" disabled={isLoading} className={authPrimary}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <OrDivider />
      <button type="button" onClick={handleGoogle} className={authSecondary}>
        Continue with Google
      </button>
      <p className="text-center text-sm text-[var(--text-secondary)]">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-[var(--accent-text)]">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
