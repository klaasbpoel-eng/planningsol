import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Printer, RotateCcw, FlaskConical, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getGasColor } from "@/constants/gasColors";
import { cn } from "@/lib/utils";

// Gas constants
const GASES = [
  { id: "n2", name: "Stikstof", formula: "N₂", molarMass: 28.014, colorKey: "Stikstof" },
  { id: "co2", name: "CO₂", formula: "CO₂", molarMass: 44.01, colorKey: "CO2" },
  { id: "ar", name: "Argon", formula: "Ar", molarMass: 39.948, colorKey: "Argon" },
  { id: "o2", name: "Zuurstof", formula: "O₂", molarMass: 31.998, colorKey: "Zuurstof" },
] as const;

const R = 8.314; // J/(mol·K)
const T = 288.15; // K (15°C)

const CYLINDER_VOLUMES = [10, 20, 40, 50];
const PRESSURES = [200, 300];

type GasPercentages = Record<string, number>;

export function GasMixtureRecipemaker() {
  const [percentages, setPercentages] = useState<GasPercentages>({
    n2: 0, co2: 0, ar: 0, o2: 0,
  });
  const [targetPressure, setTargetPressure] = useState(200);
  const [cylinderVolume, setCylinderVolume] = useState(50);
  const printRef = useRef<HTMLDivElement>(null);

  const totalPercentage = Object.values(percentages).reduce((sum, v) => sum + v, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.01;

  const updatePercentage = (gasId: string, value: number) => {
    setPercentages(prev => ({ ...prev, [gasId]: Math.max(0, Math.min(100, value)) }));
  };

  const fillingSteps = useMemo(() => {
    const activeGases = GASES
      .filter(g => percentages[g.id] > 0)
      .map(g => {
        const pct = percentages[g.id];
        const partialPressureBar = (pct / 100) * targetPressure;
        const pressurePa = partialPressureBar * 1e5;
        const volumeM3 = cylinderVolume / 1000;
        const massGrams = (pressurePa * volumeM3 * g.molarMass) / (R * T);
        return {
          ...g,
          percentage: pct,
          partialPressureBar,
          massGrams,
        };
      })
      // Sort heaviest first (filling order)
      .sort((a, b) => b.massGrams - a.massGrams);

    let cumulative = 0;
    return activeGases.map((g, i) => {
      cumulative += g.massGrams;
      return { ...g, step: i + 1, cumulativeGrams: cumulative };
    });
  }, [percentages, targetPressure, cylinderVolume]);

  const handleReset = () => {
    setPercentages({ n2: 0, co2: 0, ar: 0, o2: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  const formatWeight = (g: number) => {
    if (g >= 1000) return `${(g / 1000).toFixed(3)} kg`;
    return `${g.toFixed(1)} g`;
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Receptenmaker Gasmengsels</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={!isValid || fillingSteps.length === 0}>
            <Printer className="h-4 w-4 mr-1" /> Print recept
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Vulrecept Gasmengsel</h1>
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
                  <Select value={String(targetPressure)} onValueChange={v => setTargetPressure(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRESSURES.map(p => (
                        <SelectItem key={p} value={String(p)}>{p} bar</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                        <TableCell className="text-right">{formatWeight(step.massGrams)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatWeight(step.cumulativeGrams)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Totaal</TableCell>
                    <TableCell className="text-right font-semibold">{targetPressure} bar</TableCell>
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
              <p><strong>Methode:</strong> Gravimetrisch vullen met referentiecilinder op weegschaal</p>
              <p><strong>Formule:</strong> m = (P × V × M) / (R × T) met T = 288,15 K (15°C)</p>
              <p><strong>Vulvolgorde:</strong> Zwaarste component eerst, cumulatief gewicht aflezen op weegschaal</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default GasMixtureRecipemaker;
