import { useState, useEffect } from "react";
import { format } from "date-fns";
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

// App layout wrapping
// App layout wrapping
import { PageLayout } from "@/components/layout/PageLayout";
import { SqlSyncTaskForm, SqlSyncTask } from "@/components/admin/SqlSyncTaskForm";

export default function SqlSyncTasksPage() {
    const [tasks, setTasks] = useState<SqlSyncTask[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<SqlSyncTask | undefined>(undefined);
    const { toast } = useToast();

    const fetchTasks = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from("sql_sync_tasks")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;
            setTasks(data || []);
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
            const { error } = await supabase.from("sql_sync_tasks").delete().eq("id", id);
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

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from("sql_sync_tasks")
                .update({ is_active: !currentStatus })
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Status geüpdatet",
                description: `Taak is nu ${!currentStatus ? 'actief' : 'gepauzeerd'}.`,
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
            title="SQL Data Sync Settings"
            description="Beheer de synchronisatie instellingen tussen je lokale MS SQL Server en Supabase."
            titleIcon={<Database className="h-6 w-6 text-primary" />}
        >
            <div className="flex w-full">
                <main className="flex-1 overflow-auto">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Sync Taken</h2>
                                <p className="text-muted-foreground">
                                    Beheer de synchronisatie instellingen tussen je lokale MS SQL Server en Supabase.
                                </p>
                            </div>
                            <Button onClick={() => handleOpenForm()}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nieuwe Taak
                            </Button>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Geconfigureerde Queries</CardTitle>
                                <CardDescription>
                                    Een overzicht van alle ingestelde overdrachten via de data pump.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Naam</TableHead>
                                                <TableHead>Doeltabel</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Laatste Sync</TableHead>
                                                <TableHead className="text-right">Acties</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center h-24">
                                                        Laden...
                                                    </TableCell>
                                                </TableRow>
                                            ) : tasks.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                        Geen taken gevonden. Maak je eerste sync taak aan.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                tasks.map((task) => (
                                                    <TableRow key={task.id}>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                {task.name}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1 text-sm text-gray-500">
                                                                <ArrowRightLeft className="h-3 w-3" />
                                                                {task.destination_table}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge
                                                                variant={task.is_active ? "default" : "secondary"}
                                                                className="cursor-pointer"
                                                                onClick={() => handleToggleActive(task.id!, task.is_active)}
                                                            >
                                                                {task.is_active ? (
                                                                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Actief</span>
                                                                ) : (
                                                                    <span className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Gepauzeerd</span>
                                                                )}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-gray-500">
                                                            {task.last_sync_time
                                                                ? format(new Date(task.last_sync_time), "dd MMM yyyy HH:mm")
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
                                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
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
