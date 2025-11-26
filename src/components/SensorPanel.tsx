"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Upload, Thermometer, Droplets, AlertCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setSensorCsv = useAppStore((state) => state.setSensorCsv);

  const handleFileUpload = (sensorId: number, file: File) => {
    setSensorCsv(sensorId, file);
  };

  return (
    <LiquidGlassCard className="h-full flex flex-col">
      <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
        <h2 className="text-lg font-semibold">Capteurs SwitchBot</h2>
        <Badge variant="outline" className="text-xs">
          {sensors.length} capteur{sensors.length > 1 ? 's' : ''}
        </Badge>
      </div>
      
      {sensors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun capteur configuré</p>
            <p className="text-xs mt-1 opacity-75">Chargez un fichier JSON de positions</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="space-y-3 pr-2">
            {sensors.map((sensor) => (
              <LiquidGlassCard key={sensor.id} className="p-4 hover:shadow-lg transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">{sensor.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        ID: {sensor.id}
                      </p>
                    </div>
                    <Badge 
                      variant={sensor.currentData ? "default" : "secondary"}
                      className="shrink-0 text-xs"
                    >
                      {sensor.currentData ? (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          Actif
                        </span>
                      ) : (
                        "Inactif"
                      )}
                    </Badge>
                  </div>

                  {sensor.currentData && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <Thermometer size={14} className="text-red-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium">{sensor.currentData.temperature.toFixed(1)}°C</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">Température</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <Droplets size={14} className="text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-medium">{sensor.currentData.humidity.toFixed(1)}%</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">Humidité</div>
                        </div>
                      </div>
                      <div className="col-span-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-600 dark:text-gray-400">Point de rosée:</span>
                          <span className="font-medium">{sensor.currentData.dewPoint.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between text-[10px] mt-1">
                          <span className="text-gray-600 dark:text-gray-400">Humidité abs:</span>
                          <span className="font-medium">{sensor.currentData.absoluteHumidity.toFixed(2)} g/m³</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {mode === 'replay' && (
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                      {!sensor.csvFile ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-9 text-xs bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 hover:from-blue-100 hover:to-purple-100 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 border-blue-200 dark:border-blue-800"
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
                          <Upload size={14} className="mr-2" />
                          Importer les données CSV
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2 p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                          <FileText size={16} className="text-green-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-green-700 dark:text-green-400 truncate">
                              {sensor.csvFile.name}
                            </div>
                            <div className="text-[10px] text-green-600 dark:text-green-500">
                              {(sensor.csvFile.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
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