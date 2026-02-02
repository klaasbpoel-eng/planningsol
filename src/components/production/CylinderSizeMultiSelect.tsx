import { useState, useEffect } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

interface CylinderSize {
  id: string;
  name: string;
  capacity_liters: number | null;
}

interface CylinderSizeMultiSelectProps {
  cylinderSizes: CylinderSize[];
  selectedCylinderSizes: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

// Group cylinder sizes by capacity range
const getCapacityGroup = (capacity: number | null): string => {
  if (capacity === null) return "Overig";
  if (capacity <= 10) return "Klein (≤10L)";
  if (capacity <= 50) return "Medium (11-50L)";
  if (capacity <= 100) return "Groot (51-100L)";
  return "Bundels (>100L)";
};

const groupOrder = ["Klein (≤10L)", "Medium (11-50L)", "Groot (51-100L)", "Bundels (>100L)", "Overig"];

export function CylinderSizeMultiSelect({
  cylinderSizes,
  selectedCylinderSizes,
  onSelectionChange,
  placeholder = "Alle cilindergroottes",
  className = "",
}: CylinderSizeMultiSelectProps) {
  // Group cylinder sizes by capacity
  const groupedCylinderSizes = groupOrder.map(groupName => ({
    name: groupName,
    sizes: cylinderSizes
      .filter(cs => getCapacityGroup(cs.capacity_liters) === groupName)
      .sort((a, b) => (a.capacity_liters || 0) - (b.capacity_liters || 0)),
  })).filter(group => group.sizes.length > 0);

  const getDisplayText = () => {
    if (selectedCylinderSizes.length === 0) return placeholder;
    if (selectedCylinderSizes.length === 1) {
      return cylinderSizes.find(cs => cs.name === selectedCylinderSizes[0])?.name || "1 geselecteerd";
    }
    return `${selectedCylinderSizes.length} cilindergroottes geselecteerd`;
  };

  const handleSelectAll = () => {
    if (selectedCylinderSizes.length === cylinderSizes.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(cylinderSizes.map(cs => cs.name));
    }
  };

  const handleGroupSelect = (groupSizeNames: string[]) => {
    const allSelected = groupSizeNames.every(name => selectedCylinderSizes.includes(name));
    if (allSelected) {
      onSelectionChange(selectedCylinderSizes.filter(name => !groupSizeNames.includes(name)));
    } else {
      const newSelection = [...selectedCylinderSizes];
      groupSizeNames.forEach(name => {
        if (!newSelection.includes(name)) {
          newSelection.push(name);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const handleSizeSelect = (sizeName: string) => {
    if (selectedCylinderSizes.includes(sizeName)) {
      onSelectionChange(selectedCylinderSizes.filter(name => name !== sizeName));
    } else {
      onSelectionChange([...selectedCylinderSizes, sizeName]);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`justify-between bg-background ${className}`}
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoek cilindergrootte..." />
          <CommandList>
            <CommandEmpty>Geen cilindergroottes gevonden.</CommandEmpty>
            <CommandGroup>
              {/* Select All */}
              <CommandItem
                onSelect={handleSelectAll}
                className="text-primary font-medium"
              >
                <Checkbox
                  checked={selectedCylinderSizes.length === cylinderSizes.length}
                  className="mr-2"
                />
                {selectedCylinderSizes.length === cylinderSizes.length ? "Deselecteer alles" : "Selecteer alles"}
              </CommandItem>
              <CommandSeparator />

              {/* Grouped cylinder sizes */}
              {groupedCylinderSizes.map((group, idx) => {
                const groupNames = group.sizes.map(cs => cs.name);
                const allGroupSelected = groupNames.every(name => selectedCylinderSizes.includes(name));
                const someGroupSelected = groupNames.some(name => selectedCylinderSizes.includes(name));
                const selectedInGroup = groupNames.filter(name => selectedCylinderSizes.includes(name)).length;

                return (
                  <div key={group.name}>
                    {idx > 0 && <CommandSeparator />}
                    <CommandItem
                      onSelect={() => handleGroupSelect(groupNames)}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      <Checkbox
                        checked={allGroupSelected}
                        className="mr-2"
                        data-state={someGroupSelected && !allGroupSelected ? "indeterminate" : allGroupSelected ? "checked" : "unchecked"}
                      />
                      <span className="flex-1">{group.name}</span>
                      {selectedInGroup > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                          {selectedInGroup}/{groupNames.length}
                        </Badge>
                      )}
                    </CommandItem>
                    {group.sizes.map((size) => (
                      <CommandItem
                        key={size.id}
                        value={size.name}
                        onSelect={() => handleSizeSelect(size.name)}
                        className="pl-6"
                      >
                        <Checkbox
                          checked={selectedCylinderSizes.includes(size.name)}
                          className="mr-2"
                        />
                        <span>{size.name}</span>
                        {size.capacity_liters && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({size.capacity_liters}L)
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </div>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
