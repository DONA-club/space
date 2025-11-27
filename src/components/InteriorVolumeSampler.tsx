import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { useLoadVolumeGLB } from '@/hooks/useLoadVolumeGLB';
import { generateInteriorPointCloud, InteriorPointCloudResult } from '@/lib/generateInteriorPointCloud';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Loader2, Play, Download, Trash2 } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { showSuccess } from '@/utils/toast';

interface InteriorVolumeSamplerProps {
  gltfUrl: string | null;
  onPointCloudGenerated?: (result: InteriorPointCloudResult) => void;
}

export const InteriorVolumeSampler = ({ gltfUrl, onPointCloudGenerated }: InteriorVolumeSamplerProps) => {
  const volumeData = useLoadVolumeGLB(gltfUrl);
  const [resolution, setResolution] = useState(0.25);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<InteriorPointCloudResult | null>(null);
  const pointCloudRef = useRef<THREE.Points | null>(null);
  const setFilteredPointCloud = useAppStore((state) => state.setFilteredPointCloud);
  const filteredPointCloud = useAppStore((state) => state.filteredPointCloud);

  const handleGenerate = async () => {
    if (!volumeData.mesh || !volumeData.geometry) {
      console.error('No mesh loaded');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      const result = await generateInteriorPointCloud(
        volumeData.mesh,
        volumeData.bounds,
        {
          resolution,
          onProgress: (processed, total, percentage) => {
            setProgress(percentage);
          },
        }
      );

      setResult(result);
      
      // Save to store for use in Scene3DViewer
      setFilteredPointCloud(result.points);
      showSuccess(`Point cloud filtré sauvegardé ! ${result.totalInside.toLocaleString()} points intérieurs`);
      
      if (onPointCloudGenerated) {
        onPointCloudGenerated(result);
      }
    } catch (error) {
      console.error('Error generating interior point cloud:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    setResult(null);
    setFilteredPointCloud(null);
    showSuccess('Point cloud filtré supprimé');
  };

  const handleExport = () => {
    if (!result) return;

    const data = {
      points: Array.from(result.points),
      metadata: {
        totalPoints: result.totalInside,
        resolution,
        filterPercentage: result.filterPercentage,
        timestamp: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interior-points-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!gltfUrl) {
    return (
      <LiquidGlassCard className="p-6">
        <p className="text-gray-500 dark:text-gray-400">
          Chargez un modèle 3D pour commencer
        </p>
      </LiquidGlassCard>
    );
  }

  if (volumeData.loading) {
    return (
      <LiquidGlassCard className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement du modèle GLB...</span>
        </div>
      </LiquidGlassCard>
    );
  }

  if (volumeData.error) {
    return (
      <LiquidGlassCard className="p-6">
        <p className="text-red-600 dark:text-red-400">{volumeData.error}</p>
      </LiquidGlassCard>
    );
  }

  const estimatedPoints = volumeData.bounds 
    ? Math.ceil(
        (volumeData.bounds.max.x - volumeData.bounds.min.x) / resolution *
        (volumeData.bounds.max.y - volumeData.bounds.min.y) / resolution *
        (volumeData.bounds.max.z - volumeData.bounds.min.z) / resolution
      )
    : 0;

  return (
    <LiquidGlassCard className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Générateur de Point Cloud Interne</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Résolution (m)</Label>
              <span className="text-sm font-medium text-blue-600">{resolution.toFixed(2)}</span>
            </div>
            <Slider
              value={[resolution]}
              onValueChange={(v) => setResolution(v[0])}
              min={0.1}
              max={1.0}
              step={0.05}
              disabled={processing}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Points estimés: ~{estimatedPoints.toLocaleString()}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={processing || !volumeData.mesh}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Traitement... {progress.toFixed(0)}%
                </>
              ) : (
                <>
                  <Play size={16} className="mr-2" />
                  Générer
                </>
              )}
            </Button>
            
            {(result || filteredPointCloud) && (
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={processing}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        </div>
      </div>

      {processing && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-gray-600 dark:text-gray-400">
            Filtrage volumétrique avec BVH...
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <h4 className="font-medium text-green-800 dark:text-green-300">✅ Point Cloud Généré & Appliqué</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Points totaux:</span>
              <span className="ml-2 font-medium">{result.totalProcessed.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Points internes:</span>
              <span className="ml-2 font-medium">{result.totalInside.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Taux de filtrage:</span>
              <span className="ml-2 font-medium">{result.filterPercentage.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Résolution:</span>
              <span className="ml-2 font-medium">{resolution.toFixed(2)}m</span>
            </div>
          </div>
          
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            className="w-full mt-2"
          >
            <Download size={14} className="mr-2" />
            Exporter (JSON)
          </Button>
          
          <p className="text-xs text-green-700 dark:text-green-400 text-center">
            🎯 L'interpolation utilise maintenant ces points filtrés
          </p>
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="font-medium mb-2">🔧 Technologie:</p>
        <ul className="space-y-1">
          <li>• <strong>BVH</strong> (three-mesh-bvh) pour raycasting accéléré</li>
          <li>• <strong>Web Worker</strong> pour traitement parallèle</li>
          <li>• <strong>Even-Odd Rule</strong> pour test inside/outside</li>
          <li>• Optimisé pour 64k+ points</li>
        </ul>
      </div>
    </LiquidGlassCard>
  );
};