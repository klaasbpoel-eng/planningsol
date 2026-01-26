import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
}

export function DefaultCustomerSetting() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [defaultCustomerName, setDefaultCustomerName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch customers
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (customersData) {
        setCustomers(customersData);
      }

      // Fetch current setting
      const { data: settingData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "default_customer_name")
        .single();

      if (settingData?.value) {
        setDefaultCustomerName(settingData.value);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleChange = async (customerName: string) => {
    setSaving(true);
    setDefaultCustomerName(customerName);

    const { error } = await supabase
      .from("app_settings")
      .update({ value: customerName })
      .eq("key", "default_customer_name");

    if (error) {
      toast.error("Fout bij opslaan instelling");
      console.error("Error saving setting:", error);
    } else {
      toast.success("Standaardklant bijgewerkt");
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Standaardklant</CardTitle>
            <CardDescription>
              Stel de standaardklant in voor nieuwe orders
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Standaardklant voor nieuwe orders</Label>
          <div className="flex items-center gap-2">
            <Select value={defaultCustomerName} onValueChange={handleChange}>
              <SelectTrigger className="w-[300px] bg-background">
                <SelectValue placeholder="Selecteer standaardklant" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.name}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!saving && defaultCustomerName && <Check className="h-4 w-4 text-green-500" />}
          </div>
          <p className="text-xs text-muted-foreground">
            Deze klant wordt automatisch geselecteerd bij het aanmaken van nieuwe gascilinder orders.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
