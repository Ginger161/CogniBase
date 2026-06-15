"use client";
import { useState } from 'react';
import { auth, googleProvider } from '../../../lib/firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');
    
    try {
      // 1. Set persistence based on the checkbox
      const persistenceMode = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceMode);
      
      // 2. Log the user in
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError('Invalid email or password. Please try again.');
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address in the box first to reset your password.');
      return;
    }
    try {
      setError('');
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset link sent! Please check your inbox (and spam folder).');
    } catch (err: any) {
      setError('Failed to send reset email. Ensure the email address is correct.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError('');
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      router.push('/dashboard'); 
    } catch (err: any) {
      setError('Could not connect to Google. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1128', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem', color: 'white', fontFamily: 'sans-serif' }}>
      <div style={{ backgroundColor: '#111111', padding: '3rem', borderRadius: '1rem', border: '1px solid #27272A', width: '100%', maxWidth: '450px' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', color: 'white' }}>CogniBase</h1>
          <p style={{ color: '#A1A1AA', marginTop: '0.5rem' }}>Access your study terminal.</p>
        </div>
        
        {error && <div style={{ backgroundColor: '#7F1D1D', color: '#FECACA', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}
        {message && <div style={{ backgroundColor: '#064E3B', color: '#A7F3D0', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{message}</div>}
        
        <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#A1A1AA' }}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#18181B', border: '1px solid #3F3F46', color: 'white' }} />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#A1A1AA', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                style={{ accentColor: '#EA580C', cursor: 'pointer' }} 
              />
              Remember me
            </label>
            
            <button 
              type="button" 
              onClick={handleResetPassword}
              style={{ background: 'none', border: 'none', color: '#EA580C', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
          
          <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '0.75rem', marginTop: '1rem', backgroundColor: '#EA580C', color: 'white', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', margin: '1.5rem 0', color: '#71717A', fontSize: '0.85rem' }}>OR</div>

        <button onClick={handleGoogleLogin} style={{ width: '100%', padding: '0.75rem', backgroundColor: 'white', color: 'black', borderRadius: '0.5rem', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
          Sign in with Google
        </button>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.85rem', color: '#A1A1AA' }}>
          Don't have an account? <Link href="/signup" style={{ color: '#EA580C', textDecoration: 'none', fontWeight: 'bold' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
