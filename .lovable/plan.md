
# Fix: Horizontaal scrollen op mobiel voorkomen

## Probleem

Op mobiele apparaten kan de hele pagina horizontaal verschoven worden, waardoor er witte ruimte zichtbaar wordt aan de rechterkant. Dit wordt veroorzaakt door elementen die breder zijn dan het scherm.

## Oorzaak

Er zijn meerdere plekken waar content buiten het scherm kan uitsteken:

1. **Geen overflow beveiliging** op de pagina-wrapper (`ProductionPlanningPage.tsx`) - het `gradient-mesh` div mist `overflow-x: hidden`
2. **KPI Dashboard "Additional Stats Row"** - gebruikt `grid-cols-3` zonder responsive aanpassing, waardoor tekst en iconen op smalle schermen buiten beeld vallen
3. **KPI Dashboard header** - de badges en tekst in de `CardHeader` kunnen op smalle schermen te breed worden

## Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/ProductionPlanningPage.tsx` | Voeg `overflow-x-hidden` toe aan de page wrapper |
| `src/components/production/KPIDashboard.tsx` | Maak de "Additional Stats Row" responsive (`grid-cols-1 sm:grid-cols-3`) en voeg `overflow-hidden` toe aan de card |
| `src/index.css` | Voeg globale `overflow-x: hidden` toe aan `body` om horizontaal scrollen app-breed te voorkomen |

## Technische Details

### 1. Globale overflow fix (`src/index.css`)
Voeg `overflow-x: hidden` toe aan de body styling om app-breed horizontaal scrollen te voorkomen. Dit is de veiligste aanpak zodat geen enkele pagina dit probleem kan veroorzaken.

### 2. Page wrapper (`ProductionPlanningPage.tsx`)
Voeg `overflow-x-hidden` toe aan de `min-h-screen gradient-mesh` div als extra beveiliging.

### 3. KPI Dashboard (`KPIDashboard.tsx`)
- Verander de "Additional Stats Row" van `grid-cols-3` naar `grid-cols-1 sm:grid-cols-3` zodat de statistieken op mobiel onder elkaar staan
- Voeg `overflow-hidden` toe aan de wrapper Card
- Maak de header badges `flex-wrap` zodat ze op smalle schermen kunnen wrappen
