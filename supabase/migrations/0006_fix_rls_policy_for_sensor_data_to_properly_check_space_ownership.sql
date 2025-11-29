-- Drop all existing policies for sensor_data
DROP POLICY IF EXISTS "sensor_data_select_policy" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_insert_policy" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_update_policy" ON sensor_data;
DROP POLICY IF EXISTS "sensor_data_delete_policy" ON sensor_data;

-- Create new policies with proper checks
CREATE POLICY "sensor_data_select_policy" ON sensor_data 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

CREATE POLICY "sensor_data_insert_policy" ON sensor_data 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

CREATE POLICY "sensor_data_update_policy" ON sensor_data 
FOR UPDATE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

CREATE POLICY "sensor_data_delete_policy" ON sensor_data 
FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);