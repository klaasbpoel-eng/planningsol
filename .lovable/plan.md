

## Fix: Alle medewerkers tonen in Toolbox Sessie Registratie

### Probleem
De sessie-dialoog haalt alleen profielen op met `is_approved = true` (regel 69 in `ToolboxSessionDialog.tsx`). Van de 8 medewerkers in het systeem zijn er maar 2 goedgekeurd:

| Medewerker | Goedgekeurd |
|---|---|
| kbpoel | Ja |
| Klaas Berend Poel | Ja |
| Bram ten Cate | Nee |
| Gido Rechtop | Nee |
| Jeanneau | Nee |
| Martin Heikens | Nee |
| Robin Stoppels | Nee |
| Stephan van Raaij | Nee |

### Twee opties

**Optie A (aanbevolen): De 6 niet-goedgekeurde medewerkers goedkeuren via de database**
De medewerkers zijn waarschijnlijk al actieve collega's die alleen nog niet formeel zijn goedgekeurd in het systeem. Door hun status bij te werken verschijnen ze overal in de app.

- Eenmalige database-update: `UPDATE profiles SET is_approved = true WHERE is_approved = false`
- Geen codewijzigingen nodig

**Optie B: De filter verwijderen uit de sessie-dialoog**
De `.eq("is_approved", true)` filter weghalen zodat alle profielen getoond worden, ongeacht goedkeuringsstatus. Dit heeft als risico dat ongewenste/onvolledige accounts ook verschijnen.

- Wijziging in `src/components/toolbox/ToolboxSessionDialog.tsx` regel 69: de `.eq("is_approved", true)` verwijderen

### Aanbeveling
Optie A is de schoonste oplossing: de medewerkers zijn echte collega's en horen goedgekeurd te zijn. De `is_approved`-filter in de code is een bewuste veiligheidsmaatregel die je beter kunt behouden.

### Technisch detail

| Bestand | Wijziging |
|---|---|
| Database | `UPDATE profiles SET is_approved = true, approved_at = now() WHERE is_approved = false` |

