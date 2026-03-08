

# UI/UX Verbeterplan

Na het doorlichten van de gehele applicatie zijn dit de verbeterpunten die ik heb geidentificeerd, gegroepeerd per prioriteit.

---

## 1. Login pagina -- Visuele upgrade

**Probleem:** De login pagina is functioneel maar kaal -- vlakke witte achtergrond zonder branding.

**Verbetering:**
- Achtergrond voorzien van de `gradient-mesh` of `bg-mesh-animate` klasse die al in het design system zit
- Subtiele blur-ring/glow rond de login card (`glass-card-premium`)
- Login card voorzien van een lichte schaduw-animatie bij focus op invoervelden

---

## 2. Header -- Betere visuele hierarchie

**Probleem:** De header gebruikt `bg-primary-foreground` (wit) wat vlak oogt. De zoekbalk en acties staan dicht op elkaar.

**Verbetering:**
- Header een subtiel `backdrop-blur` en `bg-background/80` geven voor een glaseffect passend bij het design system
- Spacing tussen action-items vergroten van `gap-1` naar `gap-2`
- Role-badge op mobiel verbergen (neemt ruimte in beslag op kleine schermen)

---

## 3. Dagelijks Overzicht -- Verbeterde leesbaarheid

**Probleem:** Het 1695-regelige component werkt goed, maar heeft enkele UX-verbeterpunten.

**Verbeteringen:**
- **Lege dag-state:** Gebruik de bestaande `EmptyState` component (variant `calendar`, size `sm`) in plaats van een platte `<p>` tag
- **Zoekbalk:** Voeg een clear-knop (X) toe aan het zoekveld wanneer er tekst is ingevuld
- **Progress bar:** Voeg kleurovergangen toe aan de progress bar (groen bij >75%, oranje bij 40-75%, rood bij <40%)
- **Section headers:** Voeg een hover-effect toe aan de inklapbare sectie-headers voor betere affordance

---

## 4. Productie pagina -- Tab navigatie

**Probleem:** De tab-balk kan op mobiel tot 9 kolommen bevatten, wat erg krap is.

**Verbetering:**
- Op mobiel de tabs horizontaal scrollbaar maken met `overflow-x-auto` en `scrollbar-hide` in plaats van een grid
- Actieve tab visueel beter onderscheiden met een underline-indicator naast de achtergrondkleur
- `TabsList` een vaste hoogte geven zodat het niet verspringt bij wisselende content

---

## 5. Consistentie loading states

**Probleem:** Sommige pagina's gebruiken een simpele `<Loader2>` spinner, andere gebruiken skeletons. De loading ervaring is inconsistent.

**Verbetering:**
- Alle pagina's (`Index.tsx`, `DailyOverviewPage.tsx`, etc.) voorzien van een gestandaardiseerde full-page loading component met het SOL logo + subtiele pulse animatie in plaats van een kale spinner

---

## 6. Floating Action Button -- Verbetering

**Probleem:** De FAB is functioneel maar mist visuele feedback en heeft geen animatie bij verschijnen.

**Verbetering:**
- FAB voorzien van een `scale-in` entry animatie via framer-motion
- Een lichte schaduw-puls toevoegen zodat de knop meer opvalt
- `pb-safe` padding respecteren voor notch-devices (nu `bottom-6`, beter `bottom-6 pb-safe`)

---

## 7. Card componenten -- Subtiele verbeteringen

**Probleem:** Cards zijn uniform maar missen diepte-differentiatie.

**Verbetering:**
- Interactieve cards (die `interactive` variant al ondersteunen) een subtiele `border-l-4` accent-kleur geven per categorie in het dagoverzicht
- Hover-state versterken met een lichte `ring` in plaats van alleen shadow

---

## 8. Mobiel hamburger menu -- Polish

**Probleem:** Het mobiele menu opent als een Sheet maar mist een paar finesse-elementen.

**Verbetering:**
- Actieve pagina visueel markeren met een gekleurde border-left indicator
- Een footer toevoegen met de app-versie of "SOL Planner" branding
- Animatie op de menu-items toevoegen (staggered fade-in)

---

## Technische samenvatting

| # | Onderdeel | Bestanden | Complexiteit |
|---|-----------|-----------|-------------|
| 1 | Login styling | `AuthForm.tsx` | Laag |
| 2 | Header glaseffect | `Header.tsx` | Laag |
| 3 | Dagelijks Overzicht UX | `DailyOverview.tsx` | Middel |
| 4 | Productie tabs mobiel | `ProductionPlanning.tsx` | Middel |
| 5 | Loading states | `Index.tsx`, `DailyOverviewPage.tsx` + nieuw component | Laag |
| 6 | FAB animatie | `floating-action-button.tsx` | Laag |
| 7 | Card accenten | `DailyOverview.tsx` Section component | Laag |
| 8 | Mobiel menu polish | `Header.tsx` | Laag |

Alle wijzigingen gebruiken het bestaande design system (Tailwind, framer-motion, shadcn/ui) en introduceren geen nieuwe dependencies.

