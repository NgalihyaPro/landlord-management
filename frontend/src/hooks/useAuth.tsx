import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api, { clearCsrfToken, clearGetCache, prefetchGet } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface User {
  id: number;
  organization_id?: number;
  organization_name?: string;
  full_name: string;
  email: string;
  role: string;
  avatar: string | null;
  phone?: string | null;
  is_platform_admin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (userData: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const syncAuth = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (!cancelled) {
          setUser(data);
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    syncAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {
      setUser(null);
    }
  };

  const login = (userData: User) => {
    clearGetCache();
    prefetchGet('/dashboard');
    setUser(userData);
  };

  const logout = async () => {
    clearGetCache();
    clearCsrfToken();
    try {
      await api.post('/auth/logout');
    } catch {
      // If logout fails on the network, still clear the local session state.
    }
    setUser(null);
    setLoading(false);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
