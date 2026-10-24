'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useTheme } from 'next-themes';
import { writeThemeCookie } from '@/lib/theme-cookie';

export interface UserContext {
  uid: string; // Supabase UID
  name: string;
  email: string;
  school?: string;
  department?: string;
  /** The user's saved profile JSON (courses and so on), not the whole user row. */
  profile: { courses?: Array<{ courseCode: string; courseTitle: string; semester?: string }>; [key: string]: unknown } | null;
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

const DEFAULT_PREFERENCES = { theme: 'charcoal', sidebarMode: 'expanded', dailyFocusGoal: 120, guideComplexity: 'standard' };

export function UserProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<UserContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setTheme } = useTheme();

  const fetchUser = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.warn('Supabase auth session warning:', error);
        setContext(null);
        return;
      }

      const user = data?.session?.user;
      if (!user) {
        setContext(null);
        return;
      }

      const fallback: UserContext = {
        uid: user.id,
        name: user.email?.split('@')[0] || 'Student',
        email: user.email || '',
        profile: null,
        preferences: DEFAULT_PREFERENCES,
      };

      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const settings = await res.json();
          setContext({
            ...fallback,
            name: settings.username || fallback.name,
            school: settings.school || '',
            department: settings.department || '',
            profile: settings.profile ?? null,
            preferences: { ...DEFAULT_PREFERENCES, ...(settings.preferences ?? {}) },
          });
          if (settings.preferences?.theme) {
            setTheme(settings.preferences.theme);
            writeThemeCookie(settings.preferences.theme);
          }
        } else if (res.status === 401) {
          setContext(null);
        } else {
          setContext(fallback);
        }
      } catch {
        setContext(null);
      }
    } catch (err) {
      console.warn('Failed to retrieve user session:', err);
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [setTheme]);

  useEffect(() => {
    // Load once on mount, then follow sign-in / sign-out.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of the signed-in user
    fetchUser();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setContext(null);
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') fetchUser();
    });
    return () => authListener?.subscription?.unsubscribe();
  }, [fetchUser]);

  const value = useMemo(() => ({ context, isLoading, mutate: fetchUser }), [context, isLoading, fetchUser]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Outside the provider (should not happen)
    return { context: null, isLoading: false, mutate: async () => {} };
  }
  return context;
}
