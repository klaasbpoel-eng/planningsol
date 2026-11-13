-- Reference/settings tables: only approved staff may read
DROP POLICY IF EXISTS "Authenticated users can view settings" ON public.app_settings;
CREATE POLICY "Approved users can view settings" ON public.app_settings
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view afname" ON public.afname;
CREATE POLICY "Approved users can view afname" ON public.afname
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated can view stock products" ON public.stock_products;
CREATE POLICY "Approved users can view stock products" ON public.stock_products
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view voorraad" ON public.voorraad;
CREATE POLICY "Approved users can view voorraad" ON public.voorraad
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated can view gas_packages" ON public.gas_packages;
CREATE POLICY "Approved users can view gas_packages" ON public.gas_packages
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view customer_locations" ON public.customer_locations;
CREATE POLICY "Approved users can view customer_locations" ON public.customer_locations
  FOR SELECT TO authenticated USING (public.is_user_approved() OR public.is_admin());

-- Toolbox sessions: managed by admins and supervisors only
DROP POLICY IF EXISTS "Enable read access for all users" ON public.toolbox_sessions;
DROP POLICY IF EXISTS "Enable insert for authenticated users (admins/supervisors manag" ON public.toolbox_sessions;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.toolbox_sessions;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.toolbox_sessions;

CREATE POLICY "Managers can view toolbox sessions" ON public.toolbox_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Managers can create toolbox sessions" ON public.toolbox_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((public.is_admin() OR public.has_role(auth.uid(), 'supervisor')) AND created_by = auth.uid());
CREATE POLICY "Managers can update toolbox sessions" ON public.toolbox_sessions
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Managers can delete toolbox sessions" ON public.toolbox_sessions
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));

-- Toolbox session participants: managers manage; staff may see their own attendance
DROP POLICY IF EXISTS "Enable read access for all users" ON public.toolbox_session_participants;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.toolbox_session_participants;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.toolbox_session_participants;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.toolbox_session_participants;

CREATE POLICY "Managers or participant can view participants" ON public.toolbox_session_participants
  FOR SELECT TO authenticated
  USING (
    public.is_admin() OR public.has_role(auth.uid(), 'supervisor')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = toolbox_session_participants.profile_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Managers can add participants" ON public.toolbox_session_participants
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Managers can update participants" ON public.toolbox_session_participants
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'))
  WITH CHECK (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Managers can delete participants" ON public.toolbox_session_participants
  FOR DELETE TO authenticated
  USING (public.is_admin() OR public.has_role(auth.uid(), 'supervisor'));

-- Toolbox files: only admins/supervisors may change or remove files
DROP POLICY IF EXISTS "Allow authenticated update/delete" ON storage.objects;
CREATE POLICY "Toolbox managers can update files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'toolbox-files' AND (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')))
  WITH CHECK (bucket_id = 'toolbox-files' AND (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')));
CREATE POLICY "Toolbox managers can delete files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'toolbox-files' AND (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')));