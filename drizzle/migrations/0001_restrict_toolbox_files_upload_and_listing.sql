DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Toolbox managers can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'toolbox-files' AND (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')));

-- Public bucket: files stay reachable via their public URL; only managers may list/query objects.
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
CREATE POLICY "Toolbox managers can list files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'toolbox-files' AND (public.is_admin() OR public.has_role(auth.uid(), 'supervisor')));