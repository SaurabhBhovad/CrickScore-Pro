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
    let redirectChecked = false;
    let authFired = false;

    const maybeStopLoading = () => {
      if (redirectChecked && authFired && isMounted) {
        setLoading(false);
      }
    };

    // 1. Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isMounted) {
        setUser(user);
        authFired = true;
        maybeStopLoading();
      }
    });

    // 2. Check for redirect result in parallel
    getRedirectResult(auth).then((result) => {
      if (result?.user && isMounted) {
        toast.success('Successfully signed in!');
      }
      redirectChecked = true;
      maybeStopLoading();
    }).catch((error: any) => {
      console.error('Redirect sign-in error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add this URL to the Authorized Domains list in Firebase Console.');
      }
      redirectChecked = true;
      maybeStopLoading();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async () => {
    const isIframe = window.self !== window.top;

    try {
      // Always try popup first as it's more reliable for state persistence
      await signInWithPopup(auth, googleProvider);
      toast.success('Successfully signed in!');
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add this URL to the Authorized Domains list in Firebase Console.');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.info('Sign-in was cancelled.');
      } else if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
        // If popup is blocked and we're not in an iframe, fallback to redirect
        if (!isIframe) {
          toast.info('Popup blocked. Trying redirect method...');
          await signInWithRedirect(auth, googleProvider);
        } else {
          toast.error('Sign-in popup was blocked. Please allow popups for this site.');
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
