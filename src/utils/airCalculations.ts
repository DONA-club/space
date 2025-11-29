/**
 * Calcule la densité de l'air en fonction de la température et de l'humidité relative
 * 
 * Formule basée sur l'équation d'état des gaz parfaits et la loi de Dalton
 * ρ = (P_d / (R_d * T)) + (P_v / (R_v * T))
 * 
 * où:
 * - P_d = pression partielle de l'air sec
 * - P_v = pression partielle de la vapeur d'eau
 * - R_d = constante spécifique de l'air sec (287.05 J/(kg·K))
 * - R_v = constante spécifique de la vapeur d'eau (461.5 J/(kg·K))
 * - T = température en Kelvin
 * 
 * @param temperature - Température en °C
 * @param relativeHumidity - Humidité relative en % (0-100)
 * @param pressure - Pression atmosphérique en Pa (par défaut 101325 Pa = 1 atm)
 * @returns Densité de l'air en kg/m³
 */
export function calculateAirDensity(
  temperature: number,
  relativeHumidity: number,
  pressure: number = 101325
): number {
  // Constantes
  const R_d = 287.05; // J/(kg·K) - constante spécifique de l'air sec
  const R_v = 461.5;  // J/(kg·K) - constante spécifique de la vapeur d'eau
  
  // Conversion température en Kelvin
  const T = temperature + 273.15;
  
  // Calcul de la pression de vapeur saturante (formule de Magnus-Tetens)
  const P_sat = 611.2 * Math.exp((17.67 * temperature) / (temperature + 243.5));
  
  // Pression partielle de la vapeur d'eau
  const P_v = (relativeHumidity / 100) * P_sat;
  
  // Pression partielle de l'air sec
  const P_d = pressure - P_v;
  
  // Densité de l'air (kg/m³)
  const density = (P_d / (R_d * T)) + (P_v / (R_v * T));
  
  return density;
}

/**
 * Calcule la masse d'air dans un volume donné
 * 
 * @param volume - Volume en m³
 * @param temperature - Température en °C
 * @param relativeHumidity - Humidité relative en % (0-100)
 * @param pressure - Pression atmosphérique en Pa (par défaut 101325 Pa)
 * @returns Masse d'air en kg
 */
export function calculateAirMass(
  volume: number,
  temperature: number,
  relativeHumidity: number,
  pressure: number = 101325
): number {
  const density = calculateAirDensity(temperature, relativeHumidity, pressure);
  return density * volume;
}

/**
 * Calcule l'humidité absolue (masse de vapeur d'eau par m³ d'air)
 * 
 * @param temperature - Température en °C
 * @param relativeHumidity - Humidité relative en % (0-100)
 * @returns Humidité absolue en g/m³
 */
export function calculateAbsoluteHumidity(
  temperature: number,
  relativeHumidity: number
): number {
  // Pression de vapeur saturante (Pa)
  const P_sat = 611.2 * Math.exp((17.67 * temperature) / (temperature + 243.5));
  
  // Pression partielle de la vapeur d'eau (Pa)
  const P_v = (relativeHumidity / 100) * P_sat;
  
  // Température en Kelvin
  const T = temperature + 273.15;
  
  // Constante spécifique de la vapeur d'eau
  const R_v = 461.5; // J/(kg·K)
  
  // Humidité absolue (kg/m³)
  const absoluteHumidity = P_v / (R_v * T);
  
  // Conversion en g/m³
  return absoluteHumidity * 1000;
}