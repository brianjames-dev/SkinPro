"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";

type UnsavedEntry = {
  isDirty: () => boolean;
  requestExit: (action: () => void) => void;
};

type UnsavedChangesContextValue = {
  register: (key: string, entry: UnsavedEntry) => () => void;
  getEntry: (key: string) => UnsavedEntry | null;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef(new Map<string, UnsavedEntry>());

  const register = useCallback((key: string, entry: UnsavedEntry) => {
    registryRef.current.set(key, entry);
    return () => {
      registryRef.current.delete(key);
    };
  }, []);

  const getEntry = useCallback((key: string) => {
    return registryRef.current.get(key) ?? null;
  }, []);

  const value = useMemo(
    () => ({
      register,
      getEntry
    }),
    [register, getEntry]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChangesContext() {
  return useContext(UnsavedChangesContext);
}

export function useUnsavedChangesRegistry(key: string, entry: UnsavedEntry) {
  const ctx = useUnsavedChangesContext();
  useEffect(() => {
    if (!ctx) {
      return;
    }
    return ctx.register(key, entry);
  }, [ctx, entry, key]);
}
