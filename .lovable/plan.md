
## Fix: MySQL Verbinding - Deno-compatibele MySQL Client

### Probleem

De `query-mysql` backend functie werkt niet omdat de `mysql2` library via `esm.sh` wordt geladen. Deze library is gebouwd voor Node.js en gebruikt interne Node.js modules (`net`, `tls`, `crypto`) die niet beschikbaar zijn in de Deno runtime. Hierdoor crasht de functie direct bij het opstarten met:

```
TypeError: Cannot read properties of undefined (reading 'prototype')
```

Daarnaast bevat het host-veld in de instellingen een protocol-prefix (`https://`) die voor verbindingsfouten zorgt.

### Oplossing

**1. Backend functie herschrijven met Deno-native MySQL client**

De `mysql2` import vervangen door de Deno-native MySQL driver (`deno.land/x/mysql@v2.12.1`). Deze driver is specifiek gebouwd voor Deno en heeft geen Node.js afhankelijkheden.

**Bestand: `supabase/functions/query-mysql/index.ts`**

Wijzigingen:
- Import wijzigen van `esm.sh/mysql2` naar `deno.land/x/mysql@v2.12.1/mod.ts`
- Verbindingsparameters aanpassen aan de API van de nieuwe client (`hostname` i.p.v. `host`, `username` i.p.v. `user`, `db` i.p.v. `database`)
- Query-uitvoering aanpassen: `client.execute(query, params)` retourneert `{ rows }` in plaats van een tuple `[rows, fields]`
- Verbinding sluiten via `client.close()` i.p.v. `connection.end()`
- Ongebruikte `createClient` import van supabase verwijderen
- Host-sanitization toevoegen: protocol, paden en poortnummers uit de hostname strippen

**2. Host-validatie toevoegen aan de instellingen**

**Bestand: `src/components/admin/DataSourceSettings.tsx`**

- `onBlur` handler toevoegen aan het Host invoerveld
- Bij verlaten van het veld automatisch `https://`, `http://`, paden, query-parameters en poortnummers verwijderen
- Zo wordt altijd alleen de kale hostname opgeslagen (bijv. `web0131.zxcs.nl`)

### Technische details

Huidige import (werkt niet):
```typescript
import mysql from "https://esm.sh/mysql2@3.9.7/promise";
```

Nieuwe import (Deno-native):
```typescript
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";
```

API-mapping:
| Oud (mysql2)                    | Nieuw (deno_mysql)                  |
|---------------------------------|-------------------------------------|
| `mysql.createConnection({...})` | `new Client().connect({...})`       |
| `host`                          | `hostname`                          |
| `user`                          | `username`                          |
| `database`                      | `db`                                |
| `connection.execute(q, p)`      | `client.execute(q, p)`             |
| `[rows, fields]` (tuple)       | `{ rows }` (object)                |
| `connection.end()`              | `client.close()`                    |

Host-sanitization in de backend functie:
```typescript
function sanitizeHost(raw: string): string {
  let h = raw.trim();
  h = h.replace(/^https?:\/\//i, "");
  h = h.replace(/\/.*$/, "");
  h = h.replace(/:\d+$/, "");
  return h;
}
```

### Overzicht bestanden

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/query-mysql/index.ts` | Herschrijven: mysql2 vervangen door Deno-native MySQL client + host-sanitization |
| `src/components/admin/DataSourceSettings.tsx` | onBlur host-validatie toevoegen |
