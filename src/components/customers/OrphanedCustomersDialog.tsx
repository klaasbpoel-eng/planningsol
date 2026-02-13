import { useState, useEffect } from "react";
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, UserPlus, Merge, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface Orphan {
    customer_id: string;
    customer_name: string;
}

interface OrphanedCustomersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onResolved: () => void;
}

export function OrphanedCustomersDialog({
    open,
    onOpenChange,
    onResolved,
}: OrphanedCustomersDialogProps) {
    const [orphans, setOrphans] = useState<Orphan[]>([]);
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [targetId, setTargetId] = useState("");
    const [customers, setCustomers] = useState<{ value: string, label: string }[]>([]);
    const [linkModeId, setLinkModeId] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            checkOrphans();
            fetchCustomers();
        }
    }, [open]);

    const fetchCustomers = async () => {
        try {
            const data = await api.customers.getAll();
            if (data) {
                setCustomers(data.map((c: any) => ({ value: c.id, label: c.name })));
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
        }
    };

    const checkOrphans = async () => {
        setLoading(true);
        try {
            // Need to cast to any mainly because TS definition might not be updated in IDE context yet
            const data = await (api.customers as any).getOrphans();
            setOrphans(data || []);
            if (data && data.length === 0) {
                // Optional: auto-close or show success? 
                // For now just show empty state
            }
        } catch (error) {
            console.error("Error checking orphans:", error);
            toast.error("Kon wezen niet controleren");
        } finally {
            setLoading(false);
        }
    };

    const handleRevive = async (orphan: Orphan) => {
        setResolvingId(orphan.customer_id);
        try {
            await (api.customers as any).reviveOrphan(orphan.customer_id, orphan.customer_name);
            toast.success(`Klant "${orphan.customer_name}" hersteld`);
            setOrphans(prev => prev.filter(o => o.customer_id !== orphan.customer_id));
            onResolved(); // Notify parent to refresh list
        } catch (error) {
            console.error("Error reviving orphan:", error);
            toast.error("Herstellen mislukt");
        } finally {
            setResolvingId(null);
        }
    };

    const handleLink = async (orphan: Orphan) => {
        if (!targetId) {
            toast.error("Selecteer een doelklant");
            return;
        }

        setResolvingId(orphan.customer_id);
        try {
            // Use merge to move orders, false for deleteSource (source doesn't exist anyway)
            await (api.customers as any).merge(orphan.customer_id, targetId, false);
            toast.success(`Orders van "${orphan.customer_name}" verplaatst`);
            setOrphans(prev => prev.filter(o => o.customer_id !== orphan.customer_id));
            setLinkModeId(null);
            setTargetId("");
            onResolved();
        } catch (error) {
            console.error("Error linking orphan:", error);
            toast.error("Koppelen mislukt");
        } finally {
            setResolvingId(null);
        }
    };

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogContent className="sm:max-w-[700px]">
                <ResponsiveDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                            <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        </div>
                        <div>
                            <ResponsiveDialogTitle>Data Integriteit Controle</ResponsiveDialogTitle>
                            <ResponsiveDialogDescription>
                                Er zijn orders gevonden die gekoppeld zijn aan klanten die niet (meer) bestaan.
                            </ResponsiveDialogDescription>
                        </div>
                    </div>
                </ResponsiveDialogHeader>

                <div className="py-4">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : orphans.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="font-medium">Alles ziet er goed uit!</h3>
                            <p className="text-muted-foreground text-sm max-w-xs">
                                Er zijn geen zwevende orders of ontbrekende klantprofielen gevonden.
                            </p>
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="mt-2">
                                Sluiten
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Alert>
                                <AlertDescription>
                                    De onderstaande klanten hebben wel orders, maar geen klantprofiel. U kunt ze herstellen (opnieuw aanmaken) of hun orders koppelen aan een bestaande klant.
                                </AlertDescription>
                            </Alert>

                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Klantnaam (uit orders)</TableHead>
                                            <TableHead>ID</TableHead>
                                            <TableHead className="text-right">Acties</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orphans.map((orphan) => (
                                            <TableRow key={orphan.customer_id}>
                                                <TableCell className="font-medium">
                                                    {orphan.customer_name || "Onbekend"}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {orphan.customer_id}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {linkModeId === orphan.customer_id ? (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <div className="w-[200px]">
                                                                <SearchableSelect
                                                                    options={customers}
                                                                    value={targetId}
                                                                    onValueChange={setTargetId}
                                                                    placeholder="Kies klant..."
                                                                    className="h-8"
                                                                />
                                                            </div>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleLink(orphan)}
                                                                disabled={resolvingId === orphan.customer_id || !targetId}
                                                            >
                                                                {resolvingId === orphan.customer_id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Koppel"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => setLinkModeId(null)}
                                                            >
                                                                Annuleer
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleRevive(orphan)}
                                                                disabled={resolvingId === orphan.customer_id || !!linkModeId}
                                                            >
                                                                {resolvingId === orphan.customer_id && resolvingId !== "link" ? (
                                                                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                                                ) : (
                                                                    <UserPlus className="h-3 w-3 mr-2" />
                                                                )}
                                                                Herstellen
                                                            </Button>
                                                            <Button
                                                                variant="secondary"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setLinkModeId(orphan.customer_id);
                                                                    setTargetId("");
                                                                }}
                                                                disabled={resolvingId === orphan.customer_id || !!linkModeId}
                                                            >
                                                                <Merge className="h-3 w-3 mr-2" />
                                                                Koppelen
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
