"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { showSuccess, showError } from '@/utils/toast';
import { Upload, Download, Trash2, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export const CSVManager = () => {
  const currentSpace = useAppStore((state) => state.currentSpace);
  const sensors = useAppStore((state) => state.sensors);
  const [loading, setLoading] = useState(false);
  const [lastDate, setLastDate] = useState<Date | null>(null);

  useEffect(() => {
    if (currentSpace) {
      loadLastDate();
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

  const handleCSVUpload = async (sensorId: number, file: File) => {
    if (!currentSpace) return;

    setLoading(true);

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

      showSuccess(`${newData.length} points de données ajoutés pour ${sensor.name}`);
      loadLastDate();
    } catch (error) {
      console.error('Error uploading CSV:', error);
      showError(error instanceof Error ? error.message : 'Erreur lors du chargement du CSV');
    } finally {
      setLoading(false);
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
    } catch (error) {
      console.error('Error deleting data:', error);
      showError('Erreur lors de la suppression');
    }
  };

  if (!currentSpace) return null;

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

      <div className="space-y-3">
        {sensors.map((sensor) => (
          <div key={sensor.id} className="flex items-center gap-2 p-3 bg-white/50 dark:bg-black/50 rounded-lg">
            <span className="flex-1 text-sm font-medium">{sensor.name}</span>
            
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
          </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
};