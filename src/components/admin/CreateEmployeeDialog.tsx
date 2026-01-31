import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateEmployeeDialogProps {
  trigger?: React.ReactNode;
}

export function CreateEmployeeDialog({ trigger }: CreateEmployeeDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    department: "",
    job_title: "",
    role: "user" as string,
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create profile directly (without auth user - admin creating employee)
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          full_name: data.full_name,
          email: data.email,
          department: data.department || null,
          job_title: data.job_title || null,
          is_approved: true, // Automatically approved when admin creates
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // Note: Role assignment will happen when the user registers and links to this profile
      // For now, we store the intended role in a separate step when user registers
      
      return newProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-employees"] });
      toast.success("Medewerker aangemaakt", {
        description: "De medewerker kan nu registreren met het opgegeven e-mailadres",
      });
      setOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      department: "",
      job_title: "",
      role: "user",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error("E-mailadres is verplicht");
      return;
    }

    createEmployeeMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Nieuwe medewerker
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe medewerker aanmaken</DialogTitle>
          <DialogDescription>
            Maak een nieuw medewerkersprofiel aan. De medewerker kan zich registreren met het opgegeven e-mailadres en wordt automatisch gekoppeld.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Naam *</Label>
              <Input
                id="new-name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Volledige naam"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">E-mail *</Label>
              <Input
                id="new-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="medewerker@bedrijf.nl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-department">Afdeling</Label>
              <Input
                id="new-department"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                placeholder="Bijv. Productie, Administratie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-job-title">Functie</Label>
              <Input
                id="new-job-title"
                value={formData.job_title}
                onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                placeholder="Functietitel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger id="new-role">
                  <SelectValue placeholder="Selecteer een rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Gebruiker</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                De rol wordt toegewezen wanneer de medewerker zich registreert
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={createEmployeeMutation.isPending}>
              {createEmployeeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aanmaken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
