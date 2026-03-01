

# Command Palette UX Verbetering

## Wat gaat er veranderen

### 1. Positie naar boven + groter resultatenvenster
De dialoog verschuift van het midden naar het bovenste derde deel van het scherm (zoals Spotlight/Raycast). De resultatenlijst wordt vergroot van 300px naar 450px zodat meer items zichtbaar zijn.

### 2. Fullscreen op mobiel
Op mobiele apparaten wordt het command palette fullscreen weergegeven als een bottom sheet-achtige ervaring die het hele scherm vult.

### 3. Recente acties
Een "Recent" groep bovenaan die de laatst gebruikte 5 acties toont. Wordt opgeslagen in localStorage zodat het tussen sessies bewaard blijft. Wanneer je een actie uitvoert, wordt deze automatisch bovenaan de recente lijst geplaatst.

### 4. Fuzzy search verbetering
Keywords toevoegen aan elk item zodat gedeeltelijke zoektermen beter matchen. Bijvoorbeeld: "prod" vindt "Productieplanning", "gas" vindt "Gascilinder Planning". Dit werkt via het `keywords` prop van cmdk.

---

## Technische aanpak

### Bestanden die gewijzigd worden:

**`src/components/ui/command.tsx`**
- `CommandDialog`: positie aanpassen via CSS (`top-[20%] translate-y-0` i.p.v. `top-[50%] translate-y-[-50%]`)
- Mobiele variant: fullscreen styling via `max-sm:` classes

**`src/components/command-palette/CommandPalette.tsx`**
- Recente acties state + localStorage logica toevoegen
- `keywords` prop toevoegen aan alle `CommandItem` componenten voor betere fuzzy search
- "Recent" `CommandGroup` bovenaan renderen wanneer er recente items zijn
- `CommandList` max-height verhogen naar 450px

