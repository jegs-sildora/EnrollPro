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
  user: User | null;
  sessionExpired: boolean;
  isHydrated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  setSessionExpired: (expired: boolean) => void;
  setHydrated: () => void;
}

export const useLearnerAuthStore = create<LearnerAuthState>()(
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
      name: "learner-auth-storage",
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
