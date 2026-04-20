

# UI/UX Aanbevelingen — Dagelijks Overzicht

Op basis van de huidige schermafbeelding en de structuur van `DailyOverview.tsx` (1813 regels, 5 kolommen, dichte informatieweergave) heb ik een aantal observaties en concrete verbeteringen geïdentificeerd. Hieronder de prioriteitsvolgorde.

## Hoofdobservaties

1. **Visuele hiërarchie is plat** — de 5 kolommen (Ambulance/Droogijs/Taken/Afwezig/Gas) hebben allemaal dezelfde gewichtsverdeling, ongeacht hoeveel content erin staat. De Ambulance-kolom puilt uit met klantcodes terwijl Afwezig leeg is.
2. **Statusbar bovenin is cryptisch** — `0/3 afgerond`, drie losse badges (1, 120 kg, 1) zonder labels. Vereist mentale parsing.
3. **Filter-row neemt veel ruimte** — zoekveld + Alles/Open/Afgerond pillen + info-banner = 3 regels boven de eigenlijke data.
4. **Klantenlijst in Ambulance-kaart** is een ruwe dump (10+ codes onder elkaar) zonder groepering of telling.
5. **Geen visueel onderscheid tussen "vandaag heeft werk" en "rustig"** — lege kolommen ogen even prominent als volle.
6. **Acties verstopt** — `+` knoppen per kolom zijn klein; geen quick-add vanuit toetsenbord zichtbaar (wel `⌘K` in header maar niet in context).
7. **Geen tijd-as** — items worden opgesomd zonder volgorde naar uur, terwijl een dagoverzicht juist tijdgebaseerd is.

## Voorgestelde verbeteringen (geprioriteerd)

### Prio 1 — Duidelijkere koptekst & samenvatting
- Vervang `0/3 afgerond` + losse badges door één **samenvattingsstrook**:
  `Vandaag · 3 items · 1 ambulancerit · 120 kg droogijs · 1 taak · iedereen aanwezig`
- Maak de progress-bar dikker (h-2) en geef een label: "Voortgang van de dag".
- Verplaats `Print / Compact / Fullscreen / Toetsenbord / Mark-all-done` naar een **overflow-menu** (drie puntjes); houd alleen Dag/Week + datum-navigatie zichtbaar.

### Prio 2 — Tijd-as in dagweergave
- Sorteer items binnen elke kolom op `start_time` en toon de tijd als prefix (bv. `08:30 — Sanquin Groningen`).
- Items zonder tijd onderaan onder een aparte sectie "Geen tijd".
- Optioneel: smalle linker tijdkolom (06–18 uur) waarlangs items horizontaal uitlijnen — alleen in dag-view.

### Prio 3 — Compactere & rustigere kolomkaarten
- Gebruik **collapsible sections** binnen de Ambulance-kaart: Cilinders / Klanten (met telling: "Klanten · 11"). Standaard alleen titel+telling, klikken toont detail.
- Geef lege kolommen een afgezwakte stijl (border-dashed, lichtere text, kleine illustratie) zodat ze visueel terugtreden.
- Maak kolombreedtes **flexibel** (CSS grid met `minmax`) zodat een kolom met veel content meer ruimte krijgt en lege kolommen smaller worden.

### Prio 4 — Duidelijker statusgedrag
- Vervang de "Nieuw"-badge door een subtiele linker accent-bar (2px) op de kaart — minder visueel lawaai.
- Status-badges (Gepland/Bezig/Voltooid) krijgen een vast icoon (klok/play/check) zodat ze ook zonder kleur leesbaar zijn.
- Voltooide items collapsen automatisch in een "Afgerond (n)" sectie onderaan elke kolom.

### Prio 5 — Filter & zoek minder dominant
- Maak het zoekveld smaller (max-w-sm) en plaats de Alles/Open/Afgerond als segmented-control rechts ernaast op één regel.
- Verberg de info-banner ("Er staan nog 11 items…") na 5 seconden of plaats hem als subtiele tekst onder de datumnavigatie.

### Prio 6 — Quick actions & toetsenbord
- Toon onder de kolomtitel een hint bij hover: "N = nieuw, K = doorzoeken".
- Voeg per kolom een **inline quick-add** toe (één regel input die verschijnt na klik op `+`) i.p.v. direct een dialog te openen voor simpele taken.
- FAB rechtsonder voor "Nieuw item" met menu naar alle 5 types (mobile-first).

### Prio 7 — Mobiele weergave
- Op mobiel: 5 kolommen → 1 verticale stapel met **horizontale chip-tabs** bovenaan (Alle · Ambulance · Droogijs · …).
- Swipe-gestures voor dag-navigatie.

## Niet-functionele aanbevelingen

- **Refactor**: `DailyOverview.tsx` is 1813 regels — splits in `<DayHeader>`, `<DaySummaryBar>`, `<ColumnCard>`, `<AmbulanceColumn>`, `<DryIceColumn>`, etc. Maakt toekomstige iteraties veel sneller.
- **Toegankelijkheid**: voeg `aria-label` toe aan kleur-afhankelijke statusbadges; controleer contrast van de "Nieuw"-badge op witte achtergrond.
- **Performance**: memoiseer de zware kolomberekeningen per dag (lijkt nu bij elke render herberekend).

## Volgorde van uitvoering (voorstel)

```text
Stap 1: Header + samenvattingsstrook opschonen          (klein, hoge impact)
Stap 2: Kolomkaarten — collapsible secties + lege staat (medium)
Stap 3: Tijd-as / sortering op start_time               (medium)
Stap 4: Refactor in subcomponenten                      (groot, geen UX-impact)
Stap 5: Mobiele tab-layout + FAB                        (medium)
Stap 6: Quick-add inline + statusgedrag verfijnen       (klein-medium)
```

Geef aan welke stappen je wilt uitvoeren — ik kan ze los of gecombineerd implementeren. Stap 1 + 2 samen geven al een merkbare rust en duidelijkheid op het scherm.

