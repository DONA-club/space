-- Recalculer VPD pour toutes les données existantes
-- VPD = VPsat - VPair
-- VPsat = 0.6108 * exp((17.27 * T) / (T + 237.3))
-- VPair = VPsat * (RH / 100)

UPDATE sensor_data
SET vpd_kpa = (
  0.6108 * EXP((17.27 * temperature) / (temperature + 237.3))
  - (0.6108 * EXP((17.27 * temperature) / (temperature + 237.3)) * (humidity / 100.0))
)
WHERE vpd_kpa IS NULL OR vpd_kpa = 0;

-- Ajouter un commentaire pour documenter la formule
COMMENT ON COLUMN sensor_data.vpd_kpa IS 'Vapor Pressure Deficit en kPa, calculé avec: VPD = VPsat - VPair, où VPsat = 0.6108 * exp((17.27 * T) / (T + 237.3)) et VPair = VPsat * (RH / 100)';