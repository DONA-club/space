"use client";

import { useEffect, useState } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Compass, Lock, Unlock, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';

const degToCardinal = (deg: number): string => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  const idx = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[idx];
};

// Couleur de pastille selon l’azimut (N=bleu, E=orange, S=rouge, O=violet)
const getAzimuthBadgeClasses = (deg: number): string => {
  const d = ((deg % 360) + 360) % 360;
  if (d >= 45 && d < 135) {
    // Est
    return 'bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-200';
  } else if (d >= 135 && d < 225) {
    // Sud
    return 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-700 dark:text-red-200';
  } else if (d >= 225 && d < 315) {
    // Ouest
    return 'bg-purple-100 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-200';
  } else {
    // Nord
    return 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200';
  }
};

export const OrientationPanel = () => {
  const currentSpace = useAppStore((s) => s.currentSpace);
  const orientationAzimuth = useAppStore((s) => s.orientationAzimuth);
  const setOrientationAzimuth = useAppStore((s) => s.setOrientationAzimuth);

  const [localDeg, setLocalDeg] = useState<number>(orientationAzimuth);
  const [locked, setLocked] = useState<boolean>(true);
  const [isAnonSession, setIsAnonSession] = useState<boolean>(true);

  // Suivi de modification depuis le dernier déverrouillage
  const [hasChanged, setHasChanged] = useState<boolean>(false);
  const [unlockStartDeg, setUnlockStartDeg] = useState<number | null>(null);

  useEffect(() => {
    setLocalDeg(orientationAzimuth);
  }, [orientationAzimuth]);

  useEffect(() => {
    if (currentSpace?.orientation_azimuth != null) {
      const val = Math.round(currentSpace.orientation_azimuth);
      setOrientationAzimuth(val);
      setLocalDeg(val);
    }
  }, [currentSpace, setOrientationAzimuth]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      const anon = !!(u && ((u as any).is_anonymous || (u as any).app_metadata?.provider === 'anonymous'));
      setIsAnonSession(anon);
    });
  }, []);

  const handlePanelMouseEnter = () => {
    window.dispatchEvent(new CustomEvent('windRoseShow'));
  };

  const handlePanelMouseLeave = async () => {
    window.dispatchEvent(new CustomEvent('windRoseHide'));
    // Sauvegarde uniquement si panneau déverrouillé ET modifié
    if (!locked && hasChanged) {
      await saveOrientation(localDeg, true);
      setHasChanged(false);
    }
    // Re-verrouiller si il était déverrouillé
    if (!locked) {
      setLocked(true);
      showSuccess("Azimut verrouillé");
    }
  };

  const handleLockToggle = async () => {
    if (locked) {
      // Déverrouillage
      if (!isAnonSession) {
        setLocked(false);
        setHasChanged(false);
        setUnlockStartDeg(localDeg);
        window.dispatchEvent(new CustomEvent('windRoseShow'));
        return;
      }
      const unlocked = typeof window !== 'undefined' && localStorage.getItem('adminUnlocked') === 'true';
      if (!unlocked) {
        const pwd = window.prompt('Mot de passe administrateur ?');
        if (pwd !== 'admin') {
          showError('Mot de passe incorrect');
          return;
        }
        localStorage.setItem('adminUnlocked', 'true');
        showSuccess('Mode administrateur activé');
      }
      setLocked(false);
      setHasChanged(false);
      setUnlockStartDeg(localDeg);
      window.dispatchEvent(new CustomEvent('windRoseShow'));
    } else {
      // Verrouillage
      if (hasChanged) {
        await saveOrientation(localDeg, true);
        setHasChanged(false);
      }
      setLocked(true);
      window.dispatchEvent(new CustomEvent('windRoseHide'));
      showSuccess("Azimut verrouillé");
    }
  };

  const saveOrientation = async (degToSave: number, showToast: boolean = true) => {
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
    if (showToast) {
      showSuccess("Azimut enregistré");
    }
  };

  return (
    <LiquidGlassCard className="flex-shrink-0">
      <div
        className={`${locked ? "px-3 py-0" : "p-3"}`}
        onMouseEnter={handlePanelMouseEnter}
        onMouseLeave={handlePanelMouseLeave}
      >
        <div className={`flex items-center justify-between ${locked ? "h-10" : "mb-2"}`}>
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-indigo-600" />
            <h3 className="text-sm font-medium">Orientation</h3>
            {currentSpace?.latitude != null && currentSpace?.longitude != null && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 flex items-center gap-1 bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-200"
                title="Coordonnées GPS"
              >
                <MapPin size={10} className="text-teal-600" />
                {currentSpace.latitude.toFixed(5)}, {currentSpace.longitude.toFixed(5)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] h-5 px-1.5 ${getAzimuthBadgeClasses(localDeg)}`}
              title="Azimut verrouillé et enregistré"
            >
              {degToCardinal(localDeg)} • {Math.round(localDeg)}°
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleLockToggle}
              aria-label={locked ? "Déverrouiller l'orientation" : "Verrouiller l'orientation"}
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
              onMouseLeave={async () => {
                // Enregistre seulement si déverrouillé et modifié
                if (!locked && hasChanged) {
                  await saveOrientation(localDeg, true);
                  setHasChanged(false);
                }
              }}
            >
              <Slider
                value={[localDeg]}
                onValueChange={(v) => {
                  const deg = v[0];
                  setLocalDeg(deg);
                  setOrientationAzimuth(deg); // live update
                  if (!locked) {
                    // Déclarer une modification si différente du point de départ
                    const ref = unlockStartDeg ?? deg;
                    if (Math.round(deg) !== Math.round(ref)) {
                      setHasChanged(true);
                    }
                  }
                }}
                min={0}
                max={359}
                step={1}
                className="h-1"
              />
            </div>
          </div>
        )}
      </div>
    </LiquidGlassCard>
  );
};

export default OrientationPanel;