import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Link2, Plus, Trash2, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerUserLink {
  id: string;
  user_id: string;
  customer_id: string;
  created_at: string | null;
  customer_name?: string;
  user_name?: string;
  user_email?: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
}

export function CustomerUserLinkManager() {
  const [links, setLinks] = useState<CustomerUserLink[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // New link form
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [linkToDelete, setLinkToDelete] = useState<CustomerUserLink | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [linksRes, customersRes, profilesRes] = await Promise.all([
        supabase.from("customer_users").select("*"),
        supabase.from("customers").select("id, name").eq("is_active", true).order("name"),
        supabase.from("profiles").select("id, user_id, full_name, email").eq("is_approved", true),
      ]);

      const customerMap = new Map((customersRes.data || []).map(c => [c.id, c.name]));
      const profileMap = new Map(
        (profilesRes.data || []).filter(p => p.user_id).map(p => [p.user_id!, { name: p.full_name, email: p.email }])
      );

      const enrichedLinks = (linksRes.data || []).map(link => ({
        ...link,
        customer_name: customerMap.get(link.customer_id) || "Onbekend",
        user_name: profileMap.get(link.user_id)?.name || "Onbekend",
        user_email: profileMap.get(link.user_id)?.email || "",
      }));

      setLinks(enrichedLinks);
      setCustomers(customersRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fout bij ophalen gegevens");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Users that are not yet linked
  const availableUsers = profiles.filter(
    p => p.user_id && !links.some(l => l.user_id === p.user_id)
  );

  const handleAddLink = async () => {
    if (!selectedUserId || !selectedCustomerId) {
      toast.error("Selecteer een gebruiker en een klant");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("customer_users").insert({
        user_id: selectedUserId,
        customer_id: selectedCustomerId,
      });

      if (error) throw error;

      // Also assign customer role if not present
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", selectedUserId)
        .eq("role", "customer")
        .maybeSingle();

      if (!existingRole) {
        await supabase.from("user_roles").insert({
          user_id: selectedUserId,
          role: "customer",
        });
      }

      toast.success("Gebruiker gekoppeld aan klant");
      setSelectedUserId("");
      setSelectedCustomerId("");
      fetchAll();
    } catch (error: any) {
      console.error("Error creating link:", error);
      if (error?.code === "23505") {
        toast.error("Deze gebruiker is al gekoppeld aan een klant");
      } else {
        toast.error("Fout bij koppelen");
      }
    }
    setSaving(false);
  };

  const handleDeleteLink = async () => {
    if (!linkToDelete) return;
    try {
      const { error } = await supabase
        .from("customer_users")
        .delete()
        .eq("id", linkToDelete.id);

      if (error) throw error;

      // Optionally remove customer role
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", linkToDelete.user_id)
        .eq("role", "customer");

      toast.success("Koppeling verwijderd");
      fetchAll();
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("Fout bij verwijderen koppeling");
    }
    setDeleteDialogOpen(false);
    setLinkToDelete(null);
  };

  const filteredLinks = links.filter(
    link =>
      link.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      link.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Link2 className="h-5 w-5 text-primary" />
          Klant-Gebruiker Koppelingen
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Koppel gebruikers aan klantaccounts zodat zij via het klantportaal kunnen bestellen.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new link */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex-1">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer gebruiker..." />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Geen beschikbare gebruikers
                  </div>
                ) : (
                  availableUsers.map(profile => (
                    <SelectItem key={profile.user_id!} value={profile.user_id!}>
                      {profile.full_name || profile.email || "Naamloos"}
                      {profile.email ? ` (${profile.email})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer klant..." />
              </SelectTrigger>
              <SelectContent>
                {customers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddLink} disabled={saving || !selectedUserId || !selectedCustomerId}>
            <Plus className="h-4 w-4 mr-2" />
            Koppelen
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op gebruiker of klant..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
            <Users className="h-8 w-8" />
            {searchQuery ? "Geen koppelingen gevonden" : "Nog geen koppelingen aangemaakt"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gebruiker</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLinks.map(link => (
                <TableRow key={link.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{link.user_name}</div>
                      {link.user_email && (
                        <div className="text-xs text-muted-foreground">{link.user_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{link.customer_name}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setLinkToDelete(link);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Koppeling verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de koppeling tussen "{linkToDelete?.user_name}" en "{linkToDelete?.customer_name}" wilt verwijderen? De klantrol wordt ook verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLink}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
