ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS orientation_azimuth DOUBLE PRECISION DEFAULT 0;

-- RLS déjà en place sur spaces; les policies SELECT/UPDATE existantes limitent par user_id.