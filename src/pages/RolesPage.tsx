import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { Copy, Database, Download, KeyRound, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { getPermissionsForRole, type AppRole } from "@/hooks/useUserPermissions";
import { getNavigationGroups } from "@/config/navigation";
import {
  CONFIGURABLE_PERMISSIONS,
  STANDARD_ROLE_LABELS,
  STANDARD_ROLES,
  currentChoice,
  planAssignment,
  removeRole,
  upsertRole,
  validateCustomRole,
  type CustomRole,
  type RoleAssignments,
} from "@/lib/customRoles";
import { loadCustomRoleConfig, saveCustomRoles, saveRoleAssignments } from "@/lib/customRoleStore";
import { buildOwnRoleRulesRemovalSql, buildOwnRoleRulesSql, describePermissionRule } from "@/lib/ownRoleDatabaseRules";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Person {
  userId: string;
  name: string;
  email: string;
  role: AppRole;
}

const TABS = ["rollen", "toewijzen", "database"] as const;

const emptyDraft = (): CustomRole => ({
  id: "",
  name: "",
  description: "",
  baseRole: "operator",
  disabledPermissions: [],
  hiddenMenuItems: [],
});

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `rol-${Date.now().toString(36)}`;

export default function RolesPage() {
  return (
    <ProtectedRoute>
      {({ user, role, isAdmin }) =>
        isAdmin ? <RolesContent userId={user.id} userEmail={user.email} role={role} /> : <Navigate to="/" replace />
      }
    </ProtectedRoute>
  );
}

function RolesContent({ userId, userEmail, role }: { userId: string; userEmail?: string; role: AppRole }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tab");
  const tab = TABS.includes(requested as (typeof TABS)[number]) ? (requested as string) : "rollen";

  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignments>({});
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CustomRole | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CustomRole | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [personSearch, setPersonSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [config, profiles, roleRows] = await Promise.all([
        loadCustomRoleConfig(true),
        supabase.from("profiles").select("user_id, full_name, email").not("user_id", "is", null).order("full_name", { ascending: true }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roleRows.error) throw roleRows.error;
      const roleByUser = new Map<string, string>((roleRows.data ?? []).map((r: any) => [r.user_id, r.role]));
      setRoles(config.roles);
      setAssignments(config.assignments);
      setPeople(
        (profiles.data ?? []).flatMap((p: any) => {
          const r = roleByUser.get(p.user_id) ?? "user";
          // Customers use the ordering portal and are managed elsewhere.
          if (r === "customer") return [];
          return [
            {
              userId: p.user_id as string,
              name: p.full_name || p.email || "Onbekend",
              email: p.email ?? "",
              role: (STANDARD_ROLES.includes(r as AppRole) ? r : "user") as AppRole,
            },
          ];
        }),
      );
    } catch (e: any) {
      setLoadError(e.message ?? "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const peopleCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const person of people) {
      const choice = currentChoice(person.userId, person.role, roles, assignments);
      if (choice.startsWith("custom:")) counts[choice.slice(7)] = (counts[choice.slice(7)] ?? 0) + 1;
    }
    return counts;
  }, [people, roles, assignments]);

  const filteredPeople = useMemo(() => {
    const term = personSearch.trim().toLocaleLowerCase("nl-NL");
    if (!term) return people;
    return people.filter((p) => `${p.name} ${p.email}`.toLocaleLowerCase("nl-NL").includes(term));
  }, [people, personSearch]);

  const openNew = () => {
    setDraft(emptyDraft());
    setDraftError(null);
  };

  const openEdit = (r: CustomRole) => {
    setDraft({ ...r, disabledPermissions: [...r.disabledPermissions], hiddenMenuItems: [...r.hiddenMenuItems] });
    setDraftError(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    const problem = validateCustomRole(draft, roles);
    if (problem) {
      setDraftError(problem);
      return;
    }
    const role = { ...draft, id: draft.id || newId() };
    const next = upsertRole(roles, role);
    setSaving(true);
    try {
      await saveCustomRoles(next);
      setRoles(next);
      setDraft(null);
      toast.success(draft.id ? `Rol "${role.name.trim()}" bijgewerkt` : `Rol "${role.name.trim()}" aangemaakt`);
    } catch (e: any) {
      setDraftError(`Opslaan mislukt: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const next = removeRole(roles, assignments, deleting.id);
    try {
      await saveCustomRoles(next.roles);
      await saveRoleAssignments(next.assignments);
      setRoles(next.roles);
      setAssignments(next.assignments);
      toast.success(`Rol "${deleting.name}" verwijderd`);
    } catch (e: any) {
      toast.error(`Verwijderen mislukt: ${e.message}`);
    } finally {
      setDeleting(null);
    }
  };

  const assign = async (person: Person, choice: string) => {
    const plan = planAssignment(choice, person.userId, roles, assignments);
    if (!plan) return;
    setBusyUser(person.userId);
    try {
      if (plan.baseRole !== person.role) {
        // The standard role decides database access, so it is stored where the database checks it.
        const { data: existing, error: readError } = await supabase.from("user_roles").select("id").eq("user_id", person.userId).maybeSingle();
        if (readError) throw readError;
        if (plan.baseRole === "user") {
          if (existing) {
            const { error } = await supabase.from("user_roles").delete().eq("user_id", person.userId);
            if (error) throw error;
          }
        } else if (existing) {
          const { error } = await supabase.from("user_roles").update({ role: plan.baseRole as any }).eq("user_id", person.userId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("user_roles").insert({ user_id: person.userId, role: plan.baseRole as any });
          if (error) throw error;
        }
      }
      await saveRoleAssignments(plan.assignments);
      setAssignments(plan.assignments);
      setPeople((current) => current.map((p) => (p.userId === person.userId ? { ...p, role: plan.baseRole } : p)));
      const chosen = choice.startsWith("custom:") ? roles.find((r) => `custom:${r.id}` === choice)?.name : STANDARD_ROLE_LABELS[plan.baseRole];
      toast.success(`${person.name} is nu ${chosen}`);
    } catch (e: any) {
      toast.error(`Toewijzen mislukt: ${e.message}`);
    } finally {
      setBusyUser(null);
    }
  };

  const baseRights = draft ? getPermissionsForRole(draft.baseRole) : null;
  const draftMenuGroups = draft ? getNavigationGroups(draft.baseRole === "admin") : [];
  const draftAssignedCount = draft?.id ? peopleCount[draft.id] ?? 0 : 0;

  const toggleIn = (list: string[], value: string, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value));

  return (
    <PageLayout
      userEmail={userEmail}
      role={role}
      isAdmin
      title="Rollen"
      description="Maak eigen rollen en geef ze aan medewerkers."
      titleIcon={<KeyRound className="h-6 w-6 text-primary" />}
    >
      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="rollen">Rollen</TabsTrigger>
          <TabsTrigger value="toewijzen">Toewijzen</TabsTrigger>
          <TabsTrigger value="database">Databaseregels</TabsTrigger>
        </TabsList>

        {loadError && (
          <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p className="font-medium text-destructive">De rollen konden niet worden geladen.</p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
          </div>
        )}

        <TabsContent value="rollen" className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
              <div>
                <CardTitle>Eigen rollen</CardTitle>
                <CardDescription>
                  Elke eigen rol bouwt voort op een standaardrol. Je kunt rechten uitzetten en menu-onderdelen verbergen, maar
                  nooit meer geven dan de standaardrol.
                </CardDescription>
              </div>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nieuwe rol
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <Skeleton className="h-20 w-full" />
              ) : roles.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nog geen eigen rollen. Klik op "Nieuwe rol" om te beginnen.</p>
              ) : (
                roles.map((r) => {
                  const count = peopleCount[r.id] ?? 0;
                  return (
                    <div key={r.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{r.name}</span>
                          <Badge variant="outline">op basis van {STANDARD_ROLE_LABELS[r.baseRole]}</Badge>
                        </div>
                        {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                        <p className="text-xs text-muted-foreground">
                          {count} {count === 1 ? "persoon" : "personen"} · {r.disabledPermissions.length}{" "}
                          {r.disabledPermissions.length === 1 ? "recht" : "rechten"} uit · {r.hiddenMenuItems.length} menu-onderdelen verborgen
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)} aria-label={`Rol ${r.name} bewerken`}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Bewerken
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setDeleting(r)} aria-label={`Rol ${r.name} verwijderen`}>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Verwijderen
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="toewijzen" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between sm:space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Rol per persoon
                </CardTitle>
                <CardDescription>Kies een standaardrol of een eigen rol. De wijziging geldt direct.</CardDescription>
              </div>
              <div className="relative sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Zoek een persoon…"
                  className="pl-9"
                  aria-label="Zoek een persoon"
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="overflow-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                        <TableHead className="w-64">Rol</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPeople.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                            Geen personen gevonden.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPeople.map((person) => {
                          const self = person.userId === userId;
                          return (
                            <TableRow key={person.userId}>
                              <TableCell className="font-medium">
                                {person.name}
                                {self && <span className="ml-2 text-xs text-muted-foreground">(jij)</span>}
                              </TableCell>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">{person.email}</TableCell>
                              <TableCell>
                                <Select
                                  value={currentChoice(person.userId, person.role, roles, assignments)}
                                  onValueChange={(choice) => assign(person, choice)}
                                  disabled={self || busyUser === person.userId}
                                >
                                  <SelectTrigger aria-label={`Rol van ${person.name}`} title={self ? "Je eigen rol kun je hier niet wijzigen" : undefined}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      <SelectLabel>Standaardrollen</SelectLabel>
                                      {STANDARD_ROLES.map((r) => (
                                        <SelectItem key={r} value={`std:${r}`}>
                                          {STANDARD_ROLE_LABELS[r]}
                                        </SelectItem>
                                      ))}
                                    </SelectGroup>
                                    {roles.length > 0 && (
                                      <SelectGroup>
                                        <SelectLabel>Eigen rollen</SelectLabel>
                                        {roles.map((r) => (
                                          <SelectItem key={r.id} value={`custom:${r.id}`}>
                                            {r.name}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    )}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Je eigen rol kun je hier niet wijzigen, zodat je jezelf niet buitensluit.</p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="database" className="mt-4">
          <DatabaseRulesCard />
        </TabsContent>
      </Tabs>

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Rol bewerken" : "Nieuwe rol"}</DialogTitle>
            <DialogDescription>De standaardrol bepaalt wat iemand maximaal mag; hier zet je dingen uit.</DialogDescription>
          </DialogHeader>
          {draft && baseRights && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="rol-naam">Naam</Label>
                <Input
                  id="rol-naam"
                  value={draft.name}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Bijv. Planner"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rol-omschrijving">Omschrijving</Label>
                <Textarea
                  id="rol-omschrijving"
                  value={draft.description}
                  maxLength={200}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Waar is deze rol voor?"
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rol-basis">Op basis van</Label>
                <Select
                  value={draft.baseRole}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      baseRole: value as AppRole,
                      // Rights the new base does not have cannot stay switched on or off.
                      disabledPermissions: draft.disabledPermissions.filter((k) => getPermissionsForRole(value as AppRole)[k]),
                    })
                  }
                  disabled={draftAssignedCount > 0}
                >
                  <SelectTrigger id="rol-basis">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {STANDARD_ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draftAssignedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Geef eerst de {draftAssignedCount} {draftAssignedCount === 1 ? "persoon" : "personen"} met deze rol een andere rol om de basis te wijzigen.
                  </p>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Rechten</legend>
                {CONFIGURABLE_PERMISSIONS.map((perm) => {
                  const possible = baseRights[perm.key];
                  const on = possible && !draft.disabledPermissions.includes(perm.key);
                  return (
                    <div key={perm.key} className="flex items-start justify-between gap-3 rounded-md border p-2.5">
                      <div>
                        <Label htmlFor={`recht-${perm.key}`} className={possible ? "" : "text-muted-foreground"}>
                          {perm.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {possible ? perm.description : `Niet mogelijk met de standaardrol ${STANDARD_ROLE_LABELS[draft.baseRole]}.`}
                        </p>
                        {possible && (
                          <p className="text-xs text-muted-foreground/80">
                            {describePermissionRule(perm.key).inDatabase ? "Ook geblokkeerd in de database (met de databaseregels)." : "Alleen in de app."}
                          </p>
                        )}
                      </div>
                      <Switch
                        id={`recht-${perm.key}`}
                        checked={on}
                        disabled={!possible}
                        onCheckedChange={(checked) =>
                          setDraft({ ...draft, disabledPermissions: toggleIn(draft.disabledPermissions, perm.key, !checked) as CustomRole["disabledPermissions"] })
                        }
                      />
                    </div>
                  );
                })}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Zichtbaar in het menu</legend>
                <p className="text-xs text-muted-foreground">Uitgevinkte onderdelen verdwijnen uit het menu en de zoekfunctie (Ctrl+K).</p>
                {draftMenuGroups.map((group) => (
                  <div key={group.id} className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {group.items.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                          <Checkbox
                            checked={!draft.hiddenMenuItems.includes(item.id)}
                            onCheckedChange={(checked) =>
                              setDraft({ ...draft, hiddenMenuItems: toggleIn(draft.hiddenMenuItems, item.id, checked !== true) })
                            }
                            aria-label={`${item.label} tonen`}
                          />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </fieldset>

              {draftError && <p className="text-sm text-destructive">{draftError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuleren
            </Button>
            <Button onClick={saveDraft} disabled={saving}>
              {saving ? "Opslaan…" : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rol "{deleting?.name}" verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (peopleCount[deleting.id] ?? 0) > 0
                ? `${peopleCount[deleting.id]} ${(peopleCount[deleting.id] ?? 0) === 1 ? "persoon houdt" : "personen houden"} daarna de standaardrol ${STANDARD_ROLE_LABELS[deleting.baseRole]}.`
                : "Niemand heeft deze rol op dit moment."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function DatabaseRulesCard() {
  const sql = useMemo(() => buildOwnRoleRulesSql(), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("Databaseregels gekopieerd");
    } catch {
      toast.error("Kopiëren lukte niet; gebruik Downloaden.");
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Databaseregels voor eigen rollen
          </CardTitle>
          <CardDescription>
            Voer deze regels één keer uit in de SQL-editor van de database. Daarna weigert de database wat een eigen rol niet
            mag, ook buiten de app om. Rollen die je later maakt of wijzigt gelden direct; opnieuw uitvoeren is alleen nodig na
            een update van deze pagina.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={copy}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Kopiëren
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadText("eigen-rollen-databaseregels.sql", sql)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Downloaden
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {CONFIGURABLE_PERMISSIONS.map((perm) => {
            const rule = describePermissionRule(perm.key);
            return (
              <li key={perm.key} className="flex flex-col gap-1 rounded-md border p-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium">{perm.label}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant={rule.inDatabase ? "default" : "outline"}>{rule.inDatabase ? "Database" : "Alleen app"}</Badge>
                  <span>{rule.text}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <pre
          aria-label="Databaseregels"
          className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed select-text"
        >
          {sql}
        </pre>
        <p className="text-xs text-muted-foreground">
          Wil je de regels weer weghalen?{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => downloadText("eigen-rollen-databaseregels-verwijderen.sql", buildOwnRoleRulesRemovalSql())}
          >
            Download de SQL om ze te verwijderen
          </button>
          .
        </p>
      </CardContent>
    </Card>
  );
}
