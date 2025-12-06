-- Ajouter la colonne vpd_kpa (Vapor Pressure Deficit en kilopascals) à la table sensor_data
ALTER TABLE sensor_data 
ADD COLUMN IF NOT EXISTS vpd_kpa DOUBLE PRECISION;

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN sensor_data.vpd_kpa IS 'Déficit de pression de vapeur (Vapor Pressure Deficit) en kilopascals';