import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, clearTokens, publicApi, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('gym_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadMe() {
      if (!localStorage.getItem('gym_access')) {
        setBooting(false);
        return;
      }
      try {
        const me = await api('/auth/me/');
        if (!cancelled) {
          setUser(me);
          localStorage.setItem('gym_user', JSON.stringify(me));
        }
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loginPin(email, pin) {
    const payload = await publicApi('/auth/login/pin/', { email, pin });
    setTokens(payload);
    setUser(payload.user);
  }

  async function loginPassword(email, password) {
    const payload = await publicApi('/auth/login/password/', { email, password });
    setTokens(payload);
    setUser(payload.user);
  }

  async function register(body) {
    return publicApi('/auth/register/', body);
  }

  async function testEnvLogin() {
    const payload = await publicApi('/auth/test-env/', {}, { method: 'POST' });
    setTokens(payload);
    setUser(payload.user);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  const value = useMemo(() => ({ user, booting, loginPin, loginPassword, register, testEnvLogin, logout, setUser }), [user, booting]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
