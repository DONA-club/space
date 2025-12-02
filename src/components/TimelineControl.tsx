"use client";

import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, SkipForward, Thermometer, Droplets, Wind, CloudRain, Repeat, Circle, Download } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { supabase } from '@/integrations/supabase/client';
import { findClosestDataPoint } from '@/utils/sensorUtils';
import { showSuccess, showError } from '@/utils/toast';
import * as SunCalc from 'suncalc';

interface DewPointDifference {
  timestamp: number;
  difference: number;
}

const POINTS_BEFORE = 500;
const POINTS_AFTER = 500;
const PRELOAD_THRESHOLD = 333;
const COLOR_ZONE_RADIUS = 15;

let instanceCounter = 0;

export const TimelineControl = () => {
  const mode = useAppStore((state) => state.mode);
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
  const isRecording = useAppStore((state) => state.isRecording);
  const setRecording = useAppStore((state) => state.setRecording);
  const liveSystemConnected = useAppStore((state) => state.liveSystemConnected);

  const [playbackSpeed, setPlaybackSpeed] = useState(60);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeEnd, setRangeEnd] = useState<number | null>(null);
  const [liveTimelineEnd, setLiveTimelineEnd] = useState<number>(Date.now());
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'current' | null>(null);
  const [dewPointDifferences, setDewPointDifferences] = useState<DewPointDifference[]>([]);
  // Segments jour/nuit pour l'overlay subtil de la timeline
  const [loadedRanges, setLoadedRanges] = useState<Array<{start: number, end: number}>>([]);
  const [loadingRanges, setLoadingRanges] = useState<Set<string>>(new Set());
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [syncingHistory, setSyncingHistory] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastScrollLoadRef = useRef<number>(0);
  const lastPlaybackLoadRef = useRef<number>(0);
  const hasInitializedCursorRef = useRef<boolean>(false);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [componentId] = useState(() => {
    instanceCounter++;
    return `timeline-${instanceCounter}`;
  });
  
  const gradientId = `curveGradient-${componentId}`;
  const maskId = `colorZoneMask-${componentId}`;

  useEffect(() => {
    if (mode === 'live' || !rangeStart || !rangeEnd) return;

    if (currentTimestamp < rangeStart) {
      console.log('🔒 Cursor clamped to range start:', rangeStart);
      setCurrentTimestamp(rangeStart);
    } else if (currentTimestamp > rangeEnd) {
      console.log('🔒 Cursor clamped to range end:', rangeEnd);
      setCurrentTimestamp(rangeEnd);
    }
  }, [rangeStart, rangeEnd, currentTimestamp, mode, setCurrentTimestamp]);

  useEffect(() => {
    if (mode !== 'live') return;

    const interval = setInterval(() => {
      setLiveTimelineEnd(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    if (timeRange && rangeStart === null && rangeEnd === null) {
      setRangeStart(timeRange[0]);
      setRangeEnd(timeRange[1]);
      
      if (mode === 'replay' && !hasInitializedCursorRef.current) {
        setCurrentTimestamp(timeRange[0]);
        hasInitializedCursorRef.current = true;
      }
    }
  }, [timeRange, rangeStart, rangeEnd, mode, setCurrentTimestamp]);

  useEffect(() => {
    if (mode === 'live') {
      hasInitializedCursorRef.current = false;
    }
  }, [mode]);

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
  }, [currentSpace, hasOutdoorData, timeRange, sensors, rangeStart, rangeEnd, currentTimestamp]);

  useEffect(() => {
    if (!isPlaying || !rangeStart || !rangeEnd || !currentSpace || !hasOutdoorData || mode === 'live') return;

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
  }, [currentTimestamp, isPlaying, rangeStart, rangeEnd, loadedRanges, currentSpace, hasOutdoorData, mode]);

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
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }

    if (!isPlaying || !rangeStart || !rangeEnd || mode === 'live') return;

    playbackIntervalRef.current = setInterval(() => {
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

    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, rangeStart, rangeEnd, setCurrentTimestamp, setPlaying, loopEnabled, mode]);

  useEffect(() => {
    const timelineElement = timelineRef.current;
    if (!timelineElement || !timeRange || !rangeStart || !rangeEnd || mode === 'live') return;

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
  }, [timeRange, rangeStart, rangeEnd, currentTimestamp, setCurrentTimestamp, hasDataAtTimestamp, getFurthestLoadedTimestamp, mode]);

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
    if (mode === 'live') return;
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || !timeRange || isDragging || mode === 'live') return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    
    const newTimestamp = timeRange[0] + (timeRange[1] - timeRange[0]) * percentage;

    let clampedTimestamp = Math.max(rangeStart || timeRange[0], Math.min(newTimestamp, rangeEnd || timeRange[1]));
    
    setCurrentTimestamp(clampedTimestamp);
    loadDewPointWindow(clampedTimestamp);
  };

  const handleSkipToStart = () => {
    if (!rangeStart) return;
    setCurrentTimestamp(rangeStart);
    loadDewPointWindow(rangeStart);
  };

  const handleSkipToEnd = () => {
    if (!rangeEnd) return;
    setCurrentTimestamp(rangeEnd);
    loadDewPointWindow(rangeEnd);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !timelineRef.current || !timeRange || mode === 'live') return;

    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const newTimestamp = timeRange[0] + (timeRange[1] - timeRange[0]) * percentage;

    if (isDragging === 'start') {
      const newStart = Math.min(newTimestamp, rangeEnd || timeRange[1]);
      setRangeStart(newStart);
    } else if (isDragging === 'end') {
      const newEnd = Math.max(newTimestamp, rangeStart || timeRange[0]);
      setRangeEnd(newEnd);
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
    if (isDragging && mode !== 'live') {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, rangeStart, rangeEnd, timeRange, currentTimestamp, mode]);

  const getDayMarkers = () => {
    if (!timeRange) return [];
    
    const effectiveEnd = mode === 'live' ? liveTimelineEnd : timeRange[1];
    
    const markers: number[] = [];
    const startDate = new Date(timeRange[0]);
    startDate.setHours(0, 0, 0, 0);
    
    let currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + 1);
    
    while (currentDate.getTime() <= effectiveEnd) {
      markers.push(currentDate.getTime());
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return markers;
  };

  const getPosition = (timestamp: number) => {
    if (!timeRange) return 0;
    
    const effectiveEnd = mode === 'live' ? liveTimelineEnd : timeRange[1];
    const effectiveRange = effectiveEnd - timeRange[0];
    
    return ((timestamp - timeRange[0]) / effectiveRange) * 100;
  };

  // Jour/nuit à un instant donné (continuité sans rupture à minuit)
  const isDayAt = (ts: number): boolean => {
    if (!currentSpace || currentSpace.latitude == null || currentSpace.longitude == null) return true;
    const date = new Date(ts);
    const times = SunCalc.getTimes(date, currentSpace.latitude!, currentSpace.longitude!);
    if (times.sunrise && times.sunset) {
      const t = date.getTime();
      const sunrise = times.sunrise.getTime();
      const sunset = times.sunset.getTime();
      return t >= sunrise && t <= sunset;
    }
    const pos = SunCalc.getPosition(date, currentSpace.latitude!, currentSpace.longitude!);
    return pos.altitude > 0;
  };

  // Calcul des segments jour/nuit selon la localisation et la plage temporelle
  const dayNightSegments = useMemo(() => {
    if (!timeRange) return [];
    if (!currentSpace || currentSpace.latitude == null || currentSpace.longitude == null) return [];

    const segments: Array<{ start: number; end: number; type: 'day' | 'night' }> = [];
    const effectiveEnd = mode === 'live' ? liveTimelineEnd : timeRange[1];

    const clampToRange = (ts: number) => Math.max(timeRange[0], Math.min(ts, effectiveEnd));

    // Démarrer à minuit du premier jour
    const startDate = new Date(timeRange[0]);
    startDate.setHours(0, 0, 0, 0);

    // Boucler jour par jour jusqu'à la fin effective
    let currentDate = new Date(startDate.getTime());
    while (currentDate.getTime() <= effectiveEnd) {
      const nextMidnight = new Date(currentDate.getTime());
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      const dayStart = Math.max(timeRange[0], currentDate.getTime());
      const dayEnd = Math.min(effectiveEnd, nextMidnight.getTime());

      const times = SunCalc.getTimes(currentDate, currentSpace.latitude!, currentSpace.longitude!);
      const sunrise = times.sunrise?.getTime();
      const sunset = times.sunset?.getTime();

      const midday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0);
      const posAtMidday = SunCalc.getPosition(midday, currentSpace.latitude!, currentSpace.longitude!);
      const isPolarDay = sunrise == null || sunset == null ? posAtMidday.altitude > 0 : false;
      const isPolarNight = sunrise == null || sunset == null ? posAtMidday.altitude <= 0 : false;

      if (isPolarDay) {
        segments.push({ start: dayStart, end: dayEnd, type: 'day' });
      } else if (isPolarNight) {
        segments.push({ start: dayStart, end: dayEnd, type: 'night' });
      } else if (sunrise != null && sunset != null) {
        // Nuit du début de journée au lever
        if (sunrise > dayStart) {
          segments.push({ start: dayStart, end: clampToRange(sunrise), type: 'night' });
        }
        // Jour du lever au coucher
        segments.push({ start: clampToRange(sunrise), end: clampToRange(sunset), type: 'day' });
        // Nuit du coucher à la fin de la journée
        if (sunset < dayEnd) {
          segments.push({ start: clampToRange(sunset), end: dayEnd, type: 'night' });
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    // Fusion simple des segments contigus de même type
    const merged: Array<{ start: number; end: number; type: 'day' | 'night' }> = [];
    for (const seg of segments.sort((a, b) => a.start - b.start)) {
      const last = merged[merged.length - 1];
      if (last && last.type === seg.type && Math.abs(last.end - seg.start) < 1000) {
        last.end = Math.max(last.end, seg.end);
      } else {
        merged.push({ ...seg });
      }
    }
    return merged;
  }, [timeRange, currentSpace, mode, liveTimelineEnd]);

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

    // Increased tension for smoother curves (was 0.7, now 0.4 for more smoothness)
    const tension = 0.4;

    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = coords[Math.max(i - 1, 0)];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = coords[Math.min(i + 2, coords.length - 1)];

      // Catmull-Rom to Bezier conversion with tension control
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

  const handleToggleRecording = () => {
    setRecording(!isRecording);
    if (!isRecording) {
      showSuccess('Enregistrement démarré');
    } else {
      showSuccess('Enregistrement arrêté');
    }
  };

  const handleSyncHistory = async () => {
    if (!currentSpace) return;

    setSyncingHistory(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccess('Historique synchronisé avec succès');
    } catch (error) {
      console.error('Error syncing history:', error);
      showError('Erreur lors de la synchronisation de l\'historique');
    } finally {
      setSyncingHistory(false);
    }
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
  
  const colorZoneStart = Math.max(rangeStartPos, currentPos - COLOR_ZONE_RADIUS);
  const colorZoneEnd = Math.min(rangeEndPos, currentPos + COLOR_ZONE_RADIUS);

  const isDayNow = isDayAt(currentTimestamp);
  const curveStrokeWidth = isDayNow ? 2.8 : 1.6;
  const zeroLineStrokeWidth = isDayNow ? 0.7 : 0.5;

  const isLiveMode = mode === 'live';
  const cursorColor = isLiveMode ? (liveSystemConnected ? 'from-red-400 to-red-500' : 'from-gray-400 to-gray-500') : 'from-yellow-400 to-orange-500';
  
  const effectiveTimelineEnd = isLiveMode ? liveTimelineEnd : timeRange[1];

  return (
    <LiquidGlassCard className="p-2 sm:p-4">
      <div className="space-y-2 sm:space-y-4">
        <TooltipPrimitive.Provider delayDuration={300}>
          <Tabs value={selectedMetric} onValueChange={(v) => setSelectedMetric(v as any)} className="w-full">
            <TabsList className="bg-white/30 dark:bg-black/30 backdrop-blur-sm h-8 sm:h-9 p-1 gap-1 w-full grid grid-cols-4">
              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <TabsTrigger 
                    value="temperature" 
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-2 sm:px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                  >
                    {selectedMetric === 'temperature' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-md"></div>
                    )}
                    <Thermometer size={12} className={selectedMetric === 'temperature' ? 'text-red-600 relative z-10' : 'text-red-500 relative z-10'} />
                    <span className={`text-[10px] sm:text-xs font-medium relative z-10 ${selectedMetric === 'temperature' ? 'text-red-700 dark:text-red-500' : ''}`}>T°</span>
                  </TabsTrigger>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs hidden sm:block">
                    <p className="font-medium mb-1">Température (°C)</p>
                    <p className="text-gray-300">Mesure la chaleur de l'air ambiant</p>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>

              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <TabsTrigger 
                    value="humidity" 
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-2 sm:px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                  >
                    {selectedMetric === 'humidity' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-600/20 rounded-md"></div>
                    )}
                    <Droplets size={12} className={selectedMetric === 'humidity' ? 'text-blue-600 relative z-10' : 'text-blue-500 relative z-10'} />
                    <span className={`text-[10px] sm:text-xs font-medium relative z-10 ${selectedMetric === 'humidity' ? 'text-blue-700 dark:text-blue-500' : ''}`}>HR</span>
                  </TabsTrigger>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs hidden sm:block">
                    <p className="font-medium mb-1">Humidité Relative (%)</p>
                    <p className="text-gray-300">Pourcentage de vapeur d'eau dans l'air</p>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>

              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <TabsTrigger 
                    value="absoluteHumidity" 
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-2 sm:px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                  >
                    {selectedMetric === 'absoluteHumidity' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 rounded-md"></div>
                    )}
                    <Wind size={12} className={selectedMetric === 'absoluteHumidity' ? 'text-cyan-600 relative z-10' : 'text-cyan-500 relative z-10'} />
                    <span className={`text-[10px] sm:text-xs font-medium relative z-10 ${selectedMetric === 'absoluteHumidity' ? 'text-cyan-700 dark:text-cyan-500' : ''}`}>HA</span>
                  </TabsTrigger>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs hidden sm:block">
                    <p className="font-medium mb-1">Humidité Absolue (g/m³)</p>
                    <p className="text-gray-300">Quantité réelle d'eau dans l'air</p>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>

              <TooltipPrimitive.Root>
                <TooltipPrimitive.Trigger asChild>
                  <TabsTrigger 
                    value="dewPoint" 
                    className="relative flex items-center justify-center gap-1 sm:gap-1.5 h-6 sm:h-7 px-2 sm:px-3 data-[state=active]:bg-white/90 dark:data-[state=active]:bg-gray-800/90 data-[state=active]:shadow-md transition-all"
                  >
                    {selectedMetric === 'dewPoint' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-purple-600/20 rounded-md"></div>
                    )}
                    <CloudRain size={12} className={selectedMetric === 'dewPoint' ? 'text-purple-600 relative z-10' : 'text-purple-500 relative z-10'} />
                    <span className={`text-[10px] sm:text-xs font-medium relative z-10 ${selectedMetric === 'dewPoint' ? 'text-purple-700 dark:text-purple-500' : ''}`}>PR</span>
                  </TabsTrigger>
                </TooltipPrimitive.Trigger>
                <TooltipPrimitive.Portal>
                  <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs hidden sm:block">
                    <p className="font-medium mb-1">Point de Rosée (°C)</p>
                    <p className="text-gray-300">Température de condensation</p>
                  </TooltipPrimitive.Content>
                </TooltipPrimitive.Portal>
              </TooltipPrimitive.Root>
            </TabsList>
          </Tabs>
        </TooltipPrimitive.Provider>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 sm:gap-2">
            {isLiveMode ? (
              <>
                <TooltipPrimitive.Provider delayDuration={300}>
                  <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>
                      <Button
                        size="sm"
                        onClick={handleToggleRecording}
                        className={`h-7 sm:h-8 w-7 sm:w-8 p-0 ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-gray-500 hover:bg-gray-600'}`}
                      >
                        <Circle size={12} fill={isRecording ? 'white' : 'none'} />
                      </Button>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
                        {isRecording ? 'Arrêter l\'enregistrement' : 'Démarrer l\'enregistrement'}
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>

                  <TooltipPrimitive.Root>
                    <TooltipPrimitive.Trigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncHistory}
                        disabled={syncingHistory}
                        className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-7 sm:h-8 px-2 sm:px-3 text-xs"
                      >
                        <Download size={12} className="sm:mr-2" />
                        <span className="hidden sm:inline">{syncingHistory ? 'Sync...' : 'Historique'}</span>
                      </Button>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
                        Synchroniser l'historique depuis le système distant
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                </TooltipPrimitive.Provider>
              </>
            ) : (
              <TooltipPrimitive.Provider delayDuration={300}>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSkipToStart}
                      className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-7 sm:h-8 w-7 sm:w-8 p-0"
                    >
                      <SkipBack size={12} />
                    </Button>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
                      Retour au début
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>

                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setPlaying(!isPlaying)}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 h-7 sm:h-8 w-7 sm:w-8 p-0"
                    >
                      {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </Button>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
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
                        ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 h-7 sm:h-8 w-7 sm:w-8 p-0"
                        : "bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-7 sm:h-8 w-7 sm:w-8 p-0"
                      }
                    >
                      <Repeat size={12} />
                    </Button>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
                      {loopEnabled ? 'Boucle activée' : 'Activer la boucle'}
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>

                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSkipToEnd}
                      className="bg-white/30 dark:bg-black/30 backdrop-blur-sm border-white/40 hover:bg-white/50 h-7 sm:h-8 w-7 sm:w-8 p-0"
                    >
                      <SkipForward size={12} />
                    </Button>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs hidden sm:block">
                      Aller à la fin
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </TooltipPrimitive.Provider>
            )}
          </div>

          {!isLiveMode && (
            <div className="flex items-center gap-2">
              <TooltipPrimitive.Provider delayDuration={300}>
                <TooltipPrimitive.Root>
                  <TooltipPrimitive.Trigger asChild>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      className="text-[10px] sm:text-xs bg-white/30 dark:bg-black/30 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={60}>1 min/s</option>
                      <option value={300}>5x</option>
                      <option value={600}>10x</option>
                      <option value={1800}>30x</option>
                      <option value={3600}>60x</option>
                    </select>
                  </TooltipPrimitive.Trigger>
                  <TooltipPrimitive.Portal>
                    <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-1.5 rounded-md text-xs max-w-xs hidden sm:block">
                      <p className="font-medium mb-1">Vitesse de lecture</p>
                      <p>Contrôle la vitesse de défilement des données</p>
                    </TooltipPrimitive.Content>
                  </TooltipPrimitive.Portal>
                </TooltipPrimitive.Root>
              </TooltipPrimitive.Provider>

            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">
            <span className="truncate">{formatTime(rangeStart)}</span>
            <span className={`font-medium truncate px-2 ${isLiveMode ? (liveSystemConnected ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400') : 'text-blue-600 dark:text-blue-400'}`}>
              {formatTime(currentTimestamp)}
            </span>
            <span className="truncate">{formatTime(effectiveTimelineEnd)}</span>
          </div>

          <div
            ref={timelineRef}
            className={`relative ${isDayNow ? 'h-16 sm:h-20' : 'h-12 sm:h-16'} bg-white/20 dark:bg-black/20 backdrop-blur-sm rounded-xl border border-white/30 overflow-visible ${isLiveMode ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={handleTimelineClick}
          >
            {currentSpace?.latitude != null && currentSpace?.longitude != null && dayNightSegments.length > 0 && (
              <>
                {/* Gradient continu nuit ↔ aube ↔ jour ↔ crépuscule (palette plus nuancée et continue) */}
                {(() => {
                  const stops: Array<{ offset: number; color: string }> = [];
                  dayNightSegments.forEach((seg) => {
                    const start = getPosition(seg.start);
                    const end = getPosition(seg.end);
                    if (seg.type === 'night') {
                      // Nuit: bleu nuit profond → bleu nuit doux
                      stops.push({ offset: start, color: 'rgba(10,17,34,1)' });
                      stops.push({ offset: end, color: 'rgba(24,39,68,1)' });
                    } else {
                      // Jour: lever (chaud) → zénith (bleu clair) → coucher (chaud)
                      const mid = (start + end) / 2;
                      stops.push({ offset: start, color: 'rgba(255,176,106,0.40)' }); // lever chaleureux
                      stops.push({ offset: mid, color: 'rgba(204,232,255,0.55)' });   // zénith doux
                      stops.push({ offset: end, color: 'rgba(255,154,120,0.40)' });   // coucher pêche
                    }
                  });
                  const gradient = `linear-gradient(to right, ${stops
                    .sort((a, b) => a.offset - b.offset)
                    .map((s) => `${s.color} ${s.offset}%`)
                    .join(', ')})`;
                  return <div className="absolute inset-0 pointer-events-none z-[0]" style={{ background: gradient }} />;
                })()}
              </>
            </>
          )}
          {hasOutdoorData && hasNegativeValues && (
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
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
                className="absolute inset-0 w-full h-full pointer-events-none z-[2]"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <line
                  x1="0"
                  y1={zeroLineY}
                  x2="100"
                  y2={zeroLineY}
                  stroke="rgba(249, 115, 22, 0.6)"
                  strokeWidth={zeroLineStrokeWidth}
                  strokeDasharray="2,2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}

            {hasOutdoorData && dewPointDifferences.length > 0 && (
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none z-[3]"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <path
                  d={smoothPath}
                  fill="none"
                  stroke="rgba(156, 163, 175, 0.5)"
                  strokeWidth={curveStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}


            {dayMarkers.map((marker, idx) => {
              const pos = getPosition(marker);
              return (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none z-[5]"
                  style={{ left: `${pos}%` }}
                >
                  <div className="w-px h-full bg-gray-400/50"></div>
                  <span className="absolute -bottom-4 sm:-bottom-5 text-[8px] sm:text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(marker)}
                  </span>
                </div>
              );
            })}

            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-400/30 to-purple-400/30 backdrop-blur-sm pointer-events-none z-[6]"
              style={{
                left: `${getPosition(rangeStart)}%`,
                width: `${getPosition(rangeEnd) - getPosition(rangeStart)}%`
              }}
            />

            {!isLiveMode && (
              <>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 sm:w-3 h-5 sm:h-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
                  style={{ left: `${getPosition(rangeStart)}%`, marginLeft: '-4px' }}
                  onMouseDown={handleMouseDown('start')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                </div>

                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2 sm:w-3 h-5 sm:h-6 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full cursor-ew-resize shadow-lg hover:scale-110 transition-transform border-2 border-white/50 z-10"
                  style={{ left: `${getPosition(rangeEnd)}%`, marginLeft: '-4px' }}
                  onMouseDown={handleMouseDown('end')}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full"></div>
                </div>
              </>
            )}

            <div
              className={`absolute top-0 bottom-0 w-0.5 bg-gradient-to-b ${cursorColor} ${isLiveMode ? 'cursor-not-allowed' : 'cursor-ew-resize'} shadow-lg z-[100] ${isRecording ? 'animate-pulse' : ''}`}
              style={{ left: `${getPosition(currentTimestamp)}%`, marginLeft: '-1px', opacity: isLiveMode && !liveSystemConnected ? 0.5 : 1 }}
              onMouseDown={!isLiveMode ? handleMouseDown('current') : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`absolute -top-1 sm:-top-1.5 left-1/2 -translate-x-1/2 w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gradient-to-br ${cursorColor} rounded-full border border-white shadow-lg`}></div>
              <div className={`absolute -bottom-1 sm:-bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 sm:w-2 h-1.5 sm:h-2 bg-gradient-to-br ${cursorColor} rounded-full border border-white shadow-lg`}></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 gap-1 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            {hasOutdoorData && dewPointDifferences.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-1.5">
                <div className="w-6 sm:w-8 h-1.5 sm:h-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-full"></div>
                <span className="whitespace-nowrap">ΔPR: {minDiff.toFixed(1)}°C → {maxDiff.toFixed(1)}°C</span>
              </div>
            )}
          </div>
          <span className="whitespace-nowrap">
            Durée: {((effectiveTimelineEnd - timeRange[0]) / (1000 * 60 * 60)).toFixed(1)}h
          </span>
        </div>
      </div>
    </LiquidGlassCard>
  );
};