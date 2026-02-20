

## Fix: Toolbox pagina crash + VrijgavesPage build error

### Probleem 1: Toolbox pagina crash ("Er is iets misgegaan")
De crash wordt veroorzaakt door een lege string als `value` in een Select-item in `ToolboxSessionDialog.tsx` (regel 258):

```
<SelectItem value="">-- Geen / Onbekend --</SelectItem>
```

Radix UI staat geen lege string toe als waarde voor `Select.Item`. Dit gooit een fout die door de ErrorBoundary wordt opgevangen, waardoor de hele `/toolbox` pagina crasht -- zelfs als de dialoog niet open is, omdat het component al in de DOM wordt geladen.

**Oplossing**: Verander de lege string naar een placeholder waarde zoals `"none"` en pas de logica aan zodat `"none"` als "geen instructeur" wordt behandeld.

| Bestand | Wijziging |
|---------|-----------|
| `src/components/toolbox/ToolboxSessionDialog.tsx` | `value=""` wijzigen naar `value="none"`, en bij submit `"none"` omzetten naar `null` |

### Probleem 2: VrijgavesPage build error
De TypeScript fout meldt dat `canvas` ontbreekt in de `render()` parameters. Nieuwere versies van `pdfjs-dist` vereisen dat het `canvas` element expliciet wordt meegegeven.

**Oplossing**: Voeg `canvas` toe aan het render-object op regel 95.

| Bestand | Wijziging |
|---------|-----------|
| `src/pages/VrijgavesPage.tsx` | `canvas` property toevoegen aan het `page.render()` object |

