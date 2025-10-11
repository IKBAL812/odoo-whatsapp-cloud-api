"use client";

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { OdooLoginResult } from "@/app/lib/odoo/jsonrpc";

type AuthContextValue = {
  sessionId: string | null;
  user: OdooLoginResult | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  isAuthenticating: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

const SESSION_STORAGE_KEY = "odooSessionId";
const SESSION_USER_KEY = "odooSessionUser";

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export default function AuthProvider({ children }: PropsWithChildren) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<OdooLoginResult | null>(null);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const storedUser = window.localStorage.getItem(SESSION_USER_KEY);

    if (storedSession) {
      setSessionId(storedSession);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (error) {
          console.warn("Failed to parse stored user session", error);
          window.localStorage.removeItem(SESSION_USER_KEY);
        }
      }
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
  }, []);

  const persistSession = useCallback(
    (newSessionId: string, sessionUser: OdooLoginResult | null) => {
      if (typeof window === "undefined") {
        return;
      }
      window.localStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
      if (sessionUser) {
        window.localStorage.setItem(
          SESSION_USER_KEY,
          JSON.stringify(sessionUser)
        );
      } else {
        window.localStorage.removeItem(SESSION_USER_KEY);
      }
    },
    []
  );

  const clearPersistedSession = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_USER_KEY);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      setIsAuthenticating(true);
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : "Unable to sign in with the provided credentials";
          throw new Error(message);
        }

        const newSessionId = data?.sessionId as string | undefined;
        const sessionUser = (data?.user ?? null) as OdooLoginResult | null;

        if (!newSessionId) {
          throw new Error("Missing session id in server response");
        }

        setSessionId(newSessionId);
        setUser(sessionUser);
        persistSession(newSessionId, sessionUser);
        setStatus("authenticated");
      } catch (error) {
        setSessionId(null);
        setUser(null);
        clearPersistedSession();
        setStatus("unauthenticated");
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [persistSession, clearPersistedSession]
  );

  const logout = useCallback(() => {
    setSessionId(null);
    setUser(null);
    clearPersistedSession();
    setStatus("unauthenticated");
  }, [clearPersistedSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionId,
      user,
      isAuthenticated: status === "authenticated",
      isCheckingAuth: status === "checking",
      isAuthenticating,
      login,
      logout,
    }),
    [sessionId, user, status, isAuthenticating, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
