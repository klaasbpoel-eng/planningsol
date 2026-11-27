import { Info } from "lucide-react";

export function ReportReadingGuide({ section }: { section: string }) {
  const context: Record<string, string> = {
    overview: "Dashboard: de geselecteerde periode en locatie gelden voor alle cijfers hieronder.",
    productie: "Maand- en jaarrapport: eigen periodekeuze; beide locaties staan naast elkaar. De periode hierboven geldt alleen voor de samenvatting.",
    insights: "Jaaranalyse: dezelfde kalenderperiode vorig jaar. Klantsegmentatie: de vergelijkingsperiode staat in het overzicht.",
    cylinders: "Cilinderanalyse: eigen jaarkeuzes per grafiek; de productiekalender heeft een eigen maandkeuze.",
    locations: "Locatievergelijking: beide locaties, met een eigen jaar- en YTD-keuze. YTD vergelijkt in beide jaren t/m dezelfde kalenderdag.",
    comparison: "Jaarvergelijking: eigen jaar- en YTD-keuze. YTD omvat maanden t/m de huidige maand, niet exact t/m vandaag.",
  };
  return (
    <div className="border-y py-3 space-y-2 text-sm">
      <p className="font-medium flex items-start gap-2"><Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />{context[section]}</p>
      <details className="text-muted-foreground">
        <summary className="cursor-pointer w-fit text-primary">Betekenis van de cijfers</summary>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 pt-3 leading-relaxed">
          <div><dt className="font-medium text-foreground">Cilinders en productieregels</dt><dd>Cilinders = som van Aantal in de productieregistratie. Een productieregel is geen unieke klantorder. Bundels blijven de geregistreerde aantallen, behalve waar omrekening expliciet vermeld is.</dd></div>
          <div><dt className="font-medium text-foreground">Verschil (%)</dt><dd>(Huidig − vorige periode) ÷ vorige periode × 100. Zonder vorige productie is procentuele groei niet te berekenen. Meer volume is niet automatisch meer efficiëntie of omzet.</dd></div>
          <div><dt className="font-medium text-foreground">Aandeel en procentpunt</dt><dd>Aandeel = deel van het volledige productietotaal. Procentpunt (pp) = verschil tussen twee aandelen, niet de procentuele volumegroei.</dd></div>
          <div><dt className="font-medium text-foreground">Droogijs en prognoses</dt><dd>Droogijs komt uit de orderplanning van Emmen; gepland volume is niet hetzelfde als geproduceerd volume. Een jaarprognose is een lineaire schatting, zonder seizoenseffecten.</dd></div>
        </dl>
      </details>
    </div>
  );
}