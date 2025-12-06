"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Upload, Download, Trash2, Info, Loader2, FolderUp } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export const CSVManager = () => {
  const currentSpace = useAppStore((state) => state.currentSpace);
  const isEphemeral = Boolean((currentSpace as any)?.isEphemeral);
  const sensors = useAppStore((state) => state.sensors);
  const [loading, setLoading] = useState(false);
  const [lastDate, setLastDate] = useState<Date | null>(null);
  const [sensorDataCounts, setSensorDataCounts] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (currentSpace) {
      loadLastDate();
      loadSensorDataCounts();
    }
  }, [currentSpace]);

  const loadLastDate = async () => {
    if (!currentSpace) return;

    try {
      const { data, error } = await supabase
        .from('sensor_data')
        .select('timestamp')
        .eq('space_id', currentSpace.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setLastDate(new Date(data.timestamp));
      }
    } catch (error) {
      console.error('Error loading last date:', error);
    }
  };

  const loadSensorDataCounts = async () => {
    if (!currentSpace) return;

    try {
      const counts = new Map<number, number>();
      
      for (const sensor of sensors) {
        const { count, error } = await supabase
          .from('sensor_data')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', currentSpace.id)
          .eq('sensor_id', sensor.id);

        if (error) throw error;
        counts.set(sensor.id, count || 0);
      }
      
      setSensorDataCounts(counts);
    } catch (error) {
      console.error('Error loading sensor data counts:', error);
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

    if (localStorage.getItem('adminUnlocked') !== 'true') {
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
      const matchDetails: Array<{ file: string; sensor: string; score: number }> = [];

      for (const file of fileArray) {
        if (!file.name.endsWith('.csv')) continue;

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
          matchDetails.push({
            file: file.name,
            sensor: bestMatch.sensor.name,
            score: bestMatch.score,
          });
        } else {
          unmatchedFiles.push(file.name);
        }
      }

      if (matchDetails.length > 0) {
        console.log('📊 Fichiers CSV associés :');
        matchDetails.forEach(detail => {
          const confidence = detail.score === 1.0 ? 'exact' : 
                            detail.score >= 0.9 ? 'très bon' :
                            detail.score >= 0.8 ? 'bon' : 'acceptable';
          console.log(`   ✓ ${detail.file} → ${detail.sensor} (${confidence}, score: ${detail.score.toFixed(2)})`);
        });
      }

      if (matchedCount > 0) {
        showSuccess(`${matchedCount} fichier${matchedCount > 1 ? 's' : ''} CSV chargé${matchedCount > 1 ? 's' : ''} avec succès`);
        loadLastDate();
        loadSensorDataCounts();
      }
      
      if (unmatchedFiles.length > 0) {
        console.warn('⚠️ Fichiers non associés :', unmatchedFiles);
        showError(`${unmatchedFiles.length} fichier${unmatchedFiles.length > 1 ? 's' : ''} non associé${unmatchedFiles.length > 1 ? 's' : ''}: ${unmatchedFiles.slice(0, 3).join(', ')}${unmatchedFiles.length > 3 ? '...' : ''}`);
      }
    } catch (error) {
      console.error('Error in bulk upload:', error);
      showError('Erreur lors du chargement en masse');
    } finally {
      setLoading(false);
    }
  };

  const handleCSVUpload = async (sensorId: number, file: File, showToast: boolean = true) => {
    if (!currentSpace) return;

    if (localStorage.getItem('adminUnlocked') !== 'true') {
      const pwd = window.prompt('Mot de passe administrateur ?');
      if (pwd !== 'admin') {
        showError('Mot de passe incorrect');
        return;
      }
      localStorage.setItem('adminUnlocked', 'true');
      showSuccess('Mode administrateur activé');
    }

    try {
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

        // Calculer VPD (Vapor Pressure Deficit) en kPa
        // VPD = VPsat - VPair
        // VPsat = 0.6108 * exp((17.27 * T) / (T + 237.3))
        // VPair = VPsat * (RH / 100)
        const vpSat = 0.6108 * Math.exp((17.27 * temp) / (temp + 237.3));
        const vpAir = vpSat * (hum / 100);
        const vpdKpa = vpSat - vpAir;

        newData.push({
          space_id: currentSpace.id,
          sensor_id: sensorId,
          sensor_name: sensor.name,
          timestamp: timestamp.toISOString(),
          temperature: temp,
          humidity: hum,
          absolute_humidity: absHum,
          dew_point: dpt,
          vpd_kpa: vpdKpa,
        });
      }

      if (newData.length === 0) {
        throw new Error('Aucune donnée valide trouvée');
      }

      // Insert data (ON CONFLICT DO NOTHING handles duplicates)
      const { error } = await supabase
        .from('sensor_data')
        .upsert(newData, { onConflict: 'space_id,sensor_id,timestamp' });

      if (error) throw error;

      // Update last_csv_date in space
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
        loadLastDate();
        loadSensorDataCounts();
      }
    } catch (error) {
      console.error('Error uploading CSV:', error);
      if (showToast) {
        showError(error instanceof Error ? error.message : 'Erreur lors du chargement du CSV');
      }
      throw error;
    }
  };

  const downloadAllData = async (sensorId: number) => {
    if (!currentSpace) return;

    try {
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

      // Convert to CSV
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
    } catch (error) {
      console.error('Error downloading data:', error);
      showError('Erreur lors du téléchargement');
    }
  };

  const deleteAllData = async (sensorId: number) => {
    if (!currentSpace) return;

    const sensor = sensors.find(s => s.id === sensorId);
    if (!sensor) return;

    if (!confirm(`Supprimer toutes les données de ${sensor.name} ?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sensor_data')
        .delete()
        .eq('space_id', currentSpace.id)
        .eq('sensor_id', sensorId);

      if (error) throw error;

      showSuccess('Données supprimées');
      loadLastDate();
      loadSensorDataCounts();
    } catch (error) {
      console.error('Error deleting data:', error);
      showError('Erreur lors de la suppression');
    }
  };

  if (!currentSpace) return null;

  if (isEphemeral) {
    return (
      <LiquidGlassCard className="p-4">
        <h3 className="font-semibold mb-4">Gestion des données CSV</h3>
        <Alert className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            En mode démo, les espaces ajoutés hors “Show-room” sont éphémères : les chargements CSV sont désactivés et ne sont jamais sauvegardés.
          </AlertDescription>
        </Alert>
      </LiquidGlassCard>
    );
  }

  return (
    <LiquidGlassCard className="p-4">
      <h3 className="font-semibold mb-4">Gestion des données CSV</h3>

      {lastDate && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
            Dernières données : {lastDate.toLocaleString('fr-FR')}
            <br />
            Chargez de nouveaux fichiers CSV pour enrichir les données après cette date.
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        <Button
          size="sm"
          variant="outline"
          className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 hover:from-blue-500/20 hover:to-purple-500/20 border-blue-300 dark:border-blue-700"
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
              <Loader2 className="animate-spin mr-2" size={16} />
              Chargement en cours...
            </>
          ) : (
            <>
              <FolderUp size={16} className="mr-2" />
              Charger plusieurs CSV en une fois
            </>
          )}
        </Button>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 text-center">
          Matching intelligent : exact, initiales, suffixes (_data, etc.)
        </p>
      </div>

      <div className="space-y-3">
        {sensors.map((sensor) => {
          const dataCount = sensorDataCounts.get(sensor.id) || 0;
          const hasData = dataCount > 0;

          return (
            <div key={sensor.id} className="flex items-center gap-2 p-3 bg-white/50 dark:bg-black/50 rounded-lg">
              <div className="flex-1">
                <span className="text-sm font-medium block">{sensor.name}</span>
                {hasData && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {dataCount.toLocaleString()} point{dataCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
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
                {loading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Upload size={14} />
                )}
              </Button>

              {hasData && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadAllData(sensor.id)}
                  >
                    <Download size={14} />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteAllData(sensor.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </LiquidGlassCard>
  );
};