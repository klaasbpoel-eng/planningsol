

## Plan: Interactieve Plattegrond optimaliseren voor Inventory & Stock Management

Dit plan bevat twee delen: (1) de plattegrond koppelen aan live voorraaddata, en (2) een buitenopslag-zone toevoegen voor brandbare gassen. Daarnaast worden de build errors gefixed.

---

### 1. Build Errors Fixen (sql_sync_tasks)

De `sql_sync_tasks` tabel bestaat niet in de gegenereerde types. Oplossing: alle Supabase calls in `SqlSyncTaskForm.tsx` en `SqlSyncTasksPage.tsx` casten met `as any` om de TypeScript-fouten te omzeilen, aangezien de tabel wel in de database bestaat maar niet in de typedefinitie.

---

### 2. Buitenopslag Brandbare Gassen (rechtsbovenin)

Toevoegen aan `InteractiveFloorPlan.tsx`:
- Nieuw terreingebied rechtsbovenin de SVG (x: ~600-970, y: 15-140) naast de bulktanks
- Nieuwe zone "Buitenopslag Brandbare Gassen" met sub-zones voor Acetyleen, Waterstof en Methaan
- Zone type: nieuw `opslag_brandbaar` met oranje/rode kleur en waarschuwingsindicator
- Gevarenpictogram (GHS02 - vlam) in de zone-rendering
- Zones versleepbaar in edit mode, net als bestaande zones

Nieuwe DEFAULT_ZONES entries:
```
{ id: "buiten_brandbaar", x: 620, y: 30, w: 350, h: 110, label: "Buitenopslag", sublabel: "Brandbare gassen", type: "opslag_brandbaar" }
{ id: "buiten_acetyleen", x: 630, y: 50, w: 100, h: 75, label: "Acetyleen", sublabel: "C₂H₂", type: "opslag_brandbaar" }
{ id: "buiten_waterstof", x: 740, y: 50, w: 100, h: 75, label: "Waterstof", sublabel: "H₂", type: "opslag_brandbaar" }
{ id: "buiten_methaan", x: 850, y: 50, w: 100, h: 75, label: "Methaan", sublabel: "CH₄", type: "opslag_brandbaar" }
```

---

### 3. Inventory & Stock Integratie op de Plattegrond

Zones koppelen aan live database data:
- **PGS-data op zones**: Bij het klikken op een gasopslag-zone (bijv. "Zuurstof Trolley") wordt een detail-paneel getoond met actuele voorraadinfo uit `pgs_substances` (current_stock_kg, max_allowed_kg, bezettingspercentage)
- **Visuele bezettingsindicatoren**: Zones krijgen een kleurcodering op basis van bezettingsgraad:
  - Groen (< 60%), Oranje (60-85%), Rood (> 85%)
  - Kleine voortgangsbalk onderaan elke zone
- **Bulktanks**: Toon actueel niveau uit `bulk_storage_tanks` tabel als visuele vulling in de cirkels (arc/fill)
- **Mapping**: Zone-id's koppelen aan gas_type_id's via een mapping-object, zodat de juiste voorraaddata per zone wordt opgehaald
- **Real-time**: Supabase query bij mount + optioneel realtime subscription

Technisch:
- Nieuwe prop `showInventoryOverlay?: boolean` op `InteractiveFloorPlan`
- useEffect hook om `pgs_substances` en `bulk_storage_tanks` data op te halen
- Mapping object `ZONE_TO_GAS_TYPE` dat zone-id's koppelt aan gastypes
- SVG rect overlay met bezettingspercentage per zone
- Detail-panel uitbreiden met voorraadinfo wanneer een zone geselecteerd is

---

### 4. Bestanden die worden gewijzigd

| Bestand | Wijziging |
|---|---|
| `src/components/production/InteractiveFloorPlan.tsx` | Nieuw zone type `opslag_brandbaar`, buitenopslag-zones, inventory overlay, database koppeling |
| `src/components/admin/SqlSyncTaskForm.tsx` | `as any` cast op `.from()` calls |
| `src/pages/SqlSyncTasksPage.tsx` | `as any` cast op `.from()` calls |

