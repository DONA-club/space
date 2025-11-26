import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Upload, Thermometer, Droplets, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export const SensorPanel = () => {
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const setSensorCsv = useAppStore((state) => state.setSensorCsv);

  const handleFileUpload = (sensorId: number, file: File) => {
    setSensorCsv(sensorId, file);
  };

  return (
    <LiquidGlassCard className="p-4 h-[600px] flex flex-col">
      <h2 className="text-xl font-semibold mb-4">Capteurs SwitchBot</h2>
      
      {sensors.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <AlertCircle size={48} className="mx-auto mb-2 opacity-50" />
            <p>Aucun capteur configuré</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 pr-4">
            {sensors.map((sensor) => (
              <LiquidGlassCard key={sensor.id} className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{sensor.name}</h3>
                    <Badge variant={sensor.currentData ? "default" : "secondary"}>
                      {sensor.currentData ? "Actif" : "Inactif"}
                    </Badge>
                  </div>

                  {sensor.currentData && (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Thermometer size={14} className="text-red-500" />
                        <span>{sensor.currentData.temperature.toFixed(1)}°C</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets size={14} className="text-blue-500" />
                        <span>{sensor.currentData.humidity.toFixed(1)}%</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Point de rosée: {sensor.currentData.dewPoint.toFixed(1)}°C
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Humidité abs: {sensor.currentData.absoluteHumidity.toFixed(2)} g/m³
                      </div>
                    </div>
                  )}

                  {mode === 'replay' && !sensor.csvFile && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2"
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
                      Importer CSV
                    </Button>
                  )}

                  {sensor.csvFile && (
                    <div className="text-xs text-green-600 dark:text-green-400 mt-2">
                      ✓ {sensor.csvFile.name}
                    </div>
                  )}
                </div>
              </LiquidGlassCard>
            ))}
          </div>
        </ScrollArea>
      )}
    </LiquidGlassCard>
  );
};