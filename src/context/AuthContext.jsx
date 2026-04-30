/**
 * AuthContext — replaces Auth0 with our own JWT-based auth.
 * Provides: user, token, login, register, logout, isAuthenticated
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("ffbs_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("ffbs_token") || null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!token && !!user;

  // On mount, verify token is still valid
  useEffect(() => {
    if (token) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data);
          localStorage.setItem("ffbs_user", JSON.stringify(res.data));
        })
        .catch(() => {
          // Token invalid
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  // Listen for 401 auto-logout
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("ffbs:logout", handler);
    return () => window.removeEventListener("ffbs:logout", handler);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password);
    const { access_token, user_id, email: userEmail, full_name, role } = res.data;
    const userData = { id: user_id, email: userEmail, full_name, role };
    localStorage.setItem("ffbs_token", access_token);
    localStorage.setItem("ffbs_user", JSON.stringify(userData));
    setToken(access_token);
    setUser(userData);
    return userData;
  }, []);

  const register = useCallback(async (email, password, fullName, organisation, role, roleData) => {
    const res = await authApi.register({ email, password, full_name: fullName, organisation, role, role_data: roleData });
    // Registration no longer returns a token — account requires admin approval first
    return { pendingApproval: res.data.pending_approval === true };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ffbs_token");
    localStorage.removeItem("ffbs_user");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
