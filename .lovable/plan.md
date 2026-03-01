
# Snelle statuswijziging in Dagelijks Overzicht

Dezelfde context-menu functionaliteit die in de kalenderweergave is geimplementeerd, wordt nu toegevoegd aan alle items in het Dagelijks Overzicht (DailyOverview component).

## Wat verandert er

Rechts-klikken (of long-press op mobiel) op een ambulancerit, gascilinder-order, droogijs-order of taak opent een context-menu met statusopties. De status wordt direct (optimistisch) bijgewerkt zonder het detail-dialoog te openen.

## Statusopties per categorie

- **Ambulance**: Gepland, Bezig, Voltooid, Geannuleerd
- **Gascilinders**: Gepland, Bezig, Voltooid, Geannuleerd
- **Droogijs**: Gepland, Bezig, Voltooid, Geannuleerd
- **Taken**: Gepland, Bezig, Voltooid, Geannuleerd

Verlof-items (Afwezig) krijgen geen context-menu omdat hun status via een apart goedkeuringsproces loopt.

## Technische aanpak

### Bestand: `src/components/dashboard/DailyOverview.tsx`

1. **Import toevoegen**: `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem` uit `@/components/ui/context-menu`, plus `toast` uit `sonner` en relevante iconen (`Clock`, `Play`, `CheckCircle2`, `XCircle`).

2. **Quick-status handlers toevoegen**: Vier functies die optimistisch de lokale state updaten en asynchroon de database bijwerken via Supabase:
   - `handleQuickAmbulanceStatus` - update `ambulance_trips`
   - `handleQuickGasStatus` - update `gas_cylinder_orders`
   - `handleQuickDryIceStatus` - update `dry_ice_orders`
   - `handleQuickTaskStatus` - update `tasks`

   Bij fout wordt de oude state hersteld (rollback) en een foutmelding getoond.

3. **Items wrappen in ContextMenu**: Elk clickable item-div wordt gewrapped in:
   ```text
   <ContextMenu>
     <ContextMenuTrigger asChild>
       <div onClick={...}>bestaande inhoud</div>
     </ContextMenuTrigger>
     <ContextMenuContent>
       <ContextMenuItem>Gepland</ContextMenuItem>
       <ContextMenuItem>Bezig</ContextMenuItem>
       <ContextMenuItem>Voltooid</ContextMenuItem>
       <ContextMenuItem>Geannuleerd</ContextMenuItem>
     </ContextMenuContent>
   </ContextMenu>
   ```

4. **Herbruikbare helper**: Een `renderDailyStatusMenu` functie die de vier menu-items rendert met iconen, labels en een visuele markering van de huidige status.

### Items die gewrapped worden
- Ambulancerit items (regel ~494-534)
- Gascilinder items - zowel enkelvoudige als gegroepeerde klant-items (regel ~567-614)
- Droogijs items (regel ~633-657)
- Taak items (regel ~677-699)
