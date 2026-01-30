import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Building2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

interface Customer {
  id: string | null;
  name: string;
}

interface CustomerMultiSelectProps {
  customers: Customer[];
  selectedCustomers: string[];
  onSelectionChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function CustomerMultiSelect({
  customers,
  selectedCustomers,
  onSelectionChange,
  placeholder = "Alle klanten",
  className = "",
}: CustomerMultiSelectProps) {
  const [open, setOpen] = useState(false);

  // Sort customers alphabetically
  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  }, [customers]);

  // Get customer keys for comparison
  const customerKeys = useMemo(() => {
    return sortedCustomers.map(c => c.id || c.name);
  }, [sortedCustomers]);

  const allSelected = selectedCustomers.length === 0 || selectedCustomers.length === customerKeys.length;

  const handleSelectAll = () => {
    if (allSelected && selectedCustomers.length > 0) {
      // If all are selected, deselect all
      onSelectionChange([]);
    } else if (selectedCustomers.length === 0) {
      // If none selected (showing all), select all explicitly
      onSelectionChange(customerKeys);
    } else {
      // Otherwise select all
      onSelectionChange([]);
    }
  };

  const handleCustomerToggle = (customerKey: string) => {
    if (selectedCustomers.length === 0) {
      // Currently showing all - select only this one
      onSelectionChange([customerKey]);
    } else if (selectedCustomers.includes(customerKey)) {
      // Remove this customer
      const newSelection = selectedCustomers.filter(k => k !== customerKey);
      onSelectionChange(newSelection);
    } else {
      // Add this customer
      onSelectionChange([...selectedCustomers, customerKey]);
    }
  };

  const getDisplayText = () => {
    if (selectedCustomers.length === 0) {
      return placeholder;
    }
    if (selectedCustomers.length === 1) {
      const customer = sortedCustomers.find(c => (c.id || c.name) === selectedCustomers[0]);
      return customer?.name || selectedCustomers[0];
    }
    return `${selectedCustomers.length} klanten geselecteerd`;
  };

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionChange([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between bg-background", className)}
        >
          <span className="truncate flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            {getDisplayText()}
          </span>
          <div className="flex items-center gap-1 ml-2">
            {selectedCustomers.length > 0 && (
              <Badge
                variant="secondary"
                className="h-5 px-1.5 text-xs cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={clearSelection}
              >
                <X className="h-3 w-3" />
              </Badge>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoek klant..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Geen klanten gevonden.</CommandEmpty>
            <CommandGroup>
              {/* Select All Option */}
              <CommandItem
                onSelect={handleSelectAll}
                className="font-medium border-b mb-1"
              >
                <Checkbox
                  checked={allSelected}
                  className="mr-2"
                />
                <span className="flex-1">
                  {allSelected && selectedCustomers.length === 0 ? "Alle klanten" : "Selecteer alles"}
                </span>
                <Badge variant="outline" className="ml-2 text-xs">
                  {customerKeys.length}
                </Badge>
              </CommandItem>

              {/* Individual Customers */}
              {sortedCustomers.map((customer) => {
                const customerKey = customer.id || customer.name;
                const isSelected = selectedCustomers.length === 0 || selectedCustomers.includes(customerKey);
                
                return (
                  <CommandItem
                    key={customerKey}
                    value={customer.name}
                    onSelect={() => handleCustomerToggle(customerKey)}
                    className="pl-4"
                  >
                    <Checkbox
                      checked={isSelected && selectedCustomers.length > 0}
                      className="mr-2"
                      data-state={selectedCustomers.length === 0 ? "indeterminate" : isSelected ? "checked" : "unchecked"}
                    />
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{customer.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
