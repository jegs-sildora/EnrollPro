import { useMemo } from "react"
import {
  useReducedMotion,
  type Easing,
  type Transition,
  type Variants,
} from "motion/react"

export type MotionDurationToken = "instant" | "fast" | "normal" | "slow"
export type MotionDistanceToken = "xs" | "sm" | "md"
export type MotionEaseToken = "smooth" | "sharp"

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.16,
    normal: 0.24,
    slow: 0.34,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1] as Easing,
    sharp: [0.4, 0, 0.2, 1] as Easing,
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 12,
  },
  spring: {
    soft: {
      type: "spring",
      stiffness: 360,
      damping: 30,
      mass: 0.9,
    } as const,
    pill: {
      type: "spring",
      stiffness: 420,
      damping: 32,
      mass: 0.85,
    } as const,
  },
} as const

export const smoothEase = motionTokens.easing.smooth
export const sharpEase = motionTokens.easing.sharp

export interface MotionPreferences {
  reduceMotion: boolean
  prefersReducedMotion: boolean
  isLowEndDevice: boolean
  durations: Record<MotionDurationToken, number>
  distances: Record<MotionDistanceToken, number>
}

function detectLowEndDevice() {
  if (typeof navigator === "undefined") {
    return false
  }

  const deviceMemory = "deviceMemory" in navigator
    ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    : undefined
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 8

  if (typeof deviceMemory === "number" && deviceMemory <= 2) {
    return true
  }

  return deviceMemory === undefined && hardwareConcurrency <= 4
}

export function useMotionPreferences(): MotionPreferences {
  const prefersReducedMotion = Boolean(useReducedMotion())
  const isLowEndDevice = useMemo(() => detectLowEndDevice(), [])
  const reduceMotion = prefersReducedMotion || isLowEndDevice

  return useMemo(() => {
    const durationMultiplier = reduceMotion ? 0.45 : 1
    const distanceMultiplier = reduceMotion ? 0 : 1

    return {
      reduceMotion,
      prefersReducedMotion,
      isLowEndDevice,
      durations: {
        instant: motionTokens.duration.instant * durationMultiplier,
        fast: motionTokens.duration.fast * durationMultiplier,
        normal: motionTokens.duration.normal * durationMultiplier,
        slow: motionTokens.duration.slow * durationMultiplier,
      },
      distances: {
        xs: motionTokens.distance.xs * distanceMultiplier,
        sm: motionTokens.distance.sm * distanceMultiplier,
        md: motionTokens.distance.md * distanceMultiplier,
      },
    }
  }, [isLowEndDevice, prefersReducedMotion, reduceMotion])
}

export function createMotionTransition(
  preferences: Pick<MotionPreferences, "durations">,
  duration: MotionDurationToken = "normal",
  ease: MotionEaseToken = "smooth",
): Transition {
  return {
    duration: preferences.durations[duration],
    ease: motionTokens.easing[ease],
  }
}

export function createFadeShiftVariants(
  preferences: Pick<MotionPreferences, "distances" | "reduceMotion">,
  enterAxis: "x" | "y" = "y",
  exitAxis: "x" | "y" = enterAxis,
  distance: MotionDistanceToken = "sm",
): Variants {
  const enterDistance = preferences.reduceMotion ? 0 : preferences.distances[distance]
  const exitDistance = preferences.reduceMotion ? 0 : preferences.distances[distance]
  const initialState: Record<string, number> = {
    opacity: 0,
    [enterAxis]: enterDistance,
  }
  const animateState: Record<string, number> = {
    opacity: 1,
    [enterAxis]: 0,
  }
  const exitState: Record<string, number> = {
    opacity: 0,
    [exitAxis]: exitDistance * -1,
  }

  return {
    initial: initialState,
    animate: animateState,
    exit: exitState,
  }
}

export function createScaleFadeVariants(
  preferences: Pick<MotionPreferences, "reduceMotion">,
  scale = 0.97,
): Variants {
  return {
    initial: {
      opacity: 0,
      scale: preferences.reduceMotion ? 1 : scale,
    },
    animate: {
      opacity: 1,
      scale: 1,
    },
    exit: {
      opacity: 0,
      scale: preferences.reduceMotion ? 1 : scale,
    },
  }
}

export function createListContainerTransition(
  preferences: Pick<MotionPreferences, "durations" | "reduceMotion">,
): Transition {
  return {
    staggerChildren: preferences.reduceMotion ? 0 : 0.04,
    delayChildren: preferences.reduceMotion ? 0 : 0.02,
  }
}

export const motionClassNames = {
  overlay: "motion-ui-overlay",
  dialogContent: "motion-ui-dialog-content",
  floatingContent: "motion-ui-floating-content",
  floatingSubContent: "motion-ui-floating-subcontent",
  navigationContent: "motion-ui-navigation-content",
  navigationViewport: "motion-ui-navigation-viewport",
  navigationIndicator: "motion-ui-navigation-indicator",
  closeButton:
    "motion-ui-close-button transition-[background-color,color,border-color,box-shadow,opacity,transform] [transition-duration:var(--motion-duration-fast)] [transition-timing-function:var(--motion-ease-smooth)]",
  controlSurface:
    "transition-[background-color,color,border-color,box-shadow,transform,opacity] [transition-duration:var(--motion-duration-fast)] [transition-timing-function:var(--motion-ease-smooth)] active:scale-[0.985] disabled:active:scale-100",
  controlIndicator:
    "transition-[opacity,transform] [transition-duration:var(--motion-duration-fast)] [transition-timing-function:var(--motion-ease-smooth)]",
  tabContent: "motion-ui-tab-content",
  collapsibleContent: "motion-ui-collapsible-content",
} as const

const defaultPreferences: MotionPreferences = {
  reduceMotion: false,
  prefersReducedMotion: false,
  isLowEndDevice: false,
  durations: {
    instant: motionTokens.duration.instant,
    fast: motionTokens.duration.fast,
    normal: motionTokens.duration.normal,
    slow: motionTokens.duration.slow,
  },
  distances: {
    xs: motionTokens.distance.xs,
    sm: motionTokens.distance.sm,
    md: motionTokens.distance.md,
  },
}

export const pageTransition: Transition = createMotionTransition(
  defaultPreferences,
  "normal",
)

export const panelTransition: Transition = createMotionTransition(
  defaultPreferences,
  "fast",
)

export const staggerTransition: Transition = createListContainerTransition(
  defaultPreferences,
)

export const pageVariants: Variants = createFadeShiftVariants(
  defaultPreferences,
  "y",
  "y",
  "sm",
)

export const sectionVariants: Variants = createFadeShiftVariants(
  defaultPreferences,
  "y",
  "y",
  "md",
)

export const listVariants: Variants = {
  initial: {},
  animate: {
    transition: staggerTransition,
  },
}

export const statusVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: motionTokens.distance.xs,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: motionTokens.distance.xs * -1,
  },
}

export function getReducedMotionProps(reducedMotion: boolean) {
  if (!reducedMotion) {
    return {
      initial: "initial",
      animate: "animate",
      exit: "exit",
    } as const
  }

  return {
    initial: false,
    animate: undefined,
    exit: undefined,
  } as const
}
