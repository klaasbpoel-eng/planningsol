import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, UserCheck, Loader2, Users, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
  department: string | null;
  job_title: string | null;
}

type ActionType = "approve" | "reject" | "delete" | null;

export function UserApprovalManagement() {
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    department: "",
    job_title: "",
  });

  const { data: pendingUsers, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, is_approved, approved_at, created_at, department, job_title")
        .eq("is_approved", false)
        .not("user_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, is_approved, approved_at, created_at, department, job_title")
        .not("user_id", "is", null)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Profile[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { error } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: adminProfile?.id,
        })
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Gebruiker goedgekeurd");
      closeDialogs();
    },
    onError: (error) => {
      toast.error("Fout bij goedkeuren: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Gebruiker verwijderd");
      closeDialogs();
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ profileId, data }: { profileId: string; data: typeof editForm }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name || null,
          email: data.email || null,
          department: data.department || null,
          job_title: data.job_title || null,
        })
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      toast.success("Gebruiker bijgewerkt");
      setEditingProfile(null);
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken: " + error.message);
    },
  });

  const closeDialogs = () => {
    setSelectedProfile(null);
    setActionType(null);
  };

  const handleAction = () => {
    if (!selectedProfile) return;
    
    if (actionType === "approve") {
      approveMutation.mutate(selectedProfile.id);
    } else if (actionType === "reject" || actionType === "delete") {
      deleteMutation.mutate(selectedProfile.id);
    }
  };

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile);
    setEditForm({
      full_name: profile.full_name || "",
      email: profile.email || "",
      department: profile.department || "",
      job_title: profile.job_title || "",
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    updateMutation.mutate({ profileId: editingProfile.id, data: editForm });
  };

  const isLoading = pendingLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending registrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Wachtende registraties
          </CardTitle>
          <CardDescription>
            Gebruikers die wachten op goedkeuring
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingUsers && pendingUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Geregistreerd op</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "Onbekend"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {format(new Date(user.created_at), "d MMM yyyy HH:mm", { locale: nl })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            setSelectedProfile(user);
                            setActionType("approve");
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Goedkeuren
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedProfile(user);
                            setActionType("reject");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Afwijzen
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Geen wachtende registraties</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All users management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Alle gebruikers
          </CardTitle>
          <CardDescription>
            Beheer alle geregistreerde gebruikers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {allUsers && allUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Afdeling</TableHead>
                  <TableHead>Functie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "Onbekend"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.department || "-"}</TableCell>
                    <TableCell>{user.job_title || "-"}</TableCell>
                    <TableCell>
                      {user.is_approved ? (
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                          Actief
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                          Wachtend
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedProfile(user);
                            setActionType("delete");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Geen gebruikers gevonden</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!selectedProfile && !!actionType} onOpenChange={closeDialogs}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" && "Gebruiker goedkeuren?"}
              {actionType === "reject" && "Gebruiker afwijzen?"}
              {actionType === "delete" && "Gebruiker verwijderen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve" &&
                `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt goedkeuren? De gebruiker krijgt hierna toegang tot het systeem.`}
              {actionType === "reject" &&
                `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt afwijzen? Het account wordt verwijderd.`}
              {actionType === "delete" &&
                `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionType !== "approve" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {actionType === "approve" && "Goedkeuren"}
              {actionType === "reject" && "Afwijzen"}
              {actionType === "delete" && "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker bewerken</DialogTitle>
            <DialogDescription>
              Pas de gegevens van deze gebruiker aan
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Naam</Label>
                <Input
                  id="edit-name"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  placeholder="Volledige naam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="E-mailadres"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Afdeling</Label>
                <Input
                  id="edit-department"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="Afdeling"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-job-title">Functie</Label>
                <Input
                  id="edit-job-title"
                  value={editForm.job_title}
                  onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                  placeholder="Functietitel"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingProfile(null)}>
                Annuleren
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
