
# Mobiel Formulier Verbeteren: Swipe- en Scrollproblemen Oplossen

## Het Probleem

Op mobiel opent het bestelformulier als een Vaul **Drawer** (bottom sheet). Deze Drawer reageert op swipe-gebaren over het **hele** oppervlak om te sluiten. Wanneer je in het formulier scrollt, selecteert of een dropdown opent, interpreteert de Drawer dit als een "weg-swipe" en sluit het formulier. Dit is een bekend probleem bij bottom sheets met lange, scrollbare inhoud.

---

## De Oplossing: `handleOnly` Mode voor Lange Formulieren

De Vaul library ondersteunt een `handleOnly` prop: wanneer ingeschakeld kan de drawer **alleen** via de drag-handle (het balkje bovenaan) worden weggeswiped, niet door ergens anders in het formulier te swipen. Dit lost beide problemen op:

1. **Scrollen in het formulier** conflicteert niet meer met de dismiss-gesture
2. **Selecties en dropdowns** worden niet meer onderbroken door onbedoeld sluiten

---

## Wat Verandert

### 1. `ResponsiveDialog` component uitbreiden

Het `ResponsiveDialog` component (`src/components/ui/responsive-dialog.tsx`) wordt uitgebreid met een optionele `handleOnly` prop die wordt doorgegeven aan de Vaul Drawer. Standaard `false` voor korte dialogen, maar `true` voor lange formulieren.

### 2. Drawer component: Handle zichtbaar maken

Het `DrawerContent` component (`src/components/ui/drawer.tsx`) toont al een drag-indicatie balk bovenaan. Deze wordt iets groter en duidelijker gestyled zodat gebruikers weten dat ze daar moeten swipen om te sluiten.

### 3. Gas Cylinder Order Dialog aanpassen

`CreateGasCylinderOrderDialog.tsx`: Stel `handleOnly` in op de `ResponsiveDialog`, en maak de footer sticky op mobiel zodat de "Aanmaken" knop altijd zichtbaar blijft zonder mee te scrollen.

### 4. Dry Ice Order Dialog aanpassen

`CreateDryIceOrderDialog.tsx`: Dezelfde `handleOnly` aanpassing toepassen voor consistentie.

---

## Technisch Overzicht

**`src/components/ui/responsive-dialog.tsx`**
- Voeg `handleOnly?: boolean` toe aan `ResponsiveDialogProps`
- Geef dit door aan de `Drawer` component als prop
- Voeg een expliciete sluiten-knop (X) toe aan de mobiele header als `handleOnly` actief is, zodat gebruikers altijd kunnen sluiten

**`src/components/ui/drawer.tsx`**
- Importeer `Drawer.Handle` (Vaul's ingebouwde handle component) - dit is al visueel aanwezig als een `div`, maar door het officiele Handle component te gebruiken reageert de drag-gesture correct

**`src/components/production/CreateGasCylinderOrderDialog.tsx`**
- Voeg `handleOnly` toe aan `ResponsiveDialog`
- Maak de footer sticky op mobiel: `sticky bottom-0 bg-background border-t z-10` met safe-area padding

**`src/components/production/CreateDryIceOrderDialog.tsx`**
- Zelfde `handleOnly` aanpassing

---

## Samenvatting van bestanden

| Bestand | Wijziging |
|---|---|
| `src/components/ui/responsive-dialog.tsx` | `handleOnly` prop toevoegen, close-knop in mobiele header |
| `src/components/ui/drawer.tsx` | Drag handle verbeteren met Vaul Handle component |
| `src/components/production/CreateGasCylinderOrderDialog.tsx` | `handleOnly` activeren, sticky footer op mobiel |
| `src/components/production/CreateDryIceOrderDialog.tsx` | `handleOnly` activeren, sticky footer op mobiel |
