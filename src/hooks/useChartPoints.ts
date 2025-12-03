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
  const volumetricRef = useRef<{ temperature: number; absoluteHumidity: number; metricValue?: number } | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e?.detail;
      if (!detail || typeof detail !== "object") {
        volumetricRef.current = null;
        return;
      }
      const { avgTemp, avgAbsHumidity, metricAverage } = detail;
      if (typeof avgTemp === "number" && typeof avgAbsHumidity === "number") {
        volumetricRef.current = { temperature: avgTemp, absoluteHumidity: avgAbsHumidity, metricValue: typeof metricAverage === "number" ? metricAverage : undefined };
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
        type Item = { name: string; temperature: number; absoluteHumidity: number; metricValue: number };
        let items: Item[] = [];

        // Intérieur (capteurs avec currentData)
        sensors.forEach((s) => {
          if (!s.currentData) return;
          const metricValue = getMetricValue(
            {
              timestamp: s.currentData.timestamp,
              temperature: s.currentData.temperature,
              humidity: s.currentData.humidity,
              absoluteHumidity: s.currentData.absoluteHumidity,
              dewPoint: s.currentData.dewPoint,
            },
            selectedMetric
          );
          items.push({
            name: s.name,
            temperature: s.currentData.temperature,
            absoluteHumidity: s.currentData.absoluteHumidity,
            metricValue,
          });
        });

        // Extérieur (si présent)
        if (hasOutdoorData && outdoorData) {
          const metricValue = getMetricValue(
            {
              timestamp: outdoorData.timestamp,
              temperature: outdoorData.temperature,
              humidity: outdoorData.humidity,
              absoluteHumidity: outdoorData.absoluteHumidity,
              dewPoint: outdoorData.dewPoint,
            },
            selectedMetric
          );
          items.push({
            name: "Extérieur",
            temperature: outdoorData.temperature,
            absoluteHumidity: outdoorData.absoluteHumidity,
            metricValue,
          });
        }

        // Si l’interpolation est active, ne garder que “Moyenne volumétrique” + Extérieur (si dispo)
        const vol = volumetricRef.current;
        if (meshingEnabled) {
          const filtered: Item[] = [];
          if (vol && typeof vol.metricValue === "number") {
            filtered.push({
              name: "Moyenne volumétrique",
              temperature: vol.temperature,
              absoluteHumidity: vol.absoluteHumidity,
              metricValue: vol.metricValue,
            });
          }
          const out = items.find((i) => i.name.toLowerCase().includes("ext"));
          if (out) filtered.push(out);
          items = filtered.length > 0 ? filtered : items;
        }

        // Déterminer la plage de couleur
        let minV: number;
        let maxV: number;
        if (interpolationRange) {
          minV = interpolationRange.min;
          maxV = interpolationRange.max;
        } else {
          const values = items.map((i) => i.metricValue).filter((v) => Number.isFinite(v));
          minV = Math.min(...values);
          maxV = Math.max(...values);
          if (minV === maxV) {
            minV -= 0.001;
            maxV += 0.001;
          }
        }

        // Coloriser et publier
        const outPts: ChartPoint[] = items.map((i) => {
          const c = getColorFromValueSaturated(i.metricValue, minV, maxV, selectedMetric);
          return {
            name: i.name,
            temperature: i.temperature,
            absoluteHumidity: i.absoluteHumidity,
            color: `#${c.getHexString()}`
          };
        });

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
          metricValue: v,
        };
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
              metricValue: v,
            };
          })()
        : Promise.resolve<ChartPoint | null>(null);

      // Attendre toutes les promesses
      const results = await Promise.all([...sensorPromises, outdoorPromise]);
      const itemsRaw = results.filter(Boolean) as { name: string; temperature: number; absoluteHumidity: number; metricValue: number }[];

      let items = itemsRaw;

      // Si interpolation active: ne garder que volumétrique + extérieur
      const vol = volumetricRef.current;
      const outPoint = itemsRaw.find((p) => p.name.toLowerCase().includes("ext"));
      if (meshingEnabled) {
        const filtered: typeof items = [];
        if (vol && typeof vol.metricValue === "number") {
          filtered.push({
            name: "Moyenne volumétrique",
            temperature: vol.temperature,
            absoluteHumidity: vol.absoluteHumidity,
            metricValue: vol.metricValue,
          });
        }
        if (outPoint) filtered.push(outPoint);
        items = filtered.length > 0 ? filtered : items;
      }

      // Déterminer la plage de couleur
      let minV: number;
      let maxV: number;
      if (interpolationRange) {
        minV = interpolationRange.min;
        maxV = interpolationRange.max;
      } else {
        const values = items.map((i) => i.metricValue).filter((v) => Number.isFinite(v));
        minV = Math.min(...values);
        maxV = Math.max(...values);
        if (minV === maxV) {
          minV -= 0.001;
          maxV += 0.001;
        }
      }

      // Coloriser et publier
      const outPts: ChartPoint[] = items.map((i) => {
        const c = getColorFromValueSaturated(i.metricValue, minV, maxV, selectedMetric);
        return {
          name: i.name,
          temperature: i.temperature,
          absoluteHumidity: i.absoluteHumidity,
          color: `#${c.getHexString()}`
        };
      });

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