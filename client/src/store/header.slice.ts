import { create } from "zustand";

interface HeaderState {
  title: string | null;
  setTitle: (title: string | null) => void;
}

export const useHeaderStore = create<HeaderState>((set) => ({
  title: null,
  setTitle: (title) => set({ title }),
}));
