"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Thermometer, Droplets, Wind, CloudRain } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { findClosestDataPoint } from '@/utils/sensorUtils';

interface DewPointDifference {
  timestamp: number;
  difference: number; // interior - exterior
}

const POINTS_BEFORE = 500;
const POINTS_AFTER = 500;

export const TimelineControl = () => {
  const isPlaying = useAppStore((state) => state.isPlaying);
  const setPlaying = useAppStore((state) => state.setPlaying);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const setCurrentTimestamp = useAppStore((state) => state.setCurrentTimestamp);
  const timeRange = useAppStore((state) => state.timeRange);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const setSelectedMetric = useAppStore((state) => state.setSelectedMetric);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const sensors = useAppStore((state) => state.sensors);
  const hasOutdoorData = useAppStore((state) => state.hasOutdoorData);

  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null);
  const [dewPointDifferences, setDewPointDifferences] = useState<DewPointDifference[]>([]);
  const [loadedRanges, setLoadedRanges] = useState<Array<{start: number, end: number}>>([]);
  const [loadingCurve, setLoadingCurve] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Initialize range when timeRange changes
  useEffect(() => {
    if (timeRange && rangeStart === null && rangeEnd === null) {
      setRangeStart(timeRange[0]);
      setRangeEnd(timeRange[1]);
    }
  }, [timeRange, rangeStart, rangeEnd]);

  // Load dew point differences in streaming windows
  useEffect(() => {
    if (!currentSpace || !hasOutdoorData || !timeRange) {
      setDewPointDifferences([]);
      setLoadedRanges([]);
      return;
    }

    const loadDewPointWindow = async () => {
      try {
        const targetDate = new Date(currentTimestamp).toISOString();

        // Check if we already have data for this range
        const needsLoad = !loadedRanges.some(r => 
          r.start <= currentTimestamp && 
          r.end >= currentTimestamp
        );

        if (!needsLoad) return;

        setLoadingCurve(true);

        // Load outdoor data window (500 before + 500 after)
        const { data: outdoorBefore, error: outdoorBeforeError } = await supabase
          .from('sensor_data')
          .select('timestamp, dew_point')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .lt('timestamp', targetDate)
          .order('timestamp', { ascending: false })
          .limit(POINTS_BEFORE);

        if (outdoorBeforeError) throw outdoorBeforeError;

        const { data: outdoorAfter, error: outdoorAfterError } = await supabase
          .from('sensor_data')
          .select('timestamp, dew_point')
          .eq('space_id', 0)
          .eq('sensor_id', 0)
          .gte('timestamp', targetDate)
          .order('timestamp', { ascending: true })
          .limit(POINTS_AFTER);

        if (outdoorAfterError) throw outdoorAfterError;

        const outdoorWindow = [...(outdoorBefore || []).reverse(), ...(outdoorAfter || [])];

        if (outdoorWindow.length === 0) return;

        // Load indoor data for the same window
        const indoorDataPromises = sensors.map(async (sensor) => {
          const { data: beforeData, error: beforeError } = await supabase
            .from('sensor_data')
            .select('timestamp, dew_point')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .lt('timestamp', targetDate)
            .order('timestamp', { ascending: false })
            .limit(POINTS_BEFORE);

          if (beforeError) throw beforeError;

          const { data: afterData, error: afterError } = await supabase
            .from('sensor_data')
            .select('timestamp, dew_point')
            .eq('space_id', currentSpace.id)
            .eq('sensor_id', sensor.id)
            .gte('timestamp', targetDate)
            .order('timestamp', { ascending: true })
            .limit(POINTS_AFTER);

          if (afterError) throw afterError;

          const windowData = [...(beforeData || []).reverse(), ...(afterData || [])];
          return { sensorId: sensor.id, data: windowData };
        });

        const indoorDataResults = await Promise.all(indoorDataPromises);

        // Calculate differences for this window
        const newDifferences: DewPointDifference[] = [];

        outdoorWindow.forEach((outdoorPoint) => {
          const timestamp = new Date(outdoorPoint.timestamp).getTime();
          const outdoorDewPoint = outdoorPoint.dew_point;

          let totalIndoorDewPoint = 0;
          let count = 0;

          indoorDataResults.forEach(({ data }) => {
            if (data.length === 0) return;

            const closestIndoor = findClosestDataPoint(
              data.map(d => ({
                timestamp: new Date(d.timestamp).getTime(),
                temperature: 0,
                humidity: 0,
                absoluteHumidity: 0,
                dewPoint: d.dew_point
              })),
              timestamp
            );

            totalIndoorDewPoint += closestIndoor.dewPoint;
            count++;
          });

          if (count > 0) {
            const avgIndoorDewPoint = totalIndoorDewPoint / count;
            const difference = avgIndoorDewPoint - outdoorDewPoint;
            newDifferences.push({ timestamp, difference });
          }
        });

        // Merge with existing data
        const mergedData = [...dewPointDifferences, ...newDifferences]
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter((item, index, arr) => 
            index === 0 || item.timestamp !== arr[index - 1].timestamp
          );

        setDewPointDifferences(mergedData);

        // Update loaded ranges
        if (newDifferences.length > 0) {
          const minTimestamp = Math.min(...newDifferences.map(d => d.timestamp));
          const maxTimestamp = Math.max(...newDifferences.map(d => d.timestamp));
          
          setLoadedRanges(prev => [...prev, {
            start: minTimestamp,
            end: maxTimestamp
          }]);
        }
      } catch (error) {
        console.error('Error loading dew point window:', error);
      } finally {
        setLoadingCurve(false);
      }
    };

    loadDewPointWindow();
  }, [currentSpace, hasOutdoorData, timeRange, sensors, currentTimestamp]);

  // Calculate min/max difference for scaling
  const { minDiff, maxDiff, diffRange } = useMemo(() => {
    if (dewPointDifferences.length === 0) {
      return { minDiff: 0, maxDiff: 0, diffRange: 0 };
    }

    const diffs = dewPointDifferences.map(d => d.difference);
    const min = Math.min(...diffs);
    const max = Math.max(...diffs);
    const range = max - min;

    return { minDiff: min, maxDiff: max, diffRange: range };
  }, [dewPointDifferences]);

  // Filter visible points with fade-out at edges
  const visibleDewPointDifferences = useMemo(() => {
    if (dewPointDifferences.length === 0) return [];

    // Find the loaded range that contains current timestamp
    const currentRange = loadedRanges.find(r => 
      r.start <= currentTimestamp && 
      r.end >= currentTimestamp
    );

    if (!currentRange) return [];

    // Get points in the loaded range
    return dewPointDifferences.filter(point => 
      point.timestamp >= currentRange.start && 
      point.timestamp <= currentRange.end
    );
  }, [dewPointDifferences, currentTimestamp, loadedRanges]);

  // Playback loop
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

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !timeRange || isDragging) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTimestamp = timeRange[0] + (timeRange[1] - timeRange[0]) * percentage;

    const clampedTimestamp = Math.max(rangeStart || timeRange[0], Math.min(newTimestamp, rangeEnd || timeRange[1]));
    setCurrentTimestamp(clampedTimestamp);
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

  const handleWheel = (e: React.WheelEvent) => {
    if (!timeRange || !rangeStart || !rangeEnd) return;

    e.preventDefault();

    const delta = e.deltaX !== 0 ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    
    if (delta === 0) return;

    const rangeSize = rangeEnd - rangeStart;
    const timeShift = (delta / 100) * rangeSize * 0.01;

    const newTimestamp = currentTimestamp + timeShift;
    const clampedTimestamp = Math.max(rangeStart, Math.min(newTimestamp, rangeEnd));
    
    setCurrentTimestamp(clampedTimestamp);
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

  const getColorForDifference = (difference: number): string => {
    if (diffRange === 0) return 'rgb(128, 128, 128)';

    // Normalize difference to 0-1 range
    const normalized = (difference - minDiff) / diffRange;

    // Green (max) to Blue (min) gradient
    // Green: rgb(34, 197, 94) - high difference (max)
    // Blue: rgb(59, 130, 246) - low difference (min)
    const r = Math.round(34 + (59 - 34) * (1 - normalized));
    const g = Math.round(197 - (197 - 130) * (1 - normalized));
    const b = Math.round(94 + (246 - 94) * (1 - normalized));

    return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculate opacity for fade-out effect at edges
  const getOpacityForPoint = (timestamp: number, index: number, totalPoints: number): number => {
    const currentRange = loadedRanges.find(r => 
      r.start <= currentTimestamp && 
      r.end >= currentTimestamp
    );

    if (!currentRange) return 0;

    const fadeZone = 50; // Number of points for fade effect
    
    // Fade at start
    if (index < fadeZone) {
      return index / fadeZone;
    }
    
    // Fade at end
    if (index > totalPoints - fadeZone) {
      return (totalPoints - index) / fadeZone;
    }
    
    return 1;
  };

  // Generate ultra-smooth Bezier curve path with tension control
  const generateSmoothPath = (points: DewPointDifference[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      const x = getPosition(points[0].timestamp);
      const y = diffRange > 0 
        ? 100 - ((points[0].difference - minDiff) / diffRange) * 80 - 10
        : 50;
      return `M ${x},${y}`;
    }

    const coords = points.map(point => ({
      x: getPosition(point.timestamp),
      y: diffRange > 0 
        ? 100 - ((point.difference - minDiff) / diffRange) * 80 - 10
        : 50
    }));

    let path = `M ${coords[0].x},${coords[0].y}`;

    // Use Catmull-Rom spline for ultra-smooth curves
    const tension = 0.5; // 0 = sharp corners, 1 = very smooth

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      // Calculate control points using Catmull-Rom
      const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
      const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
      const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return path;
  };

  if (!timeRange || rangeStart === null || rangeEnd === null) return null;

  const dayMarkers = getDayMarkers();
  const smoothPath = generateSmoothPath(visibleDewPointDifferences);

  // Calculate opacity based on data availability
  const curveOpacity = visibleDewPointDifferences.length > 0 ? 1 : 0;

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        {/* Top Controls Row */}
        <div className="relative flex items-center justify-between gap-4">
          {/* Left: Metric selector */}
          <TooltipPrimitive.Provider delayDuration={300}>
            <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)}>
              <TabsList className="bg-white/30 dark:bg-black/30 backdrop-blur-sm h-9 p-1 gap-1">
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <TabsTrigger 
                      value="temperature" 
                      className="relative flex items-center gap-1.5 h-7 px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                    >
                      {selectedMetric === 'temperature' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-md"></div>
                      )}
                      <Thermometer size={14} className={selectedMetric === 'temperature' ? 'text-red-600 relative z-10' : 'text-red-500 relative z-10'} />
                      <span className={`text-xs font-medium relative z-10 ${selectedMetric === 'temperature' ? 'text-red-700 dark:text-red-500' : ''}`}>T°</span>
                    </TabsTrigger>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                      <p className="font-medium mb-1">Température (°C)</p>
                      <p className="text-gray-300">Mesure la chaleur de l'air ambiant</p>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>

                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <TabsTrigger 
                      value="humidity" 
                      className="relative flex items-center gap-1.5 h-7 px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                    >
                      {selectedMetric === 'humidity' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-md"></div>
                      )}
                      <Droplets size={14} className={selectedMetric === 'humidity' ? 'text-blue-600 relative z-10' : 'text-blue-500 relative z-10'} />
                      <span className={`text-xs font-medium relative z-10 ${selectedMetric === 'humidity' ? 'text-blue-700 dark:text-blue-500' : ''}`}>HR</span>
                    </TabsTrigger>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                      <p className="font-medium mb-1">Humidité Relative (%)</p>
                      <p className="text-gray-300">Pourcentage de vapeur d'eau dans l'air</p>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>

                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <TabsTrigger 
                      value="absoluteHumidity" 
                      className="relative flex items-center gap-1.5 h-7 px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                    >
                      {selectedMetric === 'absoluteHumidity' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 rounded-md"></div>
                      )}
                      <Wind size={14} className={selectedMetric === 'absoluteHumidity' ? 'text-cyan-600 relative z-10' : 'text-cyan-500 relative z-10'} />
                      <span className={`text-xs font-medium relative z-10 ${selectedMetric === 'absoluteHumidity' ? 'text-cyan-700 dark:text-cyan-500' : ''}`}>HA</span>
                    </TabsTrigger>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                      <p className="font-medium mb-1">Humidité Absolue (g/m³)</p>
                      <p className="text-gray-300">Quantité réelle d'eau dans l'air</p>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>

                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <TabsTrigger 
                      value="dewPoint" 
                      className="relative flex items-center gap-1.5 h-7 px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                    >
                      {selectedMetric === 'dewPoint' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-md"></div>
                      )}
                      <CloudRain size={14} className={selectedMetric === 'dewPoint' ? 'text-purple-600 relative z-10' : 'text-purple-500 relative z-10'} />
                      <span className={`text-xs font-medium relative z-10 ${selectedMetric === 'dewPoint' ? 'text-purple-700 dark:text-purple-500' : ''}`}>PR</span>
                    </TabsTrigger>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                      <p className="font-medium mb-1">Point de Rosée (°C)</p>
                      <p className="text-gray-300">Température de condensation</p>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </TabsList>
            </Tabs>
          </TooltipPrimitive.Provider>

          {/* Center: Playback controls */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <TooltipPrimitive.Provider delayDuration={300}>
              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentTimestamp(rangeStart)}
                    className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-8 w-8 p-0"
                  >
                    <SkipBack size={14} />
                  </Button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                    Retour au début
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>

              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setPlaying(!isPlaying)}
                    className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-8 w-8 p-0"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </Button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                    {isPlaying ? 'Pause' : 'Lecture'}
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>

              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCurrentTimestamp(rangeEnd)}
                    className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-8 w-8 p-0"
                  >
                    <SkipForward size={14} />
                  </Button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                    Aller à la fin
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            </TooltipPrimitive.Provider>
          </div>

          {/* Right: Playback speed */}
          <TooltipPrimitive.Provider delayDuration={300}>
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="text-xs bg-white/30 dark:bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={60}>1 min/s</option>
                  <option value={300}>5x</option>
                  <option value={600}>10x</option>
                  <option value={1800}>30x</option>
                  <option value={3600}>60x</option>
                </select>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs">
                  <p className="font-medium mb-1">Vitesse de lecture</p>
                  <p>Contrôle la vitesse de défilement des données</p>
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </TooltipPrimitive.Provider>
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
            onClick={handleTimelineClick}
            onWheel={handleWheel}
          >
            {/* Dew Point Difference Curve - Ultra Smooth with Fade */}
            {hasOutdoorData && visibleDewPointDifferences.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500"
                style={{ opacity: curveOpacity }}
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    {visibleDewPointDifferences.map((point, idx) => {
                      const position = getPosition(point.timestamp);
                      const color = getColorForDifference(point.difference);
                      return (
                        <stop
                          key={idx}
                          offset={`${position}%`}
                          stopColor={color}
                        />
                      );
                    })}
                  </linearGradient>
                </defs>
                <path
                  d={smoothPath}
                  fill="none"
                  stroke="url(#curveGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {/* Day markers */}
            {dayMarkers.map((marker, idx) => {
              const pos = getPosition(marker);
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
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
              className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 backdrop-blur-sm pointer-events-none"
              style={{
                left: `${getPosition(rangeStart)}%`,
                width: `${getPosition(rangeEnd) - getPosition(rangeStart)}%`
              }}
            />

            {/* Range start handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
              style={{ left: `${getPosition(rangeStart)}%`, marginLeft: '-6px' }}
              onMouseDown={handleMouseDown('start')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

            {/* Range end handle */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
              style={{ left: `${getPosition(rangeEnd)}%`, marginLeft: '-6px' }}
              onMouseDown={handleMouseDown('end')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

            {/* Current position cursor */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-yellow-400 to-orange-500 cursor-ew-resize shadow-lg z-20"
              style={{ left: `${getPosition(currentTimestamp)}%`, marginLeft: '-1px' }}
              onMouseDown={handleMouseDown('current')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border border-white shadow-lg"></div>
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full border border-white shadow-lg"></div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
              <span>Début</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
              <span>Fin</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"></div>
              <span>Actuel</span>
            </div>
            {hasOutdoorData && dewPointDifferences.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full"></div>
                <span>ΔPR: {minDiff.toFixed(1)}°C → {maxDiff.toFixed(1)}°C</span>
              </div>
            )}
          </div>
          <span>
            Durée: {((rangeEnd - rangeStart) / (1000 * 60 * 60)).toFixed(1)}h
          </span>
        </div>
      </div>
    </LiquidGlassCard>
  );
};