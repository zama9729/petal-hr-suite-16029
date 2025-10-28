import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'superadmin' | 'orgadmin' | 'manager' | 'employee';

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  roles: UserRole[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  tenantId: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

export interface SignupData {
  orgName: string;
  domain: string;
  adminName: string;
  adminEmail: string;
  password: string;
  timezone?: string;
  companySize?: string;
  industry?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedTenantId = localStorage.getItem('tenantId');

    if (storedToken && storedUser && storedTenantId) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      setTenantId(storedTenantId);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE_URL}/auth/login`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password })
      // });
      // const data = await response.json();

      // Mock response for now
      const mockData = {
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        tenantId: 'tenant-123',
        user: {
          id: 'user-1',
          email,
          name: 'Demo User',
          tenantId: 'tenant-123',
          roles: ['orgadmin'] as UserRole[],
        },
      };

      setToken(mockData.token);
      setUser(mockData.user);
      setTenantId(mockData.tenantId);

      localStorage.setItem('token', mockData.token);
      localStorage.setItem('user', JSON.stringify(mockData.user));
      localStorage.setItem('tenantId', mockData.tenantId);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (data: SignupData) => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      // const result = await response.json();

      // Mock response
      const mockData = {
        token: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token',
        tenantId: 'tenant-new',
        user: {
          id: 'user-new',
          email: data.adminEmail,
          name: data.adminName,
          tenantId: 'tenant-new',
          roles: ['orgadmin'] as UserRole[],
        },
      };

      setToken(mockData.token);
      setUser(mockData.user);
      setTenantId(mockData.tenantId);

      localStorage.setItem('token', mockData.token);
      localStorage.setItem('user', JSON.stringify(mockData.user));
      localStorage.setItem('tenantId', mockData.tenantId);
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setTenantId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('tenantId');
  };

  return (
    <AuthContext.Provider value={{ user, token, tenantId, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
