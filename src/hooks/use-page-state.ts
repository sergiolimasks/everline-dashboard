import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_PREFIX = "dashboard-ui:";
let storageInitialized = false;

function initializePageStateStorage() {
  if (typeof window === "undefined" || storageInitialized) return;

  storageInitialized = true;

  const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (navigationEntry?.type !== "reload") return;

  const keysToClear: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      keysToClear.push(key);
    }
  }

  keysToClear.forEach((key) => sessionStorage.removeItem(key));
}

function readStoredValue<T>(key: string, fallback: T): T {
  initializePageStateStorage();

  if (typeof window === "undefined") return fallback;

  const stored = sessionStorage.getItem(key);
  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify(value));
}

export function usePageState<T>(key: string, initialState: T) {
  const storageKey = `${STORAGE_PREFIX}${key}:state`;
  const [state, setState] = useState<T>(() => readStoredValue(storageKey, initialState));

  useEffect(() => {
    writeStoredValue(storageKey, state);
  }, [state, storageKey]);

  return [state, setState] as const;
}

export function usePageScroll(key: string, ready = true) {
  const storageKey = `${STORAGE_PREFIX}${key}:scroll`;
  const restoredWhenReadyRef = useRef(false);

  const restoreScroll = useCallback(() => {
    initializePageStateStorage();

    if (typeof window === "undefined") return;

    const stored = sessionStorage.getItem(storageKey);
    const scrollY = stored ? Number(JSON.parse(stored)) : 0;

    if (!Number.isFinite(scrollY)) return;

    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    });
  }, [storageKey]);

  const saveScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    writeStoredValue(storageKey, window.scrollY);
  }, [storageKey]);

  useEffect(() => {
    restoreScroll();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveScroll();
      }
    };

    window.addEventListener("pagehide", saveScroll);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      saveScroll();
      window.removeEventListener("pagehide", saveScroll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [restoreScroll, saveScroll]);

  useEffect(() => {
    if (!ready || restoredWhenReadyRef.current) return;

    restoredWhenReadyRef.current = true;
    restoreScroll();
  }, [ready, restoreScroll]);
}
