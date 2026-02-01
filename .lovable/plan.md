
# Plan: Droogijs productie rapportage herstellen

## Probleem Analyse

De rapportage toont geen droogijs (en cilinder) data omdat de database functies niet correct werken. De oorzaak is **function overloading ambiguïteit**:

Er bestaan twee versies van dezelfde functies:
- `get_monthly_order_totals(p_year, p_order_type)` - oude versie met 2 parameters
- `get_monthly_order_totals(p_year, p_order_type, p_location)` - nieuwe versie met 3 parameters

Wanneer de frontend deze functies aanroept met alleen 2 parameters, kan PostgreSQL/PostgREST niet bepalen welke versie moet worden gebruikt. Dit resulteert in HTTP 300 errors en lege data.

Hetzelfde probleem geldt voor:
- `get_monthly_cylinder_totals_by_gas_type`
- `get_yearly_totals_by_customer`

---

## Oplossing

De oude 2-parameter versies van de functies moeten worden verwijderd, zodat alleen de nieuwere 3-parameter versies (met optionele `p_location DEFAULT NULL`) overblijven.

---

## Stappen

### 1. Database Migratie
Verwijder de oude overloaded functie versies:

```sql
DROP FUNCTION IF EXISTS public.get_monthly_order_totals(integer, text);
DROP FUNCTION IF EXISTS public.get_monthly_cylinder_totals_by_gas_type(integer);
DROP FUNCTION IF EXISTS public.get_yearly_totals_by_customer(integer);
```

Dit laat de nieuwere versies met optionele locatie parameter intact. De `DEFAULT NULL` parameter zorgt ervoor dat de functies nog steeds correct werken wanneer geen locatie wordt meegegeven.

### 2. Verificatie
Na de migratie wordt gecontroleerd of:
- De `CumulativeYearChart` component droogijs data correct toont
- De `YearComparisonReport` zowel cilinder als droogijs data weergeeft
- De locatiefilter correct werkt voor beide typen

---

## Technische Details

| Onderdeel | Actie |
|-----------|-------|
| Database functies | Verwijder 3 oude overloaded functies |
| Frontend code | Geen wijzigingen nodig |
| Risico | Laag - de nieuwe functies zijn al aanwezig en functioneel |

---

## Verwacht Resultaat

Na deze wijziging:
- Droogijs productie voor 2025 (123.373 kg over 320 orders) wordt correct weergegeven in alle rapportages
- Cilinder data wordt ook correct getoond
- De jaarvergelijking en cumulatieve grafieken werken weer
