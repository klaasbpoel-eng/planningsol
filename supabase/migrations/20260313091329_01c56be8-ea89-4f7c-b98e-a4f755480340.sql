
CREATE TABLE public.voorraad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "DS_SUBCODE" text NOT NULL,
  "DS_CENTER_DESCRIPTION" text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.afname (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "SubCode" text NOT NULL,
  "SubCodeDescription" text NOT NULL,
  "CenterDescription" text NOT NULL,
  "Aantal" numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.voorraad ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afname ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view voorraad" ON public.voorraad FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage voorraad" ON public.voorraad FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Authenticated users can view afname" ON public.afname FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage afname" ON public.afname FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
