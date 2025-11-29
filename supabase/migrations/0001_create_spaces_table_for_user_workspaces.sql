-- Create spaces table
CREATE TABLE public.spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  gltf_file_path TEXT,
  gltf_file_name TEXT,
  json_file_path TEXT,
  json_file_name TEXT,
  last_csv_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "spaces_select_policy" ON public.spaces 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "spaces_insert_policy" ON public.spaces 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "spaces_update_policy" ON public.spaces 
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "spaces_delete_policy" ON public.spaces 
FOR DELETE TO authenticated USING (auth.uid() = user_id);