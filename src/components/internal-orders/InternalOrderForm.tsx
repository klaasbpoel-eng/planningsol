import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ARTICLES } from "@/data/articles";
import type { Database } from "@/integrations/supabase/types";

type ProductionLocation = Database["public"]["Enums"]["production_location"];

export interface OrderItem {
    articleId: string;
    articleName: string;
    quantity: number;
}

export interface InternalOrderFormData {
    fromLocation: ProductionLocation;
    toLocation: ProductionLocation;
    items: OrderItem[];
    notes: string;
}

interface InternalOrderFormProps {
    initialData?: InternalOrderFormData;
    defaultFromLocation?: ProductionLocation;
    defaultToLocation?: ProductionLocation;
    onSubmit: (data: InternalOrderFormData) => Promise<void>;
    isSubmitting?: boolean;
    submitLabel?: string;
}

export const InternalOrderForm = ({
    initialData,
    defaultFromLocation = "sol_emmen",
    defaultToLocation = "sol_tilburg",
    onSubmit,
    isSubmitting = false,
    submitLabel = "Bestelling Plaatsen"
}: InternalOrderFormProps) => {
    const [fromLocation, setFromLocation] = useState<ProductionLocation>(initialData?.fromLocation || defaultFromLocation);
    const [toLocation, setToLocation] = useState<ProductionLocation>(initialData?.toLocation || defaultToLocation);
    const [selectedArticle, setSelectedArticle] = useState<string>("");
    const [quantity, setQuantity] = useState<number>(1);
    const [createItems, setCreateItems] = useState<OrderItem[]>(initialData?.items || []);
    const [notes, setNotes] = useState<string>(initialData?.notes || "");

    // Update defaults if they change and no initial data was provided (e.g. initial load)
    useEffect(() => {
        if (!initialData) {
            setFromLocation(defaultFromLocation);
            setToLocation(defaultToLocation);
        }
    }, [defaultFromLocation, defaultToLocation, initialData]);

    const articleGroups = useMemo(() => {
        const sorted = [...ARTICLES].sort((a, b) => a.name.localeCompare(b.name));

        // Group by category
        const groups: Record<string, typeof sorted> = {};

        sorted.forEach(article => {
            const category = article.category || "Overig";
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(article);
        });

        // Convert to array and sort by category name
        return Object.entries(groups)
            .map(([heading, items]) => ({ heading, items }))
            .sort((a, b) => a.heading.localeCompare(b.heading));
    }, []);

    const LocationLabel = ({ value }: { value: string }) => {
        return value === "sol_emmen" ? <span>SOL Emmen</span> : <span>SOL Tilburg</span>;
    };

    const addItem = () => {
        if (!selectedArticle || quantity <= 0) return;
        const article = ARTICLES.find(a => a.id === selectedArticle);
        if (!article) return;

        setCreateItems(prev => [
            ...prev,
            { articleId: article.id, articleName: article.name, quantity }
        ]);
        setSelectedArticle("");
        setQuantity(1);
    };

    const removeItem = (index: number) => {
        setCreateItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        onSubmit({
            fromLocation,
            toLocation,
            items: createItems,
            notes
        });

        // Only clear if not editing (initialData undefined)
        if (!initialData) {
            setCreateItems([]);
            setNotes("");
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Van</Label>
                    <div className="p-2 bg-muted/50 rounded-md font-medium text-sm border">
                        <LocationLabel value={fromLocation} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>Naar</Label>
                    <div className="p-2 bg-muted/50 rounded-md font-medium text-sm border">
                        <LocationLabel value={toLocation} />
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-3">
                <Label>Artikel Toevoegen</Label>
                <SearchableSelect
                    groups={articleGroups.map(g => ({
                        heading: g.heading,
                        items: g.items.map(a => ({
                            value: a.id,
                            label: `[${a.id}] ${a.name}`
                        }))
                    }))}
                    value={selectedArticle}
                    onValueChange={setSelectedArticle}
                    placeholder="Selecteer artikel..."
                    searchPlaceholder="Zoek..."
                />

                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="w-full sm:w-1/3">
                        <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                        />
                    </div>
                    <Button className="w-full sm:flex-1" variant="secondary" onClick={addItem} disabled={!selectedArticle}>
                        <Plus className="h-4 w-4 mr-2" />
                        Toevoegen
                    </Button>
                </div>
            </div>

            {/* Current Items List */}
            {createItems.length > 0 && (
                <div className="mt-4 border rounded-md overflow-hidden">
                    <div className="bg-muted/50 p-2 text-xs font-medium text-muted-foreground border-b">
                        Orderregels
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                        {createItems.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 text-sm border-b last:border-0 hover:bg-muted/20">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <Badge variant="outline" className="shrink-0 h-6">{item.quantity}x</Badge>
                                    <div className="flex flex-col sm:flex-row sm:items-center overflow-hidden">
                                        <span className="text-muted-foreground text-xs mr-2 shrink-0">[{item.articleId}]</span>
                                        <span className="truncate font-medium">{item.articleName}</span>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0 ml-2" onClick={() => removeItem(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="notes">Notities</Label>
                <Textarea
                    id="notes"
                    placeholder="Opmerkingen..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none"
                    rows={3}
                />
            </div>

            <Button
                className="w-full mt-4"
                size="lg"
                onClick={handleSubmit}
                disabled={createItems.length === 0 || isSubmitting}
            >
                {isSubmitting ? "Bezig..." : submitLabel}
            </Button>
        </div>
    );
};
