/**
 * Interpolation spatiale 3D pour créer un champ continu à partir de points de mesure discrets
 * Implémente deux méthodes : IDW (Inverse Distance Weighting) et RBF (Radial Basis Functions)
 */

export interface Point3D {
  x: number;
  y: number;
  z: number;
  value: number;
}

/**
 * Calcule la distance euclidienne entre deux points 3D
 */
function distance3D(p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z - p2.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Interpolation par Inverse Distance Weighting (Méthode de Shepard, 1968)
 * 
 * Formule : f(x) = Σ(w_i * f_i) / Σ(w_i)
 * où w_i = 1 / d(x, x_i)^p
 * 
 * @param points - Points de mesure avec leurs valeurs
 * @param target - Point où on veut interpoler
 * @param power - Exposant de pondération (généralement 2)
 * @param epsilon - Seuil pour considérer qu'on est sur un point de mesure
 */
export function interpolateIDW(
  points: Point3D[],
  target: { x: number; y: number; z: number },
  power: number = 2,
  epsilon: number = 1e-6
): number {
  let weightSum = 0;
  let valueSum = 0;

  for (const point of points) {
    const dist = distance3D(point, target);

    // Si on est très proche d'un point de mesure, retourner sa valeur directement
    if (dist < epsilon) {
      return point.value;
    }

    const weight = 1 / Math.pow(dist, power);
    weightSum += weight;
    valueSum += weight * point.value;
  }

  return valueSum / weightSum;
}

/**
 * Fonctions de base radiale disponibles
 */
export type RBFKernel = 'gaussian' | 'multiquadric' | 'inverse_multiquadric' | 'thin_plate_spline';

/**
 * Calcule la valeur d'une fonction de base radiale
 */
function rbfKernel(r: number, kernel: RBFKernel, epsilon: number = 1.0): number {
  switch (kernel) {
    case 'gaussian':
      return Math.exp(-((epsilon * r) ** 2));
    
    case 'multiquadric':
      return Math.sqrt(1 + (epsilon * r) ** 2);
    
    case 'inverse_multiquadric':
      return 1 / Math.sqrt(1 + (epsilon * r) ** 2);
    
    case 'thin_plate_spline':
      return r === 0 ? 0 : r * r * Math.log(r);
    
    default:
      return Math.exp(-((epsilon * r) ** 2));
  }
}

/**
 * Classe pour l'interpolation par fonctions à base radiale (RBF)
 * 
 * Les RBF créent une surface lisse en combinant des fonctions radiales
 * centrées sur chaque point de mesure.
 * 
 * Formule : f(x) = Σ(λ_i * φ(||x - x_i||))
 * où φ est la fonction de base radiale et λ_i sont les poids calculés
 */
export class RBFInterpolator {
  private points: Point3D[];
  private weights: number[];
  private kernel: RBFKernel;
  private epsilon: number;

  constructor(points: Point3D[], kernel: RBFKernel = 'multiquadric', epsilon: number = 1.0) {
    this.points = points;
    this.kernel = kernel;
    this.epsilon = epsilon;
    this.weights = this.computeWeights();
  }

  /**
   * Calcule les poids λ_i en résolvant le système linéaire Aλ = f
   * où A_ij = φ(||x_i - x_j||)
   */
  private computeWeights(): number[] {
    const n = this.points.length;
    
    // Construire la matrice A
    const A: number[][] = [];
    for (let i = 0; i < n; i++) {
      A[i] = [];
      for (let j = 0; j < n; j++) {
        const dist = distance3D(this.points[i], this.points[j]);
        A[i][j] = rbfKernel(dist, this.kernel, this.epsilon);
      }
    }

    // Vecteur des valeurs
    const f = this.points.map(p => p.value);

    // Résoudre le système linéaire par élimination de Gauss
    return this.solveLinearSystem(A, f);
  }

  /**
   * Résout un système linéaire Ax = b par élimination de Gauss avec pivot partiel
   */
  private solveLinearSystem(A: number[][], b: number[]): number[] {
    const n = A.length;
    const augmented: number[][] = A.map((row, i) => [...row, b[i]]);

    // Élimination de Gauss avec pivot partiel
    for (let k = 0; k < n; k++) {
      // Trouver le pivot
      let maxRow = k;
      for (let i = k + 1; i < n; i++) {
        if (Math.abs(augmented[i][k]) > Math.abs(augmented[maxRow][k])) {
          maxRow = i;
        }
      }

      // Échanger les lignes
      [augmented[k], augmented[maxRow]] = [augmented[maxRow], augmented[k]];

      // Élimination
      for (let i = k + 1; i < n; i++) {
        const factor = augmented[i][k] / augmented[k][k];
        for (let j = k; j <= n; j++) {
          augmented[i][j] -= factor * augmented[k][j];
        }
      }
    }

    // Substitution arrière
    const x: number[] = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }

    return x;
  }

  /**
   * Interpole la valeur à un point donné
   */
  interpolate(target: { x: number; y: number; z: number }): number {
    let result = 0;
    
    for (let i = 0; i < this.points.length; i++) {
      const dist = distance3D(this.points[i], target);
      result += this.weights[i] * rbfKernel(dist, this.kernel, this.epsilon);
    }

    return result;
  }
}

/**
 * Crée une grille 3D interpolée à partir de points de mesure
 * 
 * @param points - Points de mesure
 * @param bounds - Limites de la grille {minX, maxX, minY, maxY, minZ, maxZ}
 * @param resolution - Nombre de points par dimension
 * @param method - Méthode d'interpolation ('idw' ou 'rbf')
 * @param options - Options spécifiques à la méthode
 */
export function createInterpolatedGrid(
  points: Point3D[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number },
  resolution: number = 20,
  method: 'idw' | 'rbf' = 'idw',
  options: { power?: number; kernel?: RBFKernel; epsilon?: number } = {}
): { x: number; y: number; z: number; value: number }[] {
  const grid: { x: number; y: number; z: number; value: number }[] = [];
  
  const stepX = (bounds.maxX - bounds.minX) / (resolution - 1);
  const stepY = (bounds.maxY - bounds.minY) / (resolution - 1);
  const stepZ = (bounds.maxZ - bounds.minZ) / (resolution - 1);

  let interpolator: RBFInterpolator | null = null;
  if (method === 'rbf') {
    interpolator = new RBFInterpolator(
      points,
      options.kernel || 'multiquadric',
      options.epsilon || 1.0
    );
  }

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      for (let k = 0; k < resolution; k++) {
        const x = bounds.minX + i * stepX;
        const y = bounds.minY + j * stepY;
        const z = bounds.minZ + k * stepZ;

        let value: number;
        if (method === 'idw') {
          value = interpolateIDW(points, { x, y, z }, options.power || 2);
        } else {
          value = interpolator!.interpolate({ x, y, z });
        }

        grid.push({ x, y, z, value });
      }
    }
  }

  return grid;
}

/**
 * Calcule les limites spatiales d'un ensemble de points
 */
export function calculateBounds(points: Point3D[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }

  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;
  let minZ = points[0].z, maxZ = points[0].z;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }

  // Ajouter une marge de 10%
  const marginX = (maxX - minX) * 0.1;
  const marginY = (maxY - minY) * 0.1;
  const marginZ = (maxZ - minZ) * 0.1;

  return {
    minX: minX - marginX,
    maxX: maxX + marginX,
    minY: minY - marginY,
    maxY: maxY + marginY,
    minZ: minZ - marginZ,
    maxZ: maxZ + marginZ,
  };
}