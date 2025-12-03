"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import { supabase } from "@/integrations/supabase/client";
import { getMetricValue } from "@/utils/metricUtils";
import { getColorFromValueSaturated } from "@/utils/colorUtils";

type ChartPoint = {
  name: string;
  temperature: number;
  absoluteHumidity: number;
  color?: string;
};

export function useChartPoints() {
  const mode = useAppStore((s) => s.mode);
  const currentSpace = useAppStore((s) => s.currentSpace);
  const sensors = useAppStore((s) => s.sensors);
  const outdoorData = useAppStore((s) => s.outdoorData);
  const hasOutdoorData = useAppStore((s) => s.hasOutdoorData);
  const currentTimestamp = useAppStore((s) => s.currentTimestamp);
  const smoothingWindowSec = useAppStore((s) => s.smoothingWindowSec);
  const selectedMetric = useAppStore((s) => s.selectedMetric);
  const interpolationRange = useAppStore((s) => s.interpolationRange);
  const meshingEnabled = useAppStore((s) => s.meshingEnabled);
  const setChartPoints = useAppStore((s) => s.setChartPoints);

  // Suivi de la moyenne volumétrique (via événement global)
  const volumetricRef = useRef<{ temperature: number; absoluteHumidity: number; color?: string } | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail || typeof detail !== "object") {
        volumetricRef.current = null;
        return;
      }
      const { avgTemp, avgAbsHumidity, metricAverage, selectedMetric: sm } = detail;
      if (typeof avgTemp === "number" && typeof avgAbsHumidity === "number") {
        let colorHex: string | undefined = undefined;
        if (typeof metricAverage === "number" && interpolationRange && sm) {
          const c = getColorFromValueSaturated(metricAverage, interpolationRange.min, interpolationRange.max, sm);
          colorHex = `#${c.getHexString()}`;
        }
        volumetricRef.current = { temperature: avgTemp, absoluteHumidity: avgAbsHumidity, color: colorHex };
      } else {
        volumetricRef.current = null;
      }
    };
    window.addEventListener("volumetricAverageUpdate", handler as EventListener);
    return () => window.removeEventListener("volumetricAverageUpdate", handler as EventListener);
  }, [interpolationRange]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!currentSpace) {
        setChartPoints([]);
        return;
      }

      // LIVE: utiliser directement les valeurs courantes
      if (mode === "live") {
        const pts: ChartPoint[] = [];

        // Intérieur (capteurs avec currentData)
        sensors.forEach((s) => {
          if (!s.currentData) return;
          let colorHex: string | undefined = undefined;
          if (interpolationRange) {
            const v = getMetricValue(
              {
                timestamp: s.currentData.timestamp,
                temperature: s.currentData.temperature,
                humidity: s.currentData.humidity,
                absoluteHumidity: s.currentData.absoluteHumidity,
                dewPoint: s.currentData.dewPoint,
              },
              selectedMetric
            );
            const c = getColorFromValueSaturated(v, interpolationRange.min, interpolationRange.max, selectedMetric);
            colorHex = `#${c.getHexString()}`;
          }
          pts.push({
            name: s.name,
            temperature: s.currentData.temperature,
            absoluteHumidity: s.currentData.absoluteHumidity,
            color: colorHex,
          });
        });

        // Extérieur (si présent)
        if (hasOutdoorData && outdoorData) {
          let colorHex: string | undefined = undefined;
          if (interpolationRange) {
            const v = getMetricValue(
              {
                timestamp: outdoorData.timestamp,
                temperature: outdoorData.temperature,
                humidity: outdoorData.humidity,
                absoluteHumidity: outdoorData.absoluteHumidity,
                dewPoint: outdoorData.dewPoint,
              },
              selectedMetric
            );
            const c = getColorFromValueSaturated(v, interpolationRange.min, interpolationRange.max, selectedMetric);
            colorHex = `#${c.getHexString()}`;
          }
          pts.push({
            name: "Extérieur",
            temperature: outdoorData.temperature,
            absoluteHumidity: outdoorData.absoluteHumidity,
            color: colorHex,
          });
        }

        // Si l’interpolation est active, ne garder que “Moyenne volumétrique” + Extérieur (si dispo)
        const vol = volumetricRef.current;
        let outPts = pts;
        if (meshingEnabled && (vol || (hasOutdoorData && outdoorData))) {
          outPts = [];
          if (vol) outPts.push({ name: "Moyenne volumétrique", ...vol });
          if (hasOutdoorData && outdoorData) {
            const v = getMetricValue(
              {
                timestamp: outdoorData.timestamp,
                temperature: outdoorData.temperature,
                humidity: outdoorData.humidity,
                absoluteHumidity: outdoorData.absoluteHumidity,
                dewPoint: outdoorData.dewPoint,
              },
              selectedMetric
            );
            let colorHex: string | undefined = undefined;
            if (interpolationRange) {
              const c = getColorFromValueSaturated(v, interpolationRange.min, interpolationRange.max, selectedMetric);
              colorHex = `#${c.getHexString()}`;
            }
            outPts.push({
              name: "Extérieur",
              temperature: outdoorData.temperature,
              absoluteHumidity: outdoorData.absoluteHumidity,
              color: colorHex,
            });
          }
        }

        if (!cancelled) setChartPoints(outPts);
        return;
      }

      // REPLAY: récupérer les points les plus proches en parallèle
      const ts = currentTimestamp || Date.now();

      // Pour chaque capteur intérieur, deux requêtes (below / above) parallélisées globalement
      const sensorPromises = sensors.map(async (sensor) => {
        const [belowRes, aboveRes] = await Promise.all([
          supabase
            .from("sensor_data")
            .select("temperature, humidity, absolute_humidity, dew_point, timestamp")
            .eq("space_id", currentSpace.id)
            .eq("sensor_id", sensor.id)
            .lte("timestamp", new Date(ts).toISOString())
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("sensor_data")
            .select("temperature, humidity, absolute_humidity, dew_point, timestamp")
            .eq("space_id", currentSpace.id)
            .eq("sensor_id", sensor.id)
            .gte("timestamp", new Date(ts).toISOString())
            .order("timestamp", { ascending: true })
            .limit(1)
            .maybeSingle(),
        ]);

        const below = belowRes.data as any | null;
        const above = aboveRes.data as any | null;

        let chosen: any | null = null;
        if (below && above) {
          const dBelow = Math.abs(new Date(below.timestamp).getTime() - ts);
          const dAbove = Math.abs(new Date(above.timestamp).getTime() - ts);
          chosen = dBelow <= dAbove ? below : above;
        } else {
          chosen = below || above || null;
        }

        if (!chosen || !interpolationRange) return null;

        const v = getMetricValue(
          {
            timestamp: new Date(chosen.timestamp).getTime(),
            temperature: chosen.temperature,
            humidity: chosen.humidity,
            absoluteHumidity: chosen.absolute_humidity,
            dewPoint: chosen.dew_point,
          },
          selectedMetric
        );
        const c = getColorFromValueSaturated(v, interpolationRange.min, interpolationRange.max, selectedMetric);
        const colorHex = `#${c.getHexString()}`;

        return {
          name: sensor.name,
          temperature: chosen.temperature,
          absoluteHumidity: chosen.absolute_humidity,
          color: colorHex,
        } as ChartPoint | null;
      });

      // Extérieur (si présent)
      const outdoorPromise = hasOutdoorData
        ? (async () => {
            const [belowRes, aboveRes] = await Promise.all([
              supabase
                .from("sensor_data")
                .select("temperature, humidity, absolute_humidity, dew_point, timestamp, sensor_name")
                .eq("space_id", currentSpace.id)
                .eq("sensor_id", 0)
                .lte("timestamp", new Date(ts).toISOString())
                .order("timestamp", { ascending: false })
                .limit(1)
                .maybeSingle(),
              supabase
                .from("sensor_data")
                .select("temperature, humidity, absolute_humidity, dew_point, timestamp, sensor_name")
                .eq("space_id", currentSpace.id)
                .eq("sensor_id", 0)
                .gte("timestamp", new Date(ts).toISOString())
                .order("timestamp", { ascending: true })
                .limit(1)
                .maybeSingle(),
            ]);
            const below = belowRes.data as any | null;
            const above = aboveRes.data as any | null;

            let chosen: any | null = null;
            if (below && above) {
              const dBelow = Math.abs(new Date(below.timestamp).getTime() - ts);
              const dAbove = Math.abs(new Date(above.timestamp).getTime() - ts);
              chosen = dBelow <= dAbove ? below : above;
            } else {
              chosen = below || above || null;
            }

            if (!chosen || !interpolationRange) return null;

            const v = getMetricValue(
              {
                timestamp: new Date(chosen.timestamp).getTime(),
                temperature: chosen.temperature,
                humidity: chosen.humidity,
                absoluteHumidity: chosen.absolute_humidity,
                dewPoint: chosen.dew_point,
              },
              selectedMetric
            );
            const c = getColorFromValueSaturated(v, interpolationRange.min, interpolationRange.max, selectedMetric);
            const colorHex = `#${c.getHexString()}`;

            return {
              name: chosen.sensor_name || "Extérieur",
              temperature: chosen.temperature,
              absoluteHumidity: chosen.absolute_humidity,
              color: colorHex,
            } as ChartPoint | null;
          })()
        : Promise.resolve<ChartPoint | null>(null);

      // Attendre toutes les promesses
      const results = await Promise.all([...sensorPromises, outdoorPromise]);
      const ptsRaw = results.filter(Boolean) as ChartPoint[];

      let outPts = ptsRaw;

      // Si interpolation active: ne garder que volumétrique + extérieur
      const vol = volumetricRef.current;
      const outPoint = ptsRaw.find((p) => p.name.toLowerCase().includes("ext"));
      if (meshingEnabled && (vol || outPoint)) {
        outPts = [];
        if (vol) outPts.push({ name: "Moyenne volumétrique", ...vol });
        if (outPoint) outPts.push(outPoint);
      }

      if (!cancelled) setChartPoints(outPts);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    mode,
    currentSpace,
    sensors,
    outdoorData,
    hasOutdoorData,
    currentTimestamp,
    smoothingWindowSec,
    selectedMetric,
    interpolationRange,
    meshingEnabled,
    setChartPoints,
  ]);
}