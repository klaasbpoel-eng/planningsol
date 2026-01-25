import { Sun, Sunset, Calendar } from "lucide-react";

// Day part helpers
export const dayPartLabels: Record<string, string> = {
  morning: "Ochtend",
  afternoon: "Middag",
  full_day: "Hele dag",
};

export const dayPartShortLabels: Record<string, string> = {
  morning: "☀️",
  afternoon: "🌅",
  full_day: "",
};

export const getDayPartLabel = (dayPart: string | null | undefined): string => {
  if (!dayPart || dayPart === "full_day") return "";
  return dayPartLabels[dayPart] || "";
};

export const getDayPartIcon = (dayPart: string | null | undefined) => {
  if (!dayPart || dayPart === "full_day") return null;
  switch (dayPart) {
    case "morning":
      return Sun;
    case "afternoon":
      return Sunset;
    default:
      return Calendar;
  }
};

export const getDayPartBadgeColor = (dayPart: string | null | undefined): string => {
  if (!dayPart || dayPart === "full_day") return "";
  switch (dayPart) {
    case "morning":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "afternoon":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    default:
      return "bg-muted text-muted-foreground";
  }
};

// Time formatting helpers
export const formatTimeRange = (
  startTime: string | null | undefined,
  endTime: string | null | undefined
): string => {
  if (!startTime && !endTime) return "";
  
  const formatTime = (time: string) => {
    // Handle HH:MM:SS or HH:MM format
    const parts = time.split(":");
    return `${parts[0]}:${parts[1]}`;
  };
  
  if (startTime && endTime) {
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  }
  if (startTime) {
    return `Vanaf ${formatTime(startTime)}`;
  }
  if (endTime) {
    return `Tot ${formatTime(endTime)}`;
  }
  return "";
};

export const formatTimeShort = (time: string | null | undefined): string => {
  if (!time) return "";
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
};

export const hasTimeInfo = (
  startTime: string | null | undefined,
  endTime: string | null | undefined
): boolean => {
  return !!(startTime || endTime);
};
