import { useState, useMemo } from "react";
import { useAllToolboxCompletions } from "@/hooks/useToolbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { addMonths, format, isAfter, isBefore, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { Search, CheckCircle2, AlertTriangle, XCircle, Loader2, BookOpen } from "lucide-react";

export function ToolboxLogbook() {
    const { completions, loading } = useAllToolboxCompletions();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "expired" | "warning">("all");

    const filteredCompletions = useMemo(() => {
        return completions.filter(c => {
            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const userName = c.user_profile?.full_name?.toLowerCase() || "";
            const userEmail = c.user_profile?.email?.toLowerCase() || "";
            const toolboxTitle = c.toolbox.title.toLowerCase();

            const matchesSearch =
                userName.includes(searchLower) ||
                userEmail.includes(searchLower) ||
                toolboxTitle.includes(searchLower);

            if (!matchesSearch) return false;

            // Status filter
            if (statusFilter === "all") return true;

            const completedDate = new Date(c.completed_at);
            const validityMonths = c.toolbox.validity_months || 12; // Default to 12 if not set
            const expirationDate = addMonths(completedDate, validityMonths);
            const warningDate = subMonths(expirationDate, 1);
            const now = new Date();

            if (statusFilter === "expired") {
                return isBefore(expirationDate, now);
            }
            if (statusFilter === "warning") {
                return isAfter(expirationDate, now) && isBefore(warningDate, now);
            }
            if (statusFilter === "valid") {
                return isAfter(expirationDate, now) && isAfter(warningDate, now); // Strictly valid (not in warning)
            }

            return true;
        });
    }, [completions, searchQuery, statusFilter]);

    const getStatusBadge = (completedAt: string, validityMonths: number) => {
        const completedDate = new Date(completedAt);
        const expirationDate = addMonths(completedDate, validityMonths);
        const warningDate = subMonths(expirationDate, 1);
        const now = new Date();

        if (isBefore(expirationDate, now)) {
            return (
                <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> Verlopen
                </Badge>
            );
        }
        if (isAfter(expirationDate, now) && isBefore(warningDate, now)) {
            return (
                <Badge variant="outline" className="border-warning text-warning gap-1">
                    <AlertTriangle className="h-3 w-3" /> Verloopt bijna
                </Badge>
            );
        }
        return (
            <Badge variant="outline" className="border-success text-success gap-1">
                <CheckCircle2 className="h-3 w-3" /> Geldig
            </Badge>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Toolbox Logboek</CardTitle>
                    <CardDescription>Overzicht van alle voltooide toolboxen en hun geldigheid.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Zoek op naam, email of toolbox..."
                                className="pl-10"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                            <SelectTrigger className="w-full md:w-48">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Alle statussen</SelectItem>
                                <SelectItem value="valid">Geldig</SelectItem>
                                <SelectItem value="warning">Verloopt bijna</SelectItem>
                                <SelectItem value="expired">Verlopen</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Medewerker</TableHead>
                                    <TableHead>Toolbox</TableHead>
                                    <TableHead>Voltooid op</TableHead>
                                    <TableHead>Geldig tot</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCompletions.length > 0 ? (
                                    filteredCompletions.map((completion) => {
                                        const completedDate = new Date(completion.completed_at);
                                        const validityMonths = completion.toolbox.validity_months || 12;
                                        const expirationDate = addMonths(completedDate, validityMonths);

                                        return (
                                            <TableRow key={`${completion.toolbox_id}-${completion.user_id}`}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {completion.user_profile?.full_name || "Onbekend"}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {completion.user_profile?.email || ""}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">{completion.toolbox.title}</TableCell>
                                                <TableCell>
                                                    {format(completedDate, "d MMM yyyy", { locale: nl })}
                                                </TableCell>
                                                <TableCell>
                                                    {format(expirationDate, "d MMM yyyy", { locale: nl })}
                                                </TableCell>
                                                <TableCell>
                                                    {completion.score !== null ? (
                                                        <Badge variant={completion.score >= 80 ? "secondary" : "outline"}>
                                                            {completion.score}%
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {getStatusBadge(completion.completed_at, validityMonths)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                                                <p>Geen resultaten gevonden</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
