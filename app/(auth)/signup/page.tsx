"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';
import { AuthShell, AuthError, AuthField, OrDivider, authInput, authPrimary, authSecondary } from '@/components/auth/AuthShell';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    if (password !== confirmPassword) return setError('The passwords do not match.');

    setIsLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (authError) {
      setError(authError.message || 'Could not create your account.');
      setIsLoading(false);
      return;
    }
    // Supabase answers with no identities when the email is already registered.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setError('This email is already registered. Try signing in.');
      setIsLoading(false);
      return;
    }
    // If email confirmation is on there is no session yet.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError('Check your email to confirm your account, then sign in.');
        setIsLoading(false);
        return;
      }
    }
    setStep(2);
    setIsLoading(false);
  };

  const finish = async (skip: boolean) => {
    setIsLoading(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name.trim(), school: skip ? '' : school.trim(), department: skip ? '' : department.trim() }),
      });
    } catch {
      /* the profile can be completed later in Settings */
    }
    router.push('/dashboard');
    router.refresh();
  };

  const handleGoogle = async () => {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (authError) setError('Google sign-in failed. Please try again.');
  };

  if (step === 2) {
    return (
      <AuthShell title="Almost there" subtitle="Optional: this helps tailor examples to your course.">
        <AuthError message={error} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish(false);
          }}
          className="flex flex-col gap-4"
        >
          <AuthField id="school" label="School">
            <input id="school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. Veritas University" className={authInput} />
          </AuthField>
          <AuthField id="department" label="Department">
            <input id="department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Educational Management" className={authInput} />
          </AuthField>
          <button type="submit" disabled={isLoading} className={authPrimary}>
            {isLoading ? 'Saving…' : 'Finish'}
          </button>
          <button type="button" disabled={isLoading} onClick={() => finish(true)} className="min-h-11 text-sm font-semibold text-[var(--text-secondary)]">
            Skip for now
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Turn your notes, slides and lectures into something you can study from.">
      <AuthError message={error} />
      <form onSubmit={handleCreateAccount} className="flex flex-col gap-4">
        <AuthField id="name" label="Name">
          <input id="name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={authInput} />
        </AuthField>
        <AuthField id="email" label="Email">
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={authInput} />
        </AuthField>
        <AuthField id="password" label="Password">
          <input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={authInput} />
        </AuthField>
        <AuthField id="confirm" label="Confirm password">
          <input id="confirm" type="password" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={authInput} />
        </AuthField>
        <button type="submit" disabled={isLoading} className={authPrimary}>
          {isLoading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <OrDivider />
      <button type="button" onClick={handleGoogle} className={authSecondary}>
        Continue with Google
      </button>
      <p className="text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-[var(--accent-text)]">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
