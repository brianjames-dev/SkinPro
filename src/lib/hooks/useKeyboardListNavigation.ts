"use client";

import { useCallback, useEffect, useState } from "react";

type UseKeyboardListNavigationOptions<T> = {
  items: T[];
  isOpen: boolean;
  onSelect?: (item: T) => void;
};

type UseKeyboardListNavigationResult = {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent) => boolean;
  resetActiveIndex: () => void;
};

export default function useKeyboardListNavigation<T>({
  items,
  isOpen,
  onSelect
}: UseKeyboardListNavigationOptions<T>): UseKeyboardListNavigationResult {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!isOpen || items.length === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => (prev >= items.length ? items.length - 1 : prev));
  }, [isOpen, items.length]);

  const resetActiveIndex = useCallback(() => setActiveIndex(-1), []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen || items.length === 0) {
        return false;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => {
          if (prev < 0) {
            return 0;
          }
          return Math.min(prev + 1, items.length - 1);
        });
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const nextIndex = activeIndex >= 0 ? activeIndex : 0;
        const item = items[nextIndex];
        if (item) {
          onSelect?.(item);
        }
        return true;
      }
      return false;
    },
    [activeIndex, isOpen, items, onSelect]
  );

  return {
    activeIndex,
    setActiveIndex,
    onKeyDown,
    resetActiveIndex
  };
}
