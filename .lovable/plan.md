
# Waarschuwing CO2 partiaaldruk in Receptenmaker

## Wat wordt er toegevoegd

Een waarschuwingsbanner die verschijnt wanneer de partiaaldruk van CO2 in het mengsel boven 60 bar uitkomt. De melding waarschuwt dat fasescheiding (vloeistofvorming) mogelijk is bij die druk, aangezien de kritische druk van CO2 73,83 bar bedraagt.

## Gedrag

- De waarschuwing verschijnt automatisch zodra `CO2-percentage / 100 * doeldruk > 60 bar`
- De waarschuwing verdwijnt wanneer het percentage of de doeldruk wordt verlaagd
- De waarschuwing blokkeert het gebruik niet (alleen informatief)
- De banner toont de berekende partiaaldruk en de kritische druk van CO2

## Weergave

Een oranje/gele Alert-banner met een AlertTriangle-icoon, geplaatst direct onder de vulparameters-kaart (voor de resultaattabel). De banner is zichtbaar in zowel het bewerkscherm als de printweergave.

---

## Technische details

### Bestand: `src/components/production/GasMixtureRecipemaker.tsx`

1. Bereken de CO2 partiaaldruk als derived value: `co2PartialPressure = (percentages.co2 / 100) * targetPressure`
2. Voeg een `Alert` component toe (uit `@/components/ui/alert`) met variant "destructive" styling in oranje/gele tint, direct onder de vulparameters sectie (rond regel 370, voor de resultaattabel)
3. Toon de alert alleen wanneer `co2PartialPressure > 60` en `percentages.co2 > 0`
4. Inhoud: "CO2 partiaaldruk is {waarde} bar (kritisch: 73,83 bar). Boven 60 bar is fasescheiding mogelijk."
5. Importeer `Alert, AlertTitle, AlertDescription` uit `@/components/ui/alert` (al beschikbaar in het project)
