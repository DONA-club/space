"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

export const TimelineControl = () => {
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const timeRange = useAppStore((state) => state.timeRange);

  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize range when timeRange changes
  useEffect(() => {
    if (timeRange && rangeStart === null && rangeEnd === null) {
      setRangeStart(timeRange[0]);
      setRangeEnd(timeRange[1]);
    }
  }, [timeRange, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!isPlaying || !rangeStart || !rangeEnd) return;

    const interval = setInterval(() => {
      setCurrentTimestamp((prev) => {
        const next = prev + (1000 * playbackSpeed);
        if (next > rangeEnd) {
          setPlaying(false);
          return rangeEnd;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, rangeStart, rangeEnd, setCurrentTimestamp, setPlaying]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  };

  const handleMouseDown = (type: 'start' | 'end' | 'current') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || !timeRange) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTimestamp = timeRange[0] + (timeRange[1] - timeRange[0]) * percentage;

    if (isDragging === 'start') {
      setRangeStart(Math.min(newTimestamp, rangeEnd || timeRange[1]));
    } else if (isDragging === 'end') {
      setRangeEnd(Math.max(newTimestamp, rangeStart || timeRange[0]));
    } else if (isDragging === 'current') {
      setCurrentTimestamp(Math.max(rangeStart || timeRange[0], Math.min(newTimestamp, rangeEnd || timeRange[1])));
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, rangeStart, rangeEnd, timeRange]);

  // Generate day markers
  const getDayMarkers = () => {
    if (!timeRange) return [];
    
    const markers: number[] = [];
    const startDate = new Date(timeRange[0]);
    startDate.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1);
    
    while (currentDate.getTime() <= timeRange[1]) {
      markers.push(currentDate.getTime());
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return markers;
  };

  const getPosition = (timestamp: number) => {
    if (!timeRange) return 0;
    return ((timestamp - timeRange[0]) / (timeRange[1] - timeRange[0])) * 100;
  };

  if (!timeRange || rangeStart === null || rangeEnd === null) return null;

  const dayMarkers = getDayMarkers();

  return (
    <LiquidGlassCard className="p-6">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentTimestamp(rangeStart)}
              className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50"
            >
              <SkipBack size={16} />
            </Button>
            <Button
              size="sm"
              onClick={() => setPlaying(!isPlaying)}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentTimestamp(rangeEnd)}
              className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50"
            >
              <SkipForward size={16} />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">Vitesse:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="text-sm bg-white/30 dark:bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={60}>1 min/s</option>
              <option value={120}>2x</option>
              <option value={300}>5x</option>
              <option value={600}>10x</option>
              <option value={1800}>30x</option>
            </select>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
            <span>{formatTime(rangeStart)}</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">{formatTime(currentTimestamp)}</span>
            <span>{formatTime(rangeEnd)}</span>
          </div>

          <div 
            ref={timelineRef}
            className="relative h-16 bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-xl border border-white/30 overflow-visible cursor-pointer"
          >
            {/* Day markers */}
            {dayMarkers.map((marker, idx) => {
              const pos = getPosition(marker);
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col items-center"
                  style={{ left: `${pos}%` }}
                >
                  <div className="w-px h-full bg-gray-400/50"></div>
                  <span className="absolute -bottom-5 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(marker)}
                  </span>
                </div>
              );
            })}

            {/* Selected range highlight */}
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 backdrop-blur-sm"
              style={{
                left: `${getPosition(rangeStart)}%`,
                width: `${getPosition(rangeEnd) - getPosition(rangeStart)}%`
              }}
            />

            {/* Range start handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50"
              style={{ left: `${getPosition(rangeStart)}%`, marginLeft: '-8px' }}
              onMouseDown={handleMouseDown('start')}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

            {/* Range end handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50"
              style={{ left: `${getPosition(rangeEnd)}%`, marginLeft: '-8px' }}
              onMouseDown={handleMouseDown('end')}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

            {/* Current position cursor */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-400 to-orange-500 cursor-ew-resize shadow-lg"
              style={{ left: `${getPosition(currentTimestamp)}%`, marginLeft: '-2px' }}
              onMouseDown={handleMouseDown('current')}
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-2 border-white shadow-lg"></div>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border-2 border-white shadow-lg"></div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
              <span>Début</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
              <span>Fin</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
              <span>Position actuelle</span>
            </div>
          </div>
          <span>
            Durée: {((rangeEnd - rangeStart) / (1000 * 60 * 60)).toFixed(1)}h
          </span>
        </div>
      </div>
    </LiquidGlassCard>
  );
};