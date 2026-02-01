

# Plan: Productielocatie Splitsing voor Gascilinders

## Overzicht
Dit plan implementeert twee aparte tabbladen voor de gascilinder productielocaties **SOL Tilburg** en **SOL Emmen**. De database is al voorbereid met een `production_location` kolom.

## Wat wordt er gewijzigd?

### 1. Hoofdtabbladen Structuur (ProductionPlanning.tsx)
De huidige structuur met 3 tabbladen wordt uitgebreid naar 4 tabbladen:
- **Droogijs** - blijft ongewijzigd
- **Tilburg** (nieuw) - gascilinder orders voor SOL Tilburg
- **Emmen** (nieuw) - gascilinder orders voor SOL Emmen
- **Rapportage** - blijft ongewijzigd

De statistiekkaart "Gascilinders vandaag" wordt gesplitst in twee aparte kaarten per locatie.

### 2. GasCylinderPlanning Component Aanpassen
Het GasCylinderPlanning component krijgt een nieuwe `location` prop:
- Filtert orders automatisch op de geselecteerde locatie
- Toont alleen orders voor die specifieke locatie
- Bulk verwijderen werkt per locatie

### 3. Order Aanmaken met Locatie
Bij het aanmaken van een nieuwe order (CreateGasCylinderOrderDialog):
- De locatie wordt automatisch ingesteld op basis van het actieve tabblad
- De locatie prop wordt doorgegeven vanuit het parent component

### 4. Order Bewerken met Locatie
Bij het bewerken van een order (GasCylinderOrderDialog):
- Locatie kan niet worden gewijzigd (order blijft bij originele vestiging)
- De locatie wordt wel getoond in de detailweergave

---

## Technische Details

### Nieuwe Props
```text
GasCylinderPlanning:
  + location: "tilburg" | "emmen" (verplicht)

CreateGasCylinderOrderDialog:
  + location: "tilburg" | "emmen" (verplicht, wordt opgeslagen bij aanmaken)
```

### Database Query Aanpassingen
Alle queries in GasCylinderPlanning worden uitgebreid met:
```text
.eq("production_location", location)
```

### Bestanden die worden aangepast
1. `src/components/production/ProductionPlanning.tsx`
   - Nieuwe tabbladen toevoegen (Tilburg, Emmen in plaats van Gascilinders)
   - Statistieken splitsen per locatie
   
2. `src/components/production/GasCylinderPlanning.tsx`
   - Nieuwe `location` prop toevoegen
   - Filter queries op locatie
   - Titel en beschrijving aanpassen per locatie
   
3. `src/components/production/CreateGasCylinderOrderDialog.tsx`
   - Nieuwe `location` prop toevoegen
   - Locatie opslaan bij aanmaken order

4. `src/components/production/GasCylinderOrderDialog.tsx`
   - Locatie tonen in detailweergave (read-only)

5. `src/components/production/ExcelImportDialog.tsx`
   - Locatie meegeven bij bulk import

### UI/UX
- Tilburg tabblad krijgt dezelfde oranje kleur als het huidige gascilinders tabblad
- Emmen tabblad krijgt een paarse kleur voor visueel onderscheid
- Beide tabbladen tonen het Cylinder icoon

