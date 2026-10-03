/**
 * Patched @radix-ui/react-compose-refs — React 19 compatible
 *
 * PROBLEM
 * =======
 * Radix `Slot` (used by every `asChild` component) calls `composeRefs()`
 * directly during render — NOT inside a hook:
 *
 *   props2.ref = forwardedRef ? composeRefs(forwardedRef, childrenRef) : childrenRef;
 *
 * This creates a NEW callback ref function on every render.  React 19
 * treats a new callback ref identity as a ref change: it detaches the
 * old ref (calls it with null or runs its cleanup), then attaches the
 * new one.  If any individual ref (e.g. Radix `usePresence`) calls
 * `setState` during attach/detach, that triggers a re-render → new ref
 * → detach/attach → setState → re-render → infinite loop.
 *
 * FIX
 * ===
 * `composeRefs` caches the composed callback on the first ref argument
 * (using a WeakMap).  On subsequent calls with the same first ref, it
 * returns the SAME function object — so React 19 sees a stable ref and
 * does NOT detach/re-attach.  The latest set of refs is read from a
 * mutable array so the stable callback always forwards to the current refs.
 *
 * `useComposedRefs` also returns a stable callback via useRef + useCallback.
 */
import { useRef, useCallback } from "react"

type PossibleRef<T> = React.Ref<T> | undefined

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref !== null && ref !== undefined) {
    ;(ref as React.MutableRefObject<T>).current = value
  }
}

/**
 * Cache keyed by the first ref argument.  For a given `forwardedRef`,
 * we always return the same composed callback.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const composedRefCache = new WeakMap<object, { callback: React.RefCallback<any>; refs: PossibleRef<any>[] }>()

function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  // Find a ref that can serve as a WeakMap key (must be an object).
  const keyRef = refs.find((r) => r !== null && r !== undefined && (typeof r === "object" || typeof r === "function")) as object | undefined

  if (keyRef) {
    const cached = composedRefCache.get(keyRef)
    if (cached) {
      // Update the mutable refs array so the stable callback reads fresh refs.
      cached.refs = refs
      return cached.callback as React.RefCallback<T>
    }

    // First time seeing this key ref — create a stable callback.
    const entry: { callback: React.RefCallback<T>; refs: PossibleRef<T>[] } = {
      callback: (node: T) => {
        entry.refs.forEach((ref) => setRef(ref, node))
      },
      refs,
    }
    composedRefCache.set(keyRef, entry)
    return entry.callback
  }

  // Fallback: no cacheable ref — return a fresh function (rare/harmless).
  return (node: T) => {
    refs.forEach((ref) => setRef(ref, node))
  }
}

function useComposedRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  const latestRefs = useRef(refs)
  latestRefs.current = refs

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(((node: T) => {
    latestRefs.current.forEach((ref) => setRef(ref, node))
  }) as React.RefCallback<T>, [])
}

export { composeRefs, useComposedRefs }
