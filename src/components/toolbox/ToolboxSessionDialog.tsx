import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon, Loader2, CheckCircle2, Search, UserMinus, UserPlus, Users, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { useToolboxes, createToolboxSession, useAllToolboxCompletions } from "@/hooks/useToolbox";
import { supabase } from "@/integrations/supabase/client";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

interface Profile {
    id: string; // This is the PK (UUID)
    user_id: string; // This is the auth.users UUID
    full_name: string | null;
    email: string | null;
    production_location: string | null;
    department: string | null;
    is_approved: boolean; // Only show approved users
}

export function ToolboxSessionDialog({ open, onOpenChange, onSaved }: Props) {
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    // Data State
    const { toolboxes } = useToolboxes();
    const { completions } = useAllToolboxCompletions(); // To check previous completions
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    // Form State
    const [sessionData, setSessionData] = useState({
        toolbox_id: "",
        session_date: new Date(),
        session_time: format(new Date(), "HH:mm"),
        location: "Vergaderruimte",
        instructor_id: "",
        notes: ""
    });

    const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
    const [participantFilter, setParticipantFilter] = useState("");
    const [locationFilter, setLocationFilter] = useState("all");

    // Fetch profiles on mount
    useEffect(() => {
        async function fetchProfiles() {
            setLoadingProfiles(true);
            const { data } = await supabase
                .from("profiles" as any)
                .select("*")
                .eq("is_approved", true) // Only active employees
                .order("full_name");

            if (data) setProfiles(data as any);
            setLoadingProfiles(false);
        }
        if (open) fetchProfiles();
    }, [open]);

    // Reset on open
    useEffect(() => {
        if (open) {
            setStep(1);
            setSessionData({
                toolbox_id: "",
                session_date: new Date(),
                session_time: format(new Date(), "HH:mm"),
                location: "Vergaderruimte",
                instructor_id: "",
                notes: ""
            });
            setSelectedProfileIds(new Set());
        }
    }, [open]);

    // Derived Data
    const publishedToolboxes = useMemo(() => toolboxes.filter(t => t.status === "published"), [toolboxes]);

    const uniqueLocations = useMemo(() =>
        ["all", ...new Set(profiles.map(p => p.production_location).filter(Boolean) as string[])].sort(),
        [profiles]);

    const filteredProfiles = useMemo(() => {
        return profiles.filter(p => {
            const matchesSearch = (p.full_name?.toLowerCase() || "").includes(participantFilter.toLowerCase()) ||
                (p.email?.toLowerCase() || "").includes(participantFilter.toLowerCase());
            const matchesLocation = locationFilter === "all" || p.production_location === locationFilter;
            return matchesSearch && matchesLocation;
        });
    }, [profiles, participantFilter, locationFilter]);

    // Selection Handlers
    const toggleProfile = (id: string) => {
        const newSet = new Set(selectedProfileIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedProfileIds(newSet);
    };

    const selectAllFiltered = () => {
        const newSet = new Set(selectedProfileIds);
        filteredProfiles.forEach(p => newSet.add(p.user_id)); // Use user_id for completion tracking
        setSelectedProfileIds(newSet);
    };

    const deselectAllFiltered = () => {
        const newSet = new Set(selectedProfileIds);
        filteredProfiles.forEach(p => newSet.delete(p.user_id));
        setSelectedProfileIds(newSet);
    };

    // Helper to check if user already completed this toolbox
    const getCompletionStatus = (userId: string) => {
        if (!sessionData.toolbox_id) return null;
        const completion = completions.find(c => c.toolbox_id === sessionData.toolbox_id && c.user_id === userId);
        return completion ? completion.completed_at : null;
    };

    const handleNext = () => {
        if (step === 1) {
            if (!sessionData.toolbox_id) { toast.error("Kies een toolbox"); return; }
            if (!sessionData.session_date) { toast.error("Kies een datum"); return; }
            setStep(2);
        } else if (step === 2) {
            if (selectedProfileIds.size === 0) { toast.error("Selecteer minimaal 1 deelnemer"); return; }
            setStep(3);
        }
    };

    const handleSubmit = async () => {
        try {
            setSubmitting(true);

            const participants = Array.from(selectedProfileIds).map(userId => {
                const profile = profiles.find(p => p.user_id === userId);
                return {
                    profileId: profile?.id || "",
                    userId: userId
                };
            }).filter(p => p.profileId !== "");

            await createToolboxSession({
                toolbox_id: sessionData.toolbox_id,
                session_date: format(sessionData.session_date, "yyyy-MM-dd"), // Correct format for DB DATE
                session_time: sessionData.session_time,
                location: sessionData.location,
                instructor_id: sessionData.instructor_id || null, // This references profiles.id (UUID)
                notes: sessionData.notes
            }, participants);

            toast.success(`Sessie geregistreerd met ${selectedProfileIds.size} deelnemers!`);
            onSaved();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Fout: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                    <DialogTitle>Klassikale Sessie Registreren</DialogTitle>
                    <DialogDescription>
                        Stap {step} van 3: {step === 1 ? "Sessie Details" : step === 2 ? "Deelnemers" : "Bevestigen"}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-6">
                    {step === 1 && (
                        <div className="space-y-6 max-w-xl mx-auto w-full animate-fade-in-up">
                            <div className="space-y-3">
                                <Label>Toolbox</Label>
                                <Select
                                    value={sessionData.toolbox_id}
                                    onValueChange={(v) => setSessionData({ ...sessionData, toolbox_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecteer een toolbox..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {publishedToolboxes.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.title} ({t.category})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <Label>Datum</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !sessionData.session_date && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {sessionData.session_date ? format(sessionData.session_date, "d MMMM yyyy", { locale: nl }) : <span>Kies datum</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={sessionData.session_date} onSelect={(d) => d && setSessionData({ ...sessionData, session_date: d })} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-3">
                                    <Label>Tijd</Label>
                                    <Input
                                        type="time"
                                        value={sessionData.session_time}
                                        onChange={(e) => setSessionData({ ...sessionData, session_time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Locatie</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={sessionData.location}
                                        onChange={(e) => setSessionData({ ...sessionData, location: e.target.value })}
                                        placeholder="Bijv. Kantine Emmen"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Instructeur</Label>
                                <Select
                                    value={sessionData.instructor_id}
                                    onValueChange={(v) => setSessionData({ ...sessionData, instructor_id: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Wie gaf de training?" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">-- Geen / Onbekend --</SelectItem>
                                        {profiles.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col h-full gap-4 animate-fade-in-up">
                            <div className="flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 bg-muted/30 p-4 rounded-lg border">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Zoek medewerker..."
                                        className="pl-9"
                                        value={participantFilter}
                                        onChange={(e) => setParticipantFilter(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2 w-full md:w-auto">
                                    <Select value={locationFilter} onValueChange={setLocationFilter}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Locatie" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Alle locaties</SelectItem>
                                            {uniqueLocations.map(l => l !== "all" && <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline" size="icon" onClick={selectAllFiltered} title="Selecteer alles">
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={deselectAllFiltered} title="Deselecteer alles">
                                        <UserMinus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm px-1">
                                <span className="text-muted-foreground">{filteredProfiles.length} medewerkers getoond</span>
                                <Badge variant="secondary" className="text-primary gap-1">
                                    <Users className="h-3 w-3" />
                                    {selectedProfileIds.size} geselecteerd
                                </Badge>
                            </div>

                            <ScrollArea className="flex-1 border rounded-md">
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {filteredProfiles.map(profile => {
                                        const isSelected = selectedProfileIds.has(profile.user_id); // Use user_id
                                        const completedAt = getCompletionStatus(profile.user_id);

                                        return (
                                            <div
                                                key={profile.id}
                                                className={cn(
                                                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                                    isSelected ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-muted/50",
                                                    completedAt && !isSelected && "bg-green-50/50 dark:bg-green-900/10 border-green-200/50"
                                                )}
                                                onClick={() => toggleProfile(profile.user_id)}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleProfile(profile.user_id)}
                                                    className="mt-1"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-medium">{profile.full_name}</span>
                                                        {profile.production_location && (
                                                            <Badge variant="outline" className="text-[10px] h-5">{profile.production_location}</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{profile.department || "Geen afdeling"}</p>

                                                    {completedAt && (
                                                        <p className="text-[10px] text-green-600 flex items-center gap-1 mt-1">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Voltooid op {format(new Date(completedAt), "dd-MM-yyyy")}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6 animate-fade-in-up">
                            <div className="bg-muted/30 p-6 rounded-lg border space-y-4">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    Samenvatting Sessie
                                </h3>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Toolbox</span>
                                        <span className="font-medium">{publishedToolboxes.find(t => t.id === sessionData.toolbox_id)?.title}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Datum & Tijd</span>
                                        <span className="font-medium">{format(sessionData.session_date, "d MMMM yyyy", { locale: nl })} om {sessionData.session_time}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Locatie</span>
                                        <span className="font-medium">{sessionData.location}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs">Instructeur</span>
                                        <span className="font-medium">
                                            {profiles.find(p => p.id === sessionData.instructor_id)?.full_name || "Onbekend"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-medium mb-3 flex items-center justify-between">
                                    <span>Geselecteerde Deelnemers</span>
                                    <Badge variant="secondary">{selectedProfileIds.size}</Badge>
                                </h4>
                                <ScrollArea className="h-48 border rounded-md">
                                    <div className="p-2 space-y-1">
                                        {Array.from(selectedProfileIds).map(userId => {
                                            const p = profiles.find(pr => pr.user_id === userId);
                                            if (!p) return null;
                                            return (
                                                <div key={userId} className="text-sm py-1 px-3 bg-muted/20 rounded flex justify-between">
                                                    <span>{p.full_name}</span>
                                                    <span className="text-xs text-muted-foreground">{p.department}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                                <p className="text-xs text-muted-foreground mt-2">
                                    * Deze deelnemers worden automatisch gemarkeerd als geslaagd voor deze toolbox.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-muted/10 shrink-0">
                    {step > 1 && (
                        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={submitting}>
                            Vorige
                        </Button>
                    )}

                    {step < 3 ? (
                        <Button onClick={handleNext}>Volgende</Button>
                    ) : (
                        <Button onClick={handleSubmit} disabled={submitting} className="min-w-[120px]">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Registreer Sessie
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
