import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, setToken, clearToken } from "@/src/api/client";

type User = { id: string; email: string; name: string };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) {
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          await clearToken();
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
