
# Backend Verbeterplan

Na een volledige doorlichting van de database, RLS policies, edge functions en security scan.

---

## 🔴 KRITIEK — Security

### 1. Privilege escalation via profiel-update

**Probleem:** Gebruikers kunnen hun eigen `production_location` op NULL zetten via de "Users can update own profile" policy. Hierdoor activeert de fallback `OR (get_user_production_location(auth.uid()) IS NULL)` in de RLS policies van `dry_ice_orders`, `gas_cylinder_orders`, `internal_orders`, `pgs_substances` en `bulk_storage_tanks`, waardoor ze data van ALLE locaties kunnen inzien.

**Oplossing:** Maak een restrictieve update-policy op profiles die gevoelige kolommen (`production_location`, `is_approved`, `approved_by`, `approved_at`) uitsluit voor gewone gebruikers. Alleen admins mogen deze velden wijzigen.

**SQL:**
```sql
-- Drop de bestaande te brede policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Gebruikers mogen alleen niet-gevoelige velden wijzigen
CREATE POLICY "Users can update own profile safe fields"
ON public.profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND production_location IS NOT DISTINCT FROM (SELECT p.production_location FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_approved IS NOT DISTINCT FROM (SELECT p.is_approved FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approved_by IS NOT DISTINCT FROM (SELECT p.approved_by FROM public.profiles p WHERE p.user_id = auth.uid())
  AND approved_at IS NOT DISTINCT FROM (SELECT p.approved_at FROM public.profiles p WHERE p.user_id = auth.uid())
);
```

---

### 2. Te brede read-access op toolbox, customer_locations en customer_products

**Probleem:** Meerdere tabellen hebben `USING (true)` policies die alle data blootstellen aan iedere ingelogde gebruiker.

**Oplossing:**
- `toolbox_session_participants`: Beperk tot eigen deelname + admins/supervisors
- `toolbox_sessions`: Beperk tot admins/supervisors/instructeurs
- `customer_locations`: Beperk tot admins/supervisors/operators
- `customer_products`: Verwijder de brede policy, vertrouw op bestaande scoped policies

---

## 🟠 EDGE FUNCTIONS — Verbeteringen

### 3. CORS hardcoded op productie-domein

**Probleem:** Alle edge functions hebben `Access-Control-Allow-Origin` hardcoded op `https://planning.solnederland.nl`. Dit blokkeert requests vanuit de Lovable preview (`*.lovable.app`) en lokale dev.

**Oplossing:** CORS origin dynamisch maken op basis van de request origin, met een whitelist.

```typescript
const ALLOWED_ORIGINS = [
  "https://planning.solnederland.nl",
  "https://planningsol.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, ...",
  };
}
```

### 4. `complete-past-dry-ice-orders` — Geen authenticatie

**Probleem:** Deze functie (`verify_jwt = false`) heeft GEEN auth-check in de code. Iedereen kan het endpoint aanroepen. Hoewel het alleen een monitoring-query uitvoert (geen writes), is het een informatielek.

**Oplossing:** Voeg een admin-check toe of een gedeelde secret-key verificatie.

### 5. `fetch-published-site` — SSRF-risico

**Probleem:** Deze functie accepteert een willekeurige URL en fetcht de content. Dit is een Server-Side Request Forgery (SSRF) kwetsbaarheid — een aanvaller kan interne services benaderen.

**Oplossing:** Valideer de URL tegen een whitelist van toegestane domeinen (bijv. alleen `planning.solnederland.nl`).

### 6. `query-mysql` — SQL via request body

**Probleem:** De functie accepteert een volledige SQL-query + databasecredentials via de request body. Hoewel er auth vereist is, kan iedere ingelogde gebruiker willekeurige queries uitvoeren op de externe MySQL database.

**Oplossing:** Beperk tot admin-only of gebruik een voorgedefinieerde set queries.

### 7. CORS headers inconsistent

**Probleem:** Sommige functions gebruiken de korte CORS headers (`authorization, x-client-info, apikey, content-type`), andere de lange versie met `x-supabase-client-*`. Dit kan leiden tot CORS-fouten op bepaalde browsers.

**Oplossing:** Standaardiseer alle functions naar de volledige CORS headers.

---

## 🟡 DATABASE — Optimalisaties

### 8. Ontbrekende verify_jwt configuratie

**Probleem:** Niet alle edge functions hebben `verify_jwt` in `config.toml` gedefinieerd: `export-cylinder-orders`, `fetch-published-site`, `query-mysql`, `reset-dry-ice-orders`, `reset-gas-cylinder-orders`. Standaard is `verify_jwt = true`, maar het is beter dit expliciet te maken.

### 9. Dubbele RPC-functies

**Probleem:** Er zijn meerdere overloaded versies van dezelfde functies:
- `get_customer_segments` (3 versies)
- `get_production_efficiency` (3 versies)
- `get_production_efficiency_by_period` (2 versies)
- `get_monthly_order_totals` (2 versies)
- `get_daily_production_totals` (2 versies)
- `get_daily_production_by_period` (2 versies)
- Etc.

Dit komt door herhaalde migraties die nieuwe parameters toevoegen zonder de oude versie op te ruimen.

**Oplossing:** Opruimen van oude functie-versies via een migratie.

---

## Prioriteitsoverzicht

| # | Onderdeel | Risico | Complexiteit |
|---|-----------|--------|-------------|
| 1 | Profile privilege escalation | 🔴 Kritiek | Middel |
| 2 | Te brede RLS read policies | 🟠 Hoog | Laag |
| 3 | CORS dynamisch maken | 🟡 Medium | Laag |
| 4 | complete-past-dry-ice auth | 🟠 Hoog | Laag |
| 5 | fetch-published-site SSRF | 🟠 Hoog | Laag |
| 6 | query-mysql admin-only | 🟠 Hoog | Laag |
| 7 | CORS headers standaardiseren | 🟡 Laag | Laag |
| 8 | verify_jwt expliciet maken | 🟡 Laag | Laag |
| 9 | Dubbele RPC functies opruimen | 🟡 Laag | Middel |
