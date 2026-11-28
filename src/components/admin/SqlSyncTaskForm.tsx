import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
    name: z.string().min(2, "Vul een naam in van minstens 2 karakters."),
    source_query: z.string().min(10, "De SQL query is te kort."),
    destination_table: z.string().min(2, "Vul de juiste doeltabel in."),
    primary_key_column: z.string().optional().default(""),
    interval_minutes: z.coerce.number().min(0, "Gebruik 0 voor handmatig of een aantal minuten.").default(0),
    hard_sync: z.boolean().default(false),
    is_active: z.boolean().default(true),
});

export type SqlSyncTask = z.infer<typeof formSchema> & {
    id?: string;
    updated_at?: string;
    last_sync_time?: string;
    raw_query_data?: Record<string, unknown>;
};

interface SqlSyncTaskFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    task?: SqlSyncTask;
}

export function SqlSyncTaskForm({ open, onOpenChange, onSuccess, task }: SqlSyncTaskFormProps) {
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            source_query: "SELECT *\nFROM MijnTabel\nWHERE Datum >= GETDATE()-30",
            destination_table: "",
            primary_key_column: "",
            interval_minutes: 0,
            hard_sync: false,
            is_active: true,
        },
    });

    useEffect(() => {
        if (task && open) {
            form.reset({
                name: task.name,
                source_query: task.source_query,
                destination_table: task.destination_table,
                primary_key_column: task.primary_key_column || "",
                interval_minutes: task.interval_minutes ?? 0,
                hard_sync: task.hard_sync ?? false,
                is_active: task.is_active,
            });
        } else if (!open) {
            form.reset({
                name: "",
                source_query: "SELECT *\nFROM MijnTabel\nWHERE Datum >= GETDATE()-30",
                destination_table: "",
                primary_key_column: "",
                interval_minutes: 0,
                hard_sync: false,
                is_active: true,
            });
        }
    }, [task, open, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            const queryId = task?.id || `job-${Date.now()}`;
            const mergedQueryData = {
                ...(task?.raw_query_data || {}),
                id: queryId,
                name: values.name.trim(),
                query: values.source_query,
                targetTable: values.destination_table.trim(),
                primaryKey: values.primary_key_column?.trim() || undefined,
                intervalMinutes: values.interval_minutes || 0,
                hardSync: values.hard_sync,
                enabled: values.is_active,
            };

            const payload = {
                query_id: queryId,
                name: values.name.trim(),
                target_table: values.destination_table.trim(),
                query_data: mergedQueryData,
                updated_at: new Date().toISOString(),
            };

            const { error } = await (supabase as any)
                .from("sql_sync_saved_queries")
                .upsert(payload, { onConflict: "query_id" });

            if (error) throw error;

            toast({
                title: task?.id ? "Bijgewerkt" : "Toegevoegd",
                description: task?.id
                    ? "Sync-configuratie opgeslagen (wordt gesynchroniseerd met de SQL Sync app)."
                    : "Nieuwe sync taak aangemaakt.",
            });

            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            toast({
                title: "Fout bij opslaan",
                description: error.message,
                variant: "destructive",
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{task ? "Taak bewerken" : "Nieuwe Sync Taak"}</DialogTitle>
                    <DialogDescription>
                        Definieer welke data vanuit de lokale MS SQL Server naar Supabase gesynchroniseerd wordt. Wijzigingen worden direct gedeeld met de SQL Sync desktop-app.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Naam</FormLabel>
                                    <FormControl>
                                        <Input placeholder="bijv. RamsesCorrecties" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="source_query"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>T-SQL Query (Bron)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="SELECT * FROM dbo.MijnTabel"
                                            className="font-mono text-xs h-40"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>De query die wordt uitgevoerd op de externe MS SQL Server.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="destination_table"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Doeltabel (Supabase)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="bijv. Voorraad" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="primary_key_column"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Primary Key (optioneel)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="bijv. id" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="interval_minutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Interval (minuten)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min={0} placeholder="0 = handmatig" {...field} />
                                        </FormControl>
                                        <FormDescription>0 = alleen handmatig</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>Actief</FormLabel>
                                            <FormDescription>
                                                Automatisch meenemen in geplande syncs.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="hard_sync"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>Hard Sync (tabel leegmaken)</FormLabel>
                                            <FormDescription>
                                                Vervangt alle rijen in de doeltabel bij elke sync.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Annuleren
                            </Button>
                            <Button type="submit">
                                Opslaan
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
