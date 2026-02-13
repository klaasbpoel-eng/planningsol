import { useState, useEffect } from "react";
import {
    ResponsiveDialog,
    ResponsiveDialogContent,
    ResponsiveDialogDescription,
    ResponsiveDialogFooter,
    ResponsiveDialogHeader,
    ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AlertTriangle, ArrowRight, Merge } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Customer {
    id: string;
    name: string;
}

interface MergeCustomersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMerged: () => void;
}

export function MergeCustomersDialog({
    open,
    onOpenChange,
    onMerged,
}: MergeCustomersDialogProps) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [sourceId, setSourceId] = useState("");
    const [targetId, setTargetId] = useState("");
    const [deleteSource, setDeleteSource] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    useEffect(() => {
        if (open) {
            fetchCustomers();
            setSourceId("");
            setTargetId("");
            setDeleteSource(false);
        }
    }, [open]);

    const fetchCustomers = async () => {
        setFetching(true);
        try {
            const data = await api.customers.getAll();
            if (data) {
                setCustomers(data.map((c: any) => ({ id: c.id, name: c.name })));
            }
        } catch (error) {
            console.error("Error fetching customers:", error);
            toast.error("Fout bij ophalen klanten");
        } finally {
            setFetching(false);
        }
    };

    const handleMerge = async () => {
        if (!sourceId || !targetId) {
            toast.error("Selecteer een bron- en doelklant");
            return;
        }

        if (sourceId === targetId) {
            toast.error("Bron- en doelklant moeten verschillend zijn");
            return;
        }

        setLoading(true);
        try {
            // We need to cast api.customers to any because Typescript might not see the new 'merge' method yet 
            // if the interface wasn't updated in the same file or if it uses a type definition that wasn't updated.
            // In this project structure, api object is constructed in api.ts so it should be fine, 
            // but to be safe and avoid TS errors if types lag behind:
            await (api.customers as any).merge(sourceId, targetId, deleteSource);

            toast.success("Klanten succesvol samengevoegd");
            onMerged();
            onOpenChange(false);
        } catch (error) {
            console.error("Error merging customers:", error);
            toast.error("Fout bij samenvoegen klanten");
        } finally {
            setLoading(false);
        }
    };

    // Prepare options for SearchableSelect
    // We need to map to { value: string, label: string }
    const customerOptions = customers
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(c => ({ value: c.id, label: c.name }));

    const sourceName = customers.find(c => c.id === sourceId)?.name || "Bron";
    const targetName = customers.find(c => c.id === targetId)?.name || "Doel";

    return (
        <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
            <ResponsiveDialogContent className="sm:max-w-[500px]">
                <ResponsiveDialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/10">
                            <Merge className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                            <ResponsiveDialogTitle>Klanten Samenvoegen</ResponsiveDialogTitle>
                            <ResponsiveDialogDescription>
                                Voeg twee klanten samen en verplaats alle orders.
                            </ResponsiveDialogDescription>
                        </div>
                    </div>
                </ResponsiveDialogHeader>

                <div className="space-y-6 py-4">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label>Bron Klant (wordt verplaatst)</Label>
                            <SearchableSelect
                                options={customerOptions}
                                value={sourceId}
                                onValueChange={setSourceId}
                                placeholder="Selecteer bron klant..."
                                searchPlaceholder="Zoek klant..."
                                disabled={loading}
                            />
                        </div>

                        <div className="flex justify-center py-2">
                            <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90 sm:rotate-0" />
                        </div>

                        <div className="space-y-2">
                            <Label>Doel Klant (ontvangt data)</Label>
                            <SearchableSelect
                                options={customerOptions}
                                value={targetId}
                                onValueChange={setTargetId}
                                placeholder="Selecteer doel klant..."
                                searchPlaceholder="Zoek klant..."
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {sourceId && targetId && sourceId !== targetId && (
                        <Alert variant="destructive" className="bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400">
                            <AlertTriangle className="h-4 w-4 stroke-orange-600 dark:stroke-orange-400" />
                            <AlertTitle>Let op!</AlertTitle>
                            <AlertDescription>
                                Alle orders en data van <strong>{sourceName}</strong> worden verplaatst naar <strong>{targetName}</strong>.
                                Dit kan niet ongedaan worden gemaakt.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox
                            id="deleteSource"
                            checked={deleteSource}
                            onCheckedChange={(c) => setDeleteSource(c === true)}
                            disabled={loading}
                        />
                        <Label htmlFor="deleteSource" className="font-normal cursor-pointer leading-none">
                            Verwijder <strong>{sourceName !== "Bron" ? sourceName : "bron klant"}</strong> na samenvoegen
                        </Label>
                    </div>
                </div>

                <ResponsiveDialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        Annuleren
                    </Button>
                    <Button
                        onClick={handleMerge}
                        disabled={loading || !sourceId || !targetId || sourceId === targetId}
                        variant="destructive"
                        className="bg-orange-600 hover:bg-orange-700"
                    >
                        {loading ? "Bezig met samenvoegen..." : "Samenvoegen"}
                    </Button>
                </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
        </ResponsiveDialog>
    );
}
