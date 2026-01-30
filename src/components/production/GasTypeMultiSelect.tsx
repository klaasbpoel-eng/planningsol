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

interface GasType {
  id: string;
  name: string;
  color: string;
}

interface GasTypeMultiSelectProps {
  gasTypes: GasType[];
  selectedGasTypes: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

// Define categories with gas type name patterns
const GAS_TYPE_CATEGORIES = [
  { name: "Industriële gassen", patterns: ["CO2", "Argon 4.8", "Argon 5.0", "Zuurstof", "Stikstof 4.8", "Stikstof 5.0", "Lucht"] },
  { name: "Lasgassen (Weldmix)", patterns: ["Weldmix"] },
  { name: "Medische gassen", patterns: ["Alisol", "Med.Device"] },
  { name: "Speciale mengsels", patterns: ["Carbogeen", "EnerMix"] },
];

export function GasTypeMultiSelect({
  gasTypes,
  selectedGasTypes,
  onSelectionChange,
  placeholder = "Alle gastypes",
  className = "",
}: GasTypeMultiSelectProps) {
  // Group gas types by category and sort alphabetically
  const categorizedGasTypes = GAS_TYPE_CATEGORIES.map(category => ({
    ...category,
    gasTypes: gasTypes
      .filter(gt => category.patterns.some(pattern => gt.name.includes(pattern)))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl')),
  }));

  // Find uncategorized gas types and sort alphabetically
  const categorizedIds = categorizedGasTypes.flatMap(c => c.gasTypes.map(g => g.id));
  const uncategorized = gasTypes
    .filter(gt => !categorizedIds.includes(gt.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  const getDisplayText = () => {
    if (selectedGasTypes.length === 0) return placeholder;
    if (selectedGasTypes.length === 1) {
      return gasTypes.find(g => g.id === selectedGasTypes[0])?.name || "1 geselecteerd";
    }
    return `${selectedGasTypes.length} gastypes geselecteerd`;
  };

  const handleSelectAll = () => {
    if (selectedGasTypes.length === gasTypes.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(gasTypes.map(g => g.id));
    }
  };

  const handleCategorySelect = (categoryIds: string[]) => {
    const allSelected = categoryIds.every(id => selectedGasTypes.includes(id));
    if (allSelected) {
      onSelectionChange(selectedGasTypes.filter(id => !categoryIds.includes(id)));
    } else {
      const newSelection = [...selectedGasTypes];
      categoryIds.forEach(id => {
        if (!newSelection.includes(id)) {
          newSelection.push(id);
        }
      });
      onSelectionChange(newSelection);
    }
  };

  const handleGasTypeSelect = (gasTypeId: string) => {
    if (selectedGasTypes.includes(gasTypeId)) {
      onSelectionChange(selectedGasTypes.filter(id => id !== gasTypeId));
    } else {
      onSelectionChange([...selectedGasTypes, gasTypeId]);
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
          <CommandInput placeholder="Zoek gastype..." />
          <CommandList>
            <CommandEmpty>Geen gastypes gevonden.</CommandEmpty>
            <CommandGroup>
              {/* Select All */}
              <CommandItem
                onSelect={handleSelectAll}
                className="text-primary font-medium"
              >
                <Checkbox
                  checked={selectedGasTypes.length === gasTypes.length}
                  className="mr-2"
                />
                {selectedGasTypes.length === gasTypes.length ? "Deselecteer alles" : "Selecteer alles"}
              </CommandItem>
              <CommandSeparator />

              {/* Categorized gas types */}
              {categorizedGasTypes.map((category, idx) => {
                if (category.gasTypes.length === 0) return null;
                const categoryIds = category.gasTypes.map(g => g.id);
                const allCategorySelected = categoryIds.every(id => selectedGasTypes.includes(id));
                const someCategorySelected = categoryIds.some(id => selectedGasTypes.includes(id));
                const selectedInCategory = categoryIds.filter(id => selectedGasTypes.includes(id)).length;

                return (
                  <div key={category.name}>
                    {idx > 0 && <CommandSeparator />}
                    <CommandItem
                      onSelect={() => handleCategorySelect(categoryIds)}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      <Checkbox
                        checked={allCategorySelected}
                        className="mr-2"
                        data-state={someCategorySelected && !allCategorySelected ? "indeterminate" : allCategorySelected ? "checked" : "unchecked"}
                      />
                      <span className="flex-1">{category.name}</span>
                      {selectedInCategory > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                          {selectedInCategory}/{categoryIds.length}
                        </Badge>
                      )}
                    </CommandItem>
                    {category.gasTypes.map((gasType) => (
                      <CommandItem
                        key={gasType.id}
                        value={gasType.name}
                        onSelect={() => handleGasTypeSelect(gasType.id)}
                        className="pl-6"
                      >
                        <Checkbox
                          checked={selectedGasTypes.includes(gasType.id)}
                          className="mr-2"
                        />
                        <div
                          className="w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: gasType.color }}
                        />
                        <span>{gasType.name}</span>
                      </CommandItem>
                    ))}
                  </div>
                );
              })}

              {/* Uncategorized gas types */}
              {uncategorized.length > 0 && (() => {
                const uncategorizedIds = uncategorized.map(g => g.id);
                const allUncategorizedSelected = uncategorizedIds.every(id => selectedGasTypes.includes(id));
                const someUncategorizedSelected = uncategorizedIds.some(id => selectedGasTypes.includes(id));
                const selectedInUncategorized = uncategorizedIds.filter(id => selectedGasTypes.includes(id)).length;

                return (
                  <div>
                    <CommandSeparator />
                    <CommandItem
                      onSelect={() => handleCategorySelect(uncategorizedIds)}
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      <Checkbox
                        checked={allUncategorizedSelected}
                        className="mr-2"
                        data-state={someUncategorizedSelected && !allUncategorizedSelected ? "indeterminate" : allUncategorizedSelected ? "checked" : "unchecked"}
                      />
                      <span className="flex-1">Overige</span>
                      {selectedInUncategorized > 0 && (
                        <Badge variant="secondary" className="ml-2 text-xs px-1.5 py-0">
                          {selectedInUncategorized}/{uncategorizedIds.length}
                        </Badge>
                      )}
                    </CommandItem>
                    {uncategorized.map((gasType) => (
                      <CommandItem
                        key={gasType.id}
                        value={gasType.name}
                        onSelect={() => handleGasTypeSelect(gasType.id)}
                        className="pl-6"
                      >
                        <Checkbox
                          checked={selectedGasTypes.includes(gasType.id)}
                          className="mr-2"
                        />
                        <div
                          className="w-2.5 h-2.5 rounded-full mr-2"
                          style={{ backgroundColor: gasType.color }}
                        />
                        <span>{gasType.name}</span>
                      </CommandItem>
                    ))}
                  </div>
                );
              })()}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
