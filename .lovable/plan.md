

## Fix "Onbekend" in Kalender

### Oorzaak
De `profiles` tabel heeft alleen een `full_name` kolom, maar de code probeert te sorteren op `last_name` en `first_name` -- kolommen die niet bestaan. Dit veroorzaakt een fout waardoor alle profielen niet geladen worden, en de kalender "Onbekend" toont bij elke medewerker.

### Oplossing

**Bestand: `src/lib/api.ts` (regel 846-848)**

De `profiles.getAll()` functie aanpassen om te sorteren op `full_name` in plaats van `last_name` en `first_name`:

- MySQL query: `ORDER BY last_name ASC, first_name ASC` wordt `ORDER BY full_name ASC`
- Supabase query: `.order("last_name").order("first_name")` wordt `.order("full_name")`

### Technische details

Huidige code (fout):
```typescript
// MySQL pad
return executeMySQL("SELECT * FROM profiles ORDER BY last_name ASC, first_name ASC");
// Supabase pad
const { data, error } = await supabase.from("profiles").select("*").order("last_name").order("first_name");
```

Nieuwe code:
```typescript
// MySQL pad
return executeMySQL("SELECT * FROM profiles ORDER BY full_name ASC");
// Supabase pad
const { data, error } = await supabase.from("profiles").select("*").order("full_name");
```

Dit is een eenvoudige fix van 2 regels die het probleem direct oplost.

