"use client";

import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/appStore";

function formatNum(n: number, digits = 2) {
  const f = Number.isFinite(n) ? n : 0;
  return f.toFixed(digits);
}

const Row: React.FC<{ label: string; valueText: string; children: React.ReactNode }> = ({ label, valueText, children }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="text-[11px] text-muted-foreground">{valueText}</span>
      </div>
      {children}
    </div>
  );
};

const ZoneAdjustPanel: React.FC = () => {
  const showCalibrationPanel = useAppStore((s) => s.showCalibrationPanel);
  const psychroAdjust = useAppStore((s) => s.psychroAdjust);
  const setPsychroXShiftDeg = useAppStore((s) => s.setPsychroXShiftDeg);
  const setPsychroWidthScale = useAppStore((s) => s.setPsychroWidthScale);
  const setPsychroYOffsetPx = useAppStore((s) => s.setPsychroYOffsetPx);
  const setPsychroCurvatureGain = useAppStore((s) => s.setPsychroCurvatureGain);
  const setPsychroHeightScale = useAppStore((s) => s.setPsychroHeightScale);
  const setPsychroZoomScale = useAppStore((s) => s.setPsychroZoomScale);

  const xShiftDisplay = useMemo(() => `${formatNum(psychroAdjust.xShiftDeg, 1)} °C`, [psychroAdjust.xShiftDeg]);
  const widthDisplay = useMemo(() => `${formatNum(psychroAdjust.widthScale, 2)}×`, [psychroAdjust.widthScale]);
  const heightDisplay = useMemo(() => `${formatNum(psychroAdjust.heightScale, 2)}×`, [psychroAdjust.heightScale]);
  const yOffsetDisplay = useMemo(() => `${formatNum(psychroAdjust.yOffsetPx, 1)} px`, [psychroAdjust.yOffsetPx]);
  const curvatureDisplay = useMemo(() => `${formatNum(psychroAdjust.curvatureGain, 2)}×`, [psychroAdjust.curvatureGain]);
  const zoomDisplay = useMemo(() => `${formatNum(psychroAdjust.zoomScale, 2)}×`, [psychroAdjust.zoomScale]);

  if (!showCalibrationPanel) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Card className="w-[280px] p-4 shadow-lg border border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="space-y-4">
          <div className="text-xs font-medium text-muted-foreground">Ajustements zones (Givoni)</div>

          <Row label="Décalage horizontal" valueText={xShiftDisplay}>
            <Slider
              value={[psychroAdjust.xShiftDeg]}
              min={-20}
              max={20}
              step={0.1}
              onValueChange={(v) => setPsychroXShiftDeg(v[0] ?? 0)}
            />
          </Row>

          <Row label="Échelle de largeur" valueText={widthDisplay}>
            <Slider
              value={[psychroAdjust.widthScale]}
              min={0.7}
              max={1.4}
              step={0.01}
              onValueChange={(v) => setPsychroWidthScale(v[0] ?? 1)}
            />
          </Row>

          <Row label="Échelle de hauteur" valueText={heightDisplay}>
            <Slider
              value={[psychroAdjust.heightScale]}
              min={0.7}
              max={1.4}
              step={0.01}
              onValueChange={(v) => setPsychroHeightScale(v[0] ?? 1)}
            />
          </Row>

          <Row label="Zoom des zones" valueText={zoomDisplay}>
            <Slider
              value={[psychroAdjust.zoomScale]}
              min={0.7}
              max={1.5}
              step={0.01}
              onValueChange={(v) => setPsychroZoomScale(v[0] ?? 1)}
            />
          </Row>

          <Row label="Décalage vertical" valueText={yOffsetDisplay}>
            <Slider
              value={[psychroAdjust.yOffsetPx]}
              min={-600}
              max={600}
              step={0.5}
              onValueChange={(v) => setPsychroYOffsetPx(v[0] ?? 0)}
            />
          </Row>

          <Row label="Correction de courbure" valueText={curvatureDisplay}>
            <Slider
              value={[psychroAdjust.curvatureGain]}
              min={0}
              max={75}
              step={0.05}
              onValueChange={(v) => setPsychroCurvatureGain(v[0] ?? 0.7)}
            />
          </Row>

          <p className="text-[11px] text-muted-foreground">
            Utilise ces sliders, puis donne-moi les valeurs pour caler les polygones sur le diagramme.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default ZoneAdjustPanel;