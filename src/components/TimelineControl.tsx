"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Thermometer, Droplets, Wind, CloudRain, Repeat } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { findClosestDataPoint } from '@/utils/sensorUtils';

interface DewPointDifference {
  timestamp: number;
  difference: number;
}

const POINTS_BEFORE = 500;
const POINTS_AFTER = 500;
const PRELOAD_THRESHOLD = 333;
const COLOR_ZONE_RADIUS = 0.15;

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
  const [loadingRanges, setLoadingRanges] = useState<Set<string>>(new Set());
  const [loopEnabled, setLoopEnabled] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastScrollLoadRef = useRef<number>(0);
  const lastPlaybackLoadRef = useRef<number>(0);

  useEffect(() => {
    if (timeRange && rangeStart === null && rangeEnd === null) {
      setRangeStart(timeRange[0]);
      setRangeEnd(timeRange[1]);
    }
  }, [timeRange, rangeStart, rangeEnd]);

  const hasDataAtTimestamp = (timestamp: number): boolean => {
    return loadedRanges.some(r => r.start <= timestamp && r.end >= timestamp);
  };

  const getFurthestLoadedTimestamp = (from: number, direction: 'forward' | 'backward'): number => {
    const relevantRanges = loadedRanges.filter(r => 
      direction === 'forward' ? r.start >= from : r.end <= from
    );
    
    if (relevantRanges.length === 0) return from;
    
    if (direction === 'forward') {
      return Math.max(...relevantRanges.map(r => r.end));
    } else {
      return Math.min(...relevantRanges.map(r => r.start));
    }
  };

  const loadDewPointWindow = async (targetTimestamp: number) => {
    if (!currentSpace || !hasOutdoorData || !timeRange) return;

    try {
      const targetDate = new Date(targetTimestamp).toISOString();
      const rangeKey = `${targetTimestamp}`;

      if (loadingRanges.has(rangeKey)) return;

      const alreadyLoaded = loadedRanges.some(r => 
        r.start <= targetTimestamp && 
        r.end >= targetTimestamp
      );

      if (alreadyLoaded) return;

      setLoadingRanges(prev => new Set(prev).add(rangeKey));

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
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', 0)
        .gte('timestamp', targetDate)
        .order('timestamp', { ascending: true })
        .limit(POINTS_AFTER);

      if (outdoorAfterError) throw outdoorAfterError;

      const outdoorWindow = [...(outdoorBefore || []).reverse(), ...(outdoorAfter || [])];

      if (outdoorWindow.length === 0) {
        setLoadingRanges(prev => {
          const next = new Set(prev);
          next.delete(rangeKey);
          return next;
        });
        return;
      }

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

      setDewPointDifferences(prev => {
        const merged = [...prev, ...newDifferences]
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter((item, index, arr) => 
            index === 0 || item.timestamp !== arr[index - 1].timestamp
          );
        return merged;
      });

      if (newDifferences.length > 0) {
        const minTimestamp = Math.min(...newDifferences.map(d => d.timestamp));
        const maxTimestamp = Math.max(...newDifferences.map(d => d.timestamp));
        
        setLoadedRanges(prev => [...prev, {
          start: minTimestamp,
          end: maxTimestamp
        }]);
      }

      setLoadingRanges(prev => {
        const next = new Set(prev);
        next.delete(rangeKey);
        return next;
      });
    } catch (error) {
      console.error('Error loading dew point window:', error);
      setLoadingRanges(prev => {
        const next = new Set(prev);
        next.delete(`${targetTimestamp}`);
        return next;
      });
    }
  };

  useEffect(() => {
    if (!currentSpace || !hasOutdoorData || !timeRange || !rangeStart || !rangeEnd) return;

    loadDewPointWindow(currentTimestamp);
  }, [currentSpace, hasOutdoorData, timeRange, sensors, rangeStart, rangeEnd]);

  useEffect(() => {
    if (!isPlaying || !rangeStart || !rangeEnd || !currentSpace || !hasOutdoorData) return;

    const currentRange = loadedRanges.find(r => r.start <= currentTimestamp && r.end >= currentTimestamp);
    if (currentRange) {
      const pointsToEnd = Math.floor((currentRange.end - currentTimestamp) / (60 * 1000));
      
      if (pointsToEnd < PRELOAD_THRESHOLD) {
        const now = Date.now();
        if (now - lastPlaybackLoadRef.current > 1000) {
          lastPlaybackLoadRef.current = now;
          const preloadTimestamp = currentRange.end + (PRELOAD_THRESHOLD * 60 * 1000);
          if (preloadTimestamp <= rangeEnd) {
            loadDewPointWindow(preloadTimestamp);
          }
        }
      }
    }
  }, [currentTimestamp, isPlaying, rangeStart, rangeEnd, loadedRanges, currentSpace, hasOutdoorData]);

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

  useEffect(() => {
    if (!isPlaying || !rangeStart || !rangeEnd) return;

    const interval = setInterval(() => {
      setCurrentTimestamp((prev) => {
        const next = prev + (1000 * playbackSpeed);
        
        if (!hasDataAtTimestamp(next)) {
          const furthest = getFurthestLoadedTimestamp(prev, 'forward');
          if (furthest > prev && furthest <= rangeEnd) {
            return furthest;
          }
        }
        
        if (next > rangeEnd) {
          if (loopEnabled) {
            return rangeStart;
          } else {
            setPlaying(false);
            return rangeEnd;
          }
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, rangeStart, rangeEnd, setCurrentTimestamp, setPlaying, loopEnabled, hasDataAtTimestamp, getFurthestLoadedTimestamp]);

  useEffect(() => {
    const timelineElement = timelineRef.current;
    if (!timelineElement || !timeRange || !rangeStart || !rangeEnd) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      
      if (delta === 0) return;

      const rangeSize = rangeEnd - rangeStart;
      const timeShift = (delta / 100) * rangeSize * 0.01;

      const newTimestamp = currentTimestamp + timeShift;
      
      let clampedTimestamp = newTimestamp;
      
      if (!hasDataAtTimestamp(newTimestamp)) {
        if (timeShift > 0) {
          const furthest = getFurthestLoadedTimestamp(currentTimestamp, 'forward');
          clampedTimestamp = Math.min(newTimestamp, furthest);
        } else {
          const furthest = getFurthestLoadedTimestamp(currentTimestamp, 'backward');
          clampedTimestamp = Math.max(newTimestamp, furthest);
        }
      }
      
      clampedTimestamp = Math.max(rangeStart, Math.min(clampedTimestamp, rangeEnd));
      
      setCurrentTimestamp(clampedTimestamp);
      
      const now = Date.now();
      if (now - lastScrollLoadRef.current > 500) {
        lastScrollLoadRef.current = now;
        
        const direction = timeShift > 0 ? 'forward' : 'backward';
        const preloadTimestamp = direction === 'forward'
          ? clampedTimestamp + (PRELOAD_THRESHOLD * 60 * 1000)
          : clampedTimestamp - (PRELOAD_THRESHOLD * 60 * 1000);
        
        if (preloadTimestamp >= rangeStart && preloadTimestamp <= rangeEnd) {
          loadDewPointWindow(preloadTimestamp);
        }
      }
    };

    timelineElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      timelineElement.removeEventListener('wheel', handleWheel);
    };
  }, [timeRange, rangeStart, rangeEnd, currentTimestamp, setCurrentTimestamp, hasDataAtTimestamp, getFurthestLoadedTimestamp]);

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

    let clampedTimestamp = Math.max(rangeStart || timeRange[0], Math.min(newTimestamp, rangeEnd || timeRange[1]));
    
    setCurrentTimestamp(clampedTimestamp);
    loadDewPointWindow(clampedTimestamp);
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
      let clampedTimestamp = Math.max(rangeStart || timeRange[0], Math.min(newTimestamp, rangeEnd || timeRange[1]));
      
      if (!hasDataAtTimestamp(clampedTimestamp)) {
        const direction = clampedTimestamp > currentTimestamp ? 'forward' : 'backward';
        const furthest = getFurthestLoadedTimestamp(currentTimestamp, direction);
        clampedTimestamp = direction === 'forward' 
          ? Math.min(clampedTimestamp, furthest)
          : Math.max(clampedTimestamp, furthest);
      }
      
      setCurrentTimestamp(clampedTimestamp);
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
  }, [isDragging, rangeStart, rangeEnd, timeRange, currentTimestamp]);

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

    const normalized = (difference - minDiff) / diffRange;

    const r = Math.round(34 + (59 - 34) * (1 - normalized));
    const g = Math.round(197 - (197 - 130) * (1 - normalized));
    const b = Math.round(94 + (246 - 94) * (1 - normalized));

    return `rgb(${r}, ${g}, ${b})`;
  };

  const getYPosition = (value: number): number => {
    if (diffRange === 0) return 50;
    return 100 - ((value - minDiff) / diffRange) * 80 - 10;
  };

  const getZeroLineY = (): number => {
    return getYPosition(0);
  };

  const generateSmoothPath = (points: DewPointDifference[]): string => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      const x = getPosition(points[0].timestamp);
      const y = getYPosition(points[0].difference);
      return `M ${x},${y}`;
    }

    const coords = points.map(point => ({
      x: getPosition(point.timestamp),
      y: getYPosition(point.difference)
    }));

    let path = `M ${coords[0].x},${coords[0].y}`;

    const tension = 0.7;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
      const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
      const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
      const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

      path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }

    return path;
  };

  const generateNegativeFillPath = (points: DewPointDifference[]): string => {
    if (points.length === 0) return '';
    
    const zeroY = getZeroLineY();
    const coords = points.map(point => ({
      x: getPosition(point.timestamp),
      y: getYPosition(point.difference),
      isNegative: point.difference < 0
    }));

    let path = '';
    let inNegativeZone = false;
    
    for (let i = 0; i < coords.length; i++) {
      const point = coords[i];
      
      if (point.isNegative && !inNegativeZone) {
        path += `M ${point.x},${zeroY} L ${point.x},${point.y}`;
        inNegativeZone = true;
      } else if (point.isNegative && inNegativeZone) {
        path += ` L ${point.x},${point.y}`;
      } else if (!point.isNegative && inNegativeZone) {
        path += ` L ${point.x},${zeroY} Z`;
        inNegativeZone = false;
      }
    }
    
    if (inNegativeZone && coords.length > 0) {
      const lastPoint = coords[coords.length - 1];
      path += ` L ${lastPoint.x},${zeroY} Z`;
    }
    
    return path;
  };

  if (!timeRange || rangeStart === null || rangeEnd === null) return null;

  const dayMarkers = getDayMarkers();
  const smoothPath = generateSmoothPath(dewPointDifferences);
  const negativeFillPath = generateNegativeFillPath(dewPointDifferences);
  const zeroLineY = getZeroLineY();
  const hasNegativeValues = dewPointDifferences.some(d => d.difference < 0);

  const rangeStartPos = getPosition(rangeStart);
  const rangeEndPos = getPosition(rangeEnd);
  const currentPos = getPosition(currentTimestamp);
  
  const colorZoneStart = Math.max(rangeStartPos, currentPos - (COLOR_ZONE_RADIUS * 100));
  const colorZoneEnd = Math.min(rangeEndPos, currentPos + (COLOR_ZONE_RADIUS * 100));

  return (
    <LiquidGlassCard className="p-4">
      <div className="space-y-4">
        <div className="relative flex items-center justify-between gap-4">
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
                    variant={loopEnabled ? "default" : "outline"}
                    onClick={() => setLoopEnabled(!loopEnabled)}
                    className={loopEnabled 
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 h-8 w-8 p-0"
                      : "bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-8 w-8 p-0"
                    }
                  >
                    <Repeat size={14} />
                  </Button>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs">
                    {loopEnabled ? 'Boucle activée' : 'Activer la boucle'}
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
          >
            {hasOutdoorData && hasNegativeValues && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <path
                  d={negativeFillPath}
                  fill="rgba(249, 115, 22, 0.2)"
                  stroke="none"
                />
              </svg>
            )}

            {hasOutdoorData && hasNegativeValues && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <line
                  x1="0"
                  y1={zeroLineY}
                  x2="100"
                  y2={zeroLineY}
                  stroke="rgba(249, 115, 22, 0.6)"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {hasOutdoorData && dewPointDifferences.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <path
                  d={smoothPath}
                  fill="none"
                  stroke="rgba(156, 163, 175, 0.4)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {hasOutdoorData && dewPointDifferences.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    {dewPointDifferences.map((point, idx) => {
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
                  <mask id="colorZoneMask">
                    <rect x="0" y="0" width="100" height="100" fill="black" />
                    <rect 
                      x={`${colorZoneStart}`}
                      y="0" 
                      width={`${colorZoneEnd - colorZoneStart}`}
                      height="100" 
                      fill="white"
                    />
                  </mask>
                </defs>
                <path
                  d={smoothPath}
                  fill="none"
                  stroke="url(#curveGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  mask="url(#colorZoneMask)"
                />
              </svg>
            )}

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

            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 backdrop-blur-sm pointer-events-none"
              style={{
                left: `${getPosition(rangeStart)}%`,
                width: `${getPosition(rangeEnd) - getPosition(rangeStart)}%`
              }}
            />

            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
              style={{ left: `${getPosition(rangeStart)}%`, marginLeft: '-6px' }}
              onMouseDown={handleMouseDown('start')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
              style={{ left: `${getPosition(rangeEnd)}%`, marginLeft: '-6px' }}
              onMouseDown={handleMouseDown('end')}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full"></div>
            </div>

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

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
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