
## Fix: Top 5 Klanten Widget + Build Errors

### Probleem

De "Top 5 Klanten" widget toont "Geen klantdata beschikbaar" terwijl er wel data in de database staat (2.305 cilinders in februari 2026). Uit analyse blijkt:

1. De RPC-functies `get_customer_totals_by_period` en `get_yearly_totals_by_customer` bestaan en bevatten correcte queries
2. Er zijn geen RPC-calls zichtbaar in de netwerkverzoeken -- dit wijst erop dat de aanroep ofwel faalt voor de netwerkcall, ofwel de fout stil wordt afgevangen
3. De `.catch()` in de widget retourneert `null`, waardoor `customers` leeg blijft zonder foutmelding
4. Er zijn daarnaast 3 TypeScript build-fouten in edge functions die opgelost moeten worden

### Oorzaak

De widget vangt fouten stil op via `.catch()` zonder feedback aan de gebruiker. Als de RPC-call faalt (bijv. door een kortstondig auth-probleem of type-mismatch), wordt dit niet zichtbaar.

### Oplossing

**1. `src/components/production/TopCustomersWidget.tsx` -- Betere foutafhandeling + fallback**

- Error state toevoegen zodat fouten zichtbaar worden in de UI
- Bij een fout: toon een "Opnieuw proberen" knop
- Voeg een `console.error` toe met meer context zodat fouten makkelijker te debuggen zijn
- Voeg een retry-mechanisme toe: als de eerste poging faalt, probeer het nog een keer na 1 seconde

**2. Edge Function build errors fixen (3 bestanden)**

Alle drie de fouten zijn hetzelfde: `'error' is of type 'unknown'`. Oplossing: cast `error` naar `Error` type.

| Bestand | Regel | Fix |
|---------|-------|-----|
| `supabase/functions/export-mysql-dump/index.ts` | 299 | `(e as Error).message` |
| `supabase/functions/fetch-published-site/index.ts` | 47 | `(error as Error).message` |
| `supabase/functions/query-mysql/index.ts` | 54 | `(error as Error).message` |

### Technische Details

Aangepaste foutafhandeling in de widget:

```typescript
const [error, setError] = useState<string | null>(null);

const fetchTopCustomers = async (retryCount = 0) => {
  setLoading(true);
  setError(null);
  try {
    if (dateRange) {
      await fetchCustomersByDateRange(dateRange);
    } else {
      await fetchCustomersByYear();
    }
  } catch (err) {
    console.error("Error fetching top customers:", err);
    if (retryCount < 1) {
      // Retry once after a short delay
      setTimeout(() => fetchTopCustomers(retryCount + 1), 1000);
      return;
    }
    setError("Kon klantdata niet laden");
  } finally {
    setLoading(false);
  }
};
```

En in de render bij een fout een "Opnieuw proberen" knop tonen in plaats van alleen "Geen klantdata beschikbaar".

### Overzicht bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/TopCustomersWidget.tsx` | Error state + retry logica + UI feedback bij fouten |
| `supabase/functions/export-mysql-dump/index.ts` | Fix `unknown` type error |
| `supabase/functions/fetch-published-site/index.ts` | Fix `unknown` type error |
| `supabase/functions/query-mysql/index.ts` | Fix `unknown` type error |
