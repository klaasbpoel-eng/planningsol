/**
 * Trigger haptic feedback via the Vibration API (mobile devices).
 * Falls back silently on unsupported devices.
 */
export function haptic(style: "light" | "medium" | "heavy" = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  const durations: Record<string, number> = {
    light: 5,
    medium: 15,
    heavy: 30,
  };

  try {
    navigator.vibrate(durations[style]);
  } catch {
    // silently fail
  }
}
