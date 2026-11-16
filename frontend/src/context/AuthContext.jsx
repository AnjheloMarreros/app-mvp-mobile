import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const API_BASE = 'http://localhost:8000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('juris_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('juris_token') || null;
    } catch {
      return null;
    }
  });

  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem('juris_user', JSON.stringify(user));
      localStorage.setItem('juris_token', token);
    } else {
      localStorage.removeItem('juris_user');
      localStorage.removeItem('juris_token');
    }
  }, [user, token]);

  const login = async (identifier, password) => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al iniciar sesión');
      }

      setUser(data.user);
      setToken(data.token);
      return data;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const register = async (formData) => {
    setIsLoadingAuth(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Error al registrar la cuenta');
      }

      setUser(data.user);
      setToken(data.token);
      return data;
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  // Helper fetch que inyecta automáticamente el token Bearer
  const authFetch = async (url, options = {}) => {
    const headers = {
      ...(options.headers || {})
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    return fetch(fullUrl, { ...options, headers });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, authFetch, isLoadingAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

