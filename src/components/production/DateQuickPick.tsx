import { addDays, nextMonday, isToday, isTomorrow, isMonday, isSameWeek, addWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptic";

interface DateQuickPickProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
}

export function DateQuickPick({ value, onChange }: DateQuickPickProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = addDays(today, 1);
  const monday = nextMonday(today);
  const nextWeekMonday = isMonday(today) ? addWeeks(today, 1) : nextMonday(addWeeks(today, 0));
  // If today is monday, "volgende week" = next monday
  const nextMon = isMonday(today) ? addWeeks(today, 1) : nextMonday(today);

  const options = [
    { label: "Vandaag", date: today },
    { label: "Morgen", date: tomorrow },
    { label: "Ma", date: nextMon },
  ];

  const isSelected = (date: Date) => {
    if (!value) return false;
    return value.toDateString() === date.toDateString();
  };

  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => {
            haptic("light");
            onChange(opt.date);
          }}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            "border focus:outline-none active:scale-95",
            isSelected(opt.date)
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-foreground border-border hover:bg-accent"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
