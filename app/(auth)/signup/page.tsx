"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 State (Optional)
  const [username, setUsername] = useState('');
  const [school, setSchool] = useState('');
  const [department, setDepartment] = useState('');
  const [source, setSource] = useState('');

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Security Check: Match passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Supabase Auth
      const { data, error: supaError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (supaError) throw supaError;
      
      setStep(2);
      setIsLoading(false);
    } catch (err: any) {
      if (err.message && err.message.includes('already registered')) {
        setError('This email is already registered. Try logging in!');
      } else {
        setError(err.message || 'Failed to create account.');
      }
      setIsLoading(false);
    }
  };

  const handleFinishSetup = async (e?: React.FormEvent, skipped = false) => {
    if (e) e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Create Prisma Profile via Supabase session
      const { data: { user: supaUser } } = await supabase.auth.getUser();
      if (supaUser) {
         await fetch('/api/users', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             id: supaUser.id,
             email: supaUser.email,
             username: skipped ? '' : username,
             school: skipped ? '' : school,
             department: skipped ? '' : department,
           })
         });
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError('Failed to save details, but account was created. Redirecting...');
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      setError('');
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });
    } catch (err: any) {
      setError('Google Sign-In failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1128', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px solid #27272A', width: '100%', maxWidth: '450px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>CogniBase</h1>
          <p style={{ color: '#A1A1AA', marginTop: '0.5rem' }}>
            {step === 1 ? 'Create your secure study terminal.' : 'Tell us about your studies.'}
          </p>
        </div>

        {error && <div style={{ backgroundColor: '#7F1D1D', color: '#FECACA', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Full Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Email Address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Password (Min 8 chars, 1 Uppercase, 1 Number)</label>
              <input 
                type="password" 
                required 
                pattern="^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$"
                title="Password must be at least 8 characters long and contain at least one uppercase letter and one number."
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Confirm Password</label>
              <input 
                type="password" 
                required 
                value={confirmPassword} 
                onChange={e => setConfirmPassword(e.target.value)} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
              />
            </div>
            
            <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Creating Account...' : 'Continue'}
            </button>

            <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#71717A', fontSize: '0.85rem' }}>OR</div>

            <button type="button" onClick={handleGoogleSignup} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: 'black', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
              Sign up with Google
            </button>

            <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
              Already have an account? <Link href="/login" style={{ color: '#EA580C', textDecoration: 'none', fontWeight: 'bold' }}>Log in</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={(e) => handleFinishSetup(e, false)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Username</label>
              <input type="text" placeholder="e.g. study_ninja" value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>University / School</label>
              <input type="text" placeholder="e.g. Veritas University" value={school} onChange={e => setSchool(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Department / Major</label>
              <input type="text" placeholder="e.g. Educational Management" value={department} onChange={e => setDepartment(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>How did you hear about us?</label>
              <select value={source} onChange={e => setSource(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }}>
                <option value="">Select an option...</option>
                <option value="Friend">A Friend / Classmate</option>
                <option value="Twitter">Twitter / X</option>
                <option value="TikTok">TikTok</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="button" onClick={() => handleFinishSetup(undefined, true)} disabled={isLoading} style={{ flex: 1, padding: '0.75rem', backgroundColor: 'transparent', color: '#A1A1AA', border: '1px solid #3F3F46', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Skip for now
              </button>
              <button type="submit" disabled={isLoading} style={{ flex: 2, padding: '0.75rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                Complete Setup
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
