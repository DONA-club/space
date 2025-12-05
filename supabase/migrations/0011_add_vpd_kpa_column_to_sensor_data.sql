-- Add VPD (kPa) column to sensor_data
ALTER TABLE public.sensor_data
ADD COLUMN IF NOT EXISTS vpd_kpa DOUBLE PRECISION;

-- Optional: no default, allow nulls for backward compatibility
-- RLS policies remain unchanged and continue to protect rows.