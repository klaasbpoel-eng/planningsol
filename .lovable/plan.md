

## Dual-Write: Supabase + MySQL Sync

### Wat er verandert

Wanneer "Gebruik Externe MySQL Database" is ingeschakeld, wordt elke **create**, **update** en **delete** operatie naar **beide** databases geschreven: eerst Supabase (primair), daarna MySQL (sync). Lezen blijft alleen vanuit Supabase -- MySQL is een kopie.

### Aanpak

**1. `src/lib/api.ts` -- Dual-write logica toevoegen**

De huidige code heeft een `if (useMySQL) { ... } else { ... }` patroon dat ofwel MySQL ofwel Supabase aanroept. Dit wordt gewijzigd naar:

- **Reads (getAll, getPending, getByKey)**: Altijd vanuit Supabase lezen (geen wijziging nodig in de else-branch)
- **Writes (create, update, delete)**: Altijd eerst naar Supabase schrijven, en daarna -- als `useMySQL` aan staat -- ook naar MySQL pushen via de `query-mysql` edge function

Een helper-functie `syncToMySQL()` wordt toegevoegd die:
- Controleert of MySQL sync is ingeschakeld
- De MySQL query uitvoert via de bestaande `executeMySQL()` functie
- Fouten logt maar niet gooit (sync mag de primaire operatie niet blokkeren)
- Een toast toont als de sync faalt zodat de gebruiker het weet

**2. Per API-sectie de write-methodes aanpassen**

Voor alle ~13 secties (customers, gasTypes, cylinderSizes, dryIceProductTypes, dryIcePackaging, taskTypes, gasTypeCategories, appSettings, gasCylinderOrders, dryIceOrders, tasks, timeOffRequests, profiles) worden de `create`, `update` en `delete` methodes aangepast:

```text
Huidige flow:
  if (useMySQL) -> schrijf naar MySQL
  else          -> schrijf naar Supabase

Nieuwe flow:
  1. Schrijf naar Supabase (altijd)
  2. if (useMySQL) -> schrijf ook naar MySQL (async, fout wordt gelogd)
```

**3. Voorbeeld van de nieuwe structuur (customers.create)**

```typescript
create: async (item: any) => {
  // Altijd naar Supabase
  const { data, error } = await supabase.from("customers").insert(item).select().single();
  if (error) throw error;

  // Sync naar MySQL als ingeschakeld
  syncToMySQL(async () => {
    const keys = Object.keys(data).filter(k => k !== undefined);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(',');
    await executeMySQL(
      `INSERT INTO customers (${keys.join(',')}) VALUES (${placeholders})`,
      values
    );
  });

  return data;
}
```

**4. De `syncToMySQL` helper**

```typescript
async function syncToMySQL(fn: () => Promise<void>) {
  const config = getConfig();
  if (!config?.useMySQL) return;

  try {
    await fn();
  } catch (err) {
    console.error("MySQL sync failed:", err);
    toast.error("MySQL sync mislukt - data staat wel in de cloud database");
  }
}
```

**5. Reads blijven ongewijzigd**

Alle `getAll`, `getPending`, `getByKey` methodes blijven alleen vanuit Supabase lezen. De MySQL database is puur een mirror/backup.

### Overzicht wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/lib/api.ts` | Nieuwe `syncToMySQL` helper + alle write-methodes (~40 functies) aanpassen van either/or naar dual-write |

### Voordelen
- Supabase blijft de "source of truth"
- MySQL krijgt automatisch alle wijzigingen
- Als MySQL sync faalt, werkt de app gewoon door
- Geen aparte cron jobs of webhooks nodig
- Gebruikt de bestaande `query-mysql` edge function

### Risico's en mitigatie
- **MySQL sync kan falen**: Foutmelding wordt getoond, data staat veilig in Supabase
- **Vertraging**: MySQL sync voegt ~100-500ms toe per write, maar wordt niet afgewacht (fire-and-forget met error handling)
- **Schema mismatch**: De MySQL database moet dezelfde tabelstructuur hebben als Supabase
