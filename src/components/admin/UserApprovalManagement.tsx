import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Check, X, Clock, UserCheck, Loader2 } from "lucide-react";
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

type ActionType = "approve" | "reject" | null;

export function UserApprovalManagement() {
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<ActionType>(null);
  const [selectedRole, setSelectedRole] = useState<string>("user");

  const { data: pendingUsers, isLoading } = useQuery({
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

  const approveMutation = useMutation({
    mutationFn: async ({ profileId, role }: { profileId: string; role: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      const { data: profileData } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();

      if (!profileData?.user_id) throw new Error("Gebruikers-ID niet gevonden");

      const { error: approveError } = await supabase
        .from("profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
          approved_by: adminProfile?.id,
        })
        .eq("id", profileId);

      if (approveError) throw approveError;

      if (role !== "user") {
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
      const { error } = await (supabase as any).rpc("delete_employee_and_auth_user", {
        p_profile_id: profileId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success("Registratie afgewezen en account verwijderd");
      closeDialogs();
    },
    onError: (error) => {
      toast.error("Fout bij afwijzen: " + error.message);
    },
  });

  const closeDialogs = () => {
    setSelectedProfile(null);
    setActionType(null);
    setSelectedRole("user");
  };

  const handleApprove = () => {
    if (!selectedProfile) return;
    approveMutation.mutate({ profileId: selectedProfile.id, role: selectedRole });
  };

  const handleReject = () => {
    if (!selectedProfile) return;
    deleteMutation.mutate(selectedProfile.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Wachtende registraties
          </CardTitle>
          <CardDescription>
            Nieuwe zelf-registraties die wachten op goedkeuring van een beheerder
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
                            setSelectedRole("user");
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
            <Select value={selectedRole} onValueChange={setSelectedRole}>
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

      <AlertDialog open={actionType === "reject" && !!selectedProfile} onOpenChange={closeDialogs}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gebruiker afwijzen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet u zeker dat u {selectedProfile?.full_name || selectedProfile?.email} wilt afwijzen? Zowel het profiel als het inlogaccount worden volledig verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive hover:bg-destructive/90"
            >
              Afwijzen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
