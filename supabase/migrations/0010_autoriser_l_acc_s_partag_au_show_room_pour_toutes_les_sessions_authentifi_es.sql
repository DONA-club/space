-- Partager le Show-room (spaces) pour lecture et mise à jour entre tous les utilisateurs authentifiés
CREATE POLICY "spaces_select_showroom_shared" ON public.spaces
FOR SELECT TO authenticated
USING (name = 'Show-room');

CREATE POLICY "spaces_update_showroom_shared" ON public.spaces
FOR UPDATE TO authenticated
USING (name = 'Show-room')
WITH CHECK (name = 'Show-room');

-- Rendre accessibles les données du Show-room (sensor_data) à tous les utilisateurs authentifiés
CREATE POLICY "sensor_data_select_showroom_shared" ON public.sensor_data
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = space_id
      AND s.name = 'Show-room'
  )
);

CREATE POLICY "sensor_data_insert_showroom_shared" ON public.sensor_data
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = space_id
      AND s.name = 'Show-room'
  )
);

CREATE POLICY "sensor_data_update_showroom_shared" ON public.sensor_data
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = space_id
      AND s.name = 'Show-room'
  )
);

-- Autoriser la lecture des fichiers du bucket 'models' par tous les utilisateurs authentifiés
CREATE POLICY "models_read_all_authenticated" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'models');