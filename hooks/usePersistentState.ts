'use client';

import { useCallback, useEffect, useState } from 'react';

export function usePersistentState<T>(key: string, initializer: () => T) {
  const [value, setValue] = useState<T>(initializer);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) {
        setValue(JSON.parse(stored));
      }
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, ready, value]);

  const reset = useCallback(() => {
    const next = initializer();
    setValue(next);
    window.localStorage.setItem(key, JSON.stringify(next));
  }, [initializer, key]);

  return { value, setValue, ready, reset } as const;
}
