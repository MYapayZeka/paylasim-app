import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  iban?: string;
  avatarUrl?: string;
  rating?: number;
  ratingCount?: number;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const TOKEN_KEY = 'user_token';
const USER_KEY = 'user_profile';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      const storedToken = await storage.getItem(TOKEN_KEY);
      const storedUser = await storage.getItem(USER_KEY);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.log('Oturum bilgisi yüklenemedi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (newToken: string, newUser: User) => {
    try {
      await storage.setItem(TOKEN_KEY, newToken);
      await storage.setItem(USER_KEY, JSON.stringify(newUser));
      setToken(newToken);
      setUser(newUser);
    } catch (e) {
      console.log('Oturum kaydedilemedi:', e);
    }
  };

  const updateUser = async (updatedFields: Partial<User>) => {
    if (!user) return;
    const merged = { ...user, ...updatedFields };
    try {
      await storage.setItem(USER_KEY, JSON.stringify(merged));
      setUser(merged);
    } catch (e) {
      console.log('Kullanıcı güncellenemedi:', e);
    }
  };

  const signOut = async () => {
    try {
      await storage.removeItem(TOKEN_KEY);
      await storage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    } catch (e) {
      console.log('Oturum sonlandırılamadı:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);