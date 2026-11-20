import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.js';

interface PaymentTarget {
  itemType: 'membership' | 'novel';
  itemId: string;
  itemName: string;
  amount: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVip: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  toggleBookmark: (novelId: string) => Promise<boolean>;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register' | 'admin-login' | 'admin-setup';
  setAuthModalMode: (mode: 'login' | 'register' | 'admin-login' | 'admin-setup') => void;
  paymentModalOpen: boolean;
  setPaymentModalOpen: (open: boolean) => void;
  selectedPayment: PaymentTarget | null;
  openPayment: (target?: PaymentTarget) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cs_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cs_user');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem('cs_user');
      return null;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'admin-login' | 'admin-setup'>('login');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentTarget | null>(null);

  const isAuthenticated = Boolean(token && user);
  const isAdmin = Boolean(user && user.role === 'admin');
  const isVip = Boolean(user && (user.role === 'admin' || user.membership?.isActive));

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('cs_token', newToken);
    localStorage.setItem('cs_user', JSON.stringify(newUser));
  };

  const logout = () => {
    const currentToken = token || localStorage.getItem('cs_token');
    if (currentToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`
        }
      }).catch((err) => console.warn('Backend logout notification error:', err));
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem('cs_user', JSON.stringify(data.user));
      } else if (res.status === 401 || res.status === 403) {
        logout();
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const toggleBookmark = async (novelId: string): Promise<boolean> => {
    if (!token) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return false;
    }
    try {
      const res = await fetch(`/api/auth/bookmarks/${novelId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (user) {
          const updated = { ...user, bookmarks: data.bookmarks };
          setUser(updated);
          localStorage.setItem('cs_user', JSON.stringify(updated));
        }
        return data.isBookmarked;
      }
    } catch (err) {
      console.error('Bookmark error:', err);
    }
    return false;
  };

  const openPayment = (target?: PaymentTarget) => {
    if (!isAuthenticated) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    if (target) {
      setSelectedPayment(target);
    } else {
      setSelectedPayment({
        itemType: 'membership',
        itemId: 'plan_vip_month',
        itemName: 'VIP Unlimited Audio Access (1 महीना)',
        amount: 199
      });
    }
    setPaymentModalOpen(true);
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isAdmin,
        isVip,
        login,
        logout,
        refreshUser,
        toggleBookmark,
        authModalOpen,
        setAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        paymentModalOpen,
        setPaymentModalOpen,
        selectedPayment,
        openPayment
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
