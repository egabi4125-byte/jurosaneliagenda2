import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AnimatePresence } from 'motion/react';
import { auth } from './lib/firebase';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthScreen } from './components/AuthScreen';
import { ClientArea } from './components/ClientArea';
import { SplashScreen } from './components/SplashScreen';

type SessionRole = 'admin' | 'client' | null;
const ROLE_STORAGE_KEY = 'junaildesigner_active_role';

function readStoredRole(): SessionRole {
  try {
    const val = sessionStorage.getItem(ROLE_STORAGE_KEY);
    if (val === 'admin' || val === 'client') return val;
  } catch {
    // ignore storage errors
  }
  return null;
}

export default function App() {
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<SessionRole>(() => readStoredRole());

  useEffect(() => {
    const timer = setTimeout(() => setMinSplashDone(true), 950);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      const storedRole = readStoredRole();

      // Local owner session does not depend on Firebase Auth
      if (storedRole === 'admin') {
        setUser(null);
        setRole('admin');
        setAuthReady(true);
        return;
      }

      if (!fbUser) {
        setUser(null);
        setRole(null);
        setAuthReady(true);
        return;
      }

      setUser(fbUser);
      setRole('client');
      setAuthReady(true);
    });

    return () => unsub();
  }, []);

  const handleAdminAuth = () => {
    try {
      sessionStorage.setItem(ROLE_STORAGE_KEY, 'admin');
    } catch {
      // ignore
    }
    setUser(null);
    setRole('admin');
  };

  const handleClientAuth = (fbUser: User) => {
    try {
      sessionStorage.setItem(ROLE_STORAGE_KEY, 'client');
    } catch {
      // ignore
    }
    setUser(fbUser);
    setRole('client');
  };

  const handleSignedOut = () => {
    try {
      sessionStorage.removeItem(ROLE_STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
    setRole(null);
  };

  const showSplash = !minSplashDone || !authReady;

  return (
    <>
      <AnimatePresence>{showSplash && <SplashScreen />}</AnimatePresence>

      {!showSplash && (
        <>
          {role === 'admin' ? (
            <AdminDashboard onSignedOut={handleSignedOut} />
          ) : user && role === 'client' ? (
            <ClientArea user={user} onSignedOut={handleSignedOut} />
          ) : (
            <AuthScreen
              onAdminAuthenticated={handleAdminAuth}
              onClientAuthenticated={handleClientAuth}
            />
          )}
        </>
      )}
    </>
  );
}
