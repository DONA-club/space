-- Drop existing INSERT policy
DROP POLICY IF EXISTS "sensor_data_insert_policy" ON sensor_data;

-- Create new INSERT policy that allows authenticated users to insert data for their spaces
CREATE POLICY "sensor_data_insert_policy" ON sensor_data 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);