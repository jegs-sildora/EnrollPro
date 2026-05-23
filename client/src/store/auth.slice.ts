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
  user: User | null;
  sessionExpired: boolean;
  isHydrated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setSessionExpired: (expired: boolean) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionExpired: false,
      isHydrated: false,
      setAuth: (user) => set({ user, sessionExpired: false }),
      clearAuth: () => set({ user: null }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "auth-storage",
      // Do not persist sessionExpired — it's a transient UI flag
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
