import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  fetchMe,
  login as apiLogin,
  logout as apiLogout,
  setUnauthorizedHandler,
  type AuthUser,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isGestor: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const ADMIN_ROLES = new Set(["admin", "super_admin", "gestor"]);

function deriveRoleFlags(user: AuthUser | null) {
  const roles = user?.roles ?? [];
  return {
    isAdmin: roles.some((r) => ADMIN_ROLES.has(r)),
    isSuperAdmin: roles.includes("super_admin"),
    isGestor: roles.includes("gestor"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, try to restore the session from the httpOnly cookie.
    // /auth/me returns 401 for anonymous visitors — api.ts's fetchMe swallows
    // that and returns null so we don't trip the global 401 handler on boot.
    let cancelled = false;
    (async () => {
      const me = await fetchMe();
      if (!cancelled) {
        setUser(me);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Any 401 from a non-/auth/me call means the session died (expired cookie,
    // token_version bumped server-side, etc). Clear local state so the next
    // render forces a redirect to /login via ProtectedRoute.
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const next = await apiLogin(email, password);
      setUser(next);
      return { error: null };
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Erro inesperado";
      return { error: new Error(message) };
    }
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const flags = deriveRoleFlags(user);
    return { user, loading, ...flags, signIn, signOut };
  }, [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
