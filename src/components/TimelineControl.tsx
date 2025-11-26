"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useState } from 'react';

export const TimelineControl = () => {
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const timeRange = useAppStore((state) => state.timeRange);

  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    if (!isPlaying || !timeRange) return;

    const interval = setInterval(() => {
      setCurrentTimestamp((prev) => {
        const next = prev + (1000 * playbackSpeed);
        if (next > timeRange[1]) {
          setPlaying(false);
          return timeRange[1];
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, timeRange, setCurrentTimestamp, setPlaying]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('fr-FR');
  };

  if (!timeRange) return null;

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {formatTime(currentTimestamp)}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentTimestamp(timeRange[0])}
            >
              <SkipBack size={16} />
            </Button>
            <Button
              size="sm"
              onClick={() => setPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentTimestamp(timeRange[1])}
            >
              <SkipForward size={16} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300">Vitesse:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm bg-white/50 dark:bg-black/50 rounded px-2 py-1"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
            </select>
          </div>
        </div>

        <Slider
          value={[currentTimestamp]}
          min={timeRange[0]}
          max={timeRange[1]}
          step={1000}
          onValueChange={([value]) => setCurrentTimestamp(value)}
          className="w-full"
        />
      </div>
    </LiquidGlassCard>
  );
};