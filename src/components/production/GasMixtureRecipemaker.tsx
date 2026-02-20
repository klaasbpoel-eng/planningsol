import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, RotateCcw, FlaskConical, AlertTriangle, CheckCircle2, Save, FolderOpen, Trash2, Loader2 } from "lucide-react";
import { getGasColor } from "@/constants/gasColors";
import { cn } from "@/lib/utils";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Critical properties for Peng-Robinson EOS
// Tc (K), Pc (bar), acentric factor ω, molar mass (g/mol)
interface GasCriticalProps {
  Tc: number;
  Pc: number;
  omega: number;
}

const CRITICAL_PROPS: Record<string, GasCriticalProps> = {
  n2:   { Tc: 126.2,  Pc: 33.98, omega: 0.0377 },
  co2:  { Tc: 304.21, Pc: 73.83, omega: 0.2236 },
  ar:   { Tc: 150.86, Pc: 48.98, omega: 0.0000 },
  o2:   { Tc: 154.58, Pc: 50.43, omega: 0.0222 },
  he:   { Tc: 5.19,   Pc: 2.27,  omega: -0.3900 },
};

// Solve PR cubic for given A, B parameters → returns largest (gas-phase) Z root
function solvePRCubic(A: number, B: number): number {
  const c2 = -(1 - B);
  const c1 = A - 3 * B * B - 2 * B;
  const c0 = -(A * B - B * B - B * B * B);

  const p = c1 - c2 * c2 / 3;
  const q = (2 * c2 * c2 * c2) / 27 - (c2 * c1) / 3 + c0;
  const discriminant = q * q / 4 + p * p * p / 27;

  let Z: number;
  if (discriminant > 0) {
    const sqrtD = Math.sqrt(discriminant);
    const u = Math.cbrt(-q / 2 + sqrtD);
    const v = Math.cbrt(-q / 2 - sqrtD);
    Z = u + v - c2 / 3;
  } else {
    const r = Math.sqrt(-p * p * p / 27);
    const theta = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    const z1 = m * Math.cos(theta / 3) - c2 / 3;
    const z2 = m * Math.cos((theta + 2 * Math.PI) / 3) - c2 / 3;
    const z3 = m * Math.cos((theta + 4 * Math.PI) / 3) - c2 / 3;
    Z = Math.max(z1, z2, z3); // Gas phase: largest positive root
  }
  return Math.max(Z, 0.01);
}

// Calculate mixture Z-factor using van der Waals one-fluid mixing rules
// Components: array of { gasId, moleFraction }
function calculateMixtureZFactor(
  T_K: number,
  P_bar: number,
  components: { gasId: string; moleFraction: number }[]
): number {
  if (P_bar <= 0 || components.length === 0) return 1.0;

  const R_bar = 83.145; // cm³·bar/(mol·K)

  // Calculate per-component PR parameters a_i, b_i
  const compParams = components.map(({ gasId, moleFraction }) => {
    const props = CRITICAL_PROPS[gasId];
    if (!props) return { a: 0, b: 0, x: moleFraction };
    const { Tc, Pc, omega } = props;
    const kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega * omega;
    const Tr = T_K / Tc;
    const alpha = Math.pow(1 + kappa * (1 - Math.sqrt(Tr)), 2);
    const a = 0.45724 * R_bar * R_bar * Tc * Tc / Pc * alpha;
    const b = 0.07780 * R_bar * Tc / Pc;
    return { a, b, x: moleFraction };
  });

  // Van der Waals mixing rules: a_mix = ΣΣ xi·xj·√(ai·aj), b_mix = Σ xi·bi
  let a_mix = 0;
  for (let i = 0; i < compParams.length; i++) {
    for (let j = 0; j < compParams.length; j++) {
      a_mix += compParams[i].x * compParams[j].x * Math.sqrt(compParams[i].a * compParams[j].a);
    }
  }
  let b_mix = 0;
  for (const cp of compParams) {
    b_mix += cp.x * cp.b;
  }

  const A = a_mix * P_bar / (R_bar * R_bar * T_K * T_K);
  const B = b_mix * P_bar / (R_bar * T_K);

  return solvePRCubic(A, B);
}

