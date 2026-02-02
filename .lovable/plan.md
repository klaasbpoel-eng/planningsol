
# Plan: Veiligheidsinstructies toevoegen voor Droogijs en Gascilinders

## Overzicht
Een nieuwe veiligheidssectie toevoegen aan de productieomgeving met uitgebreide instructies voor het veilig werken met droogijs en gascilinders. Deze informatie wordt getoond in een nieuw tabblad "Veiligheid" in het productieplanningsdashboard.

## Wat wordt er gebouwd?

### Nieuwe veiligheidspagina met:
- **Droogijs veiligheidsinstructies**
  - Behandelingsvoorschriften (gebruik van geïsoleerde handschoenen/tangen)
  - Opslagrichtlijnen (geventileerde ruimtes, nooit luchtdicht)
  - Gevaren (verstikking door CO2, bevriezing bij -78.5°C)
  - EHBO-instructies

- **Gascilinder veiligheidsinstructies**
  - Behandeling en transport (rechtop, vastgezet, cilinderwagen gebruiken)
  - Opslagvoorschriften (droog, geventileerd, onder 52°C)
  - Gebruiksrichtlijnen (juiste reduceerventiel, lekcontrole)
  - Persoonlijke beschermingsmiddelen (veiligheidsbril, handschoenen)

### Visuele opzet
- Twee overzichtelijke kaarten naast elkaar (droogijs en gascilinders)
- Accordion-secties per onderwerp voor overzichtelijkheid
- Waarschuwingen met Alert-componenten voor kritieke punten
- Iconen voor herkenbaarheid (Snowflake, Cylinder, ShieldAlert)

---

## Technische Details

### Bestandswijzigingen

| Bestand | Actie | Beschrijving |
|---------|-------|--------------|
| `src/components/production/SafetyInstructions.tsx` | Nieuw | Hoofdcomponent met alle veiligheidsinformatie |
| `src/components/production/ProductionPlanning.tsx` | Wijzigen | Nieuw "Veiligheid" tabblad toevoegen |

### Component Structuur

```text
SafetyInstructions.tsx
├── Card: Droogijs Veiligheid
│   ├── Alert: Kritieke waarschuwing
│   └── Accordion
│       ├── Behandeling
│       ├── Opslag
│       ├── Gevaren
│       └── EHBO
└── Card: Gascilinder Veiligheid
    ├── Alert: Kritieke waarschuwing
    └── Accordion
        ├── Behandeling & Transport
        ├── Opslag
        ├── Gebruik
        └── Beschermingsmiddelen
```

### Tab Integratie
Het ProductionPlanning component wordt uitgebreid met een vierde tab:
- Droogijs (bestaand)
- Gascilinders (bestaand)
- Rapportage (bestaand)
- **Veiligheid (nieuw)** - met ShieldAlert icoon

### Gebruikte UI Componenten
- `Card`, `CardHeader`, `CardContent` - voor de twee hoofdsecties
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent` - voor inklapbare secties
- `Alert`, `AlertTitle`, `AlertDescription` - voor waarschuwingen
- `Badge` - voor labels van gevaarscategorieën
- Lucide iconen: `Snowflake`, `Cylinder`, `ShieldAlert`, `AlertTriangle`, `Thermometer`, `Wind`

