import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export interface UserContext {
  uid: string;
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let profileData = null;
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            profileData = userSnap.data();

            // Legacy Migration: flat `courses` array -> `semesters` array
            let needsMigration = false;
            if (!profileData.semesters || profileData.semesters.length === 0) {
              needsMigration = true;
              profileData.semesters = [{
                semesterId: 'current_semester_01',
                title: 'Current Semester',
                isActive: true,
                courses: (profileData.courses && Array.isArray(profileData.courses)) ? profileData.courses : [],
                timetableUrl: ''
              }];
            }
            if (needsMigration) {
              await updateDoc(userRef, { semesters: profileData.semesters });
            }
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
        }
        
        setContext({
          uid: user.uid,
          name: profileData?.username || user.displayName || 'Student',
          email: user.email || '',
          school: profileData?.school || '',
          department: profileData?.department || '',
          profile: profileData
        });
      } else {
        setContext(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { context, isLoading };
}
