-- Create sensor_data table
CREATE TABLE public.sensor_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE NOT NULL,
  sensor_id INTEGER NOT NULL,
  sensor_name TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  temperature DOUBLE PRECISION,
  humidity DOUBLE PRECISION,
  absolute_humidity DOUBLE PRECISION,
  dew_point DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(space_id, sensor_id, timestamp)
);

-- Enable RLS
ALTER TABLE public.sensor_data ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "sensor_data_select_policy" ON public.sensor_data 
FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

CREATE POLICY "sensor_data_insert_policy" ON public.sensor_data 
FOR INSERT TO authenticated 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

CREATE POLICY "sensor_data_delete_policy" ON public.sensor_data 
FOR DELETE TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.spaces 
    WHERE spaces.id = sensor_data.space_id 
    AND spaces.user_id = auth.uid()
  )
);

-- Create index for faster queries
CREATE INDEX idx_sensor_data_space_sensor ON public.sensor_data(space_id, sensor_id, timestamp DESC);