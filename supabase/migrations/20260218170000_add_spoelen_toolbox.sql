-- Create a new toolbox: "Spoelen van cilinders en pakketten"
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
    'Toolbox Meeting — Spoelen van cilinders en pakketten',
    'Leer waarom, wanneer en hoe je cilinders en pakketten correct spoelt voor een veilig en zuiver vulproces.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&q=80&w=2000', -- Placeholder image of industrial/lab setting
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
    'Waarom is spoelen belangrijk?',
    E'**"Vorige week zat er nog restgas in een cilinder die als leeg was aangemerkt. Bij het vullen met een ander gas had dit tot een gevaarlijke reactie kunnen leiden."**\n\nSpoelen (purgen) zorgt ervoor dat restgas, vocht en verontreinigingen worden verwijderd. Dit beschermt tegen:\n\n*   **Contaminatie** van het product\n*   **Gevaarlijke gasmengsels**\n*   **Klachten** van klanten\n\nIn deze toolbox leer je precies wanneer en hoe je spoelt.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Spoelproces in beeld',
    'https://images.unsplash.com/photo-1617128711470-36605a96864d?auto=format&fit=crop&q=80&w=2000', -- Placeholder: gas regulation/pipes
    v_base_order + 2
  );

  -- Sectie 3: Wat is spoelen?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat is spoelen (purgen)?',
    E'Spoelen is het meerdere keren vullen en legen van een cilinder met een inert gas (meestal stikstof) om restgas en verontreinigingen te verwijderen. Denk aan het uitspoelen van een fles voordat je er iets anders in doet.\n\nEr zijn twee hoofdredenen:\n1.  **Veiligheid**: voorkomen van gevaarlijke gasmengsels (bijv. zuurstof + brandbaar gas).\n2.  **Kwaliteit**: een zuiver product voor de klant.\n\n**Let op:** Bij een pakket (meerdere cilinders aan één frame) moet je **alle cilinders EN de manifold** spoelen.',
    v_base_order + 3
  );

  -- Sectie 4: Wanneer moet je spoelen?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Wanneer is spoelen nodig?',
    '[
      {"text": "Na een gassoortwissel (cilinder krijgt een ander gas dan voorheen)"},
      {"text": "Na een reparatie aan het ventiel of de cilinder"},
      {"text": "Bij cilinders die lang niet gebruikt zijn (> 6 maanden)"},
      {"text": "Na een herkeuring (TÜV/periodieke keuring)"},
      {"text": "Bij nieuwe cilinders die voor het eerst in gebruik worden genomen"},
      {"text": "Bij cilinders waar vocht of vuil is aangetroffen"},
      {"text": "Bij pakketten waarvan de manifold is losgekoppeld of vervangen"},
      {"text": "Bij twijfel over de inhoud of geschiedenis van de cilinder"}
    ]',
    v_base_order + 4
  );

  -- Sectie 5: Hoe spoel je correct?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Stap-voor-stap: Zo spoel je een cilinder',
    E'1.  **Controleer de cilinder:** is het ventiel in orde? Is de cilinder visueel intact?\n2.  **Sluit de cilinder aan** op de spoelinstallatie.\n3.  **Vul de cilinder** met stikstof tot de voorgeschreven druk (volgens werkvoorschrift).\n4.  **Wacht even** zodat het gas zich mengt met eventueel restgas.\n5.  **Blaas af** — laat de druk gecontroleerd ontsnappen via de afblaasleiding.\n6.  **Herhaal stap 3-5 minimaal 3 keer** (of volgens voorschrift).\n7.  **Meet** na de laatste spoeling het restgehalte met de gasanalysator (moet onder de grenswaarde liggen).\n8.  **Registreer** dat de cilinder is gespoeld in het systeem.\n\n**Bij pakketten:** spoel elke cilinder apart én de manifold. Vergeet de manifold niet!',
    v_base_order + 5
  );

  -- Sectie 6: Risico''s en gevaren
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '⚠️ Wat kan er misgaan?',
    E'**Onvoldoende gespoeld:**\nRestgas mengt met het nieuwe gas → gevaarlijke reactie of onzuiver product.\n\n**Verkeerd spoelgas:**\nGebruik ALTIJD het voorgeschreven spoelgas (meestal stikstof). Nooit spoelen met het doelgas zelf.\n\n**Geen meting achteraf:**\nZonder analyse weet je niet of de cilinder echt schoon is.\n\n**Manifold vergeten bij pakketten:**\nHet restgas in de manifold contamineert alle cilinders alsnog.\n\n**Spoelen in een afgesloten ruimte:**\nStikstof verdringt zuurstof → verstikkingsgevaar! Zorg voor ventilatie.',
    v_base_order + 6
  );

  -- Sectie 7: Veiligheidschecklist
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Veilig spoelen',
    '[
      {"text": "Ik heb gecontroleerd of de cilinder/het pakket gespoeld moet worden"},
      {"text": "Ik gebruik het juiste spoelgas (stikstof, tenzij anders voorgeschreven)"},
      {"text": "De werkruimte is goed geventileerd"},
      {"text": "Ik heb de spoelprocedure minimaal 3x herhaald"},
      {"text": "Ik heb de gasanalysator gebruikt om het restgehalte te meten"},
      {"text": "Het restgehalte zit onder de grenswaarde"},
      {"text": "Ik heb de spoeling geregistreerd in het systeem"},
      {"text": "Bij een pakket: ik heb ook de manifold gespoeld"}
    ]',
    v_base_order + 7
  );

  -- Sectie 8: Quiz
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'quiz',
    'Test je kennis',
    '[
      {
        "question": "Waarom spoel je een cilinder voordat je deze vult met een ander gas?",
        "options": ["Om de cilinder lichter te maken", "Om restgas en verontreinigingen te verwijderen", "Omdat het er beter uitziet", "Dat hoeft eigenlijk niet"],
        "correct": 1
      },
      {
        "question": "Hoe vaak moet je minimaal spoelen?",
        "options": ["1 keer is genoeg", "Minimaal 3 keer", "10 keer", "Maakt niet uit"],
        "correct": 1
      },
      {
        "question": "Wat gebruik je meestal als spoelgas?",
        "options": ["Zuurstof", "Acetyleen", "Stikstof", "Perslucht"],
        "correct": 2
      },
      {
        "question": "Wat is het gevaar van spoelen in een afgesloten ruimte?",
        "options": ["De cilinder kan exploderen", "Het duurt langer", "Stikstof verdringt zuurstof → verstikkingsgevaar", "Er is geen gevaar"],
        "correct": 2
      },
      {
        "question": "Wat moet je extra spoelen bij een pakket?",
        "options": ["Alleen de buitenkant", "Niets extra''s", "De manifold", "De labels"],
        "correct": 2
      }
    ]',
    v_base_order + 8
  );

  -- Sectie 9: Afsluiting
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Tot slot',
    E'**Goed spoelen = veilig vullen.**\n\nBij twijfel altijd overleggen met je leidinggevende of de kwaliteitsafdeling. Vakmanschap betekent dat we samen zorgen voor een veilig product en een veilige werkplek.\n\nHeb je vragen? Vraag het je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 9
  );

END $$;
