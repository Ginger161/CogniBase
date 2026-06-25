import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

export interface UserContext {
  uid: string; // Supabase UID
  name: string;
  email: string;
  school?: string;
  department?: string;
  profile: any;
}

export function useUserContext() {
  const [context, setContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchUser() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Fetch profile from Postgres via Supabase
        const { data: profileData } = await supabase
          .from('User')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (mounted) {
          setContext({
            uid: session.user.id,
            name: profileData?.username || session.user.email?.split('@')[0] || 'Student',
            email: session.user.email || '',
            school: profileData?.school || '',
            department: profileData?.department || '',
            profile: profileData || {}
          });
        }
      } else {
        if (mounted) setContext(null);
      }
      if (mounted) setIsLoading(false);
    }

    fetchUser();

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
       if (event === 'SIGNED_OUT') {
         if (mounted) setContext(null);
       } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
         fetchUser();
       }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { context, isLoading };
}
