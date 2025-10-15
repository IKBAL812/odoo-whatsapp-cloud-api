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

type BackendUser = {
  id: number;
  name: string;
  imageUrl?: string | null;
};

type AuthContextValue = {
  sessionId: string | null;
  user: OdooLoginResult | null;
  backendId: number | null;
  backendUserId: number | null;
  backendUsers: BackendUser[];
  backendUsersById: Record<number, BackendUser>;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  isAuthenticating: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginWithSessionId: (sessionId: string) => Promise<void>;
  logout: () => void;
};

const SESSION_STORAGE_KEY = "odooSessionId";
const SESSION_USER_KEY = "odooSessionUser";
const SESSION_BACKEND_KEY = "odooBackendMeta";

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

export default function AuthProvider({ children }: PropsWithChildren) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<OdooLoginResult | null>(null);
  const [backendId, setBackendId] = useState<number | null>(null);
  const [backendUserId, setBackendUserId] = useState<number | null>(null);
  const [backendUsers, setBackendUsers] = useState<BackendUser[]>([]);
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const storedUser = window.localStorage.getItem(SESSION_USER_KEY);
    const storedBackend = window.localStorage.getItem(SESSION_BACKEND_KEY);

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
      if (storedBackend) {
        try {
          const parsed = JSON.parse(storedBackend) as {
            backendId?: number | null;
            backendUserId?: number | null;
            backendUsers?: BackendUser[];
          };
          setBackendId(
            typeof parsed.backendId === "number" ? parsed.backendId : null
          );
          setBackendUserId(
            typeof parsed.backendUserId === "number"
              ? parsed.backendUserId
              : null
          );
          setBackendUsers(Array.isArray(parsed.backendUsers) ? parsed.backendUsers : []);
        } catch (error) {
          console.warn("Failed to parse stored backend meta", error);
          window.localStorage.removeItem(SESSION_BACKEND_KEY);
        }
      }
      setStatus("authenticated");
    } else {
      setStatus("unauthenticated");
    }
  }, []);

  const persistSession = useCallback(
    (
      newSessionId: string,
      sessionUser: OdooLoginResult | null,
      backendMeta?: {
        backendId?: number | null;
        backendUserId?: number | null;
        backendUsers?: BackendUser[];
      }
    ) => {
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
      if (backendMeta) {
        window.localStorage.setItem(
          SESSION_BACKEND_KEY,
          JSON.stringify({
            backendId: backendMeta.backendId ?? null,
            backendUserId: backendMeta.backendUserId ?? null,
            backendUsers: backendMeta.backendUsers ?? [],
          })
        );
      } else {
        window.localStorage.removeItem(SESSION_BACKEND_KEY);
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
    window.localStorage.removeItem(SESSION_BACKEND_KEY);
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
        const backendMeta = data?.backend as
          | {
              backend_id?: number;
              user_id?: number;
              users?: { id: number; name: string; image_url?: string | null }[];
            }
          | undefined;

        if (!newSessionId) {
          throw new Error("Missing session id in server response");
        }

        setSessionId(newSessionId);
        setUser(sessionUser);
        const backendUsersList: BackendUser[] = Array.isArray(
          backendMeta?.users
        )
          ? backendMeta.users.map((user) => ({
              id: user.id,
              name: user.name,
              imageUrl: user.image_url,
            }))
          : [];
        const resolvedBackendId =
          typeof backendMeta?.backend_id === "number"
            ? backendMeta?.backend_id
            : null;
        const resolvedBackendUserId =
          typeof backendMeta?.user_id === "number"
            ? backendMeta?.user_id
            : null;

        setBackendId(resolvedBackendId);
        setBackendUserId(resolvedBackendUserId);
        setBackendUsers(backendUsersList);
        persistSession(newSessionId, sessionUser, {
          backendId: resolvedBackendId,
          backendUserId: resolvedBackendUserId,
          backendUsers: backendUsersList,
        });
        setStatus("authenticated");
      } catch (error) {
        setSessionId(null);
        setUser(null);
        setBackendId(null);
        setBackendUserId(null);
        setBackendUsers([]);
        clearPersistedSession();
        setStatus("unauthenticated");
        throw error;
      } finally {
        setIsAuthenticating(false);
      }
    },
    [persistSession, clearPersistedSession]
  );

  const loginWithSessionId = useCallback(
    async (providedSessionId: string) => {
      setIsAuthenticating(true);
      try {
        const response = await fetch("/api/auth/validate-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: providedSessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : "Invalid or expired session ID";
          throw new Error(message);
        }

        const sessionUser = (data?.user ?? null) as OdooLoginResult | null;
        const backendMeta = data?.backend as
          | {
              backend_id?: number;
              user_id?: number;
              users?: { id: number; name: string; image_url?: string | null }[];
            }
          | undefined;

        setSessionId(providedSessionId);
        setUser(sessionUser);
        const backendUsersList: BackendUser[] = Array.isArray(
          backendMeta?.users
        )
          ? backendMeta.users.map((user) => ({
              id: user.id,
              name: user.name,
              imageUrl: user.image_url,
            }))
          : [];
        const resolvedBackendId =
          typeof backendMeta?.backend_id === "number"
            ? backendMeta?.backend_id
            : null;
        const resolvedBackendUserId =
          typeof backendMeta?.user_id === "number"
            ? backendMeta?.user_id
            : null;

        setBackendId(resolvedBackendId);
        setBackendUserId(resolvedBackendUserId);
        setBackendUsers(backendUsersList);
        persistSession(providedSessionId, sessionUser, {
          backendId: resolvedBackendId,
          backendUserId: resolvedBackendUserId,
          backendUsers: backendUsersList,
        });
        setStatus("authenticated");
      } catch (error) {
        setSessionId(null);
        setUser(null);
        setBackendId(null);
        setBackendUserId(null);
        setBackendUsers([]);
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
    setBackendId(null);
    setBackendUserId(null);
    setBackendUsers([]);
    clearPersistedSession();
    setStatus("unauthenticated");
  }, [clearPersistedSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      sessionId,
      user,
       backendId,
       backendUserId,
       backendUsers,
       backendUsersById: backendUsers.reduce<Record<number, BackendUser>>(
         (acc, backendUser) => {
           acc[backendUser.id] = backendUser;
           return acc;
         },
         {}
       ),
      isAuthenticated: status === "authenticated",
      isCheckingAuth: status === "checking",
      isAuthenticating,
      login,
      loginWithSessionId,
      logout,
    }),
    [
      sessionId,
      user,
      backendId,
      backendUserId,
      backendUsers,
      status,
      isAuthenticating,
      login,
      loginWithSessionId,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
