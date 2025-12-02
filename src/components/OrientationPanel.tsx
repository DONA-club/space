"use client";

import { useEffect, useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Compass } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

const degToCardinal = (deg: number): string => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
};

export const OrientationPanel = () => {
  const currentSpace = useAppStore((s) => s.currentSpace);
  const orientationAzimuth = useAppStore((s) => s.orientationAzimuth);
  const setOrientationAzimuth = useAppStore((s) => s.setOrientationAzimuth);

  const [localDeg, setLocalDeg] = useState<number>(orientationAzimuth);

  useEffect(() => {
    setLocalDeg(orientationAzimuth);
  }, [orientationAzimuth]);

  useEffect(() => {
    if (currentSpace?.orientation_azimuth != null) {
      setOrientationAzimuth(Math.round(currentSpace.orientation_azimuth));
    }
  }, [currentSpace, setOrientationAzimuth]);

  const handleMouseEnter = () => {
    window.dispatchEvent(new CustomEvent('windRoseShow'));
  };

  const handleMouseLeave = async () => {
    window.dispatchEvent(new CustomEvent('windRoseHide'));
    if (!currentSpace) return;
    const deg = ((localDeg % 360) + 360) % 360;

    const { error } = await supabase
      .from('spaces')
      .update({ orientation_azimuth: deg, updated_at: new Date().toISOString() })
      .eq('id', currentSpace.id);

    if (error) {
      showError("Échec de sauvegarde de l'orientation");
      return;
    }
    showSuccess("Orientation sauvegardée");
  };

  return (
    <LiquidGlassCard className="flex-shrink-0">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-indigo-600" />
            <h3 className="text-sm font-medium">Orientation géographique</h3>
          </div>
        </div>

        <div
          className="space-y-3"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center justify-between">
            <Label className="text-xs text-gray-600 dark:text-gray-400">Azimut</Label>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] h-5 px-1.5">{degToCardinal(localDeg)}</Badge>
              <span className="text-xs font-medium text-indigo-600">{Math.round(localDeg)}°</span>
            </div>
          </div>

          <Slider
            value={[localDeg]}
            onValueChange={(v) => {
              const deg = v[0];
              setLocalDeg(deg);
              setOrientationAzimuth(deg); // live update
            }}
            min={0}
            max={359}
            step={1}
            className="h-1"
          />

          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Survole le curseur pour afficher la rose des vents; l’azimut est mis à jour en direct et sauvegardé en quittant le survol.
          </p>
        </div>
      </div>
    </LiquidGlassCard>
  );
};

export default OrientationPanel;