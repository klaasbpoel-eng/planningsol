import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AppRole } from "@/hooks/useUserPermissions";
import { STANDARD_ROLES, STANDARD_ROLE_LABELS } from "@/lib/customRoles";
import { generateStartPassword, validateNewAccount } from "@/lib/employeeAccounts";
import { createAccountForEmployee } from "@/lib/employeeAccountClient";

export interface AccountTarget {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface CreateAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Employee to give an account; leave empty to add a new person with an account. */
  employee: AccountTarget | null;
  onCreated: () => void;
}

interface Done {
  name: string;
  email: string;
  password: string;
  needsConfirmation: boolean;
}

export function CreateAccountDialog({ open, onOpenChange, employee, onCreated }: CreateAccountDialogProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AppRole>("user");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(employee?.full_name ?? "");
    setEmail(employee?.email ?? "");
    setPassword(generateStartPassword());
    setRole("user");
    setError(null);
    setDone(null);
  }, [open, employee]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { profileId: employee?.id ?? null, fullName, email, password, role };
    const problem = validateNewAccount(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createAccountForEmployee(input);
      setDone({ name: fullName.trim(), email: email.trim(), password, needsConfirmation: result.needsConfirmation });
      onCreated();
    } catch (err: any) {
      setError(err?.message ?? "Het account kon niet worden aangemaakt.");
    } finally {
      setSaving(false);
    }
  };

  const copyLogin = async () => {
    if (!done) return;
    try {
      await navigator.clipboard.writeText(`E-mail: ${done.email}\nWachtwoord: ${done.password}`);
      toast.success("Inloggegevens gekopieerd");
    } catch {
      toast.error("Kopiëren lukte niet. Selecteer de gegevens en kopieer ze zelf.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Account aangemaakt
              </DialogTitle>
              <DialogDescription>
                {done.needsConfirmation
                  ? `${done.name} krijgt een bevestigingsmail op ${done.email}. Na het klikken op de link kan ${done.name} inloggen met deze gegevens.`
                  : `${done.name} kan nu inloggen met deze gegevens.`}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border bg-muted/40 p-3 font-mono text-sm space-y-1 select-text" aria-label="Inloggegevens">
              <div>E-mail: {done.email}</div>
              <div>Wachtwoord: {done.password}</div>
            </div>
            <p className="text-xs text-muted-foreground">
              Dit wachtwoord is hierna niet meer te zien. Geef het veilig door; de medewerker kan het later wijzigen via "Wachtwoord vergeten".
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copyLogin}>
                <Copy className="h-4 w-4 mr-2" />
                Kopiëren
              </Button>
              <Button onClick={() => onOpenChange(false)}>Klaar</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Inlogaccount aanmaken</DialogTitle>
              <DialogDescription>
                {employee
                  ? "Maak een account zodat deze medewerker kan inloggen."
                  : "Voeg een medewerker toe die meteen kan inloggen."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="account-naam">Naam</Label>
              <Input id="account-naam" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email">E-mail</Label>
              <Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-rol">Rol</Label>
              <Select value={role} onValueChange={(value) => setRole(value as AppRole)}>
                <SelectTrigger id="account-rol">
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
              <p className="text-xs text-muted-foreground">Een eigen rol geef je daarna op de pagina Rollen.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-wachtwoord">Startwachtwoord</Label>
              <div className="flex gap-2">
                <Input
                  id="account-wachtwoord"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="font-mono"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Nieuw wachtwoord maken"
                  onClick={() => setPassword(generateStartPassword())}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Annuleren
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Account aanmaken
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
