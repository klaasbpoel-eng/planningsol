
-- Ambulance trips table
CREATE TABLE public.ambulance_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_date DATE NOT NULL,
  cylinders_2l_300_o2 INTEGER NOT NULL DEFAULT 0,
  cylinders_5l_o2_integrated INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

-- Ambulance trip customers table
CREATE TABLE public.ambulance_trip_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.ambulance_trips(id) ON DELETE CASCADE,
  customer_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ambulance_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_trip_customers ENABLE ROW LEVEL SECURITY;

-- RLS policies for ambulance_trips
CREATE POLICY "Admins can view all ambulance trips" ON public.ambulance_trips FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can create ambulance trips" ON public.ambulance_trips FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update ambulance trips" ON public.ambulance_trips FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete ambulance trips" ON public.ambulance_trips FOR DELETE USING (public.is_admin());
CREATE POLICY "Operators can view ambulance trips" ON public.ambulance_trips FOR SELECT USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Supervisors can view ambulance trips" ON public.ambulance_trips FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));

-- RLS policies for ambulance_trip_customers
CREATE POLICY "Admins can view all trip customers" ON public.ambulance_trip_customers FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can create trip customers" ON public.ambulance_trip_customers FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update trip customers" ON public.ambulance_trip_customers FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete trip customers" ON public.ambulance_trip_customers FOR DELETE USING (public.is_admin());
CREATE POLICY "Operators can view trip customers" ON public.ambulance_trip_customers FOR SELECT USING (public.has_role(auth.uid(), 'operator'));
CREATE POLICY "Supervisors can view trip customers" ON public.ambulance_trip_customers FOR SELECT USING (public.has_role(auth.uid(), 'supervisor'));
