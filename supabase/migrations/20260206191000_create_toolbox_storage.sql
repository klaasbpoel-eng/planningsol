-- Create a new storage bucket for toolbox files
INSERT INTO storage.buckets (id, name, public)
VALUES ('toolbox-files', 'toolbox-files', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'toolbox-files');

-- Policy to allow public access to view files
CREATE POLICY "Allow public read access"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'toolbox-files');

-- Policy to allow authenticated users to update/delete their uploads (or all for simplicity in this app)
CREATE POLICY "Allow authenticated update/delete"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'toolbox-files')
WITH CHECK (bucket_id = 'toolbox-files');
