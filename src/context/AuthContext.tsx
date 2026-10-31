import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthService, type UserRecord } from "../lib/auth/authService";
import { SessionService, type SessionRecord } from "../lib/auth/sessionService";
import { runMigrations } from "../lib/db/migrations";
import { initDb } from "../lib/db/connection";

const SESSION_TOKEN_KEY = "kanban_session_token";
const THEME_KEY = "kanban_theme_preference";

export interface AuthContextType {
  user: UserRecord | null;
  session: SessionRecord | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initError: string | null;
  retryInit: () => Promise<void>;
  theme: "dark" | "light" | "system";
  accounts: Array<{ id: string; email: string; display_name: string; status: string }>;
  login: (email: string, password: string, durationDays?: number, keepSignedIn?: boolean) => Promise<{ success: boolean; error?: string; remainingSeconds?: number }>;
  register: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; recoveryKey?: string; user?: UserRecord; error?: string }>;
  resumePendingRegistration: (email: string, password: string) => Promise<{ success: boolean; recoveryKey?: string; user?: UserRecord; error?: string }>;
  confirmRecoveryKey: (userId: string, recoveryKey: string) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithRecoveryKey: (email: string, recoveryKey: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  switchAccount: (targetUserId: string) => Promise<boolean>;
  logout: () => void;
  setTheme: (theme: "dark" | "light" | "system") => void;
  refreshAccounts: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserRecord | null>(null);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; email: string; display_name: string; status: string }>>([]);
  const [theme, setThemeState] = useState<"dark" | "light" | "system">("dark");

  const [services, setServices] = useState<{
    auth: AuthService;
    session: SessionService;
  } | null>(null);

  const refreshAccounts = useCallback(() => {
    if (!services) return;
    try {
      const list = services.auth.listLocalAccounts();
      setAccounts(list);
    } catch {
      // Ignore if uninitialized
    }
  }, [services]);

  const applyTheme = useCallback((themeChoice: "dark" | "light" | "system") => {
    let activeTheme: "dark" | "light" = "dark";
    if (themeChoice === "system") {
      activeTheme = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      activeTheme = themeChoice;
    }
    document.documentElement.setAttribute("data-theme", activeTheme);
  }, []);

  const setTheme = useCallback((newTheme: "dark" | "light" | "system") => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
  }, [applyTheme]);

  const bootstrap = useCallback(async () => {
    setIsLoading(true);
    setInitError(null);
    try {
      const savedTheme = (localStorage.getItem(THEME_KEY) as "dark" | "light" | "system") || "dark";
      setThemeState(savedTheme);
      applyTheme(savedTheme);

      try {
        const savedGradient = localStorage.getItem("kanban_gradient_preference");
        if (savedGradient && savedGradient !== "default") {
          document.documentElement.setAttribute("data-gradient", savedGradient);
          document.documentElement.setAttribute("data-canvas-gradient", savedGradient);
        } else {
          document.documentElement.removeAttribute("data-gradient");
          document.documentElement.removeAttribute("data-canvas-gradient");
        }
      } catch {}

      const db = await initDb();
      runMigrations(db);

      const auth = new AuthService(db);
      const sess = new SessionService(db);

      setServices({ auth, session: sess });

      // Restore session from token
      const savedToken = localStorage.getItem(SESSION_TOKEN_KEY);
      if (savedToken) {
        const val = sess.validateSession(savedToken);
        if (val.valid && val.user && val.session) {
          setUser(val.user);
          setSession(val.session);
        } else {
          localStorage.removeItem(SESSION_TOKEN_KEY);
        }
      }

      setAccounts(auth.listLocalAccounts());
      setInitError(null);
    } catch (err) {
      console.error("Initialization error:", err);
      setInitError((err as Error).message || "Failed to initialize database");
    } finally {
      setIsLoading(false);
    }
  }, [applyTheme]);

  // Initialize DB and restore session on mount
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const getDbStatusError = useCallback(() => {
    if (initError) return `Database initialization failed: ${initError}`;
    return "Database is still initializing, please wait a moment...";
  }, [initError]);

  const login = useCallback(
    async (email: string, password: string, durationDays: number = 30, keepSignedIn: boolean = true) => {
      if (!services) return { success: false, error: getDbStatusError() };
      try {
        const result = await services.auth.login(email, password);
        if (!result.success || !result.user) {
          return { success: false, error: result.error, remainingSeconds: result.remainingSeconds };
        }

        const newSession = services.session.createSession(result.user.id, durationDays, keepSignedIn);
        setUser(result.user);
        setSession(newSession);

        if (keepSignedIn) {
          localStorage.setItem(SESSION_TOKEN_KEY, newSession.token);
        } else {
          sessionStorage.setItem(SESSION_TOKEN_KEY, newSession.token);
        }

        refreshAccounts();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [services, refreshAccounts, getDbStatusError]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      if (!services) return { success: false, error: getDbStatusError() };
      try {
        const result = await services.auth.register(email, password, displayName);
        refreshAccounts();
        return { success: true, recoveryKey: result.recoveryKey, user: result.user };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [services, refreshAccounts, getDbStatusError]
  );

  const resumePendingRegistration = useCallback(
    async (email: string, password: string) => {
      if (!services) return { success: false, error: getDbStatusError() };
      try {
        const result = await services.auth.resumePendingRegistration(email, password);
        return { success: true, recoveryKey: result.recoveryKey, user: result.user };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [services, getDbStatusError]
  );

  const confirmRecoveryKey = useCallback(
    async (userId: string, recoveryKey: string) => {
      if (!services) return { success: false, error: getDbStatusError() };
      try {
        const confirmed = await services.auth.confirmRecoveryKey(userId, recoveryKey);
        if (!confirmed) {
          return { success: false, error: "Recovery key does not match" };
        }

        // Auto login on confirmation
        const activeUser = services.auth.getUserById(userId);
        if (activeUser) {
          const newSession = services.session.createSession(userId, 30, true);
          setUser(activeUser);
          setSession(newSession);
          localStorage.setItem(SESSION_TOKEN_KEY, newSession.token);
        }

        refreshAccounts();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [services, refreshAccounts, getDbStatusError]
  );

  const resetPasswordWithRecoveryKey = useCallback(
    async (email: string, recoveryKey: string, newPassword: string) => {
      if (!services) return { success: false, error: getDbStatusError() };
      try {
        await services.auth.resetPasswordWithRecoveryKey(email, recoveryKey, newPassword);
        // Clean session since password was reset
        localStorage.removeItem(SESSION_TOKEN_KEY);
        setUser(null);
        setSession(null);
        refreshAccounts();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
    [services, refreshAccounts]
  );

  const switchAccount = useCallback(
    async (targetUserId: string): Promise<boolean> => {
      if (!services) return false;
      try {
        const currentToken = session?.token || localStorage.getItem(SESSION_TOKEN_KEY);
        const newSession = services.session.switchAccount(currentToken, targetUserId);

        const targetUser = services.auth.getUserById(targetUserId);
        if (!targetUser) throw new Error("Target account not found");

        // Flush in-memory state and establish target account
        setUser(targetUser);
        setSession(newSession);
        localStorage.setItem(SESSION_TOKEN_KEY, newSession.token);

        refreshAccounts();
        return true;
      } catch (err) {
        console.error("Failed to switch account:", err);
        return false;
      }
    },
    [session, services, refreshAccounts]
  );

  const logout = useCallback(() => {
    if (!services) return;
    const currentToken = session?.token || localStorage.getItem(SESSION_TOKEN_KEY);
    if (currentToken) {
      services.session.destroySession(currentToken);
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_TOKEN_KEY);

    // Completely clear React in-memory state to prevent cross-account leakage
    setUser(null);
    setSession(null);
    refreshAccounts();
  }, [session, services, refreshAccounts]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user && user.status === "active",
        isLoading,
        initError,
        retryInit: bootstrap,
        theme,
        accounts,
        login,
        register,
        resumePendingRegistration,
        confirmRecoveryKey,
        resetPasswordWithRecoveryKey,
        switchAccount,
        logout,
        setTheme,
        refreshAccounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
