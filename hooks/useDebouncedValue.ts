import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates
 * after `delay` milliseconds have elapsed since the last change.
 *
 * Cleanup cancels the pending timer on every value change and on unmount,
 * preventing stale-closure updates.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
