"use client";

import { useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, Box, CheckCircle2, AlertCircle, Package, X, Cuboid } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';

export const FileUploadPanel = () => {
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [gltfFiles, setGltfFiles] = useState<File[]>([]);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const setGltfModel = useAppStore((state) => state.setGltfModel);
  const setSensors = useAppStore((state) => state.setSensors);
  const setRoomVolume = useAppStore((state) => state.setRoomVolume);

  const handleGlbUpload = async (file: File) => {
    if (!file.name.endsWith('.glb')) {
      showError('Veuillez sélectionner un fichier GLB');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('Le fichier est trop volumineux (max 50MB)');
      return;
    }

    if (file.size === 0) {
      showError('Le fichier est vide');
      return;
    }
    
    // Clear GLTF pack if exists
    if (gltfFiles.length > 0) {
      gltfFiles.forEach(f => {
        const url = URL.createObjectURL(f);
        URL.revokeObjectURL(url);
      });
      setGltfFiles([]);
    }
    
    setGlbFile(file);
    const url = URL.createObjectURL(file);
    setGlbUrl(url);
    setGltfModel(url);
    showSuccess('Modèle 3D GLB chargé avec succès');
  };

  const handleGltfPackUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Vérifier qu'il y a au moins un fichier GLTF
    const gltfFile = fileArray.find(f => f.name.endsWith('.gltf'));
    if (!gltfFile) {
      showError('Le pack doit contenir au moins un fichier .gltf');
      return;
    }

    console.log('📦 Loading GLTF pack with files:', fileArray.map(f => f.name));

    // Clear GLB if exists
    if (glbFile) {
      if (glbUrl) URL.revokeObjectURL(glbUrl);
      setGlbFile(null);
      setGlbUrl(null);
    }

    try {
      // Créer des URLs pour tous les fichiers
      const fileMap = new Map<string, string>();
      fileArray.forEach(file => {
        const url = URL.createObjectURL(file);
        fileMap.set(file.name, url);
        console.log(`Created blob URL for ${file.name}:`, url);
      });

      // Lire le fichier GLTF
      const gltfText = await gltfFile.text();
      const gltfData = JSON.parse(gltfText);

      console.log('Original GLTF data:', gltfData);

      // Remplacer les références aux fichiers externes par les blob URLs
      if (gltfData.buffers) {
        gltfData.buffers.forEach((buffer: any, index: number) => {
          if (buffer.uri) {
            const fileName = buffer.uri.split('/').pop()?.split('\\').pop();
            console.log(`Buffer ${index} references: ${fileName}`);
            if (fileName && fileMap.has(fileName)) {
              const newUri = fileMap.get(fileName);
              console.log(`Replacing buffer URI: ${buffer.uri} -> ${newUri}`);
              buffer.uri = newUri;
            } else {
              console.warn(`⚠️ Buffer file not found: ${fileName}`);
            }
          }
        });
      }

      if (gltfData.images) {
        gltfData.images.forEach((image: any, index: number) => {
          if (image.uri) {
            const fileName = image.uri.split('/').pop()?.split('\\').pop();
            console.log(`Image ${index} references: ${fileName}`);
            if (fileName && fileMap.has(fileName)) {
              const newUri = fileMap.get(fileName);
              console.log(`Replacing image URI: ${image.uri} -> ${newUri}`);
              image.uri = newUri;
            } else {
              console.warn(`⚠️ Image file not found: ${fileName}`);
            }
          }
        });
      }

      console.log('Modified GLTF data:', gltfData);

      // Créer un nouveau blob avec le GLTF modifié
      const modifiedGltfBlob = new Blob([JSON.stringify(gltfData)], { type: 'application/json' });
      const modifiedGltfUrl = URL.createObjectURL(modifiedGltfBlob);

      console.log('Created modified GLTF URL:', modifiedGltfUrl);

      setGltfFiles(fileArray);
      setGltfModel(modifiedGltfUrl);
      
      const fileTypes = fileArray.map(f => {
        const ext = f.name.split('.').pop()?.toUpperCase();
        return ext;
      }).filter((v, i, a) => a.indexOf(v) === i);
      
      showSuccess(`Pack GLTF chargé avec succès (${fileArray.length} fichiers: ${fileTypes.join(', ')})`);
    } catch (error) {
      console.error('Error processing GLTF pack:', error);
      showError('Erreur lors du traitement du pack GLTF');
    }
  };

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value.replace(',', '.'));
    }
    return 0;
  };

  const handleJsonUpload = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      showError('Veuillez sélectionner un fichier JSON');
      return;
    }

    try {
      let text = await file.text();
      text = text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
      const data = JSON.parse(text);

      if (!data.points || !Array.isArray(data.points)) {
        throw new Error('Format JSON invalide. Le fichier doit contenir un tableau "points"');
      }

      const sensors = data.points.map((point: any, index: number) => {
        const x = parseNumber(point.x);
        const y = parseNumber(point.y);
        const z = parseNumber(point.z);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          throw new Error(`Coordonnées invalides pour le point ${index + 1}`);
        }
        
        return {
          id: index + 1,
          position: [x, y, z] as [number, number, number],
          name: point.name || `Capteur ${index + 1}`,
        };
      });

      if (sensors.length === 0) {
        throw new Error('Aucun capteur trouvé dans le fichier');
      }

      setJsonFile(file);
      setSensors(sensors);
      showSuccess(`${sensors.length} capteur${sensors.length > 1 ? 's' : ''} chargé${sensors.length > 1 ? 's' : ''} avec succès`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Erreur lors de la lecture du fichier JSON');
      console.error(error);
    }
  };

  const handleStlUpload = async (file: File) => {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.stl')) {
      showError('Veuillez sélectionner un fichier STL');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      showError('Le fichier est trop volumineux (max 50MB)');
      return;
    }

    if (file.size === 0) {
      showError('Le fichier est vide');
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      setStlFile(file);
      setRoomVolume(url);
      showSuccess('Volume STL de la pièce chargé avec succès');
    } catch (error) {
      showError('Erreur lors du chargement du fichier STL');
      console.error(error);
    }
  };

  const clearModel = () => {
    if (glbUrl) URL.revokeObjectURL(glbUrl);
    setGlbFile(null);
    setGlbUrl(null);
    setGltfFiles([]);
    setGltfModel(null);
  };

  const hasModel = glbFile || gltfFiles.length > 0;
  const canProceed = hasModel && jsonFile && stlFile;

  return (
    <LiquidGlassCard className="p-6">
      <h2 className="text-xl font-semibold mb-6">Configuration initiale</h2>
      
      <div className="space-y-6">
        {/* Model Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-blue-600" />
            <h3 className="font-medium">1. Modèle 3D (visuel)</h3>
          </div>
          
          {hasModel ? (
            <div className="space-y-2">
              {glbFile && (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle2 size={20} className="text-green-600" />
                  <div className="flex-1">
                    <span className="text-sm block font-medium">{glbFile.name}</span>
                    <span className="text-xs text-gray-500">
                      GLB • {(glbFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                  <Button size="sm" variant="outline" onClick={clearModel}>
                    <X size={14} />
                  </Button>
                </div>
              )}
              
              {gltfFiles.length > 0 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={20} className="text-green-600" />
                    <span className="text-sm font-medium">Pack GLTF ({gltfFiles.length} fichiers)</span>
                    <Button size="sm" variant="outline" onClick={clearModel} className="ml-auto">
                      <X size={14} />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {gltfFiles.map((file, idx) => (
                      <div key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.glb';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleGlbUpload(file);
                  };
                  input.click();
                }}
              >
                <Upload size={16} className="mr-2" />
                Charger un fichier GLB
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">ou</span>
                </div>
              </div>
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.gltf,.bin,.jpg,.jpeg,.png';
                  input.multiple = true;
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files && files.length > 0) handleGltfPackUpload(files);
                  };
                  input.click();
                }}
              >
                <Package size={16} className="mr-2" />
                Charger un pack GLTF (plusieurs fichiers)
              </Button>
            </div>
          )}
        </div>

        {/* STL Volume Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Cuboid size={20} className="text-orange-600" />
            <h3 className="font-medium">2. Volume de la pièce (STL)</h3>
          </div>
          
          {stlFile ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 size={20} className="text-green-600" />
              <div className="flex-1">
                <span className="text-sm block font-medium">{stlFile.name}</span>
                <span className="text-xs text-gray-500">
                  STL • {(stlFile.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setStlFile(null);
                  setRoomVolume(null);
                }}
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.stl';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleStlUpload(file);
                };
                input.click();
              }}
            >
              <Upload size={16} className="mr-2" />
              Charger le volume STL
            </Button>
          )}
        </div>

        {/* JSON Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileJson size={20} className="text-purple-600" />
            <h3 className="font-medium">3. Positions des capteurs (JSON)</h3>
          </div>
          
          {jsonFile ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="text-sm flex-1">{jsonFile.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setJsonFile(null);
                  setSensors([]);
                }}
              >
                <X size={14} />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleJsonUpload(file);
                };
                input.click();
              }}
            >
              <Upload size={16} className="mr-2" />
              Charger les positions
            </Button>
          )}
        </div>

        {/* Status message */}
        {!canProceed && (
          <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="font-medium mb-1 flex items-center gap-2">
              <AlertCircle size={14} />
              Fichiers requis pour continuer :
            </p>
            <ul className="space-y-1 ml-5">
              <li className={hasModel ? 'text-green-600 dark:text-green-400' : ''}>
                {hasModel ? '✓' : '○'} Modèle 3D (GLB ou GLTF)
              </li>
              <li className={stlFile ? 'text-green-600 dark:text-green-400' : ''}>
                {stlFile ? '✓' : '○'} Volume STL
              </li>
              <li className={jsonFile ? 'text-green-600 dark:text-green-400' : ''}>
                {jsonFile ? '✓' : '○'} Positions des capteurs (JSON)
              </li>
            </ul>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="font-medium mb-2 flex items-center gap-2">
            <AlertCircle size={14} />
            Formats acceptés :
          </p>
          <ul className="space-y-1 mb-3">
            <li>• <strong>GLB/GLTF</strong> : Modèle 3D visuel de la pièce</li>
            <li>• <strong>STL</strong> : Volume exact pour contraindre l'interpolation</li>
            <li>• <strong>JSON</strong> : Positions des capteurs</li>
            <li>• Taille max : 50 MB par fichier</li>
          </ul>
          <p className="font-medium mb-1">Format JSON attendu :</p>
          <pre className="text-xs overflow-x-auto bg-white dark:bg-black p-2 rounded">
{`{
  "points": [
    {"x": -2.046877, "y": 2.426022, "z": 3.303156},
    {"x": 3.035000, "y": 2.346022, "z": 3.809492}
  ]
}`}
          </pre>
          <p className="mt-2">✓ Supporte les virgules comme séparateurs décimaux</p>
        </div>
      </div>
    </LiquidGlassCard>
  );
};