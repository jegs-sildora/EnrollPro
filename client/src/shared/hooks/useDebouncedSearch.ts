import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface UseDebouncedSearchResult {
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  activeFilter: string;
  isSearching: boolean;
  clearSearch: () => void;
}

export function useDebouncedSearch(initialValue = ""): UseDebouncedSearchResult {
  const [inputValue, setInputValue] = useState(initialValue);
  const [activeFilter, setActiveFilter] = useState(initialValue.trim());
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
  }, []);

  const clearSearch = useCallback(() => {
    clearTimers();
    setInputValue("");
    setActiveFilter("");
    setIsSearching(false);
  }, [clearTimers]);

  const [prevInitial, setPrevInitial] = useState(initialValue);

  if (initialValue !== prevInitial) {
    setPrevInitial(initialValue);
    setInputValue(initialValue);
    setActiveFilter(initialValue.trim());
    setIsSearching(false);
  }

  useEffect(() => {
    clearTimers();

    const trimmedValue = inputValue.trim();
    if (trimmedValue === activeFilter) {
      if (isSearching) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSearching(false);
      }
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      setActiveFilter(trimmedValue);
      setIsSearching(false);
      debounceTimerRef.current = null;
    }, 300);

    return clearTimers;
  }, [activeFilter, clearTimers, inputValue]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  return {
    inputValue,
    setInputValue,
    activeFilter,
    isSearching,
    clearSearch,
  };
}
