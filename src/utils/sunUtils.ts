import * as THREE from 'three';
import * as SunCalc from 'suncalc';

export const getSunDirection = (lat: number, lon: number, date: Date): THREE.Vector3 => {
  const pos = SunCalc.getPosition(date, lat, lon);
  const altitude = pos.altitude; // radians, angle au-dessus de l'horizon
  const azimuth = pos.azimuth;   // radians, 0 = sud, +pi/2 = ouest, -pi/2 = est, +-pi = nord

  // Conversion azimuth/altitude -> direction spatiale
  // Mapping choisi:
  //  - z+ ~ sud (az=0)
  //  - z- ~ nord (az=±pi)
  //  - x+ ~ ouest (az=+pi/2)
  //  - x- ~ est (az=-pi/2)
  const x = Math.sin(azimuth) * Math.cos(altitude);
  const y = Math.sin(altitude);
  const z = Math.cos(azimuth) * Math.cos(altitude);

  const dir = new THREE.Vector3(x, y, z);
  return dir.normalize();
};

export const getSunPathPoints = (
  lat: number,
  lon: number,
  date: Date,
  radius: number,
  center: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
  stepMinutes: number = 30
): THREE.Vector3[] => {
  const times = SunCalc.getTimes(date, lat, lon);
  // Si le lever/coucher n'est pas disponible (pôles), on parcourt toute la journée
  const start = times.sunrise ? times.sunrise : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  const end = times.sunset ? times.sunset : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 0);

  const points: THREE.Vector3[] = [];
  const loopDate = new Date(start.getTime());

  while (loopDate <= end) {
    const dir = getSunDirection(lat, lon, loopDate);
    const p = new THREE.Vector3().copy(dir).multiplyScalar(radius).add(center);
    points.push(p);
    loopDate.setMinutes(loopDate.getMinutes() + stepMinutes);
  }

  // Si pas de points (nuit polaire), on prend quelques échantillons sur la journée
  if (points.length === 0) {
    for (let h = 0; h < 24; h += 2) {
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0, 0);
      const dir = getSunDirection(lat, lon, d);
      const p = new THREE.Vector3().copy(dir).multiplyScalar(radius).add(center);
      points.push(p);
    }
  }

  return points;
};