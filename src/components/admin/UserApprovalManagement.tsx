import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

interface Profile {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  is_approved: boolean;
  approved_at: string | null;
  created_at: string;
}

export function UserApprovalManagement() {
  const queryClient = useQueryClient();
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);

  const { data: pendingUsers, isLoading } = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, is_approved, approved_at, created_at")
        .eq("is_approved", false)
        .not("user_id", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: approvedUsers } = useQuery({
    queryKey: ["approved-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, is_approved, approved_at, created_at")
        .eq("is_approved", true)
        .not("user_id", "is", null)
        .order("approved_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as Profile[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (profileId: string) => {
      // Get the current admin's profile id
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
      queryClient.invalidateQueries({ queryKey: ["approved-users"] });
      toast.success("Gebruiker goedgekeurd");
      setSelectedProfile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error("Fout bij goedkeuren: " + error.message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (profileId: string) => {
      // For rejection, we delete the profile which will cascade delete the user
      // Or we can just leave them unapproved - let's leave them unapproved and notify admin
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-users"] });
      toast.success("Gebruiker afgewezen en verwijderd");
      setSelectedProfile(null);
      setActionType(null);
    },
    onError: (error) => {
      toast.error("Fout bij afwijzen: " + error.message);
    },
  });

  const handleAction = () => {
    if (!selectedProfile) return;
    
    if (actionType === "approve") {
      approveMutation.mutate(selectedProfile.id);
    } else if (actionType === "reject") {
      rejectMutation.mutate(selectedProfile.id);
    }
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

      {approvedUsers && approvedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Recent goedgekeurd
            </CardTitle>
            <CardDescription>
              Laatste 10 goedgekeurde gebruikers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Goedgekeurd op</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.full_name || "Onbekend"}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      {user.approved_at
                        ? format(new Date(user.approved_at), "d MMM yyyy HH:mm", { locale: nl })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        Goedgekeurd
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!selectedProfile && !!actionType} onOpenChange={() => {
        setSelectedProfile(null);
        setActionType(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === "approve" ? "Gebruiker goedkeuren?" : "Gebruiker afwijzen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "approve"
                ? `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt goedkeuren? De gebruiker krijgt hierna toegang tot het systeem.`
                : `Weet u zeker dat u ${selectedProfile?.full_name || selectedProfile?.email} wilt afwijzen? Het account wordt verwijderd.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              className={actionType === "reject" ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {actionType === "approve" ? "Goedkeuren" : "Afwijzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