// Gas constants
const GASES = [
  { id: "n2", name: "Stikstof", formula: "N₂", molarMass: 28.014, colorKey: "Stikstof" },
  { id: "co2", name: "CO₂", formula: "CO₂", molarMass: 44.01, colorKey: "CO2" },
  { id: "ar", name: "Argon", formula: "Ar", molarMass: 39.948, colorKey: "Argon" },
  { id: "o2", name: "Zuurstof", formula: "O₂", molarMass: 31.998, colorKey: "Zuurstof" },
  { id: "he", name: "Helium", formula: "He", molarMass: 4.003, colorKey: "Helium" },
] as const;

const R = 8.314; // J/(mol·K)
const T = 288.15; // K (15°C)

const CYLINDER_VOLUMES = [10, 20, 40, 50];
const PRESSURE_PRESETS = [200, 300];

type GasPercentages = Record<string, number>;

interface SavedRecipe {
  id: string;
  name: string;
  description: string | null;
  target_pressure: number;
  cylinder_volume: number;
  n2_percentage: number;
  co2_percentage: number;
  ar_percentage: number;
  o2_percentage: number;
  he_percentage?: number;
  created_at: string;
}

export function GasMixtureRecipemaker() {
  const [percentages, setPercentages] = useState<GasPercentages>({
    n2: 0, co2: 0, ar: 0, o2: 0, he: 0,
  });
  const [targetPressure, setTargetPressure] = useState(210);
  const [cylinderVolume, setCylinderVolume] = useState(50);

  // Save/load state
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [recipeName, setRecipeName] = useState("");
  const [recipeDescription, setRecipeDescription] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeRecipeId, setActiveRecipeId] = useState<string | null>(null);

  const totalPercentage = Object.values(percentages).reduce((sum, v) => sum + v, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.01;

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gas_mixture_recipes")
      .select("*")
      .order("name");
    if (error) {
      console.error("Error fetching recipes:", error);
    } else {
      setSavedRecipes(data as SavedRecipe[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const updatePercentage = (gasId: string, value: number) => {
    setPercentages(prev => ({ ...prev, [gasId]: Math.max(0, Math.min(100, value)) }));
  };

  const fillingSteps = useMemo(() => {
    const activeGases = GASES.filter(g => percentages[g.id] > 0);
    if (activeGases.length === 0) return [];

    // Build mole fraction components for mixture Z calculation
    const components = activeGases.map(g => ({
      gasId: g.id,
      moleFraction: percentages[g.id] / 100,
    }));

    // Calculate mixture Z at total pressure
    const Z_mix = calculateMixtureZFactor(T, targetPressure, components);

    // Total moles in cylinder: n = PV / (Z_mix * R * T)
    const pressurePa = targetPressure * 1e5;
    const volumeM3 = cylinderVolume / 1000;
    const n_total = (pressurePa * volumeM3) / (Z_mix * R * T);

    // Mass per component: m_i = n_total * x_i * M_i
    const steps = activeGases
      .map(g => {
        const pct = percentages[g.id];
        const x_i = pct / 100;
        const massGrams = n_total * x_i * g.molarMass;
        return {
          ...g,
          percentage: pct,
          partialPressureBar: x_i * targetPressure,
          massGrams,
          zFactor: Z_mix,
        };
      })
      .sort((a, b) => a.percentage - b.percentage);

    let cumulative = 0;
    return steps.map((g, i) => {
      cumulative += g.massGrams;
      return { ...g, step: i + 1, cumulativeGrams: cumulative };
    });
  }, [percentages, targetPressure, cylinderVolume]);

  const handleReset = () => {
    setPercentages({ n2: 0, co2: 0, ar: 0, o2: 0, he: 0 });
    setActiveRecipeId(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = async () => {
    if (!recipeName.trim()) {
      toast.error("Geef het recept een naam");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Je moet ingelogd zijn");
      setSaving(false);
      return;
    }

    const recipeData = {
      name: recipeName.trim(),
      description: recipeDescription.trim() || null,
      target_pressure: targetPressure,
      cylinder_volume: cylinderVolume,
      n2_percentage: percentages.n2,
      co2_percentage: percentages.co2,
      ar_percentage: percentages.ar,
      o2_percentage: percentages.o2,
      he_percentage: percentages.he,
      created_by: user.id,
    };

    let error;
    if (activeRecipeId) {
      ({ error } = await supabase
        .from("gas_mixture_recipes")
        .update(recipeData)
        .eq("id", activeRecipeId));
    } else {
      ({ error } = await supabase
        .from("gas_mixture_recipes")
        .insert(recipeData));
    }

    if (error) {
      toast.error("Fout bij opslaan: " + error.message);
    } else {
      toast.success(activeRecipeId ? "Recept bijgewerkt" : "Recept opgeslagen");
      setShowSaveDialog(false);
      fetchRecipes();
    }
    setSaving(false);
  };

  const handleLoad = (recipe: SavedRecipe) => {
    setPercentages({
      n2: Number(recipe.n2_percentage),
      co2: Number(recipe.co2_percentage),
      ar: Number(recipe.ar_percentage),
      o2: Number(recipe.o2_percentage),
      he: Number(recipe.he_percentage ?? 0),
    });
    setTargetPressure(recipe.target_pressure);
    setCylinderVolume(recipe.cylinder_volume);
    setActiveRecipeId(recipe.id);
    setRecipeName(recipe.name);
    setRecipeDescription(recipe.description || "");
    setShowLoadDialog(false);
    toast.success(`Recept "${recipe.name}" geladen`);
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase
      .from("gas_mixture_recipes")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Fout bij verwijderen: " + error.message);
    } else {
      toast.success(`Recept "${name}" verwijderd`);
      if (activeRecipeId === id) {
        setActiveRecipeId(null);
      }
      fetchRecipes();
    }
  };

  const openSaveDialog = () => {
    if (!activeRecipeId) {
      setRecipeName("");
      setRecipeDescription("");
    }
    setShowSaveDialog(true);
  };

  const formatWeight = (g: number) => {
    if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`;
    return `${g.toFixed(1)} g`;
  };

  const getRecipeSummary = (r: SavedRecipe) => {
    const parts: string[] = [];
    if (Number(r.n2_percentage) > 0) parts.push(`N₂ ${r.n2_percentage}%`);
    if (Number(r.co2_percentage) > 0) parts.push(`CO₂ ${r.co2_percentage}%`);
    if (Number(r.ar_percentage) > 0) parts.push(`Ar ${r.ar_percentage}%`);
    if (Number(r.o2_percentage) > 0) parts.push(`O₂ ${r.o2_percentage}%`);
    if (Number(r.he_percentage) > 0) parts.push(`He ${r.he_percentage}%`);
    return parts.join(" / ");
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Receptenmaker Gasmengsels</h2>
          {activeRecipeId && (
            <Badge variant="secondary" className="text-xs">{recipeName}</Badge>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { fetchRecipes(); setShowLoadDialog(true); }}>
            <FolderOpen className="h-4 w-4 mr-1" /> Laden
          </Button>
          <Button variant="outline" size="sm" onClick={openSaveDialog} disabled={!isValid || fillingSteps.length === 0}>
            <Save className="h-4 w-4 mr-1" /> Opslaan
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!isValid || fillingSteps.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Vulrecept Gasmengsel{recipeName ? `: ${recipeName}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          Doeldruk: {targetPressure} bar bij 15°C | Cilinderinhoud: {cylinderVolume}L
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
        {/* Left: Configuration */}
        <div className="space-y-4 print:hidden">
          {/* Filling parameters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vulparameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Doeldruk</label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      step={1}
                      value={targetPressure}
                      onChange={e => {
                        const val = Number(e.target.value);
                        if (val >= 1 && val <= 500) setTargetPressure(val);
                        else if (e.target.value === '') setTargetPressure(1);
                      }}
                      className="pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">bar</span>
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {PRESSURE_PRESETS.map(p => (
                      <Button
                        key={p}
                        type="button"
                        variant={targetPressure === p ? "default" : "outline"}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setTargetPressure(p)}
                      >
                        {p}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Acceptabel bereik: {Math.round(targetPressure * 0.95)} – {Math.round(targetPressure * 1.05)} bar bij 15°C (± 5%)
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Cilinderinhoud</label>
                  <Select value={String(cylinderVolume)} onValueChange={v => setCylinderVolume(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CYLINDER_VOLUMES.map(v => (
                        <SelectItem key={v} value={String(v)}>{v} liter</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gas composition */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Samenstelling</CardTitle>
              <CardDescription>Stel de percentages per component in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {GASES.map(gas => {
                const color = getGasColor(gas.colorKey);
                return (
                  <div key={gas.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm font-medium">{gas.name}</span>
                        <span className="text-xs text-muted-foreground">({gas.formula})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={percentages[gas.id] || ""}
                          onChange={e => updatePercentage(gas.id, parseFloat(e.target.value) || 0)}
                          className="w-20 h-8 text-right text-sm"
                        />
                        <span className="text-sm text-muted-foreground w-4">%</span>
                      </div>
                    </div>
                    <Slider
                      value={[percentages[gas.id]]}
                      onValueChange={([v]) => updatePercentage(gas.id, v)}
                      max={100}
                      step={0.1}
                      className="cursor-pointer"
                    />
                  </div>
                );
              })}

              {/* Total indicator */}
              <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                isValid
                  ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              )}>
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium">Totaal</span>
                </div>
                <Badge variant={isValid ? "default" : "destructive"} className="text-sm">
                  {totalPercentage.toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CO2 partial pressure warning – auto-adjust pressure */}
        {percentages.co2 > 0 && (percentages.co2 / 100) * targetPressure > 60 && (() => {
          const maxSafePressure = Math.floor(6000 / percentages.co2);
          return (
            <Alert className="lg:col-span-2 border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-500/30 print:block">
              <AlertTriangle className="h-4 w-4 !text-amber-600 dark:!text-amber-400" />
              <AlertTitle>Vuldruk automatisch verlaagd</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  Bij {percentages.co2}% CO₂ zou de partiaaldruk {((percentages.co2 / 100) * targetPressure).toFixed(1)} bar bedragen, wat boven de veilige grens van 60 bar ligt (kritische druk CO₂: 73,83 bar). Boven 60 bar is fasescheiding (vloeistofvorming) mogelijk.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/50 bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-200"
                  onClick={() => setTargetPressure(maxSafePressure)}
                >
                  Pas vuldruk aan naar {maxSafePressure} bar
                </Button>
              </AlertDescription>
            </Alert>
          );
        })()}

        {/* Right: Results table */}
        <Card className="print:shadow-none print:border-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vulrecept</CardTitle>
            <CardDescription>
              Vulvolgorde op basis van gewicht (zwaarste component eerst)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isValid && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Stel een samenstelling in van precies 100% om het vulrecept te zien.
              </div>
            )}
            {isValid && fillingSteps.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Voeg minimaal één gascomponent toe.
              </div>
            )}
            {isValid && fillingSteps.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead className="w-12">#</TableHead>
                     <TableHead>Component</TableHead>
                     <TableHead className="text-right">%</TableHead>
                     <TableHead className="text-right">Partiaaldruk</TableHead>
                     <TableHead className="text-right">Z<sub>mix</sub></TableHead>
                     <TableHead className="text-right">Gewicht</TableHead>
                     <TableHead className="text-right font-semibold">Weegschaal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fillingSteps.map(step => {
                    const color = getGasColor(step.colorKey);
                    return (
                      <TableRow key={step.id}>
                        <TableCell className="font-mono">{step.step}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-medium">{step.name}</span>
                            <span className="text-xs text-muted-foreground">{step.formula}</span>
                          </div>
                        </TableCell>
                         <TableCell className="text-right">{step.percentage.toFixed(1)}%</TableCell>
                         <TableCell className="text-right">{step.partialPressureBar.toFixed(1)} bar</TableCell>
                         <TableCell className="text-right font-mono text-xs">{step.zFactor.toFixed(4)}</TableCell>
                         <TableCell className="text-right">{formatWeight(step.massGrams)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatWeight(step.cumulativeGrams)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Totaal (Z<sub>mix</sub> = {fillingSteps[0]?.zFactor.toFixed(4)})</TableCell>
                    <TableCell className="text-right font-semibold">{targetPressure} bar <span className="font-normal text-muted-foreground">({Math.round(targetPressure * 0.95)}–{Math.round(targetPressure * 1.05)})</span></TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatWeight(fillingSteps.reduce((s, f) => s + f.massGrams, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatWeight(fillingSteps[fillingSteps.length - 1]?.cumulativeGrams ?? 0)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}

            {/* Info box */}
             <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1 print:bg-gray-50">
               <p><strong>Methode:</strong> Gravimetrisch vullen — mengsel-compressiefactor (Peng-Robinson EOS met van der Waals mengregels)</p>
               <p><strong>Formule:</strong> n<sub>totaal</sub> = (P × V) / (Z<sub>mix</sub> × R × T), m<sub>i</sub> = n<sub>totaal</sub> × x<sub>i</sub> × M<sub>i</sub></p>
               <p><strong>Vulvolgorde:</strong> Laagste percentage eerst, cumulatief gewicht aflezen op weegschaal</p>
               <p><strong>Einddruk:</strong> {targetPressure} bar ± 5% ({Math.round(targetPressure * 0.95)} – {Math.round(targetPressure * 1.05)} bar bij 15°C)</p>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{activeRecipeId ? "Recept bijwerken" : "Recept opslaan"}</DialogTitle>
            <DialogDescription>Geef het recept een naam om het later terug te laden.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Naam *</label>
              <Input
                value={recipeName}
                onChange={e => setRecipeName(e.target.value)}
                placeholder="Bijv. Lasgas 82/18"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Beschrijving</label>
              <Input
                value={recipeDescription}
                onChange={e => setRecipeDescription(e.target.value)}
                placeholder="Optionele omschrijving"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {getRecipeSummary({
                n2_percentage: percentages.n2,
                co2_percentage: percentages.co2,
                ar_percentage: percentages.ar,
                o2_percentage: percentages.o2,
              } as SavedRecipe)} | {targetPressure} bar | {cylinderVolume}L
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Annuleren</Button>
            <Button onClick={handleSave} disabled={saving || !recipeName.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {activeRecipeId ? "Bijwerken" : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Opgeslagen recepten</DialogTitle>
            <DialogDescription>Selecteer een recept om te laden.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 py-2">
            {loading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && savedRecipes.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8">
                Geen opgeslagen recepten gevonden.
              </div>
            )}
            {!loading && savedRecipes.map(recipe => (
              <div
                key={recipe.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                  activeRecipeId === recipe.id && "border-primary bg-primary/5"
                )}
                onClick={() => handleLoad(recipe)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{recipe.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {getRecipeSummary(recipe)} | {recipe.target_pressure} bar | {recipe.cylinder_volume}L
                  </div>
                  {recipe.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{recipe.description}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-destructive hover:text-destructive"
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(recipe.id, recipe.name);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GasMixtureRecipemaker;
