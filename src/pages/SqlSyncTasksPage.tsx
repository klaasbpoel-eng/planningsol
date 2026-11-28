import { useState, useEffect } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { PlusCircle, Database, CheckCircle2, XCircle, Pencil, Trash2, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { Navigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { AppRole } from "@/hooks/useUserPermissions";
import { SqlSyncTaskForm, SqlSyncTask } from "@/components/admin/SqlSyncTaskForm";

export default function SqlSyncTasksPage() {
    return (
        <ProtectedRoute>
            {({ user, role, isAdmin }) =>
                isAdmin ? <SqlSyncTasksContent userEmail={user.email} role={role} /> : <Navigate to="/" replace />
            }
        </ProtectedRoute>
    );
}

function mapCloudRowToTask(row: any): SqlSyncTask {
    const q = row.query_data || {};
    return {
        id: row.query_id,
        name: row.name || q.name || "Naamloos",
        source_query: q.query || "",
        destination_table: row.target_table || q.targetTable || "",
        primary_key_column: q.primaryKey || "",
        interval_minutes: Number(q.intervalMinutes || 0),
        hard_sync: Boolean(q.hardSync),
        is_active: q.enabled !== false,
        updated_at: row.updated_at,
        last_sync_time: q.lastSyncTime || row.updated_at,
        raw_query_data: q,
    };
}

function SqlSyncTasksContent({ userEmail, role }: { userEmail?: string; role: AppRole }) {
    const [tasks, setTasks] = useState<SqlSyncTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<SqlSyncTask | undefined>(undefined);
    const { toast } = useToast();

    const fetchTasks = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await (supabase as any)
                .from("sql_sync_saved_queries")
                .select("*")
                .order("name", { ascending: true });

            if (error) throw error;
            setTasks((data || []).map(mapCloudRowToTask));
        } catch (error: any) {
            toast({
                title: "Fout bij ophalen",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, []);

    const handleOpenForm = (task?: SqlSyncTask) => {
        setEditingTask(task);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Weet je zeker dat je de taak "${name}" wilt verwijderen?`)) return;

        try {
            const { error } = await (supabase as any)
                .from("sql_sync_saved_queries")
                .delete()
                .eq("query_id", id);
            if (error) throw error;

            toast({
                title: "Taak verwijderd",
                description: "De synchronisatie taak is succesvol verwijderd.",
            });
            fetchTasks();
        } catch (error: any) {
            toast({
                title: "Fout bij verwijderen",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleToggleActive = async (task: SqlSyncTask) => {
        if (!task.id) return;
        const nextActive = !task.is_active;
        try {
            const updatedQueryData = {
                ...(task.raw_query_data || {}),
                id: task.id,
                name: task.name,
                query: task.source_query,
                targetTable: task.destination_table,
                enabled: nextActive,
            };
            const { error } = await (supabase as any)
                .from("sql_sync_saved_queries")
                .update({
                    query_data: updatedQueryData,
                    updated_at: new Date().toISOString(),
                })
                .eq("query_id", task.id);

            if (error) throw error;

            toast({
                title: "Status geüpdatet",
                description: `Taak "${task.name}" is nu ${nextActive ? "actief" : "gepauzeerd"}.`,
            });
            fetchTasks();
        } catch (error: any) {
            toast({
                title: "Fout bij updaten",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    return (
        <PageLayout
            userEmail={userEmail}
            role={role}
            isAdmin
            title="Synchronisatie"
            description="Beheer de synchronisatie tussen de lokale MS SQL Server en Supabase (gekoppeld aan de SQL Sync app)."
            titleIcon={<Database className="h-6 w-6 text-primary" />}
        >
            <div className="flex w-full">
                <main className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Sync Taken</h2>
                                <p className="text-muted-foreground">
                                    Overzicht van alle actieve queries uit de SQL Sync desktop-app (`sql_sync_saved_queries`).
                                </p>
                            </div>
                            <Button onClick={() => handleOpenForm()}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nieuwe Taak
                            </Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Geconfigureerde Queries ({tasks.length})</CardTitle>
                                <CardDescription>
                                    Wijzigingen hier worden automatisch overgenomen door de SQL Sync app.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Naam</TableHead>
                                                <TableHead>Doeltabel</TableHead>
                                                <TableHead>Schema / Modus</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Laatst bijgewerkt</TableHead>
                                                <TableHead className="text-right">Acties</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center h-24">
                                                        Laden...
                                                    </TableCell>
                                                </TableRow>
                                            ) : tasks.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                        Geen taken gevonden. Maak je eerste sync taak aan.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                tasks.map((task) => (
                                                    <TableRow key={task.id}>
                                                        <TableCell className="font-medium">
                                                            {task.name}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                                                <ArrowRightLeft className="h-3 w-3" />
                                                                {task.destination_table}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                <Badge variant="outline">
                                                                    {task.interval_minutes > 0 ? `Elke ${task.interval_minutes} min` : "Handmatig"}
                                                                </Badge>
                                                                {task.hard_sync && (
                                                                    <Badge variant="secondary">Hard Sync</Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={task.is_active ? "default" : "secondary"}
                                                                className="cursor-pointer"
                                                                onClick={() => handleToggleActive(task)}
                                                            >
                                                                {task.is_active ? (
                                                                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Actief</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Gepauzeerd</span>
                                                                )}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            {task.updated_at
                                                                ? format(new Date(task.updated_at), "d MMM yyyy HH:mm", { locale: nl })
                                                                : "Nog nooit"}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleOpenForm(task)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDelete(task.id!, task.name)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>

            <SqlSyncTaskForm
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                onSuccess={fetchTasks}
                task={editingTask}
            />
        </PageLayout>
    );
}
