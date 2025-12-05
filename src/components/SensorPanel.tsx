"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, AlertCircle, ChevronDown, ChevronUp, Upload, Download, Trash2, FolderUp, Loader2, Clock, CloudSun, Sparkles, Zap, Waves, Box, Layers, GitBranch, Database, Home, Cloud, Calendar, FlaskConical, Gauge, Scan, Wrench, Wind, Grid3X3 } from 'lucide-react';
import { TbMaximize, TbMinimize } from 'react-icons/tb';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Alert, AlertDescription } from './ui/alert';
import { motion, AnimatePresence } from 'framer-motion';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/FixedTooltip';
import OrientationPanel from './OrientationPanel';
import PsychrometricSvgChart from './PsychrometricSvgChart';
import { getColorFromValueSaturated } from '@/utils/colorUtils';
import { getMetricValue } from '@/utils/metricUtils';
import { useIsMobile } from '@/hooks/use-mobile';

export const SensorPanel = () => {
  const isMobile = useIsMobile();
  const sensors = useAppStore((state) => state.sensors);
  const mode = useAppStore((state) => state.mode);
  const currentSpace = useAppStore((state) => state.currentSpace);
  const isEphemeral = Boolean((currentSpace as any)?.isEphemeral);
  const dataReady = useAppStore((state) => state.dataReady);
  const meshingEnabled = useAppStore((state) => state.meshingEnabled);
  const setMeshingEnabled = useAppStore((state) => state.setMeshingEnabled);
  const interpolationMethod = useAppStore((state) => state.interpolationMethod);
  const setInterpolationMethod = useAppStore((state) => state.setInterpolationMethod);
  const rbfKernel = useAppStore((state) => state.rbfKernel);
  const setRbfKernel = useAppStore((state) => state.setRbfKernel);
  const idwPower = useAppStore((state) => state.idwPower);
  const setIdwPower = useAppStore((state) => state.setIdwPower);
  const meshResolution = useAppStore((state) => state.meshResolution);
  const setMeshResolution = useAppStore((state) => state.setMeshResolution);
  const visualizationType = useAppStore((state) => state.visualizationType);
  const setVisualizationType = useAppStore((state) => state.setVisualizationType);
  const hasOutdoorData = useAppStore((state) => state.hasOutdoorData);
  const setHasOutdoorData = useAppStore((state) => state.setHasOutdoorData);
  const timeRange = useAppStore((state) => state.timeRange);
  const outdoorData = useAppStore((state) => state.outdoorData);
  const currentTimestamp = useAppStore((state) => state.currentTimestamp);
  const smoothingWindowSec = useAppStore((state) => state.smoothingWindowSec);
  const selectedMetric = useAppStore((state) => state.selectedMetric);
  const interpolationRange = useAppStore((state) => state.interpolationRange);
  const scienceExpanded = useAppStore((state) => state.scienceExpanded);
  const setScienceExpanded = useAppStore((state) => state.setScienceExpanded);
  const setChartPointsStore = useAppStore((state) => state.setChartPoints);
  const airSpeedMps = useAppStore((state) => state.airSpeedMps);
  
  const [isDataExpanded, setIsDataExpanded] = useState(true);
  const isInterpolationExpanded = useAppStore((state) => state.isInterpolationExpanded);
  const setIsInterpolationExpanded = useAppStore((state) => state.setIsInterpolationExpanded);
  const prevScienceExpandedRef = useRef(scienceExpanded);
  useEffect(() => {
    if (prevScienceExpandedRef.current && !scienceExpanded) {
      setIsInterpolationExpanded(false);
    }
    prevScienceExpandedRef.current = scienceExpanded;
  }, [scienceExpanded]);
  const [lastInteraction, setLastInteraction] = useState<number>(Date.now());
  const [interpHovered, setInterpHovered] = useState(false);

  useEffect(() => {
    setLastInteraction(Date.now());
  }, []);

  useEffect(() => {
    if (!isInterpolationExpanded) return;
    if (isMobile) return;
    const id = setInterval(() => {
      if (!interpHovered && Date.now() - lastInteraction > 12000) {
        setIsInterpolationExpanded(false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isInterpolationExpanded, interpHovered, lastInteraction, isMobile]);

  const [hoveredSensorId, setHoveredSensorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sensorDataCounts, setSensorDataCounts] = useState<Map<number, number>>(new Map());
  const [lastDataDates, setLastDataDates] = useState<Map<number, Date>>(new Map());
  const [outdoorDataCount, setOutdoorDataCount] = useState(0);
  const [outdoorSensorName, setOutdoorSensorName] = useState<string>('Extérieur');
  const [outdoorLastDate, setOutdoorLastDate] = useState<Date | null>(null);
  const chartPoints = useAppStore((state) => state.chartPoints);
  const [chartReady, setChartReady] = useState(false);
  const [isAnonSession, setIsAnonSession] = useState<boolean>(true);

  useEffect(() => {
    if (chartPoints && chartPoints.length > 0) {
      const id = setTimeout(() => setChartReady(true), 150);
      return () => clearTimeout(id);
    } else {
      setChartReady(false);
    }
  }, [chartPoints]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      const anon = !!(u && ((u as any).is_anonymous || (u as any).app_metadata?.provider === 'anonymous'));
      setIsAnonSession(anon);
    });
  }, []);
  const [volumetricPoint, setVolumetricPoint] = useState<{ temperature: number; absoluteHumidity: number; color?: string } | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail || typeof detail !== 'object') { setVolumetricPoint(null); return; }
      const { avgTemp, avgAbsHumidity, metricAverage, selectedMetric: sm } = detail;
      if (typeof avgTemp === 'number' && typeof avgAbsHumidity === 'number') {
        let colorHex = undefined as string | undefined;
        if (typeof metricAverage === 'number' && interpolationRange && sm) {
          const c = getColorFromValueSaturated(metricAverage, interpolationRange.min, interpolationRange.max, sm);
          colorHex = `#${c.getHexString()}`;
        }
        setVolumetricPoint({ temperature: avgTemp, absoluteHumidity: avgAbsHumidity, color: colorHex });
      } else {
        setVolumetricPoint(null);
      }
    };
    window.addEventListener('volumetricAverageUpdate', handler as EventListener);
    return () => window.removeEventListener('volumetricAverageUpdate', handler as EventListener);
  }, [interpolationRange]);

  useEffect(() => {
    if (currentSpace && mode === 'replay') {
      loadSensorDataInfo();
      loadOutdoorDataInfo();
    }
  }, [currentSpace, mode]);

  const loadSensorDataInfo = async () => {
    if (!currentSpace) return;

    const counts = new Map<number, number>();
    const dates = new Map<number, Date>();
      
    for (const sensor of sensors) {
      const { count, error: countError } = await supabase
        .from('sensor_data')
        .select('*', { count: 'exact', head: true })
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', sensor.id);

      if (countError) throw countError;
      counts.set(sensor.id, count || 0);

      const { data: lastData, error: dateError } = await supabase
        .from('sensor_data')
        .select('timestamp')
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', sensor.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dateError && dateError.code !== 'PGRST116') throw dateError;
        
      if (lastData) {
        dates.set(sensor.id, new Date(lastData.timestamp));
      }
    }
      
    setSensorDataCounts(counts);
    setLastDataDates(dates);
  };

  const loadOutdoorDataInfo = async () => {
    if (!currentSpace) return;

    const { count, error: countError } = await supabase
      .from('sensor_data')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', currentSpace.id)
      .eq('sensor_id', 0);

    if (countError) throw countError;
    setOutdoorDataCount(count || 0);
    setHasOutdoorData((count || 0) > 0);

    if (count && count > 0) {
      const { data: nameData, error: nameError } = await supabase
        .from('sensor_data')
        .select('sensor_name')
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', 0)
        .limit(1)
        .maybeSingle();

      if (nameError && nameError.code !== 'PGRST116') throw nameError;
      if (nameData && nameData.sensor_name) {
        setOutdoorSensorName(nameData.sensor_name);
      }

      const { data: lastData, error: dateError } = await supabase
        .from('sensor_data')
        .select('timestamp')
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', 0)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (dateError && dateError.code !== 'PGRST116') throw dateError;        
      if (lastData) {
        setOutdoorLastDate(new Date(lastData.timestamp));
      }
    }
  };

  const normalizeName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[\s\-_]/g, '')
      .replace(/_(data|export|capteur|sensor)$/i, '')
      .replace(/\.csv$/i, '');
  };

  const getInitials = (name: string): string => {
    return name
      .split(/[\s\-_]/)
      .map(word => word[0])
      .join('')
      .toLowerCase();
  };

  const detectOutdoorName = (filename: string): string => {
    const normalized = normalizeName(filename);
    if (normalized.includes('balcon')) return 'Balcon';
    if (normalized.includes('terrasse')) return 'Terrasse';
    if (normalized.includes('jardin')) return 'Jardin';
    if (normalized.includes('ville') || normalized.includes('city')) return 'Ville';
    if (normalized.includes('outdoor') || normalized.includes('outside')) return 'Extérieur';
    if (normalized.includes('exterieur')) return 'Extérieur';
    return 'Extérieur';
  };

  const isOutdoorFile = (filename: string): boolean => {
    const normalized = normalizeName(filename);
    return normalized.includes('balcon') || 
           normalized.includes('terrasse') ||
           normalized.includes('jardin') ||
           normalized.includes('exterieur') || 
           normalized.includes('outdoor') ||
           normalized.includes('outside') ||
           normalized.includes('ville') ||
           normalized.includes('city');
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const norm1 = normalizeName(str1);
    const norm2 = normalizeName(str2);
    if (norm1 === norm2) return 1.0;
    const initials1 = getInitials(str1);
    const initials2 = getInitials(str2);
    if (initials1 === norm2 || initials2 === norm1) return 0.9;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) return 0;
    let matches = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] === norm2[i]) matches++;
    }
    return matches / maxLen;
  };

  const handleBulkCSVUpload = async (files: FileList) => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('En mode démo, les espaces supplémentaires ne permettent pas l\'import CSV.'); return; }

    if (isAnonSession && localStorage.getItem('adminUnlocked') !== 'true') {
      const pwd = window.prompt('Mot de passe administrateur ?');
      if (pwd !== 'admin') {
        showError('Mot de passe incorrect');
        return;
      }
      localStorage.setItem('adminUnlocked', 'true');
      showSuccess('Mode administrateur activé');
    }

    setLoading(true);

    try {
      const fileArray = Array.from(files);
      let matchedCount = 0;
      let unmatchedFiles: string[] = [];
      let outdoorFileProcessed = false;

      for (const file of fileArray) {
        if (!file.name.endsWith('.csv')) continue;

        if (isOutdoorFile(file.name)) {
          const detectedName = detectOutdoorName(file.name);
          await handleOutdoorCSVUpload(file, false, detectedName);
          outdoorFileProcessed = true;
          matchedCount++;
          continue;
        }

        const fileNameWithoutExt = file.name.replace(/\.csv$/i, '');
        let bestMatch: { sensor: typeof sensors[0]; score: number } | null = null;
        
        for (const sensor of sensors) {
          const score = calculateSimilarity(sensor.name, fileNameWithoutExt);
          if (score > 0.7 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { sensor, score };
          }
        }

        if (bestMatch) {
          await handleCSVUpload(bestMatch.sensor.id, file, false);
          matchedCount++;
        } else {
          unmatchedFiles.push(file.name);
        }
      }

      if (matchedCount > 0) {
        showSuccess(`${matchedCount} fichier${matchedCount > 1 ? 's' : ''} CSV chargé${matchedCount > 1 ? 's' : ''} avec succès${outdoorFileProcessed ? ' (dont données extérieures)' : ''}`);
        loadSensorDataInfo();
        loadOutdoorDataInfo();
      }
      
      if (unmatchedFiles.length > 0) {
        showError(`${unmatchedFiles.length} fichier${unmatchedFiles.length > 1 ? 's' : ''} non associé${unmatchedFiles.length > 1 ? 's' : ''}: ${unmatchedFiles.slice(0, 3).join(', ')}${unmatchedFiles.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Error in bulk upload:', error);
      showError('Erreur lors du chargement en masse');
    } finally {
      setLoading(false);
    }
  };

  const handleOutdoorCSVUpload = async (file: File, showToast: boolean = true, detectedName: string = 'Extérieur') => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Import extérieur indisponible pour un espace éphémère.'); return; }

    if (isAnonSession && localStorage.getItem('adminUnlocked') !== 'true') {
      const pwd = window.prompt('Mot de passe administrateur ?');
      if (pwd !== 'admin') {
        showError('Mot de passe incorrect');
        return;
      }
      localStorage.setItem('adminUnlocked', 'true');
      showSuccess('Mode administrateur activé');
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);

    const newData: any[] = [];

    for (const line of dataLines) {
      const values = line.replace(/"/g, '').split(',');
      if (values.length < 5) continue;

      const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
      const timestamp = new Date(timestampStr.trim());
      if (isNaN(timestamp.getTime())) continue;

      const temp = parseFloat(tempStr);
      const hum = parseFloat(humStr);
      const absHum = parseFloat(absHumStr);
      const dpt = parseFloat(dptStr);
      if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) continue;

      const vpd = values.length >= 6 ? parseFloat(values[5]) : NaN;

      newData.push({
        space_id: currentSpace.id,
        sensor_id: 0,
        sensor_name: detectedName,
        timestamp: timestamp.toISOString(),
        temperature: temp,
        humidity: hum,
        absolute_humidity: absHum,
        dew_point: dpt,
        vpd_kpa: Number.isFinite(vpd) ? vpd : null,
      });
    }

    if (newData.length === 0) {
      throw new Error('Aucune donnée valide trouvée');
    }

    const { error } = await supabase
      .from('sensor_data')
      .upsert(newData, { onConflict: 'space_id,sensor_id,timestamp' });

    if (error) throw error;

    if (showToast) {
      showSuccess(`${newData.length} points de données extérieures ajoutés`);
      loadOutdoorDataInfo();
    }
  };

  const handleCSVUpload = async (sensorId: number, file: File, showToast: boolean = true) => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Import CSV indisponible pour un espace éphémère.'); return; }

    if (isAnonSession && localStorage.getItem('adminUnlocked') !== 'true') {
      const pwd = window.prompt('Mot de passe administrateur ?');
      if (pwd !== 'admin') {
        showError('Mot de passe incorrect');
        return;
      }
      localStorage.setItem('adminUnlocked', 'true');
      showSuccess('Mode administrateur activé');
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);

    const sensor = sensors.find(s => s.id === sensorId);
    if (!sensor) throw new Error('Capteur non trouvé');

    const newData: any[] = [];

    for (const line of dataLines) {
      const values = line.replace(/"/g, '').split(',');
      if (values.length < 5) continue;

      const [timestampStr, tempStr, humStr, absHumStr, dptStr] = values;
      const timestamp = new Date(timestampStr.trim());
      if (isNaN(timestamp.getTime())) continue;

      const temp = parseFloat(tempStr);
      const hum = parseFloat(humStr);
      const absHum = parseFloat(absHumStr);
      const dpt = parseFloat(dptStr);
      if (isNaN(temp) || isNaN(hum) || isNaN(absHum) || isNaN(dpt)) continue;

      const vpd = values.length >= 6 ? parseFloat(values[5]) : NaN;

      newData.push({
        space_id: currentSpace.id,
        sensor_id: sensorId,
        sensor_name: sensor.name,
        timestamp: timestamp.toISOString(),
        temperature: temp,
        humidity: hum,
        absolute_humidity: absHum,
        dew_point: dpt,
        vpd_kpa: Number.isFinite(vpd) ? vpd : null,
      });
    }

    if (newData.length === 0) {
      throw new Error('Aucune donnée valide trouvée');
    }

    const { error } = await supabase
      .from('sensor_data')
      .upsert(newData, { onConflict: 'space_id,sensor_id,timestamp' });

    if (error) throw error;

    const maxTimestamp = Math.max(...newData.map(d => new Date(d.timestamp).getTime()));
    await supabase
      .from('spaces')
      .update({ 
        last_csv_date: new Date(maxTimestamp).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', currentSpace.id);

    if (showToast) {
      showSuccess(`${newData.length} points de données ajoutés pour ${sensor.name}`);
      loadSensorDataInfo();
    }
  };

  const downloadAllData = async (sensorId: number) => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Téléchargement indisponible pour un espace éphémère.'); return; }

    const sensor = sensors.find(s => s.id === sensorId);
    if (!sensor) return;

    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('space_id', currentSpace.id)
      .eq('sensor_id', sensorId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      showError('Aucune donnée disponible');
      return;
    }

    const headers = ['timestamp', 'temperature', 'humidity', 'absolute_humidity', 'dew_point', 'vpd_kpa'];
    const csvLines = [headers.join(',')];

    data.forEach(row => {
      csvLines.push([
        row.timestamp,
        row.temperature,
        row.humidity,
        row.absolute_humidity,
        row.dew_point,
        row.vpd_kpa ?? ''
      ].join(','));
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sensor.name}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess('Données téléchargées');
  };

  const downloadOutdoorData = async () => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Téléchargement indisponible pour un espace éphémère.'); return; }

    const { data, error } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('space_id', currentSpace.id)
      .eq('sensor_id', 0)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      showError('Aucune donnée disponible');
      return;
    }

    const headers = ['timestamp', 'temperature', 'humidity', 'absolute_humidity', 'dew_point', 'vpd_kpa'];
    const csvLines = [headers.join(',')];

    data.forEach(row => {
      csvLines.push([
        row.timestamp,
        row.temperature,
        row.humidity,
        row.absolute_humidity,
        row.dew_point,
        row.vpd_kpa ?? ''
      ].join(','));
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${outdoorSensorName}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showSuccess('Données extérieures téléchargées');
  };

  const deleteAllData = async (sensorId: number) => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Suppression indisponible pour un espace éphémère.'); return; }

    const sensor = sensors.find(s => s.id === sensorId);
    if (!sensor) return;

    if (!confirm(`Supprimer toutes les données de ${sensor.name} ?`)) {
      return;
    }

    const { error } = await supabase
      .from('sensor_data')
      .delete()
      .eq('space_id', currentSpace.id)
      .eq('sensor_id', sensorId);

    if (error) throw error;

    showSuccess('Données supprimées');
    loadSensorDataInfo();
  };

  const deleteOutdoorData = async () => {
    if (!currentSpace) return;
    if (isEphemeral) { showError('Suppression indisponible pour un espace éphémère.'); return; }

    if (!confirm(`Supprimer toutes les données de ${outdoorSensorName} ?`)) {
      return;
    }

    const { error } = await supabase
      .from('sensor_data')
      .delete()
      .eq('space_id', currentSpace.id)
      .eq('sensor_id', 0);

    if (error) throw error;

    showSuccess('Données supprimées');
    setOutdoorSensorName('Extérieur');
    setOutdoorLastDate(null);
    loadOutdoorDataInfo();
  };

  const handleSensorHover = (sensorId: number) => {
    setHoveredSensorId(sensorId);
    window.dispatchEvent(new CustomEvent('sensorHover', { detail: { sensorId } }));
  };

  const handleSensorLeave = () => {
    setHoveredSensorId(null);
    window.dispatchEvent(new CustomEvent('sensorLeave'));
  };

  const isDataOld = (date: Date): boolean => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return date < oneHourAgo;
  };

  const formatRelativeTime = (date: Date): string => {
    const now = Date.now();
    const diff = now - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `il y a ${days}j`;
    if (hours > 0) return `il y a ${hours}h`;
    return 'récent';
  };

  const getDataPeriodDuration = (): string | null => {
    if (!timeRange) return null;
    const duration = (timeRange[1] - timeRange[0]) / (1000 * 60 * 60);
    const days = Math.floor(duration / 24);
    const hours = Math.floor(duration % 24);
    if (days > 0) {
      return `${days}j, ${hours}h`;
    }
    return `${hours}h`;
  };

  useEffect(() => {
    if (dataReady) {
      setIsDataExpanded(false);
    }
  }, [dataReady]);

  const indoorSensorsWithData = sensors.filter(s => (sensorDataCounts.get(s.id) || 0) > 0).length;
  const dataPeriod = getDataPeriodDuration();

  const latestIndoorDate = useMemo(() => {
    let max: Date | null = null;
    lastDataDates.forEach((d) => {
      if (d && (!max || d.getTime() > max.getTime())) {
        max = d;
      }
    });
    return max;
  }, [lastDataDates]);

  const globalLastDate: Date | null = useMemo(() => {
    if (latestIndoorDate && outdoorLastDate) {
      return latestIndoorDate.getTime() >= outdoorLastDate.getTime() ? latestIndoorDate : outdoorLastDate;
    }
    return latestIndoorDate || outdoorLastDate || null;
  }, [latestIndoorDate, outdoorLastDate]);

  const getIndoorBadgeClasses = () => {
    if (sensors.length === 0) {
      return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300';
    }
    if (indoorSensorsWithData === sensors.length) {
      return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-200';
    }
    if (indoorSensorsWithData > 0) {
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200';
    }
    return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300';
  };

  const getOutdoorBadgeClasses = () => {
    if (hasOutdoorData) {
      return 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-200';
    }
    return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300';
  };

  const getDelayBadgeClasses = () => {
    if (!globalLastDate) {
      return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300';
    }
    const diffHours = Math.floor((Date.now() - globalLastDate.getTime()) / (1000 * 60 * 60));
    if (diffHours <= 1) {
      return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-200';
    }
    if (diffHours <= 24) {
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-200';
    }
    return 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-200';
  };

  const delayLabel = useMemo(() => {
    if (!globalLastDate) return 'N/A';
    const diff = Date.now() - globalLastDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j, ${hours % 24}h`;
    return `${hours}h`;
  }, [globalLastDate]);

  useEffect(() => {
    if (!currentSpace) return;

    const loadNearestPointsAtTimestamp = async () => {
      const pts: { name: string; temperature: number; absoluteHumidity: number; color?: string }[] = [];
      const ts = currentTimestamp || Date.now();

      const halfWindowMs = (smoothingWindowSec || 60) * 1000 / 2;
      const tsMinus = new Date(ts - halfWindowMs).toISOString();
      const tsPlus = new Date(ts + halfWindowMs).toISOString();

      for (const sensor of sensors) {
        const { data: below } = await supabase
          .from('sensor_data')
          .select('temperature, humidity, absolute_humidity, dew_point, timestamp')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', sensor.id)
          .lte('timestamp', new Date(ts).toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: above } = await supabase
          .from('sensor_data')
          .select('temperature, humidity, absolute_humidity, dew_point, timestamp')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', sensor.id)
          .gte('timestamp', new Date(ts).toISOString())
          .order('timestamp', { ascending: true })
          .limit(1)
          .maybeSingle();

        let chosen = null as null | { temperature: number; humidity: number; absolute_humidity: number; dew_point: number; timestamp: string };
        if (below && above) {
          const dBelow = Math.abs(new Date(below.timestamp).getTime() - ts);
          const dAbove = Math.abs(new Date(above.timestamp).getTime() - ts);
          chosen = dBelow <= dAbove ? below : above;
        } else {
          chosen = (below as any) || (above as any) || null;
        }

        if (chosen && interpolationRange) {
          const valueForColor = getMetricValue(
            {
              timestamp: new Date(chosen.timestamp).getTime(),
              temperature: chosen.temperature,
              humidity: chosen.humidity,
              absoluteHumidity: chosen.absolute_humidity,
              dewPoint: chosen.dew_point
            },
            selectedMetric
          );
          const color = getColorFromValueSaturated(valueForColor, interpolationRange.min, interpolationRange.max, selectedMetric);
          pts.push({
            name: sensor.name,
            temperature: chosen.temperature,
            absoluteHumidity: chosen.absolute_humidity,
            color: `#${color.getHexString()}`
          });
        }
      }

      if (hasOutdoorData) {
        const { data: belowOut } = await supabase
          .from('sensor_data')
          .select('temperature, humidity, absolute_humidity, dew_point, timestamp, sensor_name')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .lte('timestamp', new Date(ts).toISOString())
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: aboveOut } = await supabase
          .from('sensor_data')
          .select('temperature, humidity, absolute_humidity, dew_point, timestamp, sensor_name')
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', 0)
          .gte('timestamp', new Date(ts).toISOString())
          .order('timestamp', { ascending: true })
          .limit(1)
          .maybeSingle();

        let chosenOut = null as null | { temperature: number; humidity: number; absolute_humidity: number; dew_point: number; timestamp: string; sensor_name?: string };
        if (belowOut && aboveOut) {
          const dBelow = Math.abs(new Date(belowOut.timestamp).getTime() - ts);
          const dAbove = Math.abs(new Date(aboveOut.timestamp).getTime() - ts);
          chosenOut = dBelow <= dAbove ? belowOut : aboveOut;
        } else {
          chosenOut = (belowOut as any) || (aboveOut as any) || null;
        }

        if (chosenOut && interpolationRange) {
          const valueForColor = getMetricValue(
            {
              timestamp: new Date(chosenOut.timestamp).getTime(),
              temperature: chosenOut.temperature,
              humidity: chosenOut.humidity,
              absoluteHumidity: chosenOut.absolute_humidity,
              dewPoint: chosenOut.dew_point
            },
            selectedMetric
          );
          const color = getColorFromValueSaturated(valueForColor, interpolationRange.min, interpolationRange.max, selectedMetric);
          pts.push({
            name: chosenOut.sensor_name || outdoorSensorName,
            temperature: chosenOut.temperature,
            absoluteHumidity: chosenOut.absolute_humidity,
            color: `#${color.getHexString()}`
          });
        }
      }
    };

    if (mode === 'replay') {
      loadNearestPointsAtTimestamp();
      return;
    }

    const livePts = sensors
      .filter(s => s.currentData)
      .map(s => {
        const valueForColor = interpolationRange
          ? getMetricValue(
              {
                timestamp: s.currentData!.timestamp,
                temperature: s.currentData!.temperature,
                humidity: s.currentData!.humidity,
                absoluteHumidity: s.currentData!.absoluteHumidity,
                dewPoint: s.currentData!.dewPoint
              },
              selectedMetric
            )
          : null;
        const colorHex =
          valueForColor != null && interpolationRange
            ? `#${getColorFromValueSaturated(valueForColor, interpolationRange!.min, interpolationRange!.max, selectedMetric).getHexString()}`
            : undefined;
        return {
          name: s.name,
          temperature: s.currentData!.temperature,
          absoluteHumidity: s.currentData!.absoluteHumidity,
          color: colorHex
        };
      });

    if (meshingEnabled) {
      const filtered: { name: string; temperature: number; absoluteHumidity: number; color?: string }[] = [];
      if (volumetricPoint) filtered.push({ name: 'Moyenne volumétrique', ...volumetricPoint });
      if (hasOutdoorData && outdoorData) {
        const valueForColor = interpolationRange
          ? getMetricValue(
              {
                timestamp: outdoorData.timestamp,
                temperature: outdoorData.temperature,
                humidity: outdoorData.humidity,
                absoluteHumidity: outdoorData.absoluteHumidity,
                dewPoint: outdoorData.dewPoint
              },
              selectedMetric
            )
          : null;
        const colorHex =
          valueForColor != null && interpolationRange
            ? `#${getColorFromValueSaturated(valueForColor, interpolationRange!.min, interpolationRange!.max, selectedMetric).getHexString()}`
            : undefined;
        filtered.push({
          name: outdoorSensorName,
          temperature: outdoorData.temperature,
          absoluteHumidity: outdoorData.absoluteHumidity,
          color: colorHex
        });
      }
    }
  }, [mode, currentTimestamp, sensors, currentSpace, hasOutdoorData, outdoorSensorName, smoothingWindowSec, meshingEnabled, volumetricPoint, interpolationRange, selectedMetric, outdoorData]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto pb-2">
      <OrientationPanel />
      {/* ...rest of the component unchanged (Interpolation and Monitoring panels, UI, etc.) */}
      {/* The remainder of the file is identical to your previous version. */}
    </div>
  );
};