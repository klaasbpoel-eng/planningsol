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
import { Check, X, Clock, UserCheck, Loader2, Users, Pencil, Trash2, Shield, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "user" | "operator" | "supervisor";
}

type ActionType = "approve" | "reject" | "delete" | null;

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  user: "Gebruiker",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-600",
  supervisor: "bg-purple-500/10 text-purple-600",
  operator: "bg-blue-500/10 text-blue-600",
  user: "bg-gray-500/10 text-gray-600",
};

const initialCreateForm = {
  full_name: "",
  email: "",
  department: "",
  job_title: "",
  role: "user" as string,
};

export function UserApprovalManagement() {
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    department: "",
    job_title: "",
    role: "user" as string,
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

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role");

      if (error) throw error;
      return data as UserRole[];
    },
  });

  const getUserRole = (userId: string | null): string => {
    if (!userId || !userRoles) return "user";
    const role = userRoles.find((r) => r.user_id === userId);
    return role?.role || "user";
  };

  const approveMutation = useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      // Get the user_id of the profile being approved
      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();

      if (!profileData?.user_id) throw new Error("User ID not found");

      // Approve the profile
      const { error: approveError } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: adminProfile?.id,
        })
        .eq("id", profileId);

      if (approveError) throw approveError;

      // Assign role if not 'user' (default)
      if (role !== "user") {
        // Check if role already exists
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", profileData.user_id)
          .maybeSingle();

        if (existingRole) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .update({ role: role as any })
            .eq("user_id", profileData.user_id);
          if (roleError) throw roleError;
        } else {
          const { error: roleError } = await supabase
            .from("user_roles")
            .insert({ user_id: profileData.user_id, role: role as any });
          if (roleError) throw roleError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
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
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Gebruiker verwijderd");
      closeDialogs();
    },
    onError: (error) => {
      toast.error("Fout bij verwijderen: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ profileId, userId, data }: { profileId: string; userId: string | null; data: typeof editForm }) => {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name || null,
          email: data.email || null,
          department: data.department || null,
          job_title: data.job_title || null,
        })
        .eq("id", profileId);

      if (profileError) throw profileError;

      // Update role if user_id exists
      if (userId) {
        // Check if role record exists
        const { data: existingRole } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        if (data.role === "user") {
          // Remove role record if setting to 'user' (default)
          if (existingRole) {
            const { error: deleteError } = await supabase
              .from("user_roles")
              .delete()
              .eq("user_id", userId);
            if (deleteError) throw deleteError;
          }
        } else {
          // Insert or update role
          if (existingRole) {
            const { error: roleError } = await supabase
              .from("user_roles")
              .update({ role: data.role as any })
              .eq("user_id", userId);
            if (roleError) throw roleError;
          } else {
            const { error: roleError } = await supabase
              .from("user_roles")
              .insert({ user_id: userId, role: data.role as any });
            if (roleError) throw roleError;
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Gebruiker bijgewerkt");
      setEditingProfile(null);
    },
    onError: (error) => {
      toast.error("Fout bij bijwerken: " + error.message);
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      if (!data.email) throw new Error("E-mail is verplicht");

      // Create profile with intended_role (will be assigned when user signs up)
      const { data: newProfile, error: profileError } = await supabase
        .from("profiles")
        .insert({
          email: data.email,
          full_name: data.full_name,
          department: data.department || null,
          job_title: data.job_title || null,
          is_approved: true, // Pre-approved by admin
          intended_role: data.role !== "user" ? data.role : null,
        })
        .select()
        .single();

      if (profileError) throw profileError;
      return newProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Gebruiker aangemaakt. Wanneer deze persoon zich registreert met dit e-mailadres, wordt de rol automatisch toegewezen.");
      setIsCreateDialogOpen(false);
      setCreateForm(initialCreateForm);
    },
    onError: (error) => {
      toast.error("Fout bij aanmaken: " + error.message);
    },
  });

  const closeDialogs = () => {
    setSelectedProfile(null);
    setActionType(null);
    setEditForm({ ...editForm, role: "user" });
  };

  const handleApprove = () => {
    if (!selectedProfile) return;
    approveMutation.mutate({ profileId: selectedProfile.id, role: editForm.role });
  };

  const handleDelete = () => {
    if (!selectedProfile) return;
    deleteMutation.mutate(selectedProfile.id);
  };

  const openEditDialog = (profile: Profile) => {
    setEditingProfile(profile);
    setEditForm({
      full_name: profile.full_name || "",
      email: profile.email || "",
      department: profile.department || "",
      job_title: profile.job_title || "",
      role: getUserRole(profile.user_id),
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    updateMutation.mutate({ 
      profileId: editingProfile.id, 
      userId: editingProfile.user_id,
      data: editForm 
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(createForm);
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
                            setEditForm({ ...editForm, role: "user" });
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Alle gebruikers
            </CardTitle>
            <CardDescription>
              Beheer alle geregistreerde gebruikers en hun rollen
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Nieuwe gebruiker
          </Button>
        </CardHeader>
        <CardContent>
          {allUsers && allUsers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Afdeling</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allUsers.map((user) => {
                  const role = getUserRole(user.user_id);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.full_name || "Onbekend"}
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={ROLE_COLORS[role] || ROLE_COLORS.user}>
                          <Shield className="h-3 w-3 mr-1" />
                          {ROLE_LABELS[role] || "Gebruiker"}
                        </Badge>
                      </TableCell>
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
                  );
                })}
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

      {/* Approve Dialog with Role Selection */}
      <Dialog open={actionType === "approve" && !!selectedProfile} onOpenChange={closeDialogs}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gebruiker goedkeuren</DialogTitle>
            <DialogDescription>
              Kies een rol voor {selectedProfile?.full_name || selectedProfile?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-role">Rol toewijzen</Label>
            <Select
              value={editForm.role}
              onValueChange={(value) => setEditForm({ ...editForm, role: value })}
            >
              <SelectTrigger id="approve-role" className="mt-2">
                <SelectValue placeholder="Selecteer een rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Gebruiker</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs}>
              Annuleren
            </Button>
            <Button onClick={handleApprove} disabled={approveMutation.isPending}>
              {approveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Goedkeuren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Reject Confirmation Dialog */}
      <AlertDialog open={(actionType === "reject" || actionType === "delete") && !!selectedProfile} onOpenChange={closeDialogs}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "reject" ? "Gebruiker afwijzen?" : "Gebruiker verwijderen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "reject"
                ? `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt afwijzen? Het account wordt verwijderd.`
                : `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {actionType === "reject" ? "Afwijzen" : "Verwijderen"}
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
              Pas de gegevens en rol van deze gebruiker aan
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
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol</Label>
                <Select
                  value={editForm.role}
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Selecteer een rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Create New User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe gebruiker aanmaken</DialogTitle>
            <DialogDescription>
              Maak een vooraf goedgekeurd profiel aan. Wanneer de gebruiker zich registreert met dit e-mailadres, wordt het account automatisch gekoppeld en de rol toegewezen.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Naam</Label>
                <Input
                  id="create-name"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  placeholder="Volledige naam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">E-mail *</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="E-mailadres"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-department">Afdeling</Label>
                <Input
                  id="create-department"
                  value={createForm.department}
                  onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                  placeholder="Afdeling"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-job-title">Functie</Label>
                <Input
                  id="create-job-title"
                  value={createForm.job_title}
                  onChange={(e) => setCreateForm({ ...createForm, job_title: e.target.value })}
                  placeholder="Functietitel"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">Rol</Label>
                <Select
                  value={createForm.role}
                  onValueChange={(value) => setCreateForm({ ...createForm, role: value })}
                >
                  <SelectTrigger id="create-role">
                    <SelectValue placeholder="Selecteer een rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Gebruiker</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                setCreateForm(initialCreateForm);
              }}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createUserMutation.isPending}>
                {createUserMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Aanmaken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
