import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged, User, signInWithPopup, signInWithRedirect, getRedirectResult, googleProvider, signOut } from '../firebase';
import { toast } from 'sonner';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for redirect result on mount
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        toast.success('Successfully signed in!');
      }
    }).catch((error) => {
      console.error('Redirect sign-in error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add this URL to the Authorized Domains list in Firebase Console.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const isIframe = window.self !== window.top;

    try {
      // On mobile and not in an iframe, redirect is often more reliable
      if (isMobile && !isIframe) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
      toast.success('Successfully signed in!');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add this URL to the Authorized Domains list in Firebase Console.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in popup was closed before completion.');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Sign-in popup was blocked. Please allow popups or try a different browser.');
        // Fallback to redirect if popup is blocked and not in iframe
        if (!isIframe) {
          await signInWithRedirect(auth, googleProvider);
        }
      } else {
        toast.error('Failed to sign in. Please try again.');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
