import type { Easing, Transition, Variants } from "motion/react"

export const smoothEase: Easing = [0.22, 1, 0.36, 1]

export const pageTransition: Transition = {
  duration: 0.24,
  ease: smoothEase,
}

export const panelTransition: Transition = {
  duration: 0.2,
  ease: smoothEase,
}

export const staggerTransition: Transition = {
  staggerChildren: 0.05,
  delayChildren: 0.03,
}

export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transitionEnd: {
      transform: "none",
    },
  },
  exit: {
    opacity: 0,
    y: -8,
  },
}

export const sectionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
}

export const listVariants: Variants = {
  initial: {},
  animate: {},
}

export const statusVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
    y: 6,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
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
