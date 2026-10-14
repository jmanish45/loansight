import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/auth/me');
        const userData = response.data?.data || response.data;
        if (userData && userData._id) {
          setUser(userData);
          localStorage.setItem('loansight_user', JSON.stringify(userData));
        } else {
          throw new Error('No user data returned');
        }
      } catch (error) {
        const saved = localStorage.getItem('loansight_user');
        if (saved) {
          try {
            setUser(JSON.parse(saved));
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const token = response.token || response.data?.token;
    const userData = response.data?.data || response.data;
    if (token) {
      localStorage.setItem('loansight_token', token);
    }
    setUser(userData);
    if (userData) {
      localStorage.setItem('loansight_user', JSON.stringify(userData));
    }
    return userData;
  };

  const register = async (name, email, password) => {
    const response = await api.post('/auth/register', { name, email, password });
    const token = response.token || response.data?.token;
    const userData = response.data?.data || response.data;
    if (token) {
      localStorage.setItem('loansight_token', token);
    }
    setUser(userData);
    if (userData) {
      localStorage.setItem('loansight_user', JSON.stringify(userData));
    }
    return userData;
  };

  const logout = async () => {
    try {
      await api.get('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('loansight_token');
      localStorage.removeItem('loansight_user');
      setUser(null);
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
