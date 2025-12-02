"use client";

import { useEffect, useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Compass, Lock, Unlock } from 'lucide-react';
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
  const [locked, setLocked] = useState<boolean>(true);

  useEffect(() => {
    setLocalDeg(orientationAzimuth);
  }, [orientationAzimuth]);

  useEffect(() => {
    if (currentSpace?.orientation_azimuth != null) {
      setOrientationAzimuth(Math.round(currentSpace.orientation_azimuth));
      setLocalDeg(Math.round(currentSpace.orientation_azimuth));
    }
  }, [currentSpace, setOrientationAzimuth]);

  const handlePanelMouseEnter = () => {
    window.dispatchEvent(new CustomEvent('windRoseShow'));
    // Reste déverrouillé tant que l’on est dans le panneau (si déjà déverrouillé)
  };

  const handlePanelMouseLeave = () => {
    window.dispatchEvent(new CustomEvent('windRoseHide'));
    // Reverrouille le panneau et l’azimut
    setLocked(true);
    showSuccess("Azimut verrouillé");
  };

  const handleUnlockClick = () => {
    setLocked(false);
    window.dispatchEvent(new CustomEvent('windRoseShow'));
  };

  const saveOrientation = async (degToSave: number) => {
    if (!currentSpace) return;
    const deg = ((degToSave % 360) + 360) % 360;

    const { error } = await supabase
      .from('spaces')
      .update({ orientation_azimuth: deg, updated_at: new Date().toISOString() })
      .eq('id', currentSpace.id);

    if (error) {
      showError("Échec de sauvegarde de l'orientation");
      return;
    }
    showSuccess("Azimut enregistré");
  };

  return (
    <LiquidGlassCard className="flex-shrink-0">
      <div
        className={`${locked ? "px-3 py-2" : "p-3"}`}
        onMouseEnter={handlePanelMouseEnter}
        onMouseLeave={handlePanelMouseLeave}
      >
        <div className={`flex items-center justify-between ${locked ? "h-10" : "mb-2"}`}>
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-indigo-600" />
            <h3 className="text-sm font-medium">Orientation géographique</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-[10px] h-5 px-1.5"
              title="Azimut verrouillé et enregistré"
            >
              {degToCardinal(localDeg)} • {Math.round(localDeg)}°
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleUnlockClick}
              aria-label={locked ? "Déverrouiller l'orientation" : "Orientation déverrouillée"}
            >
              {locked ? <Lock size={14} /> : <Unlock size={14} className="text-green-600" />}
            </Button>
          </div>
        </div>

        {!locked && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Azimut</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1.5">{degToCardinal(localDeg)}</Badge>
                <span className="text-xs font-medium text-indigo-600">{Math.round(localDeg)}°</span>
              </div>
            </div>

            <div
              onMouseLeave={() => {
                // Enregistre l’azimut quand on arrête de survoler le slider
                saveOrientation(localDeg);
              }}
            >
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
            </div>
            {/* Description retirée */}
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};

export default OrientationPanel;