

## Externe Supabase Export Toevoegen

### Wat er verandert

Naast de bestaande MySQL export komt er een **Supabase Export** knop op de MigrationSettings pagina. Deze leest de geselecteerde tabellen direct vanuit de primaire database en downloadt ze als een JSON-bestand dat geimporteerd kan worden in een externe Supabase-instantie.

### Wijzigingen

**1. Nieuw bestand: `src/components/admin/SupabaseExportSettings.tsx`**

Een nieuw component, vergelijkbaar met `DatabaseExportSettings`, dat:
- De geselecteerde tabellen als prop ontvangt
- Per tabel alle rijen ophaalt vanuit Supabase (in batches van 1000)
- Alles bundelt in een JSON-bestand met structuur `{ tableName: rows[] }`
- Het bestand downloadt als `.json` (gecomprimeerd als `.json.gz` indien mogelijk)
- Voortgang toont via toast-meldingen

Dit werkt volledig client-side (geen edge function nodig) omdat de data al via de primaire Supabase client beschikbaar is.

**2. Bestand aanpassen: `src/components/admin/MigrationSettings.tsx`**

- Import van het nieuwe `SupabaseExportSettings` component
- Toevoegen onder de bestaande `DatabaseExportSettings` component

### Resultaat

De export-pagina toont dan:
1. Tabellen selectie (bestaand)
2. MySQL Export knop (bestaand)
3. **Supabase Export knop (nieuw)** -- downloadt een JSON-bestand

### Technische details

```typescript
// SupabaseExportSettings.tsx - kernlogica
const allData: Record<string, any[]> = {};
for (const table of selectedTables) {
  let allRows: any[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(offset, offset + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = [...allRows, ...data];
    offset += data.length;
    if (data.length < 1000) break;
  }
  allData[table] = allRows;
  totalRows += allRows.length;
}
// Download als JSON(.gz)
```

| Bestand | Wijziging |
|---------|-----------|
| `src/components/admin/SupabaseExportSettings.tsx` | Nieuw -- Export component voor Supabase JSON download |
| `src/components/admin/MigrationSettings.tsx` | Import + toevoegen van SupabaseExportSettings |

