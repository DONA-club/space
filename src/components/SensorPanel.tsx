"use client";

import { useState, useEffect } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, AlertCircle, ChevronDown, ChevronUp, Grid3x3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CSVManager } from './CSVManager';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const dataReady = useAppStore((state) => state.dataReady);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const setMeshingEnabled = useAppStore((state) => state.setMeshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const setInterpolationMethod = useAppStore((state) => state.setInterpolationMethod);
  const idwPower = useAppStore((state) => state.idwPower);
  const setIdwPower = useAppStore((state) => state.setIdwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const setMeshResolution = useAppStore((state) => state.setMeshResolution);
  
  const [isExpanded, setIsExpanded] = useState(true);
  const [hoveredSensorId, setHoveredSensorId] = useState<number | null>(null);

  const handleSensorHover = (sensorId: number) => {
    setHoveredSensorId(sensorId);
    window.dispatchEvent(new CustomEvent('sensorHover', { detail: { sensorId } }));
  };

  const handleSensorLeave = () => {
    setHoveredSensorId(null);
    window.dispatchEvent(new CustomEvent('sensorLeave'));
  };

  useEffect(() => {
    if (dataReady) {
      setIsExpanded(false);
    }
  }, [dataReady]);

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto">
      {/* Sensors List Card */}
      <LiquidGlassCard className="flex-shrink-0">
        <div className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Capteurs</h2>
              <Badge variant="outline" className="text-xs h-5">
                {sensors.length}
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 p-0"
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {isExpanded && (
            <>
              {sensors.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Aucun capteur</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {sensors.map((sensor) => (
                    <div 
                      key={sensor.id} 
                      className={`p-2 rounded-lg border transition-all cursor-pointer ${
                        hoveredSensorId === sensor.id 
                          ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20' 
                          : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-black/50'
                      }`}
                      onMouseEnter={() => handleSensorHover(sensor.id)}
                      onMouseLeave={handleSensorLeave}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{sensor.name}</span>
                        <Badge 
                          variant={sensor.currentData ? "default" : "secondary"}
                          className="text-[10px] h-4 px-1.5"
                        >
                          {sensor.currentData ? "●" : "○"}
                        </Badge>
                      </div>

                      {sensor.currentData && (
                        <div className="grid grid-cols-2 gap-1">
                          <div className="flex items-center gap-1 text-[10px]">
                            <Thermometer size={10} className="text-red-500" />
                            <span>{sensor.currentData.temperature.toFixed(1)}°C</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <Droplets size={10} className="text-blue-500" />
                            <span>{sensor.currentData.humidity.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </LiquidGlassCard>

      {/* CSV Manager Card */}
      {currentSpace && mode === 'replay' && (
        <CSVManager />
      )}

      {/* Interpolation Card */}
      {dataReady && (
        <LiquidGlassCard className="flex-shrink-0">
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid3x3 size={14} className="text-purple-600" />
                <h3 className="font-medium text-sm">Interpolation</h3>
              </div>
              <Switch
                checked={meshingEnabled}
                onCheckedChange={setMeshingEnabled}
                className="scale-75"
              />
            </div>

            {meshingEnabled && (
              <>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Résolution</Label>
                    <span className="text-xs font-medium text-purple-600">{meshResolution}³</span>
                  </div>
                  <Slider
                    value={[meshResolution]}
                    onValueChange={(v) => setMeshResolution(v[0])}
                    min={10}
                    max={50}
                    step={5}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Méthode</Label>
                  <Tabs value={interpolationMethod} onValueChange={(v) => setInterpolationMethod(v as any)}>
                    <TabsList className="grid grid-cols-2 w-full h-8">
                      <TabsTrigger value="idw" className="text-xs">IDW</TabsTrigger>
                      <TabsTrigger value="rbf" className="text-xs">RBF</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {interpolationMethod === 'idw' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Exposant</Label>
                      <span className="text-xs font-medium text-blue-600">{idwPower}</span>
                    </div>
                    <Slider
                      value={[idwPower]}
                      onValueChange={(v) => setIdwPower(v[0])}
                      min={1}
                      max={5}
                      step={0.5}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </LiquidGlassCard>
      )}
    </div>
  );
};