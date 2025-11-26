"use client";

import { useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from '@/components/ui/button';
import { Upload, FileJson, Box, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';

export const FileUploadPanel = () => {
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const setGltfModel = useAppStore((state) => state.setGltfModel);
  const setSensors = useAppStore((state) => state.setSensors);

  const handleGlbUpload = (file: File) => {
    if (!file.name.endsWith('.glb') && !file.name.endsWith('.gltf')) {
      showError('Veuillez sélectionner un fichier GLB ou GLTF');
      return;
    }
    
    setGlbFile(file);
    const url = URL.createObjectURL(file);
    setGlbUrl(url);
    setGltfModel(url);
    showSuccess('Modèle 3D chargé avec succès');
  };

  const handleJsonUpload = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      showError('Veuillez sélectionner un fichier JSON');
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.points || !Array.isArray(data.points)) {
        throw new Error('Format JSON invalide. Le fichier doit contenir un tableau "points"');
      }

      const sensors = data.points.map((point: any, index: number) => ({
        id: index + 1,
        position: [point.x, point.y, point.z] as [number, number, number],
        name: point.name || `Capteur ${index + 1}`,
      }));

      setJsonFile(file);
      setSensors(sensors);
      showSuccess(`${sensors.length} capteurs chargés avec succès`);
    } catch (error) {
      showError('Erreur lors de la lecture du fichier JSON');
      console.error(error);
    }
  };

  return (
    <LiquidGlassCard className="p-6">
      <h2 className="text-xl font-semibold mb-6">Configuration initiale</h2>
      
      <div className="space-y-6">
        {/* GLB Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Box size={20} className="text-blue-600" />
            <h3 className="font-medium">1. Modèle 3D (GLB/GLTF)</h3>
          </div>
          
          {glbFile ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 size={20} className="text-green-600" />
              <span className="text-sm flex-1">{glbFile.name}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGlbFile(null);
                  setGlbUrl(null);
                  setGltfModel(null);
                }}
              >
                Changer
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.glb,.gltf';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleGlbUpload(file);
                };
                input.click();
              }}
            >
              <Upload size={16} className="mr-2" />
              Charger le modèle 3D
            </Button>
          )}
        </div>

        {/* JSON Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileJson size={20} className="text-purple-600" />
            <h3 className="font-medium">2. Positions des capteurs (JSON)</h3>
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
                Changer
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

        {/* Info */}
        <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="font-medium mb-1">Format JSON attendu :</p>
          <pre className="text-xs overflow-x-auto">
{`{
  "points": [
    {"x": 1.0, "y": 2.0, "z": 3.0, "name": "Capteur 1"},
    {"x": 4.0, "y": 5.0, "z": 6.0, "name": "Capteur 2"}
  ]
}`}
          </pre>
        </div>
      </div>
    </LiquidGlassCard>
  );
};