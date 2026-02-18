-- Create a new toolbox: "Veiligheidstraining Inerte Gassen"
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
    'Toolbox Meeting — Veiligheidstraining Inerte Gassen',
    'Leer wat inerte gassen zijn, waarom ze onzichtbaar gevaarlijk zijn en hoe je jezelf en je collega''s beschermt tegen verstikking.',
    'Veiligheid',
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=2000', -- Placeholder image of gas cylinders/industrial setting
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
    'Waarom is dit belangrijk?',
    E'**"Een monteur stapte een afgesloten ruimte in waar stikstof was gebruikt om te spoelen. Binnen 30 seconden werd hij bewusteloos. Zonder zijn collega die alarm sloeg, had hij het niet overleefd."**\n\nInerte gassen zijn kleurloos, reukloos en smaakloos — je merkt niets totdat het te laat is. Dit is hun gevaarlijkste eigenschap: je lichaam geeft geen waarschuwing.\n\nElk jaar gebeuren er wereldwijd dodelijke ongevallen door zuurstofverdringing met inerte gassen. In deze toolbox leer je wat ze doen, waar het gevaar zit en hoe je jezelf beschermt.',
    v_base_order + 1
  );

  -- Sectie 2: Afbeelding
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'image',
    'Onzichtbaar gevaar',
    'https://images.unsplash.com/photo-1595246140625-573b715e11d3?auto=format&fit=crop&q=80&w=2000', -- Placeholder for warning sign/confined space
    v_base_order + 2
  );

  -- Sectie 3: Wat zijn inerte gassen?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Wat zijn inerte gassen?',
    E'Inert betekent "niet-reactief". Deze gassen reageren niet met andere stoffen. Denk aan een stille gast op een feest. Hij doet niets, maar als hij alle ruimte inneemt, is er geen plek meer voor zuurstof.\n\nVeelvoorkomende inerte gassen op de werkvloer:\n\n*   **Stikstof (N₂)** — het meest gebruikt, ook als spoelgas\n*   **Argon (Ar)** — veel gebruikt bij het lassen en als beschermgas\n*   **Helium (He)** — voor lekdetectie en speciale toepassingen\n*   **CO₂** — technisch geen inert gas, maar verdringt ook zuurstof (en is in hoge concentratie giftig)\n\nDeze gassen zijn op zich niet giftig, maar ze **verdringen de zuurstof** in de lucht — en dát is het gevaar.',
    v_base_order + 3
  );

  -- Sectie 4: Waarom zijn ze gevaarlijk?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🫁 Het onzichtbare gevaar: zuurstofverdringing',
    E'Normale lucht bevat **20,9% zuurstof**. Bij verdringing gaat het snel:\n\n*   **19%:** Verminderd beoordelingsvermogen (maar je voelt je nog prima!)\n*   **16%:** Duizeligheid en hoofdpijn\n*   **12%:** Bewusteloosheid — binnen enkele seconden\n*   **<8%:** Dodelijk — binnen minuten\n\n**Je ruikt het niet, je proeft het niet, je ziet het niet. Je lichaam geeft GEEN waarschuwing.**\n\n**Let op gewicht:**\n*   **Argon en CO₂** zijn zwaarder dan lucht → zakken naar beneden (gevaar in putten/kelders).\n*   **Helium** is lichter → stijgt op (gevaar onder plafonds).\n*   **Stikstof** is bijna even zwaar als lucht → mengt zich snel.',
    v_base_order + 4
  );

  -- Sectie 5: Risicosituaties
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Risicosituaties op de werkvloer',
    '[
      {"text": "Afgesloten of slecht geventileerde ruimtes (opslagruimtes, kelders, containers)"},
      {"text": "Bij het spoelen van cilinders of pakketten met stikstof"},
      {"text": "Na een lekkage aan een cilinder, leiding of aansluiting"},
      {"text": "In de buurt van open cilinderventiel of afblaasleiding"},
      {"text": "Bij het aftappen van vloeibaar stikstof of argon (verdampt en verdringt lucht)"},
      {"text": "In ruimtes waar veel cilinders tegelijk staan opgeslagen"},
      {"text": "Bij het werken in een put, sleuf of verdieping onder maaiveld"},
      {"text": "Na het ventileren of testen van installaties met inert gas"}
    ]',
    v_base_order + 5
  );

  -- Sectie 6: Hoe herken je het gevaar?
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    'Signalen en waarschuwingen',
    E'Omdat je het gas zelf niet waarneemt, moet je letten op indirecte signalen:\n\n🔔 **Zuurstofmelder slaat alarm** — neem dit ALTIJD serieus, ook als je "niets merkt".\n🥴 **Collega gedraagt zich vreemd** — duizelig, verward of slaperig.\n💨 **Sissend geluid** bij een leiding of cilinder (gaslekkage).\n🧊 **IJsvorming** op leidingen of cilinders (ontsnappend vloeibaar gas).\n🕳️ **Werken in een lage of afgesloten ruimte** zonder meting = altijd verdacht.\n\n**Vertrouw je zuurstofmeter, niet je gevoel.**',
    v_base_order + 6
  );

  -- Sectie 7: Noodprocedure
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'text',
    '🚨 NOODPROCEDURE: Zuurstofverdringing',
    E'1.  **GA NIET ZELF de ruimte in** als je vermoedt dat er te weinig zuurstof is.\n2.  **WAARSCHUW** collega''s en druk op de noodknop.\n3.  **BEL** de bedrijfshulpverlening of 112.\n4.  **VENTILEER** de ruimte indien mogelijk van buitenaf.\n5.  **WACHT** op hulp met adembescherming (persluchtmasker).\n\n**Regel nummer 1: Word NOOIT zelf het tweede slachtoffer. Hoe moeilijk dat ook is.**',
    v_base_order + 7
  );

  -- Sectie 8: Beschermingsmaatregelen
  INSERT INTO public.toolbox_sections (toolbox_id, section_type, title, content, sort_order)
  VALUES (
    v_toolbox_id,
    'checklist',
    'Checklist: Veilig werken met inerte gassen',
    '[
      {"text": "Ik draag een persoonlijke zuurstofmeter als ik werk in een risicogebied"},
      {"text": "Ik controleer of de zuurstofmeter geladen en gekalibreerd is vóór aanvang werk"},
      {"text": "Ik werk nooit alleen in een afgesloten of slecht geventileerde ruimte"},
      {"text": "Ik zorg voor voldoende ventilatie bij het spoelen of aftappen van inert gas"},
      {"text": "Ik ken de locatie van de noodknop en de nooduitgang"},
      {"text": "Ik weet waar de persluchtmaskers (adembescherming) zich bevinden"},
      {"text": "Ik sluit het cilinderventiel direct na gebruik en laat het niet onnodig open staan"},
      {"text": "Ik meld lekkages direct en probeer ze niet zelf op te lossen in een afgesloten ruimte"}
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
        "question": "Wat is het grootste gevaar van inerte gassen?",
        "options": ["Ze zijn giftig", "Ze kunnen exploderen", "Ze verdringen zuurstof zonder dat je het merkt", "Ze ruiken slecht"],
        "correct": 2
      },
      {
        "question": "Bij welk zuurstofpercentage raak je bewusteloos?",
        "options": ["20%", "18%", "Rond 12%", "5%"],
        "correct": 2
      },
      {
        "question": "Wat doe je als EERSTE als je vermoedt dat een collega bewusteloos is door zuurstoftekort?",
        "options": ["Direct de ruimte in rennen om te helpen", "Afwachten of hij zelf bijkomt", "NIET naar binnen gaan en alarm slaan / 112 bellen", "De deur dichtdoen om het gas binnen te houden"],
        "correct": 2
      },
      {
        "question": "Welk gas is zwaarder dan lucht en zakt dus naar beneden?",
        "options": ["Helium", "Stikstof", "Argon", "Waterstof"],
        "correct": 2
      },
      {
        "question": "Wanneer mag je een zuurstofmeteralarm negeren?",
        "options": ["Als je haast hebt", "Als je niets ruikt", "Als je collega zegt dat het goed is", "Nooit — een alarm is altijd serieus"],
        "correct": 3
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
    E'**Inerte gassen zijn stille killers.**\n\nJe enige bescherming is kennis en je zuurstofmeter. Bij twijfel: altijd meten en nooit alleen een afgesloten ruimte betreden.\n\nDoor alert te zijn bescherm je niet alleen jezelf, maar ook je collega''s. Dat is waar teamwork écht om draait.\n\nHeb je vragen? Vraag het je leidinggevende of de veiligheidscoördinator.',
    v_base_order + 10
  );

END $$;
