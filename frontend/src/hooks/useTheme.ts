import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'notebook.theme';

function readStoredPreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'system';
  const value = localStorage.getItem(STORAGE_KEY);
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? getSystemTheme() : pref;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

// Shared subscription so every component stays in sync. Updates are
// broadcast through a storage-style event on window.
const THEME_EVENT = 'notebook:theme-change';

function subscribe(listener: () => void) {
  const onEvent = () => listener();
  window.addEventListener(THEME_EVENT, onEvent);
  window.addEventListener('storage', onEvent);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', onEvent);
  return () => {
    window.removeEventListener(THEME_EVENT, onEvent);
    window.removeEventListener('storage', onEvent);
    media.removeEventListener('change', onEvent);
  };
}

function getPreferenceSnapshot(): ThemePreference {
  return readStoredPreference();
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribe,
    getPreferenceSnapshot,
    () => 'system' as ThemePreference,
  );
  const resolvedTheme: ResolvedTheme = resolveTheme(preference);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }, []);

  const toggle = useCallback(() => {
    const current = resolveTheme(readStoredPreference());
    setPreference(current === 'dark' ? 'light' : 'dark');
  }, [setPreference]);

  return { preference, resolvedTheme, setPreference, toggle };
}

// Note: the initial `dark` class is set by an inline script in
// index.html before React mounts, so there is no flash of light
// content. The `useEffect` above handles subsequent toggles.
