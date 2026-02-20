

## Toolbox "Product stickers en medicinale stickers" vullen met PPTX-inhoud

### Wat wordt er gedaan
De bestaande toolbox (id: `08799245-...`, status: published) wordt gevuld met secties op basis van de 10 slides uit de geuploadde PowerPoint. De presentatie-afbeeldingen (page screenshots) worden gekopieerd naar het project en als image-secties toegevoegd, samen met tekst-secties voor de belangrijkste inhoud per slide.

### Sectie-indeling (10 secties, 1 per slide)

| # | Type | Titel | Inhoud |
|---|------|-------|--------|
| 0 | image | Titelpagina | Page 1 screenshot (titelpagina met SOL branding) |
| 1 | text | Medische cilinders: hoe hoort het? | Uitleg over batchsticker, productsticker en medicinaal label met RAL-kleuren |
| 2 | image | Slide 2 - Overzicht | Page 2 screenshot (visueel overzicht cilinder met labels) |
| 3 | text | Medische eigendomcilinders - voor wie? | Uitleg: Huisman, Air Liquide, Westfalen, SOL Duitsland. Medicinaal label altijd SOL, productsticker van eigenaar |
| 4 | image | Slide 3 - Labels eigenaren | Page 3 screenshot |
| 5 | text | Hoe zit het met eigendommers? | Productsticker van eigenaar, wat als deze ontbreekt of beschadigd is (1-2 stuks: SOL sticker, grote aantallen: non conform) |
| 6 | image | Slide 4 - Eigendommers | Page 4 screenshot |
| 7 | text | Medicinaal label controle | Label altijd van SOL (Duits/Nederlands/Spaans), controleren op versienummer en datum. Niet juist? Non conform melden |
| 8 | image | Slide 5 - Medicinaal labels | Page 5 screenshot |
| 9 | text | Wat zien we in de praktijk? | 4 praktijkproblemen: geen productstickers, onleesbaar/beschadigd, verkleurd (blauw ipv groen), beschadigde medicinale labels |
| 10 | image | Slide 6-9 - Praktijkvoorbeelden | Page screenshots van de praktijkvoorbeelden |
| 11 | text | Wat te doen? | Verantwoordelijkheid operator en shift-leader, non conform = niet vullen, overleggen. Logistiek en productieleider communiceren met klanten |
| 12 | checklist | Controlestappen | Checklist: productsticker aanwezig, productsticker leesbaar, medicinaal label correct, medicinaal label leesbaar, juiste versienummer |

### Technisch

1. **Afbeeldingen kopieren**: De page screenshots uit `parsed-documents://` kopieren naar `public/toolbox-images/stickers/`
2. **Afbeeldingen uploaden naar storage**: De afbeeldingen uploaden naar de `toolbox-files` storage bucket zodat ze een publieke URL krijgen
3. **Secties aanmaken**: Via de `toolbox_sections` tabel de 13 secties invoegen met de juiste `toolbox_id`, `section_type`, `title`, `content` en `sort_order`

### Bestanden die gewijzigd worden

| Bestand/Actie | Wijziging |
|---|---|
| `public/toolbox-images/stickers/` | Nieuwe map met slide-screenshots |
| Database: `toolbox_sections` | 13 nieuwe rijen voor toolbox `08799245-...` |

