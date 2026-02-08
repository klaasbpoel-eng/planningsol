

## Fix: KPI Dashboard toont data van verkeerde datum door tijdzone-conversie

### Het probleem

De KPI Dashboard toont 52 cilinders en 5 voltooide orders voor Tilburg, maar die horen eigenlijk bij 31 januari (niet februari). Dit komt door een tijdzone-bug:

- De datum `1 februari 2026 00:00 CET` wordt via `.toISOString()` omgezet naar `2026-01-31T23:00:00Z` (UTC)
- `.split('T')[0]` pakt dan `2026-01-31` in plaats van `2026-02-01`
- Hierdoor worden 5 orders van 31 januari (52 cilinders) onterecht meegeteld

Dit probleem zit op meerdere plekken in de code waar `.toISOString().split('T')[0]` wordt gebruikt voor datumconversie.

### Oplossing

Vervang alle `.toISOString().split('T')[0]` conversies door een lokale datumformattering die de tijdzone respecteert. Gebruik de bestaande `format()` functie van `date-fns` (al geimporteerd in ProductionPlanning) of een handmatige lokale formatter.

### Bestanden die worden aangepast

**1. `src/components/production/KPIDashboard.tsx`**

Voeg een helper-functie toe die lokaal formatteert:
```
const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
```

Vervang alle voorkomens van `.toISOString().split('T')[0]` door `toLocalDateString()`:
- Regel 87: `fromDate` berekening
- Regel 88: `toDate` berekening  
- Regel 98: `prevFromDate` berekening
- Regel 99: `prevToDate` berekening
- Regel 215: `startStr` in `fetchWeeklySparkline`
- Regel 216: `endStr` in `fetchWeeklySparkline`

Dit zorgt ervoor dat `1 feb 2026 00:00 CET` correct wordt als `2026-02-01`, ongeacht de tijdzone van de gebruiker.

### Impact

Na deze fix zal het KPI Dashboard voor Tilburg correct 0 cilinders en 0 orders tonen in februari, omdat alle 5 orders op 31 januari vallen en buiten de geselecteerde periode vallen.
