import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export function CustomerSelect({ value, onValueChange, defaultCustomerName = "SOL Nederland" }: CustomerSelectProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCustomerDialog, setShowNewCustomerDialog] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newContactPerson, setNewContactPerson] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSetDefault, setHasSetDefault] = useState(false);

  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, contact_person")
      .eq("is_active", true)
      .order("name");

    if (error) {
      console.error("Error fetching customers:", error);
    } else {
      setCustomers(data || []);
      
      // Set default customer if no value is set yet
      if (!value && !hasSetDefault && data && data.length > 0) {
        const defaultCustomer = data.find(
          (c) => c.name.toLowerCase() === defaultCustomerName.toLowerCase()
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

  const handleSelectChange = (customerId: string) => {
    if (customerId === "new") {
      setShowNewCustomerDialog(true);
      return;
    }
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      onValueChange(customer.id, customer.name);
    }
  };

  return (
    <>
      <Select value={value} onValueChange={handleSelectChange}>
        <SelectTrigger className="bg-background">
          <SelectValue placeholder={loading ? "Laden..." : "Selecteer klant"} />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {customers.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{customer.name}</span>
                {customer.contact_person && (
                  <span className="text-muted-foreground text-sm">
                    ({customer.contact_person})
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          <SelectItem value="new" className="text-primary">
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Nieuwe klant toevoegen</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

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
