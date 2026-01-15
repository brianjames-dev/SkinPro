"use client";

import { useCallback, useRef, useState } from "react";

type UnsavedGuardOptions = {
  isEnabled: boolean;
  getSnapshot: () => string;
  onSave?: () => Promise<boolean> | boolean;
  onDiscard?: () => void;
};

type UnsavedGuardState = {
  isDirty: () => boolean;
  markSnapshot: () => void;
  resetSnapshot: () => void;
  requestExit: (action: () => void) => void;
  prompt: {
    open: boolean;
    onStay: () => void;
    onDiscard: () => void;
    onSave: () => void;
  };
};

export default function useUnsavedChangesGuard({
  isEnabled,
  getSnapshot,
  onSave,
  onDiscard
}: UnsavedGuardOptions): UnsavedGuardState {
  const snapshotRef = useRef<string | null>(null);
  const pendingActionRef = useRef<null | (() => void)>(null);
  const [isPromptOpen, setIsPromptOpen] = useState(false);

  const markSnapshot = useCallback(() => {
    snapshotRef.current = getSnapshot();
  }, [getSnapshot]);

  const resetSnapshot = useCallback(() => {
    snapshotRef.current = null;
  }, []);

  const isDirty = useCallback(() => {
    if (!isEnabled || !snapshotRef.current) {
      return false;
    }
    return snapshotRef.current !== getSnapshot();
  }, [getSnapshot, isEnabled]);

  const requestExit = useCallback(
    (action: () => void) => {
      if (!isEnabled || !isDirty()) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setIsPromptOpen(true);
    },
    [isEnabled, isDirty]
  );

  const handleStay = useCallback(() => {
    pendingActionRef.current = null;
    setIsPromptOpen(false);
  }, []);

  const handleDiscard = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsPromptOpen(false);
    onDiscard?.();
    resetSnapshot();
    action?.();
  }, [onDiscard, resetSnapshot]);

  const handleSave = useCallback(async () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setIsPromptOpen(false);
    const saved = (await onSave?.()) ?? true;
    if (!saved) {
      setIsPromptOpen(true);
      return;
    }
    resetSnapshot();
    action?.();
  }, [onSave, resetSnapshot]);

  return {
    isDirty,
    markSnapshot,
    resetSnapshot,
    requestExit,
    prompt: {
      open: isPromptOpen,
      onStay: handleStay,
      onDiscard: handleDiscard,
      onSave: handleSave
    }
  };
}
