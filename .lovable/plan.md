

## PGS Registratie Gevaarlijke Stoffen

### Wat is dit?
Een nieuwe module voor het bijhouden van een PGS-register (Publicatiereeks Gevaarlijke Stoffen) van aanwezige gevaarlijke stoffen op de productielocaties, gekoppeld aan de bestaande gastypes in het systeem.

### Aanpak

**1. Database: nieuwe tabel `pgs_substances`**
Slaat per locatie de registratie op van gevaarlijke stoffen met PGS-classificatie:

| Kolom | Type | Beschrijving |
|-------|------|-------------|
| id | uuid PK | |
| gas_type_id | uuid FK → gas_types | Koppeling aan bestaand gastype |
| location | production_location | sol_emmen / sol_tilburg |
| pgs_guideline | text | PGS-richtlijn (bijv. "PGS 9", "PGS 16") |
| max_allowed_kg | numeric | Maximaal toegestane hoeveelheid |
| current_stock_kg | numeric | Huidige voorraad (handmatig of berekend) |
| storage_class | text | ADR/opslagklasse |
| hazard_symbols | text[] | GHS-pictogrammen (GHS02, GHS04, etc.) |
| un_number | text | UN-nummer (bijv. "UN1013") |
| cas_number | text | CAS-nummer |
| risk_phrases | text | H-zinnen |
| safety_phrases | text | P-zinnen |
| notes | text | |
| is_active | boolean | |
| updated_by | uuid | |
| created_at / updated_at | timestamptz | |

RLS: admin volledige toegang, operators/supervisors readonly op hun locatie.

**2. Seed data** via insert tool — vooraf ingevulde PGS-classificaties voor gangbare gassen:
- Zuurstof → PGS 9 (oxiderende gassen), UN1072, GHS03+GHS04
- Stikstof → PGS 9, UN1066, GHS04
- Argon → PGS 9, UN1006, GHS04
- CO₂ → PGS 9, UN1013, GHS04
- Acetyleen → PGS 16 (brandbare gassen), UN1001, GHS02+GHS04
- Waterstof → PGS 16, UN1049, GHS02+GHS04
- Propaan → PGS 16, UN1978, GHS02+GHS04
- Helium → PGS 9, UN1046, GHS04

**3. Nieuw component: `PGSRegistry.tsx`**
- Overzichtstabel per locatie met:
  - Gasnaam, PGS-richtlijn, UN-nummer, GHS-pictogrammen (als gekleurde badges)
  - Huidige voorraad vs. maximaal toegestaan (progress bar, rood bij >80%)
  - H-zinnen en P-zinnen in expandable rows
- Filtermogelijkheden op PGS-richtlijn en opslagklasse
- Admin: inline-edit voor max_allowed_kg en current_stock_kg
- Export naar Excel/PDF voor inspectiedoeleinden

**4. Integratie**
- Nieuw tabblad "PGS Register" toevoegen in `ProductionPlanning.tsx` (naast Plattegrond)
  - Icoon: `ShieldAlert` (al geïmporteerd)
  - Alleen zichtbaar voor admin/supervisor (`showAdvancedTabs`)
- Eventueel ook een dashboard-waarschuwing als een stof >80% van de max is

### Bestanden
- **Database**: 1 migratie voor `pgs_substances` tabel + RLS
- **Data**: insert van seed data voor bekende gassen
- **Nieuw**: `src/components/production/PGSRegistry.tsx`
- **Wijzigen**: `src/components/production/ProductionPlanning.tsx` (tab toevoegen)

