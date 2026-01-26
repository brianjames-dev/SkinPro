"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type UseQueryTabSyncOptions<T extends string> = {
  key: string;
  defaultValue: T;
  values: readonly T[];
};

type UseQueryTabSyncResult<T extends string> = {
  value: T;
  setValue: (next: T) => void;
  onChange: (next: T) => void;
  replaceValue: (next: T) => void;
};

export default function useQueryTabSync<T extends string>({
  key,
  defaultValue,
  values
}: UseQueryTabSyncOptions<T>): UseQueryTabSyncResult<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const resolveValue = useCallback(
    (raw: string | null): T => {
      if (raw && values.includes(raw as T)) {
        return raw as T;
      }
      return defaultValue;
    },
    [defaultValue, values]
  );

  const [value, setValue] = useState<T>(() =>
    resolveValue(searchParams.get(key))
  );
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const syncRoute = useCallback(
    (nextValue: T, mode: "push" | "replace") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(key, nextValue);
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;
      if (nextUrl === currentUrl) {
        return;
      }
      if (mode === "push") {
        router.push(nextUrl, { scroll: false });
      } else {
        router.replace(nextUrl, { scroll: false });
      }
    },
    [key, pathname, router, searchParams]
  );

  const handleChange = useCallback(
    (nextValue: T) => {
      if (nextValue === valueRef.current) {
        return;
      }
      setValue(nextValue);
      syncRoute(nextValue, "push");
    },
    [syncRoute]
  );

  const handleReplace = useCallback(
    (nextValue: T) => {
      if (nextValue !== valueRef.current) {
        setValue(nextValue);
      }
      syncRoute(nextValue, "replace");
    },
    [syncRoute]
  );

  useEffect(() => {
    const urlValue = resolveValue(searchParams.get(key));
    if (urlValue !== valueRef.current) {
      setValue(urlValue);
      return;
    }
    if (!searchParams.get(key)) {
      syncRoute(valueRef.current, "replace");
    }
  }, [key, resolveValue, searchParams, syncRoute]);

  return {
    value,
    setValue,
    onChange: handleChange,
    replaceValue: handleReplace
  };
}
