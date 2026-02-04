import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectGroup {
  heading: string;
  items: SearchableSelectOption[];
}

interface SearchableSelectProps {
  options?: SearchableSelectOption[];
  groups?: SearchableSelectGroup[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function SearchableSelect({
  options = [],
  groups = [],
  value,
  onValueChange,
  placeholder = "Selecteer...",
  searchPlaceholder = "Zoeken...",
  emptyMessage = "Geen resultaten gevonden.",
  className,
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  // Find selected label from either flat options or groups
  let selectedLabel = "";
  if (options.length > 0) {
    selectedLabel = options.find((option) => option.value === value)?.label || "";
  } else {
    for (const group of groups) {
      const found = group.items.find((item) => item.value === value);
      if (found) {
        selectedLabel = found.label;
        break;
      }
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between bg-background", className)}
        >
          <span className="truncate">
            {selectedLabel || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>

            {/* Render flat options if provided */}
            {options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Render groups if provided */}
            {groups.length > 0 && groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => {
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}

          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

