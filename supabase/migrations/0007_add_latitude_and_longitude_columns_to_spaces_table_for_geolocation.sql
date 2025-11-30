-- Add latitude and longitude columns to spaces table
ALTER TABLE spaces 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add comment to explain the columns
COMMENT ON COLUMN spaces.latitude IS 'Latitude coordinate for the space location';
COMMENT ON COLUMN spaces.longitude IS 'Longitude coordinate for the space location';