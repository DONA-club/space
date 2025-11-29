import * as THREE from 'three';

/**
 * Calcule le volume exact d'un mesh 3D fermé en utilisant la méthode du tétraèdre signé
 * 
 * Pour chaque triangle du mesh, on calcule le volume du tétraèdre formé par :
 * - L'origine (0, 0, 0)
 * - Les 3 sommets du triangle
 * 
 * Formule du volume signé d'un tétraèdre :
 * V = (1/6) * |det(v1, v2, v3)|
 * où v1, v2, v3 sont les vecteurs des sommets
 * 
 * La somme de tous ces volumes donne le volume total du mesh
 * 
 * @param mesh - Le mesh THREE.Mesh dont on veut calculer le volume
 * @returns Volume en unités du modèle (généralement mètres)
 */
export function calculateMeshVolume(mesh: THREE.Mesh): number {
  const geometry = mesh.geometry;
  
  // S'assurer que la géométrie a un index
  if (!geometry.index) {
    geometry.computeBoundingBox();
    return 0;
  }

  const positions = geometry.attributes.position.array;
  const indices = geometry.index.array;
  
  let volume = 0;

  // Parcourir tous les triangles
  for (let i = 0; i < indices.length; i += 3) {
    const i1 = indices[i] * 3;
    const i2 = indices[i + 1] * 3;
    const i3 = indices[i + 2] * 3;

    // Coordonnées des 3 sommets du triangle
    const v1x = positions[i1];
    const v1y = positions[i1 + 1];
    const v1z = positions[i1 + 2];

    const v2x = positions[i2];
    const v2y = positions[i2 + 1];
    const v2z = positions[i2 + 2];

    const v3x = positions[i3];
    const v3y = positions[i3 + 1];
    const v3z = positions[i3 + 2];

    // Calcul du volume signé du tétraèdre (origine + triangle)
    // V = (1/6) * det([v1, v2, v3])
    // det = v1 · (v2 × v3)
    const crossX = v2y * v3z - v2z * v3y;
    const crossY = v2z * v3x - v2x * v3z;
    const crossZ = v2x * v3y - v2y * v3x;

    const dot = v1x * crossX + v1y * crossY + v1z * crossZ;
    
    volume += dot / 6.0;
  }

  // Retourner la valeur absolue (le signe dépend de l'orientation des faces)
  return Math.abs(volume);
}

/**
 * Calcule le volume total d'une scène GLTF en additionnant les volumes de tous les meshes
 * 
 * @param scene - La scène THREE.Scene ou THREE.Group du modèle GLTF
 * @returns Volume total en unités du modèle
 */
export function calculateSceneVolume(scene: THREE.Object3D): number {
  let totalVolume = 0;

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const meshVolume = calculateMeshVolume(child);
      totalVolume += meshVolume;
    }
  });

  return totalVolume;
}

/**
 * Calcule le volume d'air intérieur en soustrayant le volume des objets solides
 * du volume de la bounding box
 * 
 * Note: Cette méthode suppose que le modèle représente les MURS et non l'espace vide
 * 
 * @param scene - La scène THREE.Scene ou THREE.Group
 * @returns Volume d'air intérieur
 */
export function calculateInteriorAirVolume(scene: THREE.Object3D): number {
  // Calculer la bounding box
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const boundingBoxVolume = size.x * size.y * size.z;

  // Calculer le volume des meshes (murs, objets solides)
  const solidVolume = calculateSceneVolume(scene);

  // Le volume d'air est la différence
  const airVolume = boundingBoxVolume - solidVolume;

  return Math.max(0, airVolume);
}