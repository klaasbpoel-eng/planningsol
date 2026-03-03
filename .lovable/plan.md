

## Vullocatie beheer in de database

### Wat wordt er gebouwd
Een databasetabel voor voorraadproducten met een `filled_in_emmen` veld, plus een admin-interface waarmee producten in bulk toegewezen kunnen worden aan vullocatie Emmen of niet.

### Aanpassingen

**1. Nieuwe databasetabel `stock_products`**
- Kolommen: `id`, `sub_code` (uniek), `description`, `filled_in_emmen` (boolean, default true), `created_at`, `updated_at`
- RLS: admins volledige CRUD, authenticated users SELECT
- Bij Excel-import worden nieuwe producten automatisch aangemaakt in deze tabel

**2. Admin vullocatie-beheer component**
- Nieuw bestand: `src/components/production/StockFillingLocationManager.tsx`
- Tabel met alle bekende producten, checkbox per product voor "Gevuld in Emmen"
- Selecteer-alles checkbox bovenaan voor bulk-toggle
- Multi-select met "Markeer als Emmen" / "Markeer als extern" knoppen voor geselecteerde producten
- Zoekfilter om snel producten te vinden
- Toegankelijk via een knop in de StockSummaryWidget (alleen voor admins)

**3. StockSummaryWidget en import aanpassen**
- Bij Excel-import: na het parsen, `filled_in_emmen` opzoeken uit de `stock_products` tabel per `sub_code`
- Nieuwe producten (onbekende sub_codes) worden automatisch in de tabel ingevoegd
- Bij printen wordt de database-waarde van `filled_in_emmen` gebruikt

### Technische details

**Database migratie:**
```sql
CREATE TABLE public.stock_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_code text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  filled_in_emmen boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

-- Admins: volledige CRUD
CREATE POLICY "Admins can manage stock products" ON public.stock_products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Authenticated: lezen
CREATE POLICY "Authenticated can view stock products" ON public.stock_products
  FOR SELECT TO authenticated USING (true);
```

**Bulk-update flow:**
- Admin selecteert meerdere producten via checkboxes
- Klikt op "Markeer als Emmen" of "Markeer als extern"
- Supabase `.update({ filled_in_emmen: true/false }).in('id', selectedIds)` wordt aangeroepen

**Import-integratie:**
- Na Excel-parse: voor elk item wordt `sub_code` opgezocht in `stock_products`
- Als gevonden: `filled_in_emmen` wordt overgenomen uit de database
- Als niet gevonden: product wordt aangemaakt met de waarde uit de Excel (of default `true`)
- De Excel-kolomdetectie voor vullocatie blijft als fallback voor nieuwe producten

