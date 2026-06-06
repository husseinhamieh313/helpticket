import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../utils/api";
import React from "react";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) { setLoading(false); return; }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken, user } = res.data;
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    setUser(user);
    return user;
  };

  const register = async (data) => {
    const res = await api.post("/auth/register", data);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout", { refreshToken: localStorage.getItem("refreshToken") });
    } catch {}
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
