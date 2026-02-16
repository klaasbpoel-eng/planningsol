import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import siteLogo from "@/assets/site_logo.png";

type FormMode = "login" | "signup" | "forgot-password";

export function AuthForm() {
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        toast.success("Controleer uw e-mail voor de resetlink");
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Welkom terug!");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Account succesvol aangemaakt!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "login": return "Welkom terug";
      case "signup": return "Account aanmaken";
      case "forgot-password": return "Wachtwoord vergeten";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "login": return "Log in om uw verlofaanvragen te beheren";
      case "signup": return "Meld u aan om verlof te plannen";
      case "forgot-password": return "Voer uw e-mailadres in om een resetlink te ontvangen";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex flex-col items-center gap-2 mb-4">
            <img src={siteLogo} alt="SOL Group Logo" className="h-14 w-auto" />
            <span className="text-sm font-semibold text-primary tracking-wide">Planner</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="u@bedrijf.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            {mode !== "forgot-password" && (
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-11"
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" && "Inloggen"}
              {mode === "signup" && "Account Aanmaken"}
              {mode === "forgot-password" && "Reset link versturen"}
            </Button>

            {mode === "forgot-password" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" />
                Terug naar inloggen
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot-password")}
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Wachtwoord vergeten?
                  </button>
                )}
                <p className="text-sm text-muted-foreground text-center">
                  {mode === "login" ? "Nog geen account?" : "Heeft u al een account?"}{" "}
                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "signup" : "login")}
                    className="text-accent font-medium hover:underline"
                  >
                    {mode === "login" ? "Registreren" : "Inloggen"}
                  </button>
                </p>
              </div>
            )}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
