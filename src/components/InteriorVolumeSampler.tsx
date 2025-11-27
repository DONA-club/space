import { useState } from 'react';
import { useLoadVolumeGLB } from '@/hooks/useLoadVolumeGLB';
import { filterExistingGrid, FilterGridResult } from '@/lib/filterExistingGrid';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Loader2, Play, Download, Trash2, Info, Bug } from 'lucide-react';
import { useAppStore } from '@/store/appStore';
import { showSuccess, showError } from '@/utils/toast';
import { Switch } from './ui/switch';

interface InteriorVolumeSamplerProps {
  gltfUrl: string | null;
  onPointCloudGenerated?: (result: FilterGridResult) => void;
}

export const InteriorVolumeSampler = ({ gltfUrl, onPointCloudGenerated }: InteriorVolumeSamplerProps) => {
  const volumeData = useLoadVolumeGLB(gltfUrl);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const unfilteredPointCloud = useAppStore((state) => state.unfilteredPointCloud);
  const [tolerance, setTolerance] = useState(2);
  const [invertLogic, setInvertLogic] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<FilterGridResult | null>(null);
  const setFilteredPointCloud = useAppStore((state) => state.setFilteredPointCloud);
  const filteredPointCloud = useAppStore((state) => state.filteredPointCloud);

  const handleGenerate = async () => {
    if (!volumeData.mesh || !volumeData.geometry) {
      showError('Aucun modèle 3D chargé');
      return;
    }

    if (!unfilteredPointCloud || unfilteredPointCloud.length === 0) {
      showError('Aucune grille d\'interpolation disponible. Activez d\'abord l\'interpolation spatiale.');
      return;
    }

    setProcessing(true);
    setProgress(0);
    setResult(null);

    try {
      console.log(`🎯 Filtering existing grid of ${(unfilteredPointCloud.length / 3).toLocaleString()} points...`);
      
      const result = await filterExistingGrid(
        unfilteredPointCloud,
        volumeData.mesh,
        {
          tolerance,
          invertLogic,
          onProgress: (processed, total, percentage) => {
            setProgress(percentage);
          },
        }
      );

      setResult(result);
      
      if (result.totalInside === 0) {
        showError('⚠️ Aucun point intérieur trouvé ! Essayez de changer la tolérance ou le mode de détection.');
        return;
      }
      
      if (result.filterPercentage > 95) {
        showError(`⚠️ Filtrage trop agressif (${result.filterPercentage.toFixed(1)}%) ! Ajustez les paramètres.`);
        return;
      }
      
      setFilteredPointCloud(result.points);
      showSuccess(`Point cloud filtré sauvegardé ! ${result.totalInside.toLocaleString()} points intérieurs (${result.filterPercentage.toFixed(1)}% filtrés)`);
      
      if (onPointCloudGenerated) {
        onPointCloudGenerated(result);
      }
    } catch (error) {
      console.error('Error filtering grid:', error);
      showError('Erreur lors du filtrage de la grille');
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
        meshResolution,
        tolerance,
        invertLogic,
        filterPercentage: result.filterPercentage,
        timestamp: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered-grid-${Date.now()}.json`;
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
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={20} />
            <span>Chargement du modèle GLB...</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Calcul du BVH pour le raycasting accéléré...
          </p>
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

  const gridPointCount = unfilteredPointCloud ? unfilteredPointCloud.length / 3 : 0;
  const tolerancePercentage = (tolerance / 6) * 100;

  return (
    <LiquidGlassCard className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Filtre Volumétrique</h3>
        
        <div className="space-y-4">
          {!unfilteredPointCloud || unfilteredPointCloud.length === 0 ? (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                <strong>⚠️ Grille d'interpolation non disponible</strong>
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                Activez d'abord l'interpolation spatiale dans le panneau "Interpolation" pour générer la grille de points.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200 mb-2">
                <strong>✅ Grille d'interpolation détectée</strong>
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400">Points dans la grille:</span>
                <span className="font-medium text-blue-800 dark:text-blue-200">{gridPointCount.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400">Résolution:</span>
                <span className="font-medium text-blue-800 dark:text-blue-200">{meshResolution}³</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Mode de détection</Label>
                <div className="group relative">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50">
                    <p className="font-medium mb-1">Volume d'air vs Volume solide</p>
                    <p className="mb-2"><strong>Volume d'air (recommandé) :</strong> Détecte l'espace habitable entre les murs</p>
                    <p><strong>Volume solide :</strong> Détecte l'intérieur des objets 3D</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Solide</span>
                <Switch
                  checked={invertLogic}
                  onCheckedChange={setInvertLogic}
                />
                <span className="text-xs font-medium text-blue-600">Volume d'air</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {invertLogic 
                ? "✅ Détecte le volume d'air habitable (espace entre les murs)" 
                : "⚠️ Détecte l'intérieur des objets solides (cavités dans les murs)"}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Label>Tolérance</Label>
                <div className="group relative">
                  <Info size={14} className="text-gray-400 cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-50">
                    <p className="font-medium mb-1">Vote majoritaire multi-directionnel</p>
                    <p>Nombre minimum de directions (sur 6) qui doivent s'accorder pour considérer un point comme intérieur.</p>
                    <ul className="mt-2 space-y-1">
                      <li>• 1/6 = 17% (ultra permissif)</li>
                      <li>• 2/6 = 33% (très permissif) ⭐</li>
                      <li>• 3/6 = 50% (équilibré)</li>
                      <li>• 4/6 = 67% (strict)</li>
                    </ul>
                  </div>
                </div>
              </div>
              <span className="text-sm font-medium text-purple-600">
                {tolerance}/6 ({tolerancePercentage.toFixed(0)}%)
              </span>
            </div>
            <Slider
              value={[tolerance]}
              onValueChange={(v) => setTolerance(v[0])}
              min={1}
              max={4}
              step={1}
              disabled={processing}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {tolerance === 1 && "Ultra permissif - garde presque tous les points"}
              {tolerance === 2 && "Très permissif - recommandé pour géométries complexes ⭐"}
              {tolerance === 3 && "Équilibré - 50% d'accord requis"}
              {tolerance === 4 && "Strict - filtre agressivement"}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={processing || !volumeData.mesh || !unfilteredPointCloud}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Filtrage... {progress.toFixed(0)}%
                </>
              ) : (
                <>
                  <Play size={16} className="mr-2" />
                  Filtrer la grille
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
            Filtrage volumétrique de {gridPointCount.toLocaleString()} points avec BVH...
          </p>
        </div>
      )}

      {result && (
        <div className={`space-y-3 p-4 rounded-lg border ${
          result.totalInside === 0 
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : result.filterPercentage > 95
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
        }`}>
          <h4 className={`font-medium ${
            result.totalInside === 0 
              ? 'text-red-800 dark:text-red-300'
              : result.filterPercentage > 95
              ? 'text-yellow-800 dark:text-yellow-300'
              : 'text-green-800 dark:text-green-300'
          }`}>
            {result.totalInside === 0 ? '❌ Aucun point trouvé' : 
             result.filterPercentage > 95 ? '⚠️ Filtrage trop agressif' :
             '✅ Grille Filtrée & Appliquée'}
          </h4>
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
              <span className="text-gray-600 dark:text-gray-400">Points filtrés:</span>
              <span className="ml-2 font-medium">{(result.totalProcessed - result.totalInside).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Taux de filtrage:</span>
              <span className="ml-2 font-medium">{result.filterPercentage.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Mode:</span>
              <span className="ml-2 font-medium">{invertLogic ? '🌬️ Air' : '🧱 Solide'}</span>
            </div>
          </div>
          
          {result.totalInside > 0 && (
            <>
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
                🎯 L'interpolation utilise maintenant ces {result.totalInside.toLocaleString()} points filtrés
              </p>
            </>
          )}
          
          {(result.totalInside === 0 || result.filterPercentage > 95) && (
            <div className="text-xs bg-white dark:bg-black p-2 rounded">
              <p className="font-medium mb-1">💡 Solutions :</p>
              <ul className="space-y-1">
                <li>• Essayez de changer le mode de détection (Air ↔ Solide)</li>
                <li>• Ajustez la tolérance (1-4)</li>
                <li>• Vérifiez que le modèle 3D est correctement orienté</li>
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="font-medium mb-2 flex items-center gap-2">
          <Bug size={14} />
          Filtrage volumétrique intelligent
        </p>
        <ul className="space-y-1">
          <li>• Utilise la grille d'interpolation existante (pas de recalcul)</li>
          <li>• <strong>Mode Volume d'air :</strong> Détecte l'espace habitable</li>
          <li>• <strong>BVH</strong> pour raycasting accéléré</li>
          <li>• <strong>6 directions</strong> testées (±X, ±Y, ±Z)</li>
        </ul>
      </div>
    </LiquidGlassCard>
  );
};