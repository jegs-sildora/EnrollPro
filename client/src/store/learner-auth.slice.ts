import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface LearnerUser {
  id: number;
  lrn: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  schoolName: string;
  schoolAcronym: string;
  gradeLevelName: string | null;
  sectionName: string | null;
}

interface LearnerAuthState {
  user: LearnerUser | null;
  token: string | null;
  requiresPasswordReset: boolean;
  sessionExpired: boolean;
  isHydrated: boolean;
  setAuth: (user: LearnerUser, token?: string | null) => void;
  setRequiresPasswordReset: (value: boolean) => void;
  clearAuth: () => void;
  setSessionExpired: (expired: boolean) => void;
  setHydrated: () => void;
}

export const useLearnerAuthStore = create<LearnerAuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      requiresPasswordReset: false,
      sessionExpired: false,
      isHydrated: false,
      setAuth: (user, token) => set({ user, token, requiresPasswordReset: false, sessionExpired: false }),
      setRequiresPasswordReset: (value) => set({ requiresPasswordReset: value }),
      clearAuth: () => set({ user: null, token: null, requiresPasswordReset: false }),
      setSessionExpired: (expired) => set({ sessionExpired: expired }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "learner-auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
