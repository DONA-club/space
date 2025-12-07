# DONA.club Space

DONA.club Space est une application de visualisation environnementale et de jumeau numérique pour des espaces (pièces, appartements, bâtiments). Elle permet d'associer un modèle 3D (GLB/GLTF) avec des capteurs, d'interpoler des champs (température, humidité, etc.), de naviguer dans les données (live ou replay), et d’analyser via un diagramme psychrométrique.

## Aperçu des principales fonctionnalités

- Authentification Supabase (sessions anonymes de démo supportées).
- Gestion des espaces (création, renommage, suppression, localisation GPS).
- Upload de modèle 3D (GLB ou pack GLTF) et des positions de capteurs en JSON.
- Visualisation 3D avancée (Three.js) avec:
  - Interpolation IDW/RBF.
  - Plusieurs types de rendu: points, vecteurs, isosurfaces, maillage.
  - Légende de couleur dynamique et moyenne volumétrique.
  - Chemin du soleil, rose des vents, overlay lumineux.
  - Calcul de volume d’air et masses (air/eau).
- Timeline de données (Replay / Live) avec:
  - Import CSV (capteurs internes et extérieur).
  - Contrôle de lecture, boucle, vitesse, et fenêtre temporelle.
  - Δ Point de rosée entre intérieur et extérieur.
- Diagramme psychrométrique (SVG) avec zones et animation.
- Sélection de localisation via carte (MapPicker / OpenStreetMap).

## Pile technique

- React + TypeScript (Vite, SWC)
- Tailwind CSS + shadcn/ui + Radix UI
- React Router
- Zustand (store)
- TanStack Query (data fetching)
- Three.js (rendu 3D, GLTF)
- Supabase (auth, DB, storage)
- Framer Motion (animations)
- Leaflet (carte)

## Structure du projet

- Code source (React): `src/`
  - Pages: `src/pages/`
  - Composants: `src/components/`
  - Hooks/utilitaires: `src/hooks/`, `src/utils/`
  - Store: `src/store/appStore.ts`
  - Intégration Supabase: `src/integrations/supabase/client.ts`
- Fichiers publics: `public/` (GLB/GLTF/JSON de démo, psychro lib, favicon)
- Capacitor (mobile): `ios/`, `android/`
- Migrations Supabase: `supabase/migrations/`
- Configuration: `vite.config.ts`, `tailwind.config.ts`, `components.json`

## Configuration & variables d’environnement

- Le client Supabase est déjà configuré dans `src/integrations/supabase/client.ts`.
- Exemple d’environnement: `.env.example`
  - VITE_API_URL: URL de l’API backend (utilisé par `src/services/api.ts`, par défaut `http://localhost:8000`).
- Si vous utilisez votre propre projet Supabase, adaptez les valeurs (URL/anon key) dans le client Supabase.

## Base de données & stockage (Supabase)

Migrations présentes dans `supabase/migrations/` :
- `profiles`: table profils avec RLS.
- `spaces`: table des espaces (fichiers GLTF/JSON, lat/lon, orientation).
- `sensor_data`: données capteurs (intérieur et extérieur).
- `models` (bucket storage): stockage des fichiers 3D et JSON.
- Politiques RLS pour sécuriser l’accès par utilisateur et partager le Show-room (démo).

Important:
- RLS activée sur toutes les tables.
- Les fichiers 3D/JSON sont stockés dans le bucket `models`.
- Show-room (espace de démo) est mis en place/ restauré automatiquement pour les sessions anonymes via `SpaceManager`.

## Formats de fichiers

### JSON (positions des capteurs)
- Format attendu:
```json
{
  "points": [
    { "name": "Capteur 1", "x": -2.046877, "y": 2.426022, "z": 3.303156 },
    { "name": "Capteur 2", "x": 3.035000, "y": 2.346022, "z": 3.809492 }
  ]
}
```
- Les virgules décimales (ex: "3,14") sont automatiquement converties.

### CSV (données des capteurs)
- En-têtes recommandées (ordre): `timestamp,temperature,humidity,absolute_humidity,dew_point[,vpd_kpa]`
- Les fichiers pour le capteur extérieur peuvent être détectés via leur nom (balcon, terrasse, jardin, exterieur, outdoor, city, etc.).

## Flux utilisateur (pages principales)

- Index (`src/pages/Index.tsx`):
  - Authentification Supabase.
  - Choix d’un espace via `SpaceManager`.
  - Observation dans le `Dashboard`.

- Dashboard (`src/components/Dashboard.tsx`):
  - 3D (`Scene3DViewer`) ou Monitoring (diagramme psychrométrique).
  - Timeline (`TimelineControl`), import CSV, badges et contrôles.

- SpaceManager (`src/components/SpaceManager.tsx`):
  - Créer/renommer/supprimer un espace.
  - Uploader GLB/GLTF et JSON (capteurs).
  - Localisation via `MapPicker`.

## Visualisation 3D

- Interpolation:
  - Méthodes: IDW, RBF (kernels multiples).
  - Résolution ajustable (maillage).
  - Types: Points / Vecteurs / Isosurfaces / Mesh.
- Outils:
  - Légende de couleur (plage recalculée selon la sélection).
  - Moyenne volumétrique (diffusée au diagramme).
  - Chemin du soleil (SunCalc) et rose des vents (orientation).
  - Calculs volumétriques (`src/utils/volumeCalculations.ts`), densité/masses (`src/utils/airCalculations.ts`).

## Mode démo & sécurité

- Sessions anonymes: le Show-room est accessible et restauré si besoin.
- Les espaces créés en démo (hors Show-room) sont « éphémères »: visibles localement, sans persistance côté Supabase.
- RLS empêche l’accès aux données d’autres utilisateurs.

## Développement mobile (Capacitor)

- Capacitor webDir: `dist`.
- Identifiants appli: `capacitor.config.ts` (appId/appName).
- iOS: projet Xcode dans `ios/App/App.xcodeproj`.
- Android: projet Gradle dans `android/`.
- Splash & icônes présents dans `ios/App/App/Assets.xcassets` et `android/app/src/main/res`.

## Dépannage

- Modèle 3D ne s’affiche pas:
  - Vérifier que GLB/GLTF/pack est chargé et que les URI internes du GLTF pack sont réécrites (fonction de l’UI).
- JSON invalide:
  - Assurez-vous d’avoir un tableau `points` et des coordonnées numériques.
- Données capteurs absentes:
  - Utilisez l’import CSV dans le panneau Données / Timeline (mode Replay).
- Aperçu ne se met pas à jour:
  - Utilisez Refresh. Si nécessaire, utilisez Restart ou Rebuild.

## Contribution

- Code simple et lisible; privilégiez des composants courts et ciblés (< 100 lignes).
- Utilisez Tailwind & shadcn/ui pour UI.
- Respectez la structure des dossiers (pages/composants/hooks/utils).
- N’ajoutez pas de logique non demandée; évitez la sur-ingénierie.

## Licence

- Licence non spécifiée. Merci de contacter les mainteneurs pour plus d’informations.