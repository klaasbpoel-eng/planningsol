## Doel
Voeg in de "Nieuwe verlofaanvraag"-dialog een optie toe om de aanvraag wekelijks of tweewekelijks te herhalen, per losse dag, t/m een gekozen einddatum van de reeks. Alle gegenereerde aanvragen worden gekoppeld via een gedeelde `series_id`, zodat ze later als reeks herkend en beheerd kunnen worden (consistent met bestaande "Recurring Series"-aanpak in het project).

## Scope
Alleen de dialog `src/components/calendar/CreateLeaveRequestDialog.tsx` + 1 DB-migratie om `series_id` toe te voegen aan `time_off_requests`. Andere lijsten/kalender tonen aanvragen ongewijzigd; bewerken/verwijderen "hele reeks" valt **buiten** dit verbeterplan (kan later).

## UX
1. Onder Begin/Einddatum een nieuwe sectie **"Herhaling"** met een segmented control:
   - `Geen` (default) · `Wekelijks` · `2-wekelijks`
2. Bij keuze ≠ Geen verschijnen:
   - **Dagen van de week**: multi-toggle Ma–Zo. Default = de weekdag van de gekozen begindatum.
   - **Herhalen t/m**: datepicker (default = +4 weken). Mag niet vóór begindatum liggen.
3. Onder de duur-tegel een live samenvatting: bv. *"Genereert 8 aanvragen: ma 10 jun, ma 17 jun, … t/m ma 29 jul"*. Toon top 3 + "… +N meer" als > 4.
4. Bij herhaling: het bestaande Begin/Einddatum-paar geldt als **1 occurrence** (single-day of meerdaagse blok). Voor de simpele MVP forceren we bij herhaling **single-day** (Einddatum = Begindatum); dagdeel/uren blijven werken voor die ene dag en worden herhaald.
5. Dagdeel-knop "Uren" blijft werken; tijden worden in elke gegenereerde aanvraag herhaald via dezelfde `[hh:mm-hh:mm]`-prefix in `reason`.

## Logica `handleCreate`
- Bouw lijst `occurrences: Date[]`:
  - `Geen` → `[startDate]` (huidig gedrag, evt. multi-day blok).
  - `Wekelijks`/`2-wekelijks` → vanaf `startDate`, voor elke week (stap 1 of 2) tot `seriesEndDate`, voeg elke geselecteerde weekdag toe waarvan datum ≥ startDate en ≤ seriesEndDate.
- Genereer `series_id = crypto.randomUUID()` als occurrences.length > 1.
- Bouw array van inserts (zelfde profile_id, type_id, reason, day_part, status) met `start_date = end_date = occurrence` en `series_id`.
- 1 batch insert via `supabase.from("time_off_requests").insert(rows).select()`.
- Toast: *"N verlofaanvragen ingediend (reeks)"*; `onCreate(createdRequests)` met de hele array.
- Validaties: minstens 1 weekdag geselecteerd; seriesEndDate ≥ startDate; cap op bv. 60 occurrences om misbruik te voorkomen.

## Database
Nieuwe migratie:
```
ALTER TABLE public.time_off_requests
  ADD COLUMN series_id uuid;
CREATE INDEX time_off_requests_series_id_idx
  ON public.time_off_requests (series_id);
```
Geen RLS-wijziging nodig (bestaande policies op profile_id blijven gelden). Geen GRANT-wijziging nodig (kolomtoevoeging).

## Niet in scope (vervolgstap)
- Reeks bewerken/annuleren in 1 actie vanuit lijst/kalender.
- Visuele "reeks"-badge in `TimeOffRequestList` / kalender.
- Multi-day blokken herhalen (bv. "elke 2 weken een hele werkweek vrij").

## Bestanden
- **Migratie**: nieuwe timestamped SQL voor `series_id`.
- **Edit**: `src/components/calendar/CreateLeaveRequestDialog.tsx` — UI + handleCreate herschrijven naar batch insert.