

## Plan: PGS Register UI/UX professionaliseren

### Verbeteringen

**1. Samenvattingskaarten bovenaan (KPI strip)**
Vier stat-cards boven de tabel met:
- Totaal geregistreerde stoffen
- Stoffen met status OK (groen)
- Stoffen >80% bezetting (oranje waarschuwing)
- Stoffen >95% bezetting (rood kritiek)

Gebruikt bestaande `stat-card` component of mini-cards met iconen en kleuren.

**2. GHS-pictogrammen verbeteren**
Huidige vierkante gekleurde blokjes vervangen door diamantvormige (45° geroteerde) badges — conform de officiële GHS-standaard. Rode rand voor gevaar, witte achtergrond met gekleurde symboolindicator.

**3. Verbeterde tabelweergave**
- Alternating row colors voor betere leesbaarheid
- Sticky header zodat de kolomkoppen zichtbaar blijven bij scrollen
- Subtielere rij-expansie animatie via framer-motion `AnimatePresence`
- Betere visuele hiërarchie: gastype groter/duidelijker, PGS-badge met kleurcodering per richtlijn

**4. Zoekfunctie toevoegen**
Tekstzoekveld om op gasnaam, UN-nummer of CAS-nummer te filteren.

**5. Sorteerbare kolommen**
Klikbare kolomkoppen om te sorteren op gasnaam, PGS-richtlijn, bezettingspercentage, etc. Visuele sort-indicator (pijltje).

**6. Verbeterde expanded row details**
De collapsible details per stof mooier structureren met:
- Gegroepeerde secties (Identificatie, Opslag, Veiligheid) met subtiele scheidingslijnen
- H-zinnen en P-zinnen als aparte badges/chips in plaats van plain text
- Kleurcodering: H-zinnen rood, P-zinnen blauw

**7. Locatie-tabs of segmented control**
Als er data voor beide locaties is, een tabstrip bovenaan: "Alle locaties" / "SOL Emmen" / "SOL Tilburg" — in plaats van alleen het filter-dropdown.

**8. Lege state verbeteren**
Professionelere empty state met icoon en beschrijvende tekst + actie-knop.

### Bestanden
- Alleen `src/components/production/PGSRegistry.tsx`

### Aanpak
Eén bestand, alle verbeteringen in één pass. Geen database-wijzigingen nodig.

