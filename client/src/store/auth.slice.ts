import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@enrollpro/shared";

export type AuthRole = Role | "REGISTRAR" | (string & {});

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
  accountName: string | null;
  role: AuthRole;
  mustChangePassword?: boolean;
}

interface AuthState {
  token: string | null;
  user: User | null;
  sessionExpired: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setSessionExpired: (expired: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sessionExpired: false,
      setAuth: (token, user) => set({ token, user, sessionExpired: false }),
      clearAuth: () => set({ token: null, user: null }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
    }),
    {
      name: "auth-storage",
      // Do not persist sessionExpired — it's a transient UI flag
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
