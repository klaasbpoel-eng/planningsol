

# Navigatie-items verwijderen uit de topbar

De desktop navigatielinks (Kalender, Productie, Dagoverzicht, Bestellingen, Verlof, Vrijgaves, Toolbox, Barcode, Medewerkersweergave) worden verwijderd uit de header. Gebruikers navigeren via de Command Palette (Ctrl+K / zoekknop) die al alle pagina's bevat.

## Wat blijft behouden

- Logo + rol-badge (links)
- Zoekknop / Command Palette trigger (rechts)
- Thema-toggle
- Notificatiebel
- Gebruikersnaam + uitlogknop (desktop)
- Hamburger-menu (mobiel) -- dit blijft beschikbaar als fallback-navigatie

## Wat wordt verwijderd

- De volledige `DesktopNav` component (navigatielinks in het midden van de header)
- De bijbehorende `NAV_GROUPS` constante, `DesktopNavLink` component, en `isActive` helper worden verwijderd als ze niet meer door de mobiele navigatie gebruikt worden

**Let op**: De mobiele Sheet-navigatie (`MobileNav`) blijft bestaan zodat gebruikers op telefoon nog steeds via een menu kunnen navigeren zonder het toetsenbord.

## Technisch

### Bestand: `src/components/layout/Header.tsx`

1. Verwijder de `DesktopNav` component-definitie (regels 125-160)
2. Verwijder de `<DesktopNav />` aanroep in de render (regel 256)
3. Verwijder ongebruikte imports: `Separator`, `Tooltip`/`TooltipProvider`/`TooltipTrigger`/`TooltipContent` (als alleen door DesktopNav gebruikt)
4. Verwijder de `DesktopNavLink` component (regels 95-123)
5. De `NAV_GROUPS`, `isActive`, en gerelateerde imports (`CalendarDays`, `Factory`, etc.) blijven omdat `MobileNav` ze nog gebruikt
