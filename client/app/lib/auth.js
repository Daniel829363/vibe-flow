"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const TOKEN_KEY  = "vf_access_token";
const REFRESH_KEY = "vf_refresh_token";

let interceptorsConfigured = false;

// ── Axios interceptor setup ───────────────────────────────────────────────────
function setupAxiosInterceptors(getAccessToken, refreshAccessToken, logout) {
  if (interceptorsConfigured) return;
  interceptorsConfigured = true;

  // Request: attach Bearer token dynamically
  axios.interceptors.request.use(
    (config) => {
      const token = getAccessToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response: handle 401 → try refresh
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/api/auth/login") && !originalRequest.url?.includes("/api/auth/refresh")) {
        originalRequest._retry = true;
        try {
          const newToken = await refreshAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axios(originalRequest);
          }
        } catch {
          logout();
        }
      }
      return Promise.reject(error);
    }
  );
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Token helpers ────────────────────────────────────────────────────────
  const getAccessToken  = () => (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null);
  const getRefreshToken = () => (typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null);

  const saveTokens = (access, refresh) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY,  access);
      localStorage.setItem(REFRESH_KEY, refresh);
    }
    axios.defaults.headers.common["Authorization"] = `Bearer ${access}`;
  };

  const clearTokens = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    delete axios.defaults.headers.common["Authorization"];
  };

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await axios.post("/api/auth/refresh", { refresh_token: refreshToken });
      const { access_token, refresh_token } = res.data;
      saveTokens(access_token, refresh_token);
      return access_token;
    } catch {
      clearTokens();
      setUser(null);
      return null;
    }
  }, []);

  // ── Logout ───────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  // ── Hydrate on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    // Interceptors are configured unconditionally on mount
    setupAxiosInterceptors(getAccessToken, refreshAccessToken, logout);

    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    axios
      .get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(async () => {
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const res = await axios.get("/api/auth/me");
            setUser(res.data);
          } catch {
            logout();
          }
        } else {
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, [refreshAccessToken, logout]);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const res = await axios.post("/api/auth/login", { email, password });
    const { access_token, refresh_token, user: userData } = res.data;
    saveTokens(access_token, refresh_token);
    setUser(userData);
    return userData;
  }, []);

  // ── Register ─────────────────────────────────────────────────────────────
  const register = useCallback(async (email, password, name, phone) => {
    const res = await axios.post("/api/auth/register", { email, password, name, phone });
    const { access_token, refresh_token, user: userData } = res.data;
    saveTokens(access_token, refresh_token);
    setUser(userData);
    return userData;
  }, []);

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(() => {
    window.location.href = "/api/auth/google";
  }, []);

  // ── Handle Google callback result ────────────────────────────────────────
  const handleGoogleCallback = useCallback(async (code, redirectUri) => {
    const res = await axios.post("/api/auth/google/callback", {
      code,
      redirect_uri: redirectUri,
    });
    const { access_token, refresh_token, user: userData, requires_phone, google_token, google_user } = res.data;

    if (requires_phone) {
      return { requiresPhone: true, googleToken: google_token, googleUser: google_user };
    }

    saveTokens(access_token, refresh_token);
    setUser(userData);
    return { requiresPhone: false, user: userData };
  }, []);

  // ── Complete Google registration ─────────────────────────────────────────
  const completeGoogleRegistration = useCallback(async (googleToken, phone) => {
    const res = await axios.post("/api/auth/google/complete", {
      google_token: googleToken,
      phone,
    });
    const { access_token, refresh_token, user: userData } = res.data;
    saveTokens(access_token, refresh_token);
    setUser(userData);
    return userData;
  }, []);

  // ── Update user in context ────────────────────────────────────────────────
  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser);
  }, []);

  // ── Refresh current user data from server ─────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const res = await axios.get("/api/auth/me");
      setUser(res.data);
      return res.data;
    } catch {
      return null;
    }
  }, []);

  // ── Set Impersonation ─────────────────────────────────────────────────────
  const setImpersonationTokens = useCallback((accessToken, refreshToken, userData) => {
    saveTokens(accessToken, refreshToken);
    setUser(userData);
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    loginWithGoogle,
    handleGoogleCallback,
    completeGoogleRegistration,
    updateUser,
    refreshUser,
    setImpersonationTokens,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
