
# Showroom als ronde vorm van Entrée naar Kantoor Vivisol

## Wat wordt aangepast

De huidige showroom is een rechthoekig blokje (zone `showroom` op x:595, y:610, w:130, h:28). In werkelijkheid loopt de showroom in een boog/ronde vorm van de Entrée (x:540, y:750) richting het Kantoor bij de Vivisol opslag (x:808, y:565).

## Plan

1. **Verwijder de huidige rechthoekige showroom-zone** uit `DEFAULT_ZONES`

2. **Voeg een gebogen SVG-pad toe als achtergrond** in de SVG-rendering (naast de bestaande achtergrondblokken), die een afgeronde L-bocht of boogvorm tekent van de Entrée (rechtsonder bij kantoren) omhoog naar het Vivisol-kantoor (rechtsboven). Dit wordt een `<path>` element met een kwadratische of cubische bezier-curve, met een gestippelde rand en licht gekleurde vulling, gelabeld "SHOWROOM".

3. **Voeg de showroom-zone terug als een aangepast element** dat het gebogen pad visueel volgt. Omdat zones nu rechthoekig zijn, splits ik de showroom op in 2-3 kleinere zones die samen de boog vormen:
   - `showroom_onder`: Horizontaal stuk naast de Entrée (ca. x:640, y:740, w:120, h:48)
   - `showroom_midden`: Verticaal/schuin stuk (ca. x:730, y:640, w:80, h:100) 
   - `showroom_boven`: Horizontaal stuk bij Vivisol opslag (ca. x:750, y:600, w:140, h:40)
   
   Of beter: een enkel decoratief SVG-pad als achtergrond met label, en de showroom-zone als een enkel dragbaar element op een representatieve positie.

**Gekozen aanpak**: Een decoratief gebogen SVG-pad als achtergrondvorm (niet-dragbaar, puur visueel) dat de ronde loop van de showroom toont, plus de bestaande showroom-zone die als klikbaar element op het midden van het pad blijft staan.

## Technische details

**Bestand**: `src/components/production/InteractiveFloorPlan.tsx`

- Voeg na de bestaande achtergrondblokken (rond lijn 640) een SVG `<path>` toe met een gebogen vorm:
  - Start bij Entrée-gebied (ca. 640, 760)
  - Bocht naar rechts en omhoog
  - Eindigt bij Vivisol kantoor (ca. 810, 600)
  - Styling: gevulde achtergrond (`hsl(40 70% 50% / 0.08)`), gestippelde rand, label "SHOWROOM"

- Pas de bestaande `showroom` zone-positie en afmetingen aan zodat deze centraal op het pad ligt

- De boog wordt getekend met een `quadratic bezier` curve in SVG (`Q` commando) om een natuurlijke ronde hoek te maken
