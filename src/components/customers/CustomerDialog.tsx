import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSaved: () => void;
}

export function CustomerDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: CustomerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (customer) {
      setName(customer.name);
      setContactPerson(customer.contact_person || "");
      setEmail(customer.email || "");
      setPhone(customer.phone || "");
      setAddress(customer.address || "");
      setNotes(customer.notes || "");
      setIsActive(customer.is_active);
    } else {
      setName("");
      setContactPerson("");
      setEmail("");
      setPhone("");
      setAddress("");
      setNotes("");
      setIsActive(true);
    }
  }, [customer, open]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Voer een klantnaam in");
      return;
    }

    setSaving(true);

    const customerData = {
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      is_active: isActive,
    };

    try {
      if (customer) {
        const { error } = await supabase
          .from("customers")
          .update(customerData)
          .eq("id", customer.id);

        if (error) throw error;
        toast.success("Klant bijgewerkt");
      } else {
        const { error } = await supabase.from("customers").insert(customerData);
        if (error) throw error;
        toast.success("Klant toegevoegd");
      }

      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Fout bij opslaan klant");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {customer ? "Klant bewerken" : "Nieuwe klant"}
              </DialogTitle>
              <DialogDescription>
                {customer
                  ? "Wijzig de klantgegevens"
                  : "Voeg een nieuwe klant toe aan de database"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Klantnaam <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bedrijfsnaam"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson">Contactpersoon</Label>
            <Input
              id="contactPerson"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Naam contactpersoon"
              className="bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@voorbeeld.nl"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefoon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+31 6 12345678"
                className="bg-background"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straat, Postcode, Plaats"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Eventuele opmerkingen..."
              className="bg-background resize-none"
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Actieve klant</Label>
              <p className="text-sm text-muted-foreground">
                Inactieve klanten worden niet getoond bij orderselectie
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Opslaan..." : customer ? "Bijwerken" : "Toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
