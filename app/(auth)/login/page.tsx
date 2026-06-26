"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';

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
      const { error: supaError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (supaError) throw supaError;
      
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to login.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
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
      <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px solid #27272A', width: '100%', maxWidth: '400px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>CogniBase</h1>
          <p style={{ color: '#A1A1AA', marginTop: '0.5rem' }}>
            Welcome back. Please log in.
          </p>
        </div>

        {error && <div style={{ backgroundColor: '#7F1D1D', color: '#FECACA', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Password</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} 
            />
          </div>
          
          <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
            {isLoading ? 'Logging in...' : 'Log In'}
          </button>

          <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#71717A', fontSize: '0.85rem' }}>OR</div>

          <button type="button" onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: 'black', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
            Log in with Google
          </button>

          <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
            Don't have an account? <Link href="/signup" style={{ color: '#EA580C', textDecoration: 'none', fontWeight: 'bold' }}>Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}