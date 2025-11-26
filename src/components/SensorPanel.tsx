"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Upload, Thermometer, Droplets, AlertCircle, FileText, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setSensorCsv = useAppStore((state) => state.setSensorCsv);

  const handleFileUpload = (sensorId: number, file: File) => {
    setSensorCsv(sensorId, file);
  };

  const clearCsv = (sensorId: number) => {
    setSensorCsv(sensorId, null as any);
  };

  return (
    <LiquidGlassCard className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-3 flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-base font-semibold">Capteurs SwitchBot</h2>
        <Badge variant="outline" className="text-xs">
          {sensors.length}
        </Badge>
      </div>
      
      {sensors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <AlertCircle size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun capteur configuré</p>
            <p className="text-xs mt-1 opacity-75">Chargez un fichier JSON</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 space-y-2">
            {sensors.map((sensor) => (
              <LiquidGlassCard key={sensor.id} className="p-3 hover:shadow-md transition-shadow">
                <div className="space-y-2">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-xs truncate">{sensor.name}</h3>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">ID: {sensor.id}</p>
                    </div>
                    <Badge 
                      variant={sensor.currentData ? "default" : "secondary"}
                      className="shrink-0 text-[10px] h-5 px-2"
                    >
                      {sensor.currentData ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                          Actif
                        </span>
                      ) : (
                        "Inactif"
                      )}
                    </Badge>
                  </div>

                  {/* Data */}
                  {sensor.currentData && (
                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5 p-1.5 bg-red-50 dark:bg-red-900/20 rounded">
                        <Thermometer size={12} className="text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-xs">{sensor.currentData.temperature.toFixed(1)}°C</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <Droplets size={12} className="text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium text-xs">{sensor.currentData.humidity.toFixed(1)}%</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CSV Upload - Compact */}
                  {mode === 'replay' && (
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                      {!sensor.csvFile ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-7 text-[10px] bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.csv';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) handleFileUpload(sensor.id, file);
                            };
                            input.click();
                          }}
                        >
                          <Upload size={10} className="mr-1" />
                          CSV
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1.5 p-1.5 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                          <FileText size={12} className="text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-medium text-green-700 dark:text-green-400 truncate">
                              {sensor.csvFile.name}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                            onClick={() => clearCsv(sensor.id)}
                          >
                            <X size={10} className="text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </LiquidGlassCard>
            ))}
          </div>
        </div>
      )}
    </LiquidGlassCard>
  );
};