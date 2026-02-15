

## Duplicaten in cilindergroottes opschonen

### Probleem
Er zijn dubbele cilindergroottes in de database met inconsistente naamgeving (met en zonder spaties):

| Naam (met spaties) | Orders | Naam (zonder spaties) | Orders |
|---|---|---|---|
| PP 12 X 40L | 1 | PP 12x40L | 0 |
| PP 12 X 50L | 2 | PP 12x50L | 1 |
| PP 16 X 40L | 0 | PP 16x40L | 0 |
| PP 16 X 50L | 30 | PP 16x50L | 5 |

### Oplossing
We standaardiseren op het compacte formaat **zonder spaties** (bijv. `PP 16x50L`) omdat deze de lagere sort_order hebben (= bewust geconfigureerd). De stappen:

1. **Orders migreren**: Alle bestaande orders die de "spatie-variant" gebruiken worden bijgewerkt naar het compacte formaat
2. **Duplicaten verwijderen**: De overbodige entries met spaties worden uit de `cylinder_sizes` tabel verwijderd
3. **Geen code-aanpassingen nodig**: De UI haalt de namen dynamisch uit de database

### Technische details

**Database migratie (SQL)**:
- `UPDATE gas_cylinder_orders` om `cylinder_size` van de spatie-variant naar de compacte variant te wijzigen voor alle 4 paren
- `DELETE FROM cylinder_sizes` voor de 4 overbodige rijen (PP 12 X 40L, PP 12 X 50L, PP 16 X 40L, PP 16 X 50L)

De unieke maten zonder duplicaat (PP 6 X 50L, PP 18 X 40L, PP 18 X 50L) worden niet aangepast, tenzij je ook die wilt standaardiseren. Ze hebben momenteel geen compact-equivalent.

