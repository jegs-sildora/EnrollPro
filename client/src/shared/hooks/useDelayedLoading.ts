import { useState, useEffect } from 'react';

/**
 * Hook to manage delayed loading states.
 * Modified to return immediately based on user feedback.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 200) {
  // Return immediately to ensure instant loading skeletons across the app
  return isLoading;
}
