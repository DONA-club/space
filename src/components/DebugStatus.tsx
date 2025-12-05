"use client";

import React from 'react';
import { LiquidGlassCard } from './LiquidGlassCard';

type DebugStatusProps = {
  currentSpace: any;
  hasSensorMapping: boolean;
  mode: 'live' | 'replay';
  dataReady: boolean;
  sensorsCount: number;
  gltfModelLoaded: boolean;
};

export const DebugStatus: React.FC<DebugStatusProps> = ({
  currentSpace,
  hasSensorMapping,
  mode,
  dataReady,
  sensorsCount,
  gltfModelLoaded,
}) => {
  const jsonFilePath = currentSpace?.json_file_path ?? null;
  const jsonFileName = currentSpace?.json_file_name ?? null;
  const hasLocalJsonText = Boolean((currentSpace as any)?.localJsonText);
  const spaceId = currentSpace?.id ?? null;

  const reasons: string[] = [];
  if (!hasSensorMapping) {
    reasons.push(
      "Le panneau Données est masqué car aucun mapping JSON n'a été détecté pour l'espace courant."
    );
    const details: string[] = [];
    if (!jsonFilePath) details.push('json_file_path manquant');
    if (!jsonFileName) details.push('json_file_name manquant');
    if (!hasLocalJsonText) details.push('localJsonText absent');
    if (details.length > 0) {
      reasons.push(`Détails: ${details.join(' · ')}`);
    }
  } else {
    reasons.push('Le mapping JSON est détecté, le panneau Données devrait être rendu.');
  }

  return (
    <LiquidGlassCard className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Debug affichage Données
        </h2>
        <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
          mode: {mode}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">hasSensorMapping:</span> {String(hasSensorMapping)}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">dataReady:</span> {String(dataReady)}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">sensorsCount:</span> {sensorsCount}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">gltfModelLoaded:</span> {String(gltfModelLoaded)}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">spaceId:</span> {spaceId ?? 'null'}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">json_file_path:</span> {jsonFilePath ?? 'null'}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">json_file_name:</span> {jsonFileName ?? 'null'}
        </div>
        <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
          <span className="font-medium">localJsonText:</span> {String(hasLocalJsonText)}
        </div>
      </div>

      <div className="mt-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
        {reasons.map((r, i) => (
          <div key={i}>• {r}</div>
        ))}
      </div>

      <div className="mt-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-500">
        Règle: Le panneau Données est rendu si hasSensorMapping === true. Si ce panneau indique que hasSensorMapping est false, vérifie que le JSON est bien associé à l’espace (json_file_path, json_file_name ou localJsonText).
      </div>
    </LiquidGlassCard>
  );
};

export default DebugStatus;