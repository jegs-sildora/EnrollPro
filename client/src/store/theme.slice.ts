import { useEffect, useState } from "react"
import { create } from "zustand"
import { persist } from "zustand/middleware"

export type ThemeMode = "light" | "dark" | "system"
export type ActiveTheme = "light" | "dark"

export interface ThemeState {
  mode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
  toggleTheme: () => void
}

const getSystemTheme = (): ActiveTheme => {
  if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark"
  }
  return "light"
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "light",
      setThemeMode: (mode) => set({ mode }),
      toggleTheme: () => {
        const currentMode = get().mode
        const effectiveTheme = currentMode === "system" ? getSystemTheme() : currentMode
        const nextTheme: ActiveTheme = effectiveTheme === "light" ? "dark" : "light"
        set({ mode: nextTheme })
      },
    }),
    {
      name: "enrollpro-theme",
    },
  ),
)

export function useActiveTheme(): ActiveTheme {
  const mode = useThemeStore((state) => state.mode)
  const [systemTheme, setSystemTheme] = useState<ActiveTheme>(() => getSystemTheme())

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light")
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  if (mode === "system") {
    return systemTheme
  }
  return mode
}
