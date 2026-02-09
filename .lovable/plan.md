

## Primaire Database Keuze Toevoegen

### Wat er verandert

Er komt een nieuwe instelling **"Primaire Databron"** waarmee je kiest welke database wordt gebruikt voor alle lees-, schrijf- en verwijderoperaties. De drie opties zijn:

- **Lovable Cloud** (standaard) -- de huidige Supabase-instantie
- **Externe Supabase** -- een zelf geconfigureerde Supabase-instantie
- **MySQL** -- een externe MySQL server

Dit staat los van de sync-toggles. Sync kopieert data naar extra databases; de primaire keuze bepaalt waar de app daadwerkelijk mee werkt.

### Wijzigingen

**1. `src/components/admin/DataSourceSettings.tsx` -- UI uitbreiden**

- Nieuw veld toevoegen aan `DataSourceConfig`: `primarySource: "cloud" | "external_supabase" | "mysql"` (default: `"cloud"`)
- Bovenaan het formulier een RadioGroup toevoegen met de drie opties
- Bij keuze "Externe Supabase" of "MySQL" een waarschuwing tonen dat de betreffende verbindingsgegevens ook ingevuld moeten zijn
- De sync-toggles blijven apart bestaan onder de primaire keuze

**2. `src/lib/api.ts` -- Primaire database logica**

- Nieuwe helper `getPrimaryClient()` die op basis van `config.primarySource` het juiste "client-object" teruggeeft:
  - `"cloud"` -> de standaard `supabase` client (huidige gedrag)
  - `"external_supabase"` -> de externe Supabase client (hergebruikt `getExternalSupabaseClient()`)
  - `"mysql"` -> een speciaal object dat alle queries via `executeMySQL()` uitvoert

- Voor Supabase-gebaseerde primaire bronnen (cloud + extern) verandert er weinig: de bestaande code gebruikt gewoon een andere client
- Voor MySQL als primaire bron moeten de reads ook via `executeMySQL()` lopen; hiervoor wordt een wrapper-functie per tabel gemaakt

- De sync-logica wordt aangepast: als MySQL primair is, hoeft niet meer naar MySQL gesync te worden (en vice versa)

De kernstructuur per methode wordt:

```text
Huidige flow:
  1. Lees/schrijf naar Supabase Cloud
  2. Sync naar MySQL (optioneel)
  3. Sync naar Externe Supabase (optioneel)

Nieuwe flow:
  1. Lees/schrijf naar PRIMAIRE bron (Cloud, Extern Supabase, of MySQL)
  2. Sync naar de andere twee (alleen als ingeschakeld EN niet zelf de primaire)
```

### Technische details

Nieuwe helper in `api.ts`:

```typescript
type PrimarySource = "cloud" | "external_supabase" | "mysql";

function getPrimarySource(): PrimarySource {
  const config = getConfig();
  return config?.primarySource || "cloud";
}

function getPrimarySupabaseClient(): SupabaseClient {
  const source = getPrimarySource();
  if (source === "external_supabase") {
    const ext = getExternalSupabaseClient();
    if (!ext) throw new Error("Externe Supabase niet geconfigureerd");
    return ext;
  }
  return supabase; // cloud (default)
}
```

Per API-methode wordt `supabase` vervangen door `getPrimarySupabaseClient()` voor cloud/extern, en een aparte MySQL-branch voor MySQL als primaire bron:

```typescript
getAll: async () => {
  const source = getPrimarySource();
  if (source === "mysql") {
    return await executeMySQL("SELECT * FROM customers ORDER BY name");
  }
  const client = getPrimarySupabaseClient();
  const { data, error } = await client.from("customers").select("*").order("name");
  if (error) throw error;
  return data;
},
```

Sync-logica wordt slim: niet syncen naar de bron die al primair is:

```typescript
// Na een write:
if (getPrimarySource() !== "mysql") {
  syncToMySQL(async () => { ... });
}
if (getPrimarySource() !== "external_supabase") {
  syncToExternalSupabase(async (ext) => { ... });
}
// Cloud krijgt alleen sync als het NIET primair is:
if (getPrimarySource() !== "cloud") {
  syncToCloud(async () => { ... }); // nieuw: terugschrijven naar cloud
}
```

### UI voorbeeld

De RadioGroup bovenaan het DataSourceSettings formulier:

```text
Primaire Databron
  (*) Lovable Cloud (standaard)
  ( ) Externe Supabase
  ( ) MySQL
```

Met een waarschuwingstekst als de gekozen bron niet geconfigureerd is.

### Overzicht bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/DataSourceSettings.tsx` | `primarySource` veld + RadioGroup UI + validatie-waarschuwing |
| `src/lib/api.ts` | `getPrimarySource()`, `getPrimarySupabaseClient()` helpers + alle ~50 methodes aanpassen voor primaire bron routing + slimme sync |

### Risico's
- MySQL als primaire bron heeft geen RLS-beveiliging -- alle authenticatie/autorisatie wordt dan aan de MySQL-kant verwacht
- Bij wisselen van primaire bron moeten beide databases in sync zijn, anders ontbreekt er data
