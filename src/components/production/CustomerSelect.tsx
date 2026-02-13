import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Building2, Check, ChevronsUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
}

interface CustomerSelectProps {
  value: string;
  onValueChange: (value: string, customerName: string) => void;
  defaultCustomerName?: string;
}

export function CustomerSelect({ value, onValueChange, defaultCustomerName: propDefaultCustomer }: CustomerSelectProps) {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSetDefault, setHasSetDefault] = useState(false);

  const fetchCustomers = async () => {
    // Use prop default if provided, otherwise fetch from settings
    let defaultCustomerName = propDefaultCustomer;
    
    if (!defaultCustomerName) {
      const { data: settingData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_customer_name")
        .single();
      defaultCustomerName = settingData?.value || "SOL Nederland";
    }

    const { data, error } = await supabase
      .from("customers")
      .select("id, name, contact_person")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching customers:", error);
    } else {
      setCustomers(data || []);
      
      if (!value && !hasSetDefault && data && data.length > 0) {
        const defaultCustomer = data.find(
          (c) => c.name.toLowerCase() === defaultCustomerName!.toLowerCase()
        );
        if (defaultCustomer) {
          onValueChange(defaultCustomer.id, defaultCustomer.name);
        }
        setHasSetDefault(true);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      toast.error("Voer een klantnaam in");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: newCustomerName.trim(),
          contact_person: newContactPerson.trim() || null,
        })
        .select("id, name, contact_person")
        .single();

      if (error) throw error;

      toast.success("Klant toegevoegd");
      setCustomers((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      onValueChange(data.id, data.name);
      setNewCustomerName("");
      setNewContactPerson("");
      setShowNewCustomerDialog(false);
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Fout bij toevoegen klant");
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomer = customers.find((c) => c.id === value);

  const commandList = (
    <Command>
      <CommandInput placeholder="Zoek klant..." />
      <CommandList>
        <CommandEmpty>Geen klant gevonden.</CommandEmpty>
        <CommandGroup>
          {customers.map((customer) => (
            <CommandItem
              key={customer.id}
              value={customer.name}
              onSelect={() => {
                onValueChange(customer.id, customer.name);
                setOpen(false);
              }}
            >
              <Check
                className={cn(
                  "mr-2 h-4 w-4",
                  value === customer.id ? "opacity-100" : "opacity-0"
                )}
              />
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{customer.name}</span>
              {customer.contact_person && (
                <span className="ml-2 text-muted-foreground text-sm">
                  ({customer.contact_person})
                </span>
              )}
            </CommandItem>
          ))}
          <CommandItem
            value="nieuwe-klant-toevoegen"
            onSelect={() => {
              setShowNewCustomerDialog(true);
              setOpen(false);
            }}
            className="text-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            <span>Nieuwe klant toevoegen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const triggerContent = loading ? (
    "Laden..."
  ) : selectedCustomer ? (
    <div className="flex items-center gap-2 truncate">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{selectedCustomer.name}</span>
      {selectedCustomer.contact_person && (
        <span className="text-muted-foreground text-sm truncate">
          ({selectedCustomer.contact_person})
        </span>
      )}
    </div>
  ) : (
    "Selecteer klant"
  );

  return (
    <>
      {isMobile ? (
        <>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between bg-background"
            onClick={() => setOpen(true)}
          >
            {triggerContent}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent className="max-h-[85vh]">
              <DrawerHeader className="text-left">
                <DrawerTitle>Selecteer klant</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-8">
                {commandList}
              </div>
            </DrawerContent>
          </Drawer>
        </>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between bg-background"
            >
              {triggerContent}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            {commandList}
          </PopoverContent>
        </Popover>
      )}

      <Dialog open={showNewCustomerDialog} onOpenChange={setShowNewCustomerDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Nieuwe klant</DialogTitle>
                <DialogDescription>
                  Voeg een nieuwe klant toe aan de database
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newCustomerName">
                Klantnaam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="newCustomerName"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Bedrijfsnaam"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newContactPerson">Contactpersoon</Label>
              <Input
                id="newContactPerson"
                value={newContactPerson}
                onChange={(e) => setNewContactPerson(e.target.value)}
                placeholder="Naam contactpersoon"
                className="bg-background"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowNewCustomerDialog(false)}
              disabled={saving}
            >
              Annuleren
            </Button>
            <Button onClick={handleCreateCustomer} disabled={saving || !newCustomerName.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Toevoegen..." : "Klant toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
