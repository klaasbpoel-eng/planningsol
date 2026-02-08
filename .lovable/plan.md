

## Fix: Droogijs statistieken verbergen bij Tilburg filter

### Het probleem

Wanneer "SOL Tilburg" is geselecteerd als locatie, worden de droogijs-statistieken nog steeds getoond (5.064 kg en 28 orders). Dit is incorrect omdat droogijsproductie uitsluitend in Emmen plaatsvindt.

Er zijn twee oorzaken:

1. **Droogijs data wordt altijd opgehaald** -- De RPC-aanroep voor droogijs gebruikt `p_location: null`, waardoor altijd alle droogijsdata wordt opgehaald, ongeacht de locatiefilter.
2. **"Totaal orders" telt droogijs mee** -- Het totaal aantal orders is de som van droogijs- en cilinderorders. Bij Tilburg moeten droogijsorders niet meetellen.

### Oplossing

**Bestand: `src/components/production/ProductionPlanning.tsx`**

Twee aanpassingen in de `fetchStats` functie:

1. **Droogijs-statistieken overslaan bij Tilburg**: Wanneer `selectedLocation === "sol_tilburg"`, sla de droogijs RPC-aanroepen over en zet de waarden op 0.

2. **Droogijs stat card verbergen bij Tilburg**: De "Droogijs gepland" kaart wordt niet gerenderd wanneer Tilburg is geselecteerd (consistent met hoe rapportages dit al doen).

3. **Totaal orders corrigeren**: Bij Tilburg worden alleen cilinderorders geteld.

### Technische details

**In `fetchStats` (regel 193-214):**
- Als `selectedLocation === "sol_tilburg"`: skip de dry ice RPC calls, zet `dryIceToday`, `previousDryIceToday` op 0, en tel geen droogijsorders mee bij `weekOrders`.

**In de render (regel 395-408):**
- Wrap de droogijs StatCard in een conditie: `{selectedLocation !== "sol_tilburg" && <StatCard ... />}`
- Pas de grid-kolommen aan zodat de layout klopt met of zonder de droogijs-kaart.

