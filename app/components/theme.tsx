"use client";

import { useSyncExternalStore } from "react";

type ThemeValue = "system" | "light" | "dark";
const key = "prompt-tool-theme";
const event = "prompt-tool-theme-change";
let memoryTheme: ThemeValue | undefined;

function valid(value: string | null): ThemeValue {
  return value === "dark" || value === "light" ? value : "system";
}

function snapshot(): ThemeValue {
  if (memoryTheme) return memoryTheme;
  try { return valid(localStorage.getItem(key)); } catch { return "system"; }
}

function subscribe(callback: () => void) {
  function changed() {
    document.documentElement.dataset.theme = snapshot();
    callback();
  }
  function stored(change: StorageEvent) {
    if (change.key === key || change.key === null) {
      memoryTheme = undefined;
      changed();
    }
  }
  window.addEventListener(event, changed);
  window.addEventListener("storage", stored);
  return () => { window.removeEventListener(event, changed); window.removeEventListener("storage", stored); };
}

export default function Theme() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "system" as const);
  return <label className="theme">Appearance<select value={theme} onChange={e => {
    const value = valid(e.target.value);
    memoryTheme = value;
    try { localStorage.setItem(key, value); } catch { /* Retain the in-memory choice when storage is unavailable. */ }
    document.documentElement.dataset.theme = value;
    window.dispatchEvent(new Event(event));
  }}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
