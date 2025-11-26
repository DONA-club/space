"use client";

import { useAppStore } from '@/store/appStore';
import { Thermometer } from 'lucide-react';

export const Scene3D = () => {
  const sensors = useAppStore((state) => state.sensors);

  if (sensors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Chargement des capteurs...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-900 rounded-lg">
      <div className="text-center p-8">
        <Thermometer size={64} className="mx-auto mb-4 text-blue-600" />
        <h3 className="text-xl font-semibold mb-2">Vue 3D</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          {sensors.length} capteurs détectés
        </p>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {sensors.map((sensor) => (
            <div
              key={sensor.id}
              className="bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg p-3 text-sm"
            >
              <div className="font-medium">{sensor.name}</div>
              <div className="text-xs text-gray-500">
                Position: ({sensor.position[0].toFixed(1)}, {sensor.position[1].toFixed(1)}, {sensor.position[2].toFixed(1)})
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-4">
          La visualisation 3D sera activée prochainement
        </p>
      </div>
    </div>
  );
};