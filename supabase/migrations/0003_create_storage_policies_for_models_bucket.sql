-- Policy for uploading files
CREATE POLICY "Users can upload their own models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for downloading files
CREATE POLICY "Users can download their own models"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for deleting files
CREATE POLICY "Users can delete their own models"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);