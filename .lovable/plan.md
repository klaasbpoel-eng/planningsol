

## Dubbel kruisje verwijderen in Toolbox Viewer

### Probleem
De Toolbox Viewer toont twee sluitknoppen (X):
1. Een **ingebouwde** X van het `DialogContent` component (shadcn/ui standaard, rechtsboven)
2. Een **handmatige** X-knop in de branded header van de ToolboxViewer

### Oplossing
Verberg de ingebouwde DialogContent-sluitknop via CSS, zodat alleen de eigen X-knop in de header overblijft. Dit gebeurt door een extra class toe te voegen aan het `DialogContent` element in `ToolboxViewer.tsx`.

### Technisch detail

**Bestand: `src/components/toolbox/ToolboxViewer.tsx`**

Op de `DialogContent` wordt een extra class `[&>button:last-child]:hidden` toegevoegd. Dit verbergt de automatisch gegenereerde sluitknop van Radix Dialog, terwijl de eigen knop in de header behouden blijft.

Alleen een eenregelige CSS-class toevoeging, geen structurele wijzigingen.
