

## Fix: Dropdowns in kalender-dialogen

### Wat wordt er gedaan

De dropdowns (categorie, medewerker, status, prioriteit) in de taak- en andere kalender-dialogen werken niet omdat ze door de dialog worden geblokkeerd. Dit wordt in twee stappen opgelost:

### Stap 1: Dialog-component aanpassen

**Bestand: `src/components/ui/dialog.tsx`**

Een handler toevoegen aan het DialogContent component die voorkomt dat de dialog sluit wanneer je op een dropdown-item klikt. De dropdown-menu's worden namelijk buiten de dialog gerenderd, waardoor de dialog denkt dat je "erbuiten" klikt.

### Stap 2: `modal={false}` terugdraaien

In alle 5 kalender-dialogen wordt `modal={false}` weer verwijderd zodat de overlay en focus correct blijven werken:

- `CreateTaskDialog.tsx`
- `CreateLeaveRequestDialog.tsx`
- `CreateDryIceOrderCalendarDialog.tsx`
- `CalendarItemDialog.tsx` (2 plekken)
- `DryIceOrderDialog.tsx`

### Technisch detail

De `DialogContent` component krijgt een `onPointerDownOutside` handler die controleert of de klik op een Radix dropdown-element was. Zo ja, dan wordt het sluiten van de dialog voorkomen:

```typescript
onPointerDownOutside={(e) => {
  const target = e.target as HTMLElement;
  if (target?.closest("[data-radix-popper-content-wrapper]")) {
    e.preventDefault();
  }
}}
```

### Overzicht bestanden

| Bestand | Wijziging |
|---------|-----------|
| `src/components/ui/dialog.tsx` | `onPointerDownOutside` handler toevoegen |
| `src/components/calendar/CreateTaskDialog.tsx` | `modal={false}` verwijderen |
| `src/components/calendar/CreateLeaveRequestDialog.tsx` | `modal={false}` verwijderen |
| `src/components/calendar/CreateDryIceOrderCalendarDialog.tsx` | `modal={false}` verwijderen |
| `src/components/calendar/CalendarItemDialog.tsx` | `modal={false}` verwijderen (2x) |
| `src/components/calendar/DryIceOrderDialog.tsx` | `modal={false}` verwijderen |

