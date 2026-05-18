import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@enrollpro/shared";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  employeeId: string | null;
  accountName: string | null;
  role: Role;
  mustChangePassword?: boolean;
}

interface LearnerAuthState {
  token: string | null;
  user: User | null;
  sessionExpired: boolean;
  isHydrated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setSessionExpired: (expired: boolean) => void;
  setHydrated: () => void;
}

export const useLearnerAuthStore = create<LearnerAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      sessionExpired: false,
      isHydrated: false,
      setAuth: (token, user) => set({ token, user, sessionExpired: false }),
      clearAuth: () => set({ token: null, user: null }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "learner-auth-storage",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
