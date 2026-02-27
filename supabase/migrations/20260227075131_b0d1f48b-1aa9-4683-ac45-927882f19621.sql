ALTER TABLE public.ambulance_trips 
  ADD COLUMN cylinders_1l_pindex_o2 integer NOT NULL DEFAULT 0,
  ADD COLUMN cylinders_10l_o2_integrated integer NOT NULL DEFAULT 0,
  ADD COLUMN cylinders_5l_air_integrated integer NOT NULL DEFAULT 0,
  ADD COLUMN cylinders_2l_air_integrated integer NOT NULL DEFAULT 0;