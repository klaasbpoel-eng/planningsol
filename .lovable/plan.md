## Verbeterplan Rapportage

Op basis van de screenshot en de code in `ProductionReports.tsx`, `YoYInsights.tsx`, `KPIDashboard.tsx`, `MonthlyReport.tsx`, `YearlyReport.tsx`, `YearComparisonReport.tsx`, `LocationComparisonReport.tsx` en `TopCustomersWidget.tsx`.

### Diagnose van problemen die in de huidige rapportage zichtbaar zijn

**1. Misleidende jaartrends (kritiek)**
- "Cilinders -57%" en "Droogijs +500%" met periode `1 jan - 31 dec 2026`, terwijl het vandaag 5 juni is. We vergelijken 5 maanden 2026 met 12 maanden 2025 → bijna alle "trends" zijn structureel fout.
- Hetzelfde probleem in de KPI-tegel "Volume periode" en in `TopCustomersWidget`.

**2. Periode-keuze klopt niet met intentie**
- "Dit jaar" zet de periode op `1 jan - 31 dec` in plaats van `1 jan - vandaag` (YTD). De gebruiker leest "Dit jaar" als "wat is er tot nu toe gebeurd".

**3. KPI-tegels missen context**
- `137.792` cilinders zonder vergelijking, zonder dag-/weekgemiddelde, zonder voortgang t.o.v. doel of vorig jaar YTD.
- "Wekelijkse trend" sparkline heeft geen as-labels of getal naast de lijn.
- Productie-anomalieën toont één regel ("-39%") zonder uitleg van wat normaal was.

**4. Dubbele en concurrerende informatie**
- KPI-blok bovenaan + Hero-KPIs ("Cilinders / Droogijs" met progress) + tabblad-overzicht herhalen dezelfde getallen drie keer.
- Verdeling locaties als balk + losse tegels Emmen/Tilburg.

**5. Verdeling-widget**
- Toont nu top-N gascilindertypes als horizontale balken. Geen percentages, geen totaal, geen "rest". Bij veel types onleesbaar.

**6. Top 5 klanten**
- Vergelijkt nu volume YTD vs volume heel vorig jaar → vrijwel iedere klant daalt onterecht met ~50%. Moet vergelijken met dezelfde YTD-periode vorig jaar.
- Geen klantnaam-normalisatie (zelfde fix als YoY net is doorgevoerd).

**7. Insights tab**
- Top stijgers/dalers werkt, maar mist totaalcontext (welk aandeel van het totale volume) en absolute Δ in cilinders naast %.
- Geen netto-effect: "wat verklaart het verschil tussen dit jaar en vorig jaar in totaal?".

**8. Productie / Cilinders / Locaties tabs**
- Veel grafieken, weinig samenvattende inzichten ("Wat moet ik hieruit halen?").

### Aanpak — in volgorde van impact

**Stap 1: Eerlijke periodes en vergelijkingen**
- `DateQuickPick`-optie "Dit jaar" omzetten naar **YTD** (`1 jan` t/m `vandaag`) en een aparte optie "Heel jaar" voor `1 jan - 31 dec`.
- Voor vergelijkingen altijd "zelfde aantal dagen vorig jaar" (al gedeeltelijk gedaan in `previousPeriodStats`, maar niet in `TopCustomersWidget` en de KPI-dashboard "Vorig jaar"-vergelijking). Eén centrale helper `getComparablePreviousRange(range)` introduceren en overal gebruiken.
- In KPI-tegel "Volume periode" badge "YTD vs YTD vorig jaar" tonen i.p.v. enkel een %.

**Stap 2: KPI Dashboard verdichten**
- Vervang de 4 losse tegels (Volume periode, Regels, Klanten, Wekelijkse trend) door 4 inzichtelijke tegels:
  - Totaal cilinders YTD + Δ vs vorig YTD (abs + %)
  - Gemiddeld per werkdag (laatste 30 dagen) + trend
  - Aantal actieve klanten + nieuwe klanten dit jaar
  - Voortgang t.o.v. doel of vorig-jaar-pace (progress ring i.p.v. sparkline)
- Anomaliebanner uitbreiden: "Cilinders deze week 1.612 (-39%), normaal 2.640 op basis van laatste 8 weken."

**Stap 3: Dashboard-tab opschonen**
- Eén Hero-rij (Cilinders + Droogijs) met YTD + comparable trend.
- "Verdeling locaties"-balk verwijderen als de KPI-tegels al per locatie splitsen; anders KPI-tegels Emmen/Tilburg verwijderen. Niet allebei.
- Verdeling-widget: percentages tonen, top-8 + samengevouwen "Overig" met aantal types, totaalbalk eronder.

**Stap 4: Top 5 klanten**
- YTD vs zelfde YTD-periode vorig jaar gebruiken (`fetchProductieByCustomerForYear` vervangen door datum-range variant).
- `normalizeKlant`-helper hergebruiken uit `YoYInsights` (extractie naar `src/lib/customerNormalize.ts`).
- Naast % ook absolute Δ tonen (+1.234 cil. / -567 cil.).

**Stap 5: Insights uitbreiden**
- Boven de top-lijsten een samenvatting: "Totaal vorig jaar (zelfde periode) 412.000 → dit jaar 387.000 = -25.000 (-6%). Belangrijkste bijdragers: …"
- Per rij: % aandeel van totaal volume (zodat "+60% bij een klein klantje" niet hetzelfde gewicht krijgt als "-5% bij een grote").
- Onder de lijsten: "Top 5 stijgers verklaren +12.000, top 5 dalers verklaren -34.000, overige beweging -3.000".

**Stap 6: Cilinders/Productie/Locaties/Vergelijking tabs**
- Per tab één korte tekstuele "key takeaway" bovenaan op basis van de data ("Augustus piekmaand met 14.500 cil., september -22% vs aug.").
- Productie-tab Maand/Jaar consolideren tot één view met periode-toggle om dubbele componenten te vermijden.

### Scope & technische aanpak

- Frontend-only. Geen DB- of RPC-wijzigingen; de bestaande aggregaties leveren al genoeg data.
- Nieuwe helper `src/lib/reportPeriods.ts` met `getYTDRange`, `getComparablePreviousRange`, `getWorkdayCount`.
- `src/lib/customerNormalize.ts` uitlichten zodat `YoYInsights` én `TopCustomersWidget` dezelfde regels gebruiken.
- KPI-tegels: kleine refactor in `KPIDashboard.tsx`.
- Dashboard-tab: aanpassingen in `ProductionReports.tsx` (rond regels 800–1226).
- Insights: aanvulling in `YoYInsights.tsx` (samenvattings­blok + aandeel-kolom).

### Volgorde van uitvoeren (klein → groot)

1. `DateQuickPick` "Dit jaar" → YTD + nieuwe optie "Heel jaar".
2. Centrale period-helpers + toepassen op `TopCustomersWidget` en KPI-dashboard.
3. KPI-tegels herontwerpen.
4. Dashboard-tab opschonen (dubbele info weg, Verdeling uitbreiden).
5. Insights samenvatting + aandeel-kolom.
6. Per-tab key takeaway.

### Wat ik graag wil bevestigen vóór de bouw

- Akkoord dat "Dit jaar" voortaan YTD betekent (met aparte "Heel jaar" optie)?
- Welk doel mag de progress-ring gebruiken: vorig-jaar-pace, een vast jaardoel uit `app_settings`, of beide?
- Mag ik de huidige tegels "Regels" en "Wekelijkse trend sparkline" vervangen, of wil je die behouden?
