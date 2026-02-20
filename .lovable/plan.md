

## Fix: UUID-fout bij sessie registratie

### Probleem
Bij het registreren van een sessie worden completions aangemaakt voor alle deelnemers. Profielen zonder gekoppeld gebruikersaccount hebben geen `user_id`, waardoor een lege string `""` als UUID wordt ingevoegd -- dit geeft de fout "invalid input syntax for type uuid".

### Oplossing
In `src/hooks/useToolbox.ts` (regel 468-478): filter deelnemers zonder geldige `userId` uit voordat de completions worden aangemaakt. Alleen gebruikers met een echt account kunnen een completion-record krijgen.

### Technisch detail

| Bestand | Wijziging |
|---|---|
| `src/hooks/useToolbox.ts` | Bij stap 3 (regel 469-478): filter `participants` op niet-lege `userId` voordat de upsert naar `toolbox_completions` wordt gedaan |

Concreet wordt de upsert-array gewijzigd van:
```
participants.map(p => ({ ... }))
```
naar:
```
participants.filter(p => p.userId).map(p => ({ ... }))
```

Dit zorgt ervoor dat profielen zonder gebruikersaccount wel als deelnemer worden geregistreerd (in `toolbox_session_participants`), maar geen completion-record krijgen (omdat er geen gebruiker aan gekoppeld is).
