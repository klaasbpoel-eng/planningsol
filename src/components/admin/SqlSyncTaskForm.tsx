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
    primary_key_column: z.string().min(1, "Primary key is verplicht voor updates."),
    is_active: z.boolean().default(true),
});

export type SqlSyncTask = z.infer<typeof formSchema> & {
    id?: string;
    created_at?: string;
    last_sync_time?: string;
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
            primary_key_column: "ID",
            is_active: true,
        },
    });

    useEffect(() => {
        if (task && open) {
            form.reset({
                name: task.name,
                source_query: task.source_query,
                destination_table: task.destination_table,
                primary_key_column: task.primary_key_column,
                is_active: task.is_active,
            });
        } else if (!open) {
            form.reset({
                name: "",
                source_query: "SELECT *\nFROM MijnTabel\nWHERE Datum >= GETDATE()-30",
                destination_table: "",
                primary_key_column: "ID",
                is_active: true,
            });
        }
    }, [task, open, form]);

    async function onSubmit(values: z.infer<typeof formSchema>) {
        try {
            if (task?.id) {
                // Edit existing
                const { error } = await (supabase as any)
                    .from("sql_sync_tasks")
                    .update(values)
                    .eq("id", task.id);

                if (error) throw error;
                toast({ title: "Bijgewerkt", description: "Configuratie is opgeslagen." });
            } else {
                // Create new
                const { error } = await (supabase as any)
                    .from("sql_sync_tasks")
                    .insert([values]);

                if (error) throw error;
                toast({ title: "Toegevoegd", description: "Nieuwe sync taak is aangemaakt." });
            }

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
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{task ? "Taak bewerken" : "Nieuwe Sync Taak"}</DialogTitle>
                    <DialogDescription>
                        Definieer welke data vanuit lokale SQL server naar Supabase gepompt moet worden.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unieke Naam</FormLabel>
                                    <FormControl>
                                        <Input placeholder="bijv. Artikelen Sync PIM" {...field} />
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
                                            className="font-mono text-sm h-32"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>De query die wordt uitgevoerd op de externe SQL Server.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="destination_table"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Doeltabel (Supabase)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="bijv. sync_articles" {...field} />
                                        </FormControl>
                                        <FormDescription>Tabelnaam exact zoals deze in de cloud bestaat.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="primary_key_column"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Unieke ID Kolom (Doel)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="bijv. ArtikelNr" {...field} />
                                        </FormControl>
                                        <FormDescription>Wordt gebruikt voor 'upserts' (voorkomt dubbele).</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="is_active"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Direct Activeren</FormLabel>
                                        <FormDescription>
                                            Zolang deze gepauzeerd staat, slaat de cronjob dit over.
                                        </FormDescription>
                                    </div>
                                </FormItem>
                            )}
                        />

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
