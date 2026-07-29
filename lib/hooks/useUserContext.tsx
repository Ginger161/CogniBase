'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';

export interface UserContext {
  uid: string; // Supabase UID
  name: string;
  email: string;
  school?: string;
  department?: string;
  profile: any;
  preferences: {
    theme: string;
    sidebarMode: string;
    dailyFocusGoal: number;
    guideComplexity: string;
  };
}

interface UserContextValue {
  context: UserContext | null;
  isLoading: boolean;
  mutate: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  async function fetchUser() {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const profileData = await res.json();
          setContext({
            uid: session.user.id,
            name: profileData.username || session.user.email?.split('@')[0] || 'Student',
            email: session.user.email || '',
            school: profileData.school || '',
            department: profileData.department || '',
            profile: profileData,
            preferences: profileData.preferences || {
              theme: 'system',
              sidebarMode: 'expanded',
              dailyFocusGoal: 120,
              guideComplexity: 'standard'
            }
          });
          // Sync Theme
          if (profileData.preferences?.theme) {
            setTheme(profileData.preferences.theme);
          }
        } else if (res.status === 401) {
          setContext(null);
        } else {
           setContext({
             uid: session.user.id,
             name: session.user.email?.split('@')[0] || 'Student',
             email: session.user.email || '',
             profile: {},
             preferences: {
               theme: 'system',
               sidebarMode: 'expanded',
               dailyFocusGoal: 120,
               guideComplexity: 'standard'
             }
           });
        }
      } catch(e) {
        setContext(null);
      }
    } else {
      setContext(null);
    }
    setIsLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    fetchUser();

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

  return (
    <UserContext.Provider value={{ context, isLoading, mutate: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Fallback if not wrapped in provider (shouldn't happen)
    return { context: null, isLoading: false, mutate: async () => {} };
  }
  return context;
}
