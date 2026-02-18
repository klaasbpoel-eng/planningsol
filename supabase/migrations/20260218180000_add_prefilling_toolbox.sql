-- Create a new toolbox: "Veiligheidstraining Prefilling Checks"
DO $$
DECLARE
  v_toolbox_id uuid;
  v_base_order integer := 0;
BEGIN
  -- 1. Insert the Toolbox
  INSERT INTO public.toolboxes (
    title,
    description,
    category,
    cover_image_url,
    estimated_duration_minutes,
    is_mandatory,
    status,
    published_at
  ) VALUES (
    'Toolbox Meeting — Veiligheidstraining Prefilling Checks',
    'Leer welke controles je moet uitvoeren vóórdat je een cilinder of pakket vult. Voorkomen is beter dan genezen.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?auto=format&fit=crop&q=80&w=2000', -- Placeholder image of cylinder inspection
    10,
    true,
    'published',
    now()
  ) RETURNING id INTO v_toolbox_id;

  -- 2. Insert Sections

  -- Sectie 1: Opening
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Waarom zijn prefilling checks belangrijk?',
    E'**"Een collega sloot vorige maand een cilinder aan die een beschadigd ventiel had. Gelukkig werd dit op tijd opgemerkt. Maar stel dat het niet was gezien..."**\n\nPrefilling checks zijn je laatste verdedigingslinie vóórdat het vulproces begint. Fouten die je hier mist, zijn tijdens het vullen niet meer te corrigeren.\n\nEr zijn drie hoofdredenen:\n\n1.  **Veiligheid**: voorkomen van lekkage, brand en explosie\n2.  **Kwaliteit**: juiste gas in de juiste cilinder\n3.  **Wettelijke verplichting**: voldoen aan ADR/PED-regelgeving\n\nIn deze toolbox leer je stap voor stap welke controles je doet en waarom.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Prefilling check in beeld',
    'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&q=80&w=2000', -- Placeholder: cylinder inspection/filling station
    v_base_order + 2
  );

  -- Sectie 3: Wat zijn prefilling checks?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat zijn prefilling checks?',
    E'Prefilling checks gelden voor alle controles die je uitvoert vóórdat je de cilinder aansluit op de vulinstallatie. Net als een piloot die vóór het opstijgen zijn checklist afwerkt. Geen stap overslaan.\n\nWe delen de controles in drie categorieën in:\n\n1.  🔍 **Visuele inspectie** — de buitenkant en staat van de cilinder\n2.  🔧 **Ventiel- en aansluitcontrole** — functioneert alles correct?\n3.  📝 **Identificatiecontrole** — klopt het label, de kleurcodering en de gassoort?\n\nEen prefilling check duurt maar een paar minuten, maar kan een ernstig incident voorkomen.',
    v_base_order + 3
  );

  -- Sectie 4: Visuele inspectie
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Stap 1: Visuele inspectie van de cilinder',
    '[
      {"text": "De cilinder heeft geen zichtbare deuken, scheuren of corrosie"},
      {"text": "De voetring zit stevig en is niet verbogen"},
      {"text": "De kleurcodering op de schouder is intact en leesbaar"},
      {"text": "Het label/sticker met gassoort en eigenaar is aanwezig"},
      {"text": "De keuringsdatum is nog geldig (niet verlopen)"},
      {"text": "De cilinder heeft een beschermkap of het ventiel is onbeschadigd"},
      {"text": "Er zijn geen brandsporen, verfblaren of hitteverkleuring zichtbaar"},
      {"text": "De cilinder is niet afkomstig van een onbekende bron (herkomst is traceerbaar)"}
    ]',
    v_base_order + 4
  );

  -- Sectie 5: Ventiel- en aansluitcontrole
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Stap 2: Ventiel en aansluiting controleren',
    '[
      {"text": "Het ventiel zit stevig en is niet scheef of beschadigd"},
      {"text": "De ventieldraad is schoon en onbeschadigd (geen kapotte schroefdraad)"},
      {"text": "De O-ring of pakking is aanwezig en in goede staat"},
      {"text": "Het ventiel is vetvrij (vooral bij zuurstofcilinders!)"},
      {"text": "Het ventiel kan soepel open en dicht worden gedraaid (niet vastgeroest)"},
      {"text": "De ventielaansluiting past bij de gassoort (juiste type: DIN 477, CGA, etc.)"},
      {"text": "Er zit geen vuil, stof of vocht in de ventielopening"}
    ]',
    v_base_order + 5
  );

  -- Sectie 6: Identificatiecontrole
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Stap 3: Identificatie en gassoort controleren',
    '[
      {"text": "De gassoort op het label komt overeen met de kleurcodering op de schouder"},
      {"text": "De cilinder is bestemd voor de juiste vulramp (controleer gassoort vs. vulpositie)"},
      {"text": "Het cilindernummer is leesbaar en geregistreerd in het systeem"},
      {"text": "De cilinder is niet geblokkeerd of afgekeurd in het systeem"},
      {"text": "Bij pakketten: alle cilinders in het frame zijn van dezelfde gassoort"},
      {"text": "De restdruk is gecontroleerd (cilinder mag niet in vacuüm staan, tenzij voorgeschreven)"}
    ]',
    v_base_order + 6
  );

  -- Sectie 7: Wat doe je als iets niet klopt?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🛑 Afgekeurd? Dit doe je dan.',
    E'**STOP — sluit de cilinder NIET aan.**\n\nAls een cilinder niet aan de eisen voldoet, volg je deze procedure:\n\n1.  **Markeer** de cilinder als afgekeurd (gebruik een rode sticker of label).\n2.  **Zet** de cilinder apart op de daarvoor bestemde plek.\n3.  **Meld** de afkeuring bij je leidinggevende en registreer het in het systeem.\n4.  **Werk door** met de volgende cilinder.\n\n**Een afgekeurde cilinder is geen fout van jou, maar juist goed werk.**\n\nVeelvoorkomende afkeurredenen:\n*   Verlopen keuring\n*   Beschadigd ventiel\n*   Ontbrekend label\n*   Deuken of corrosie\n*   Verkeerde kleurcodering',
    v_base_order + 7
  );

  -- Sectie 8: Totaalchecklist
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Totaalchecklist: Klaar om te vullen?',
    '[
      {"text": "Ik heb de cilinder visueel geïnspecteerd (geen schade, corrosie of brandsporen)"},
      {"text": "De keuringsdatum is nog geldig"},
      {"text": "Het ventiel is intact, schoon en vetvrij"},
      {"text": "De O-ring/pakking is aanwezig en in goede staat"},
      {"text": "De gassoort op het label komt overeen met de kleurcodering"},
      {"text": "De cilinder past bij de juiste vulramp"},
      {"text": "Het cilindernummer is geregistreerd en niet geblokkeerd"},
      {"text": "Bij twijfel heb ik de cilinder afgekeurd en apart gezet"}
    ]',
    v_base_order + 8
  );

  -- Sectie 9: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis',
    '[
      {
        "question": "Wat is het doel van een prefilling check?",
        "options": ["De cilinder mooier maken", "Controleren of de cilinder veilig en geschikt is om te vullen", "De cilinder wegen", "Tijd rekken"],
        "correct": 1
      },
      {
        "question": "Wat controleer je als eerste bij een visuele inspectie?",
        "options": ["Of de cilinder de juiste kleur verf heeft", "Of er deuken, scheuren of corrosie zichtbaar zijn", "Of de cilinder vol genoeg is", "Of het label er mooi uitziet"],
        "correct": 1
      },
      {
        "question": "Waarom moet het ventiel van een zuurstofcilinder vetvrij zijn?",
        "options": ["Omdat het er netter uitziet", "Omdat het ventiel anders vastloopt", "Omdat vet in combinatie met zuurstof spontaan kan ontbranden", "Dat maakt niet uit"],
        "correct": 2
      },
      {
        "question": "Wat doe je als de keuringsdatum van een cilinder verlopen is?",
        "options": ["Gewoon vullen, maakt niet uit", "Zelf een nieuw label maken", "De cilinder afkeuren, markeren en apart zetten", "De datum doorstrepen en een nieuwe schrijven"],
        "correct": 2
      },
      {
        "question": "Wanneer mag je een cilinder aansluiten op de vulinstallatie?",
        "options": ["Altijd, als je haast hebt", "Alleen als je leidinggevende erbij staat", "Pas nadat alle prefilling checks zijn uitgevoerd en goedgekeurd", "Als de vorige cilinder klaar is"],
        "correct": 2
      }
    ]',
    v_base_order + 9
  );

  -- Sectie 10: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Tot slot',
    E'**"Elke cilinder die je controleert, is een incident dat je voorkomt."**\n\nEen goede prefilling check kost maar een paar minuten, maar beschermt jou, je collega''s en de klant. Jij bent de laatste check voordat het gas de cilinder in gaat. Dat maakt jouw rol essentieel.\n\nHeb je vragen? Vraag het je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 10
  );

END $$;
