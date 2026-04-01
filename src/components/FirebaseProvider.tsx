import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, onAuthStateChanged, User, signInWithPopup, signInWithRedirect, getRedirectResult, googleProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '../firebase';
import { toast } from 'sonner';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  emailLogin: (email: string, pass: string) => Promise<void>;
  emailSignUp: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // Wait for redirect result to settle before deciding on loading state
        await getRedirectResult(auth);
      } catch (error: any) {
        console.error('Redirect sign-in error:', error);
        if (error.code === 'auth/unauthorized-domain') {
          toast.error('This domain is not authorized in Firebase. Please add this URL to the Authorized Domains list in Firebase Console.');
        }
      }

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (isMounted) {
          setUser(user);
          setLoading(false);
        }
      });

      return unsubscribe;
    };

    let unsubscribe: (() => void) | undefined;
    initAuth().then(unsub => {
      unsubscribe = unsub;
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
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

  const emailLogin = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast.success('Successfully signed in!');
    } catch (error: any) {
      console.error('Email login error:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Invalid email or password.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed login attempts. Please try again later.');
      } else {
        toast.error('Failed to sign in. Please try again.');
      }
      throw error;
    }
  };

  const emailSignUp = async (email: string, pass: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      // Update profile with name
      const { updateProfile } = await import('firebase/auth');
      await updateProfile(result.user, { displayName: name });
      
      // Also save to Firestore
      const { setDoc, doc, db } = await import('../firebase');
      await setDoc(doc(db, 'users', result.user.uid), {
        name,
        email,
        createdAt: new Date().toISOString(),
        role: 'user'
      });

      toast.success('Account created successfully!');
    } catch (error: any) {
      console.error('Email sign up error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('An account with this email already exists.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters.');
      } else {
        toast.error('Failed to create account. Please try again.');
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Successfully signed out!');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  return (
    <FirebaseContext.Provider value={{ user, loading, login, emailLogin, emailSignUp, logout }}>
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
