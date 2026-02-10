
## Sortering gascilinders wachtrij op `updated_at`

### Wat verandert

De gascilinders wachtrij wordt momenteel gesorteerd op `scheduled_date` (oplopend). De sortering wordt aangepast naar `updated_at` (aflopend, nieuwste bovenaan) zodat recent bijgewerkte orders bovenaan staan.

### Technisch

**Bestand: `src/lib/api.ts`**

Twee aanpassingen in de `gasCylinderOrders` sectie:

1. **`getAll`** (regel 445-447): `orderBy` wijzigen van `"scheduled_date"` naar `"updated_at"` met `orderAsc: false` (nieuwste eerst). MySQL-query eveneens aanpassen.

2. **`getPending`** (regel 466-467): Zelfde aanpassing -- sorteren op `updated_at` DESC in plaats van `scheduled_date`.
