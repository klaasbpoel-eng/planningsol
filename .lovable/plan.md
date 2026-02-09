
## Externe Supabase Database Optie Toevoegen

### Wat er verandert

Naast de bestaande MySQL sync-optie wordt een tweede optie toegevoegd: **"Gebruik Externe Supabase Database"**. Wanneer ingeschakeld, worden alle write-operaties (create, update, delete) ook naar een externe Supabase-instantie gesynchroniseerd via dezelfde dual-write aanpak.

### Wijzigingen

**1. `src/components/admin/DataSourceSettings.tsx` -- UI uitbreiden**

- Nieuwe velden toevoegen aan het `DataSourceConfig` interface:
  - `useExternalSupabase: boolean`
  - `externalSupabaseUrl: string`
  - `externalSupabaseAnonKey: string`
- Een tweede toggle-sectie toevoegen: "Gebruik Externe Supabase Database" met velden voor URL en Anon Key
- Een "Test Verbinding" knop voor de externe Supabase (doet een simpele query om te checken of de verbinding werkt)
- De beschrijving bovenaan aanpassen: "Kies of u een externe MySQL en/of Supabase database wilt synchroniseren"

**2. `src/lib/api.ts` -- Sync naar externe Supabase toevoegen**

- Een `createExternalSupabaseClient()` helper toevoegen die een tweede Supabase client aanmaakt met de externe URL en Anon Key uit de config
- Een `syncToExternalSupabase()` helper toevoegen, vergelijkbaar met `syncToMySQL()`:
  - Controleert of externe Supabase sync is ingeschakeld
  - Voert de operatie uit op de externe Supabase client
  - Logt fouten maar blokkeert niet
- Alle ~40 write-methodes uitbreiden met een extra `syncToExternalSupabase()` call na de bestaande MySQL sync

Voorbeeld van de nieuwe flow per write-operatie:

```text
1. Schrijf naar primaire Supabase (altijd)
2. if (useMySQL) -> sync naar MySQL (bestaand)
3. if (useExternalSupabase) -> sync naar externe Supabase (nieuw)
```

### Overzicht bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/DataSourceSettings.tsx` | Interface uitbreiden, tweede toggle + formulier, test-knop |
| `src/lib/api.ts` | `syncToExternalSupabase` helper + alle write-methodes uitbreiden |

### Technische details

De externe Supabase client wordt lazy aangemaakt en gecached:

```typescript
import { createClient } from '@supabase/supabase-js';

let externalClient: ReturnType<typeof createClient> | null = null;

function getExternalSupabaseClient() {
  const config = getConfig();
  if (!config?.useExternalSupabase || !config.externalSupabaseUrl || !config.externalSupabaseAnonKey) return null;
  if (!externalClient) {
    externalClient = createClient(config.externalSupabaseUrl, config.externalSupabaseAnonKey);
  }
  return externalClient;
}

async function syncToExternalSupabase(fn: (client: ReturnType<typeof createClient>) => Promise<void>) {
  const client = getExternalSupabaseClient();
  if (!client) return;
  try {
    await fn(client);
  } catch (err) {
    console.error("External Supabase sync failed:", err);
    toast.error("Externe Supabase sync mislukt - data staat wel in de primaire database");
  }
}
```

Per write-methode wordt dan een extra sync toegevoegd, bijvoorbeeld:

```typescript
create: async (item: any) => {
  // 1. Primaire Supabase
  const { data, error } = await supabase.from("customers").insert(item).select().single();
  if (error) throw error;

  // 2. MySQL sync
  syncToMySQL(async () => { /* bestaand */ });

  // 3. Externe Supabase sync
  syncToExternalSupabase(async (ext) => {
    await ext.from("customers").upsert(data);
  });

  return data;
}
```

De externe Supabase sync gebruikt `upsert` in plaats van `insert` om idempotent te zijn bij eventuele retries.
