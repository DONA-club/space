"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Grid3x3, Waves, Zap, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const MeshingControlPanel = () => {
  const dataReady = useAppStore((state) => state.dataReady);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const setMeshingEnabled = useAppStore((state) => state.setMeshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const setInterpolationMethod = useAppStore((state) => state.setInterpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const setRbfKernel = useAppStore((state) => state.setRbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const setIdwPower = useAppStore((state) => state.setIdwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const setMeshResolution = useAppStore((state) => state.setMeshResolution);

  if (!dataReady) return null;

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        {/* Header with toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3x3 size={20} className="text-purple-600" />
            <h3 className="font-semibold">Interpolation spatiale</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="meshing-toggle" className="text-sm">
              {meshingEnabled ? 'Activé' : 'Désactivé'}
            </Label>
            <Switch
              id="meshing-toggle"
              checked={meshingEnabled}
              onCheckedChange={setMeshingEnabled}
            />
          </div>
        </div>

        {meshingEnabled && (
          <>
            {/* Method selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Méthode d'interpolation</Label>
              <TooltipProvider>
                <Tabs value={interpolationMethod} onValueChange={(v) => setInterpolationMethod(v as any)}>
                  <TabsList className="grid grid-cols-2 bg-white/50 dark:bg-black/50">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="idw" className="flex items-center gap-2">
                          <Zap size={16} />
                          <span className="text-xs">IDW</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">Inverse Distance Weighting</p>
                        <p className="text-xs">Méthode de Shepard (1968)</p>
                        <p className="text-xs">Rapide, simple, efficace</p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <TabsTrigger value="rbf" className="flex items-center gap-2">
                          <Waves size={16} />
                          <span className="text-xs">RBF</span>
                        </TabsTrigger>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-medium">Radial Basis Functions</p>
                        <p className="text-xs">Surfaces très lisses</p>
                        <p className="text-xs">Plus coûteux en calcul</p>
                      </TooltipContent>
                    </Tooltip>
                  </TabsList>
                </Tabs>
              </TooltipProvider>
            </div>

            {/* IDW specific settings */}
            {interpolationMethod === 'idw' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Exposant de pondération (p)</Label>
                  <span className="text-sm font-medium text-blue-600">{idwPower}</span>
                </div>
                <Slider
                  value={[idwPower]}
                  onValueChange={(v) => setIdwPower(v[0])}
                  min={1}
                  max={5}
                  step={0.5}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Plus l'exposant est élevé, plus l'influence des points proches est forte
                </p>
              </div>
            )}

            {/* RBF specific settings */}
            {interpolationMethod === 'rbf' && (
              <div className="space-y-2">
                <Label className="text-sm">Fonction de base radiale</Label>
                <select
                  value={rbfKernel}
                  onChange={(e) => setRbfKernel(e.target.value as any)}
                  className="w-full text-sm bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="multiquadric">Multiquadric (recommandé)</option>
                  <option value="gaussian">Gaussienne</option>
                  <option value="inverse_multiquadric">Inverse Multiquadric</option>
                  <option value="thin_plate_spline">Thin Plate Spline</option>
                </select>
              </div>
            )}

            {/* Resolution */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Résolution de la grille</Label>
                <span className="text-sm font-medium text-purple-600">{meshResolution}³</span>
              </div>
              <Slider
                value={[meshResolution]}
                onValueChange={(v) => setMeshResolution(v[0])}
                min={10}
                max={40}
                step={5}
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {meshResolution}×{meshResolution}×{meshResolution} = {Math.pow(meshResolution, 3).toLocaleString()} points
              </p>
            </div>

            {/* Info box */}
            <div className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Info size={14} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium mb-1">Comment ça marche ?</p>
                  <p className="mb-2">
                    L'interpolation spatiale crée un champ continu à partir des {useAppStore.getState().sensors.length} points de mesure discrets.
                  </p>
                  <p>
                    <strong>IDW :</strong> Pondération par distance inverse (rapide)<br />
                    <strong>RBF :</strong> Fonctions radiales (surfaces lisses)
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </LiquidGlassCard>
  );
};