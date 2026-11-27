import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, PackageCheck, Printer, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { AppRole } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dayOf, latestImportOnly, groupByDriver, localDay, pickDefaultDay, totalsByArticle, type PlanningLine } from "@/lib/orderPicking";

const PLANNING_TABLE = "PlanningRamses";
const PICKS_TABLE = "PlanningRamsesPicks";
const PICK_ROLES: AppRole[] = ["admin", "supervisor", "operator"];

const nlNumber = (n: number) => n.toLocaleString("nl-NL");
const dayLabel = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function OrderPickingPage() {
  return (
    <ProtectedRoute>
      {({ user, role, isAdmin }) => <OrderPickingContent userEmail={user.email} userId={user.id} role={role} isAdmin={isAdmin} />}
    </ProtectedRoute>
  );
}

function OrderPickingContent({ userEmail, userId, role, isAdmin }: { userEmail?: string; userId: string; role: AppRole; isAdmin: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const canPick = PICK_ROLES.includes(role);
  const [picksMissing, setPicksMissing] = useState(false);

  const planning = useQuery({
    queryKey: ["planning-ramses"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(PLANNING_TABLE).select("id,Datum,Klant,Artikelnummer,Omschrijving,Aantal,Chauffeur,created_at").order("Datum").limit(5000);
      if (error) throw error;
      return latestImportOnly((data ?? []) as PlanningLine[]);
    },
  });

  const picks = useQuery({
    queryKey: ["planning-ramses-picks"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(PICKS_TABLE).select("planning_id");
      if (error) {
        setPicksMissing(true);
        return new Set<string>();
      }
      setPicksMissing(false);
      return new Set<string>((data ?? []).map((r: { planning_id: string }) => r.planning_id));
    },
  });
  const picked = picks.data ?? new Set<string>();

  const days = useMemo(() => [...new Set((planning.data ?? []).map((l) => dayOf(l.Datum)).filter(Boolean) as string[])].sort(), [planning.data]);
  const day = params.get("dag") ?? pickDefaultDay(days, localDay(new Date()));
  const driver = params.get("chauffeur") ?? "alle";
  const view = params.get("weergave") === "artikel" ? "artikel" : "chauffeur";
  const onlyOpen = params.get("open") === "1";

  const setParam = (key: string, value: string | null) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key);
      else next.set(key, value);
      return next;
    });

  const dayLines = useMemo(() => (planning.data ?? []).filter((l) => dayOf(l.Datum) === day), [planning.data, day]);
  const drivers = useMemo(() => groupByDriver(dayLines, picked).map((g) => g.chauffeur), [dayLines, picked]);
  const lines = driver === "alle" ? dayLines : dayLines.filter((l) => (l.Chauffeur?.trim() || "Zonder chauffeur") === driver);
  const groups = groupByDriver(lines, picked);
  const totals = totalsByArticle(lines, picked);
  const pickedCount = lines.filter((l) => picked.has(l.id)).length;
  const pct = lines.length ? Math.round((pickedCount / lines.length) * 100) : 0;

  const dayIndex = days.indexOf(day);
  const goDay = (delta: number) => {
    const target = dayIndex === -1 ? days.find((d) => (delta > 0 ? d > day : d < day)) : days[dayIndex + delta];
    if (target) setParams((prev) => { const n = new URLSearchParams(prev); n.set("dag", target); n.delete("chauffeur"); return n; });
  };

  const toggle = useMutation({
    mutationFn: async ({ id, isPicked }: { id: string; isPicked: boolean }) => {
      const table = (supabase as any).from(PICKS_TABLE);
      const { error } = isPicked
        ? await table.delete().eq("planning_id", id)
        : await table.upsert({ planning_id: id, picked_by: userId }, { onConflict: "planning_id" });
      if (error) throw error;
    },
    onMutate: async ({ id, isPicked }) => {
      await queryClient.cancelQueries({ queryKey: ["planning-ramses-picks"] });
      const prev = queryClient.getQueryData<Set<string>>(["planning-ramses-picks"]);
      const next = new Set(prev ?? []);
      if (isPicked) next.delete(id);
      else next.add(id);
      queryClient.setQueryData(["planning-ramses-picks"], next);
      if (!isPicked) {
        const line = lines.find((l) => l.id === id);
        const g = groupByDriver(lines.filter((l) => (l.Chauffeur ?? "") === (line?.Chauffeur ?? "")), next)[0];
        if (g && g.picked === g.total) toast({ title: `${g.chauffeur} compleet`, description: "Alle regels voor deze chauffeur zijn gepickt." });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      queryClient.setQueryData(["planning-ramses-picks"], ctx?.prev);
      toast({ title: "Opslaan mislukt", description: "De pickstatus is niet bewaard. Probeer het opnieuw.", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["planning-ramses-picks"] }),
  });

  const pickable = canPick && !picksMissing;
  const LineRow = ({ line }: { line: PlanningLine }) => {
    const isPicked = picked.has(line.id);
    return (
      <button
        type="button"
        disabled={!pickable}
        aria-pressed={isPicked}
        aria-label={`${line.Aantal}× ${line.Omschrijving ?? ""}${isPicked ? " (gepickt)" : ""}`}
        onClick={() => toggle.mutate({ id: line.id, isPicked })}
        className={cn(
          "flex w-full items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors select-none min-h-[64px]",
          isPicked ? "border-emerald-500/40 bg-emerald-500/10 text-muted-foreground" : "bg-card hover:bg-accent",
          !pickable && "cursor-default",
        )}
      >
        {isPicked ? <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-500" /> : <Circle className="h-7 w-7 shrink-0 text-muted-foreground" />}
        <span className={cn("w-14 shrink-0 text-2xl font-bold tabular-nums", isPicked && "line-through")}>{line.Aantal}×</span>
        <span className={cn("flex-1 text-base font-medium", isPicked && "line-through")}>{line.Omschrijving}</span>
        <span className="shrink-0 font-mono text-sm text-muted-foreground">{line.Artikelnummer}</span>
      </button>
    );
  };

  const sortLines = (ls: PlanningLine[]) => (onlyOpen ? ls.filter((l) => !picked.has(l.id)) : [...ls.filter((l) => !picked.has(l.id)), ...ls.filter((l) => picked.has(l.id))]);

  return (
    <PageLayout userEmail={userEmail} role={role} isAdmin={isAdmin} title="Orderpicken" description="Zet per chauffeur de orders klaar en tik regels af zodra ze gepickt zijn." titleIcon={<PackageCheck className="h-6 w-6 text-primary" />}>
      <div className="space-y-4">
        <Card className="glass-card print:hidden">
          <CardContent className="space-y-4 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Vorige dag" onClick={() => goDay(-1)} disabled={!days.some((d) => d < day)}><ChevronLeft className="h-5 w-5" /></Button>
              <span className="min-w-[14rem] text-center text-lg font-semibold capitalize">{dayLabel(day)}</span>
              <Button variant="outline" size="icon" aria-label="Volgende dag" onClick={() => goDay(1)} disabled={!days.some((d) => d > day)}><ChevronRight className="h-5 w-5" /></Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { planning.refetch(); picks.refetch(); }}><RefreshCw className="mr-2 h-4 w-4" />Verversen</Button>
                <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Printen</Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chauffeur">
              {["alle", ...drivers].map((d) => (
                <Button key={d} size="lg" variant={driver === d ? "default" : "outline"} onClick={() => setParam("chauffeur", d === "alle" ? null : d)}>{d === "alle" ? "Alle chauffeurs" : d}</Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant={view === "chauffeur" ? "secondary" : "ghost"} onClick={() => setParam("weergave", null)}>Per chauffeur</Button>
              <Button variant={view === "artikel" ? "secondary" : "ghost"} onClick={() => setParam("weergave", "artikel")}>Per artikel</Button>
              <Button className="ml-auto" variant={onlyOpen ? "secondary" : "ghost"} aria-pressed={onlyOpen} onClick={() => setParam("open", onlyOpen ? null : "1")}>Toon alleen nog te picken</Button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm"><span>Voortgang</span><span className="font-medium">{pickedCount} van {lines.length} gepickt</span></div>
              <Progress value={pct} aria-label="Voortgang picken" />
            </div>
            {picksMissing && <p className="text-sm text-amber-500">Afvinken is nog niet beschikbaar: de tabel voor de pickstatus ontbreekt in de database.</p>}
            {!canPick && !picksMissing && <p className="text-sm text-muted-foreground">Je kunt de picklijst bekijken; afvinken kan alleen een operator, supervisor of beheerder.</p>}
          </CardContent>
        </Card>

        <h2 className="hidden text-xl font-bold capitalize print:block">Picklijst {dayLabel(day)}{driver !== "alle" ? ` — ${driver}` : ""}</h2>

        {planning.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : planning.isError ? (
          <Card><CardContent className="py-8 text-center text-destructive">De planning kon niet worden geladen. Probeer het opnieuw met Verversen.</CardContent></Card>
        ) : lines.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Geen orders gepland voor deze dag.</CardContent></Card>
        ) : view === "artikel" ? (
          <Card className="glass-card">
            <CardContent className="divide-y pt-6">
              {totals.filter((t) => !onlyOpen || t.pickedAantal < t.aantal).map((t) => (
                <div key={t.artikelnummer + t.omschrijving} className="flex items-center gap-4 py-3">
                  <span className="w-20 text-2xl font-bold tabular-nums">{nlNumber(t.aantal)}×</span>
                  <span className="flex-1 font-medium">{t.omschrijving}</span>
                  <span className="font-mono text-sm text-muted-foreground">{t.artikelnummer}</span>
                  <span className={cn("w-28 text-right text-sm", t.pickedAantal >= t.aantal ? "text-emerald-500" : "text-muted-foreground")}>{nlNumber(t.pickedAantal)} gepickt</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          groups.map((g) => (
            <Card key={g.chauffeur} className="glass-card break-inside-avoid">
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">{g.chauffeur}</h3>
                  <span className={cn("rounded-full px-3 py-1 text-sm font-medium", g.picked === g.total ? "bg-emerald-500/15 text-emerald-500" : "bg-muted")}>{g.picked === g.total ? "Compleet" : `${g.picked}/${g.total}`}</span>
                </div>
                {g.customers.map((c) => {
                  const shown = sortLines(c.lines);
                  if (shown.length === 0) return null;
                  return (
                    <section key={c.klant} className="space-y-2" aria-label={c.klant}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{c.klant}</span>
                        <span className="text-muted-foreground">{c.picked}/{c.total}</span>
                      </div>
                      {shown.map((l) => <LineRow key={l.id} line={l} />)}
                    </section>
                  );
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageLayout>
  );
}
