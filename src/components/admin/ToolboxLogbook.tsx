import { useState, useMemo } from "react";
import { useAllToolboxCompletions, useToolboxSessions, useToolboxSessionParticipants } from "@/hooks/useToolbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Added Tabs
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // Added Dialog
import { addMonths, format, isAfter, isBefore, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { Search, CheckCircle2, AlertTriangle, XCircle, Loader2, BookOpen, Users, Calendar, MapPin, User, Trash2 } from "lucide-react"; // Added icons
import { Button } from "@/components/ui/button"; // Added Button
import { supabase } from "@/integrations/supabase/client"; // For delete
import { toast } from "sonner"; // For toast

export function ToolboxLogbook() {
    const [activeTab, setActiveTab] = useState("individual");

    // Individual Data
    const { completions, loading: loadingCompletions } = useAllToolboxCompletions();
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "expired" | "warning">("all");

    // Session Data
    const { sessions, loading: loadingSessions, refetch: refetchSessions } = useToolboxSessions();
    const [sessionSearch, setSessionSearch] = useState("");

    // Session Details Dialog
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
    const selectedSession = useMemo(() => sessions.find(s => s.id === selectedSessionId), [sessions, selectedSessionId]);
    const { participants: sessionParticipants, loading: loadingParticipants } = useToolboxSessionParticipants(selectedSessionId);

    // Filter Logic (Individual)
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

    // Filter Logic (Sessions)
    const filteredSessions = useMemo(() => {
        return sessions.filter(s => {
            const searchLower = sessionSearch.toLowerCase();
            const toolboxTitle = s.toolbox?.title.toLowerCase() || "";
            const instructorName = s.instructor?.full_name?.toLowerCase() || "";
            const location = s.location?.toLowerCase() || "";

            return toolboxTitle.includes(searchLower) ||
                instructorName.includes(searchLower) ||
                location.includes(searchLower);
        });
    }, [sessions, sessionSearch]);

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

    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Weet je zeker dat je deze sessie wilt verwijderen? Hiermee worden ook de logs voor de deelnemers verwijderd.")) return;

        try {
            const { error } = await supabase.from("toolbox_sessions" as any).delete().eq("id", id);
            if (error) throw error;
            toast.success("Sessie verwijderd");
            refetchSessions();
        } catch (error: any) {
            toast.error("Fout bij verwijderen: " + error.message);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Toolbox Logboek</CardTitle>
                    <CardDescription>Overzicht van alle voltooide toolboxen en klassikale sessies.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-6">
                            <TabsTrigger value="individual" className="gap-2"><User className="h-4 w-4" /> Individueel</TabsTrigger>
                            <TabsTrigger value="sessions" className="gap-2"><Users className="h-4 w-4" /> Klassikale Sessies</TabsTrigger>
                        </TabsList>

                        <TabsContent value="individual" className="space-y-6">
                            <div className="flex flex-col md:flex-row gap-4">
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

                            {loadingCompletions ? (
                                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : (
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
                            )}
                        </TabsContent>

                        <TabsContent value="sessions" className="space-y-6">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Zoek sessie..."
                                    className="pl-10"
                                    value={sessionSearch}
                                    onChange={(e) => setSessionSearch(e.target.value)}
                                />
                            </div>

                            {loadingSessions ? (
                                <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                            ) : (
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Datum</TableHead>
                                                <TableHead>Toolbox</TableHead>
                                                <TableHead>Locatie</TableHead>
                                                <TableHead>Instructeur</TableHead>
                                                <TableHead>Deelnemers</TableHead>
                                                <TableHead className="w-[50px]"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredSessions.length > 0 ? (
                                                filteredSessions.map((session) => (
                                                    <TableRow
                                                        key={session.id}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => setSelectedSessionId(session.id)}
                                                    >
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                                {format(new Date(session.session_date), "d MMM yyyy", { locale: nl })}
                                                                {session.session_time && <span className="text-muted-foreground text-xs">({session.session_time})</span>}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>{session.toolbox?.title || "Onbekende Toolbox"}</TableCell>
                                                        <TableCell>
                                                            {session.location && (
                                                                <div className="flex items-center gap-1">
                                                                    <MapPin className="h-3 w-3 text-muted-foreground" />
                                                                    {session.location}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>{session.instructor?.full_name || "-"}</TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="gap-1">
                                                                <Users className="h-3 w-3" />
                                                                {session._count?.participants || 0}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteSession(session.id, e)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="h-24 text-center">
                                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                            <BookOpen className="h-8 w-8 mb-2 opacity-20" />
                                                            <p>Geen sessies gevonden</p>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Session Details Dialog */}
            <Dialog open={!!selectedSessionId} onOpenChange={(open) => !open && setSelectedSessionId(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Sessie Details</DialogTitle>
                        <DialogDescription>
                            {selectedSession?.toolbox?.title} op {selectedSession?.session_date && format(new Date(selectedSession.session_date), "d MMM yyyy", { locale: nl })}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                            <div>
                                <span className="text-muted-foreground block text-xs">Locatie</span>
                                <span className="font-medium">{selectedSession?.location || "-"}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-xs">Instructeur</span>
                                <span className="font-medium">{selectedSession?.instructor?.full_name || "-"}</span>
                            </div>
                            {selectedSession?.notes && (
                                <div className="col-span-2">
                                    <span className="text-muted-foreground block text-xs">Opmerkingen</span>
                                    <p className="mt-1">{selectedSession.notes}</p>
                                </div>
                            )}
                        </div>

                        <div>
                            <h4 className="font-medium mb-3 flex items-center justify-between">
                                <span>Deelnemers</span>
                                <Badge variant="secondary">{sessionParticipants.length}</Badge>
                            </h4>
                            {loadingParticipants ? (
                                <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                            ) : (
                                <div className="max-h-[300px] overflow-y-auto border rounded-md divide-y">
                                    {sessionParticipants.map(p => (
                                        <div key={p.id} className="p-3 text-sm flex justify-between items-center">
                                            <div>
                                                <span className="font-medium block">{p.profile?.full_name}</span>
                                                <span className="text-xs text-muted-foreground">{p.profile?.email}</span>
                                            </div>
                                            {p.profile?.department && (
                                                <Badge variant="outline" className="text-[10px]">{p.profile.department}</Badge>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
