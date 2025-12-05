"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, AlertCircle, ChevronDown, ChevronUp, Upload, Download, Trash2, FolderUp, Loader2, Clock, CloudSun, Sparkles, Zap, Waves, Box, Layers, GitBranch, Database, Home, Cloud, Calendar, FlaskConical, Gauge, Scan, Wrench } from 'lucide-react';
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

export const SensorPanel = () => {
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
  
  const [isDataExpanded, setIsDataExpanded] = useState(true);
  const [isInterpolationExpanded, setIsInterpolationExpanded] = useState(true);
  const prevScienceExpandedRef = useRef(scienceExpanded);
  useEffect(() => {
    // Quand on passe de grand (true) à petit (false)
    if (prevScienceExpandedRef.current && !scienceExpanded && meshingEnabled) {
      // Interpolation active: garder le panneau replié
      setIsInterpolationExpanded(false);
    }
    prevScienceExpandedRef.current = scienceExpanded;
  }, [scienceExpanded, meshingEnabled]);
  const [lastInteraction, setLastInteraction] = useState<number>(Date.now());
  const [interpHovered, setInterpHovered] = useState(false);

  // Initialiser le timer d'inactivité (le suivi se fait via le survol du panneau)
  useEffect(() => {
    setLastInteraction(Date.now());
  }, []);

  // Replie le panneau Interpolation si non survolé > 12s
  useEffect(() => {
    if (!isInterpolationExpanded) return;
    const id = setInterval(() => {
      if (!interpHovered && Date.now() - lastInteraction > 12000) {
        setIsInterpolationExpanded(false);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isInterpolationExpanded, interpHovered, lastInteraction]);
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
        .single();

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
        .single();

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
        .single();

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

    // Admin gate
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

      newData.push({
        space_id: currentSpace.id,
        sensor_id: 0,
        sensor_name: detectedName,
        timestamp: timestamp.toISOString(),
        temperature: temp,
        humidity: hum,
        absolute_humidity: absHum,
        dew_point: dpt,
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

      newData.push({
        space_id: currentSpace.id,
        sensor_id: sensorId,
        sensor_name: sensor.name,
        timestamp: timestamp.toISOString(),
        temperature: temp,
        humidity: hum,
        absolute_humidity: absHum,
        dew_point: dpt,
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

    const headers = ['timestamp', 'temperature', 'humidity', 'absolute_humidity', 'dew_point'];
    const csvLines = [headers.join(',')];

    data.forEach(row => {
      csvLines.push([
        row.timestamp,
        row.temperature,
        row.humidity,
        row.absolute_humidity,
        row.dew_point
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

    const headers = ['timestamp', 'temperature', 'humidity', 'absolute_humidity', 'dew_point'];
    const csvLines = [headers.join(',')];

    data.forEach(row => {
      csvLines.push([
        row.timestamp,
        row.temperature,
        row.humidity,
        row.absolute_humidity,
        row.dew_point
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
      return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
    }
    if (indoorSensorsWithData === sensors.length) {
      return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    }
    if (indoorSensorsWithData > 0) {
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700';
    }
    return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
  };

  const getOutdoorBadgeClasses = () => {
    if (hasOutdoorData) {
      return 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700';
    }
    return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
  };

  const getDelayBadgeClasses = () => {
    if (!globalLastDate) {
      return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
    }
    const diffHours = Math.floor((Date.now() - globalLastDate.getTime()) / (1000 * 60 * 60));
    if (diffHours <= 1) {
      return 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700';
    }
    if (diffHours <= 24) {
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700';
    }
    return 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700';
  };

  const delayLabel = useMemo(() => {
    if (!globalLastDate) return 'N/A';
    const diff = Date.now() - globalLastDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}j, ${hours % 24}h`;
    return `${hours}h`;
  }, [globalLastDate]);

  // Points du diagramme psychrométrique synchronisés avec la Timeline
  useEffect(() => {
    if (!currentSpace) return;

    const loadNearestPointsAtTimestamp = async () => {
      const pts: { name: string; temperature: number; absoluteHumidity: number; color?: string }[] = [];
      const ts = currentTimestamp || Date.now();

      // Fenêtre de lissage (pour limiter les requêtes à une zone proche)
      const halfWindowMs = (smoothingWindowSec || 60) * 1000 / 2;
      const tsMinus = new Date(ts - halfWindowMs).toISOString();
      const tsPlus = new Date(ts + halfWindowMs).toISOString();

      // Pour chaque capteur: on prend la mesure la plus proche et on colore comme la sphère (selectedMetric)
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

      // Capteur extérieur (si présent) – couleur basée sur sa valeur (selectedMetric)
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

      // Désormais, le calcul des points est centralisé dans useChartPoints
      // Ne rien faire ici (on évite les mises à jour concurrentes)
    };

    if (mode === 'replay') {
      loadNearestPointsAtTimestamp();
      return;
    }

    // Mode live: utiliser les données courantes des capteurs et colorer comme la sphère
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

    // Interpolation active: ne garder que volumétrique + extérieur
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
      // Désormais, le calcul des points est centralisé dans useChartPoints
    }
  }, [mode, currentTimestamp, sensors, currentSpace, hasOutdoorData, outdoorSensorName, smoothingWindowSec, meshingEnabled, volumetricPoint, interpolationRange, selectedMetric, outdoorData]);

  return (
    <div className="h-full flex flex-col gap-3 overflow-y-auto pb-2">
      <OrientationPanel />
      <LiquidGlassCard className="flex-shrink-0">
        <div className={`${isDataExpanded ? "p-3" : "px-3 py-0"}`}>
          <div className={`flex items-center justify-between ${isDataExpanded ? "mb-2" : "h-10"}`}>
            <div className="flex items-center gap-2">
              <Database size={14} className="text-blue-600" />
              <h3 className="text-sm font-medium">Données</h3>
              {!isDataExpanded && (
                <TooltipProvider delayDuration={250}>
                  <div className="flex items-center gap-1.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-5 px-1.5 flex items-center gap-1 cursor-help ${getIndoorBadgeClasses()}`}
                          onClick={() => setIsDataExpanded(true)}
                        >
                          <Home size={10} />
                          {indoorSensorsWithData}/{sensors.length}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-medium">Capteurs intérieurs</p>
                        <p className="text-xs text-gray-400">
                          {indoorSensorsWithData} sur {sensors.length} avec des données
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-5 px-1.5 flex items-center gap-1 cursor-help ${getOutdoorBadgeClasses()}`}
                          onMouseEnter={() => handleSensorHover(0)}
                          onMouseLeave={handleSensorLeave}
                          onClick={() => setIsDataExpanded(true)}
                        >
                          <Cloud size={10} className={hasOutdoorData ? 'text-cyan-600' : 'text-gray-500'} />
                          {hasOutdoorData ? outdoorSensorName : 'Extérieur'}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-medium">Données extérieures</p>
                        <p className="text-xs text-gray-400">
                          {hasOutdoorData ? `${outdoorDataCount.toLocaleString()} points` : 'Aucune donnée'}
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {dataPeriod && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="outline"
                            className="text-[9px] h-5 px-1.5 flex items-center gap-1 cursor-help bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
                          >
                            <Calendar size={10} />
                            {dataPeriod}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">Durée disponible</p>
                          <p className="text-xs text-gray-400">Plage temporelle sélectionnée</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={`text-[9px] h-5 px-1.5 flex items-center gap-1 cursor-help ${getDelayBadgeClasses()}`}
                        >
                          <Clock size={10} />
                          -{delayLabel}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs font-medium">Dernière donnée reçue</p>
                        <p className="text-xs text-gray-400">
                          {globalLastDate ? `Il y a ${formatRelativeTime(globalLastDate).replace('il y a ', '')}` : 'Inconnue'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDataExpanded(!isDataExpanded)}
              className="h-6 w-6 p-0"
            >
              {isDataExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          <AnimatePresence>
            {isDataExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                {currentSpace && mode === 'replay' && (
                  <div className="mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border-blue-300 dark:border-blue-700 h-8"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.csv';
                        input.multiple = true;
                        input.onchange = (e) => {
                          const files = (e.target as HTMLInputElement).files;
                          if (files && files.length > 0) handleBulkCSVUpload(files);
                        };
                        input.click();
                      }}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="animate-spin mr-2" size={14} />
                          Chargement...
                        </>
                      ) : (
                        <>
                          <FolderUp size={14} className="mr-2" />
                          Charger plusieurs CSV
                        </>
                      )}
                    </Button>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 text-center">
                      Matching intelligent (capteurs + extérieur)
                    </p>
                  </div>
                )}

                {hasOutdoorData && (
                  <div className="mb-3">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-2 rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20 cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-600"
                      onMouseEnter={() => handleSensorHover(0)}
                      onMouseLeave={handleSensorLeave}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate flex items-center gap-1.5">
                          <CloudSun size={12} className="text-blue-600" />
                          {outdoorSensorName}
                        </span>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px] h-4 px-1 bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700">
                            {outdoorDataCount.toLocaleString()}
                          </Badge>
                        </div>
                      </div>

                      {outdoorData && (
                        <div className="grid grid-cols-2 gap-1 mb-1">
                          <div className="flex items-center gap-1 text-[10px]">
                            <Thermometer size={10} className="text-red-500" />
                            <span>{outdoorData.temperature.toFixed(1)}°C</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <Droplets size={10} className="text-blue-500" />
                            <span>{outdoorData.humidity.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}

                      {outdoorLastDate && (
                        <Alert className={`mb-1 py-1 px-2 ${isDataOld(outdoorLastDate) ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                          <div className="flex items-center gap-1.5">
                            <Clock className={`h-3 w-3 flex-shrink-0 ${isDataOld(outdoorLastDate) ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                            <AlertDescription className={`text-[10px] leading-tight ${isDataOld(outdoorLastDate) ? 'text-orange-800 dark:text-orange-200' : 'text-green-800 dark:text-green-200'}`}>
                              Dernières données : {formatRelativeTime(outdoorLastDate)}
                            </AlertDescription>
                          </div>
                        </Alert>
                      )}

                      {currentSpace && mode === 'replay' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-6 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.csv';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) {
                                  const detectedName = detectOutdoorName(file.name);
                                  handleOutdoorCSVUpload(file, true, detectedName);
                                }
                              };
                              input.click();
                            }}
                            disabled={loading}
                          >
                            <Upload size={10} className="mr-1" />
                            CSV
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadOutdoorData();
                            }}
                          >
                            <Download size={10} />
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteOutdoorData();
                            }}
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}

                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Home size={12} className="text-purple-600" />
                    <h4 className="text-xs font-medium">Intérieur</h4>
                    <TooltipProvider delayDuration={250}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className={`text-xs h-5 cursor-help ${getIndoorBadgeClasses()}`}>
                            {sensors.length}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">Nombre de capteurs</p>
                          <p className="text-xs text-gray-400">{sensors.length} capteur(s) enregistrés</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {sensors.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Aucun capteur</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {sensors.map((sensor) => {
                        const dataCount = sensorDataCounts.get(sensor.id) || 0;
                        const hasData = dataCount > 0;
                        const lastDate = lastDataDates.get(sensor.id);
                        const isOld = !!(lastDate && isDataOld(lastDate));

                        return (
                          <motion.div
                            key={sensor.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                              hoveredSensorId === sensor.id 
                                ? 'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20' 
                                : 'border-gray-200 dark:border-gray-700 bg-white/50 dark:bg黑/50'
                            }`}
                            onMouseEnter={() => handleSensorHover(sensor.id)}
                            onMouseLeave={handleSensorLeave}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate">{sensor.name}</span>
                              <div className="flex items-center gap-1">
                                {hasData && (
                                  <TooltipProvider delayDuration={250}>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="text-[9px] h-4 px-1 cursor-help">
                                          {dataCount.toLocaleString()}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p className="text-xs font-medium">Points de données</p>
                                        <p className="text-xs text-gray-400">{dataCount.toLocaleString()} enregistrements</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                <Badge 
                                  variant={sensor.currentData ? "default" : "secondary"}
                                  className="text-[10px] h-4 px-1.5"
                                >
                                  {sensor.currentData ? "●" : "○"}
                                </Badge>
                              </div>
                            </div>

                            {sensor.currentData && (
                              <div className="grid grid-cols-2 gap-1 mb-1">
                                <div className="flex items-center gap-1 text-[10px]">
                                  <Thermometer size={10} className="text-red-500" />
                                  <span>{sensor.currentData.temperature.toFixed(1)}°C</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px]">
                                  <Droplets size={10} className="text-blue-500" />
                                  <span>{sensor.currentData.humidity.toFixed(1)}%</span>
                                </div>
                              </div>
                            )}

                            {lastDate && (
                              <Alert className={`mb-1 py-1 px-2 ${isOld ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'}`}>
                                <div className="flex items-center gap-1.5">
                                  <Clock className={`h-3 w-3 flex-shrink-0 ${isOld ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`} />
                                  <AlertDescription className={`text-[10px] leading-tight ${isOld ? 'text-orange-800 dark:text-orange-200' : 'text-green-800 dark:text-green-200'}`}>
                                    Dernières données : {formatRelativeTime(lastDate)}
                                  </AlertDescription>
                                </div>
                              </Alert>
                            )}

                            {currentSpace && mode === 'replay' && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-6 text-[10px]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.csv';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) handleCSVUpload(sensor.id, file);
                                    };
                                    input.click();
                                  }}
                                  disabled={loading}
                                >
                                  <Upload size={10} className="mr-1" />
                                  CSV
                                </Button>

                                {hasData && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        downloadAllData(sensor.id);
                                      }}
                                    >
                                      <Download size={10} />
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteAllData(sensor.id);
                                      }}
                                    >
                                      <Trash2 size={10} />
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LiquidGlassCard>

      {dataReady && (
        <>
        <LiquidGlassCard className="flex-shrink-0">
          <div
            className={`${isInterpolationExpanded ? "p-3" : "px-3 py-0"}`}
            onMouseEnter={() => { setInterpHovered(true); setLastInteraction(Date.now()); }}
            onMouseLeave={() => { setInterpHovered(false); setLastInteraction(Date.now()); }}
          >
            <div className={`flex items-center justify-between ${isInterpolationExpanded ? "mb-2" : "h-10"}`}>
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-purple-600" />
                <h3 className="text-sm font-medium">Interpolation</h3>
                {!isInterpolationExpanded && meshingEnabled && (
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] h-5 px-1.5 flex items-center gap-1 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-400 dark:border-indigo-600"
                      title="Résolution"
                    >
                      <TbMaximize size={12} className="text-indigo-600" />
                      {(meshResolution * meshResolution * meshResolution).toLocaleString()}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-5 px-1.5 flex items-center justify-center ${
                        visualizationType === 'points'
                          ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400 dark:border-blue-600'
                          : visualizationType === 'vectors'
                          ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-400 dark:border-green-600'
                          : visualizationType === 'isosurface'
                          ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400 dark:border-purple-600'
                          : 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-400 dark:border-orange-600'
                      }`}
                      title="Type"
                    >
                      {visualizationType === 'points' && <Sparkles size={10} className="text-blue-600" />}
                      {visualizationType === 'vectors' && <GitBranch size={10} className="text-green-600" />}
                      {visualizationType === 'isosurface' && <Layers size={10} className="text-purple-600" />}
                      {visualizationType === 'mesh' && <Box size={10} className="text-orange-600" />}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-[9px] h-5 px-1.5 flex items-center justify-center ${
                        interpolationMethod === 'idw'
                          ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-400 dark:border-blue-600'
                          : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400 dark:border-purple-600'
                      }`}
                      title="Méthode"
                    >
                      {interpolationMethod === 'idw' && (
                        <>
                          <Zap size={10} className="text-blue-600" />
                          <span className="text-[9px] font-medium text-blue-700 dark:text-blue-400 ml-1">IDW</span>
                        </>
                      )}
                      {interpolationMethod === 'rbf' && (
                        <>
                          <Waves size={10} className="text-purple-600" />
                          <span className="text-[9px] font-medium text-purple-700 dark:text-purple-400 ml-1">RBF</span>
                        </>
                      )}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!isInterpolationExpanded && (
                  <Switch
                    checked={meshingEnabled}
                    onCheckedChange={setMeshingEnabled}
                    className="scale-75"
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsInterpolationExpanded(!isInterpolationExpanded)}
                  className="h-6 w-6 p-0"
                >
                  {isInterpolationExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </Button>
              </div>
            </div>

            <AnimatePresence>
              {isInterpolationExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meshing-toggle" className="text-xs">
                      {meshingEnabled ? 'Activé' : 'Désactivé'}
                    </Label>
                    <Switch
                      id="meshing-toggle"
                      checked={meshingEnabled}
                      onCheckedChange={setMeshingEnabled}
                    />
                  </div>

                  {meshingEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Visualisation</Label>
                        <div className="grid grid-cols-4 gap-2">
                          <TooltipPrimitive.Provider delayDuration={300}>
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => setVisualizationType('points')}
                                  className={`relative p-2 rounded-lg transition-all ${
                                    visualizationType === 'points'
                                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-400 dark:border-blue-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <Sparkles size={16} className={visualizationType === 'points' ? 'text-blue-600' : 'text-gray-500'} />
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium">Points</p>
                                  <p className="text-gray-300">Nuage de points colorés</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => {
                                    if (meshResolution !== 15) setMeshResolution(15);
                                    setVisualizationType('vectors');
                                    setMeshingEnabled(true);
                                    showSuccess('Vecteurs activés • résolution 15³');
                                  }}
                                  className={`relative p-2 rounded-lg transition-all ${
                                    visualizationType === 'vectors'
                                      ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400 dark:border-green-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <GitBranch size={16} className={visualizationType === 'vectors' ? 'text-green-600' : 'text-gray-500'} />
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium">Vecteurs</p>
                                  <p className="text-gray-300">Champ de gradients</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => setVisualizationType('isosurface')}
                                  className={`relative p-2 rounded-lg transition-all ${
                                    visualizationType === 'isosurface'
                                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400 dark:border-purple-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <Layers size={16} className={visualizationType === 'isosurface' ? 'text-purple-600' : 'text-gray-500'} />
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium">Isosurface</p>
                                  <p className="text-gray-300">Niveaux de valeurs</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => setVisualizationType('mesh')}
                                  className={`relative p-2 rounded-lg transition-all ${
                                    visualizationType === 'mesh'
                                      ? 'bg-gradient-to-br from-orange-500/20 to-red-500/20 border-2 border-orange-400 dark:border-orange-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <Box size={16} className={visualizationType === 'mesh' ? 'text-orange-600' : 'text-gray-500'} />
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium">Mesh</p>
                                  <p className="text-gray-300">Maillage volumique</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          </TooltipPrimitive.Provider>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-gray-600 dark:text-gray-400">Résolution</Label>
                          <span className="text-xs font-medium text-purple-600">{meshResolution}³</span>
                        </div>
                        <Slider
                          value={[meshResolution]}
                          onValueChange={(v) => setMeshResolution(v[0])}
                          min={10}
                          max={50}
                          step={5}
                          className="h-1"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Méthode</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <TooltipPrimitive.Provider delayDuration={300}>
                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => setInterpolationMethod('idw')}
                                  className={`relative p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    interpolationMethod === 'idw'
                                      ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-2 border-blue-400 dark:border-blue-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <Zap size={14} className={interpolationMethod === 'idw' ? 'text-blue-600' : 'text-gray-500'} />
                                  <span className={`text-xs font-medium ${interpolationMethod === 'idw' ? 'text-blue-700 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>IDW</span>
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium mb-1">Inverse Distance Weighting</p>
                                  <p className="text-gray-300">✓ Rapide et simple</p>
                                  <p className="text-gray-300">✓ Bon pour données uniformes</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>

                            <TooltipPrimitive.Root>
                              <TooltipPrimitive.Trigger asChild>
                                <button
                                  onClick={() => setInterpolationMethod('rbf')}
                                  className={`relative p-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
                                    interpolationMethod === 'rbf'
                                      ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-400 dark:border-purple-600'
                                      : 'bg-white/30 dark:bg-black/30 border border-gray-300 dark:border-gray-700 hover:bg-white/50 dark:hover:bg-black/50'
                                  }`}
                                >
                                  <Waves size={14} className={interpolationMethod === 'rbf' ? 'text-purple-600' : 'text-gray-500'} />
                                  <span className={`text-xs font-medium ${interpolationMethod === 'rbf' ? 'text-purple-700 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`}>RBF</span>
                                </button>
                              </TooltipPrimitive.Trigger>
                              <TooltipPrimitive.Portal>
                                <TooltipPrimitive.Content side="top" sideOffset={5} className="z-[10000] bg-gray-900 text-white px-3 py-2 rounded-md text-xs max-w-xs">
                                  <p className="font-medium mb-1">Radial Basis Functions</p>
                                  <p className="text-gray-300">✓ Surfaces très lisses</p>
                                  <p className="text-gray-300">✗ Plus coûteux en calcul</p>
                                </TooltipPrimitive.Content>
                              </TooltipPrimitive.Portal>
                            </TooltipPrimitive.Root>
                          </TooltipPrimitive.Provider>
                        </div>
                      </div>

                      {interpolationMethod === 'idw' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-gray-600 dark:text-gray-400">Exposant</Label>
                            <span className="text-xs font-medium text-blue-600">{idwPower}</span>
                          </div>
                          <Slider
                            value={[idwPower]}
                            onValueChange={(v) => setIdwPower(v[0])}
                            min={1}
                            max={5}
                            step={0.5}
                            className="h-1"
                          />
                        </motion.div>
                      )}

                      {interpolationMethod === 'rbf' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-1"
                        >
                          <Label className="text-xs text-gray-600 dark:text-gray-400">Fonction</Label>
                          <select
                            value={rbfKernel}
                            onChange={(e) => setRbfKernel(e.target.value as any)}
                            className="w-full text-xs bg-white/50 dark:bg-black/50 backdrop-blur-sm rounded-lg px-2 py-2 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            <option value="multiquadric">Multiquadric</option>
                            <option value="gaussian">Gaussienne</option>
                            <option value="inverse_multiquadric">Inverse Multiquadric</option>
                            <option value="thin_plate_spline">Thin Plate Spline</option>
                          </select>
                        </motion.div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </LiquidGlassCard>

        {/* Monitoring scientifique - Diagramme psychrométrique */}
        <LiquidGlassCard className="flex-shrink-0">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FlaskConical size={14} className="text-rose-600" />
                <h3 className="text-sm font-medium">Monitoring</h3>
                <Badge
                  variant="outline"
                  className={`text-[10px] h-5 px-1.5 flex items-center gap-1 ${
                    mode === 'live' && hasOutdoorData
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                  title="Pression atmosphérique"
                >
                  <Gauge size={10} />
                  1013 hPa
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                {chartReady && scienceExpanded && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-400 dark:border-amber-600 text-amber-600 dark:text-amber-300 hover:from-amber-500/30 hover:to-orange-500/30"
                    onClick={() => useAppStore.getState().setShowCalibrationPanel(!useAppStore.getState().showCalibrationPanel)}
                    aria-label="Calibration"
                    title="Calibration des zones"
                  >
                    <Wrench size={16} strokeWidth={2.5} />
                  </Button>
                )}
                {chartReady && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 rounded-md border border-gray-300 dark:border-gray-700 bg-white/50 dark:bg-black/40 text-gray-700 dark:text-gray-200 hover:bg-white/70 dark:hover:bg-black/60"
                    onClick={() => {
                      const next = !scienceExpanded;
                      // Si on passe de grand à petit et que l’interpolation est active, on replie
                      if (scienceExpanded && !next && meshingEnabled) {
                        setIsInterpolationExpanded(false);
                      }
                      setScienceExpanded(next);
                    }}
                    aria-label={scienceExpanded ? "Réduire" : "Agrandir"}
                    title={scienceExpanded ? "Réduire" : "Agrandir"}
                  >
                    {scienceExpanded ? <TbMinimize size={16} /> : <TbMaximize size={16} />}
                  </Button>
                )}
              </div>
            </div>

            {chartPoints.length > 0 ? (
              <div className="h-80">
                <PsychrometricSvgChart
                  points={chartPoints}
                  outdoorTemp={outdoorData ? outdoorData.temperature : null}
                  animationMs={useAppStore.getState().isPlaying ? 100 : 250}
                />
              </div>
            ) : (
              <div className="text-xs text-gray-600 dark:text-gray-400 py-2">
                Aucune donnée disponible pour le diagramme psychrométrique.
              </div>
            )}
          </div>
        </LiquidGlassCard>
        </>
      )}

    </div>
  );
};