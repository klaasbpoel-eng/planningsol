import { useSyncExternalStore } from "react";

export type LayoutWidth = "normal" | "full";
const KEY = "layout-width";
const EVENT = "layout-width-change";

export function getLayoutWidth(): LayoutWidth {
  try {
    return localStorage.getItem(KEY) === "full" ? "full" : "normal";
  } catch {
    return "normal";
  }
}

export function setLayoutWidth(width: LayoutWidth) {
  try { localStorage.setItem(KEY, width); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useLayoutWidth() {
  const width = useSyncExternalStore(subscribe, getLayoutWidth, () => "normal" as LayoutWidth);
  return { width, setWidth: setLayoutWidth, toggle: () => setLayoutWidth(width === "full" ? "normal" : "full") };
}
