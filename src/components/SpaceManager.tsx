"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Plus, Trash2, Upload, FolderOpen, AlertCircle, Info, CheckCircle2, MoreVertical, Eye, Box, Activity, Cloud, Calendar, MapPin, AlertTriangle, Radio, Link2, FileUp, FileX, Clock, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { MapPicker } from './MapPicker';

interface Space {
  id: string;
  name: string;
  description: string | null;
  gltf_file_path: string | null;
  gltf_file_name: string | null;
  json_file_path: string | null;
  json_file_name: string | null;
  last_csv_date: string | null;
  created_at: string;
  updated_at: string;
  latitude: number | null;
  longitude: number | null;
}

interface SpaceManagerProps {
  onSpaceSelected: (space: Space) => void;
}

interface SpaceStats {
  indoorSensorCount: number;
  hasOutdoorData: boolean;
  dataStartDate: Date | null;
  dataEndDate: Date | null;
  hasDataGaps: boolean;
  isLiveConnected: boolean;
  dataDelayDays: number | null;
}

export const SpaceManager = ({ onSpaceSelected }: SpaceManagerProps) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceLatitude, setNewSpaceLatitude] = useState<number>(48.8566);
  const [newSpaceLongitude, setNewSpaceLongitude] = useState<number>(2.3522);
  const [gltfFile, setGltfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonValidation, setJsonValidation] = useState<{ valid: boolean; message: string; sensorCount?: number } | null>(null);
  const [spaceStats, setSpaceStats] = useState<Map<string, SpaceStats>>(new Map());
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [selectedSpaceForMap, setSelectedSpaceForMap] = useState<Space | null>(null);
  const [tempMapLat, setTempMapLat] = useState<number>(48.8566);
  const [tempMapLng, setTempMapLng] = useState<number>(2.3522);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [selectedSpaceForRename, setSelectedSpaceForRename] = useState<Space | null>(null);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [spaceAddresses, setSpaceAddresses] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    loadSpaces();
  }, []);

  useEffect(() => {
    if (spaces.length > 0) {
      loadSpaceStats();
      loadSpaceAddresses();
    }
  }, [spaces]);

  const loadSpaces = async () => {
    try {
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSpaces(data || []);
    } catch (error) {
      console.error('Error loading spaces:', error);
      showError('Erreur lors du chargement des espaces');
    } finally {
      setLoading(false);
    }
  };

  const loadSpaceAddresses = async () => {
    const addressMap = new Map<string, string>();

    for (const space of spaces) {
      if (space.latitude && space.longitude) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${space.latitude}&lon=${space.longitude}&zoom=18&addressdetails=1`
          );
          const data = await response.json();
          
          if (data.display_name) {
            addressMap.set(space.id, data.display_name);
          }
        } catch (error) {
          console.error(`Error fetching address for space ${space.id}:`, error);
        }
      }
    }

    setSpaceAddresses(addressMap);
  };

  const loadSpaceStats = async () => {
    const statsMap = new Map<string, SpaceStats>();

    for (const space of spaces) {
      try {
        let indoorSensorCount = 0;
        if (space.json_file_path) {
          const { data: jsonData } = await supabase.storage
            .from('models')
            .download(space.json_file_path);

          if (jsonData) {
            const text = await jsonData.text();
            const json = JSON.parse(text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3'));
            indoorSensorCount = json.points?.length || 0;
          }
        }

        const { count: outdoorCount } = await supabase
          .from('sensor_data')
          .select('*', { count: 'exact', head: true })
          .eq('space_id', space.id)
          .eq('sensor_id', 0);

        const { data: minData } = await supabase
          .from('sensor_data')
          .select('timestamp')
          .eq('space_id', space.id)
          .order('timestamp', { ascending: true })
          .limit(1)
          .single();

        const { data: maxData } = await supabase
          .from('sensor_data')
          .select('timestamp')
          .eq('space_id', space.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();

        let dataDelayDays: number | null = null;
        if (maxData) {
          const lastDataDate = new Date(maxData.timestamp);
          const now = new Date();
          const diffMs = now.getTime() - lastDataDate.getTime();
          dataDelayDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }

        const hasDataGaps = false;

        statsMap.set(space.id, {
          indoorSensorCount,
          hasOutdoorData: (outdoorCount || 0) > 0,
          dataStartDate: minData ? new Date(minData.timestamp) : null,
          dataEndDate: maxData ? new Date(maxData.timestamp) : null,
          hasDataGaps,
          isLiveConnected: false,
          dataDelayDays,
        });
      } catch (error) {
        console.error(`Error loading stats for space ${space.id}:`, error);
      }
    }

    setSpaceStats(statsMap);
  };

  const parseNumber = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      return parseFloat(value.replace(',', '.'));
    }
    return NaN;
  };

  const validateJsonFile = async (file: File) => {
    try {
      let text = await file.text();
      text = text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
      const data = JSON.parse(text);

      if (!data.points || !Array.isArray(data.points)) {
        setJsonValidation({
          valid: false,
          message: 'Le fichier doit contenir un tableau "points"'
        });
        return;
      }

      if (data.points.length === 0) {
        setJsonValidation({
          valid: false,
          message: 'Le tableau "points" est vide'
        });
        return;
      }

      const invalidPoints: string[] = [];
      data.points.forEach((point: any, index: number) => {
        const x = parseNumber(point.x);
        const y = parseNumber(point.y);
        const z = parseNumber(point.z);
        
        if (isNaN(x) || isNaN(y) || isNaN(z)) {
          invalidPoints.push(`Point ${index + 1} (${point.name || 'sans nom'}): coordonnées invalides`);
        }
      });

      if (invalidPoints.length > 0) {
        setJsonValidation({
          valid: false,
          message: `Points invalides:\n${invalidPoints.join('\n')}`
        });
        return;
      }

      setJsonValidation({
        valid: true,
        message: `✓ ${data.points.length} capteur${data.points.length > 1 ? 's' : ''} détecté${data.points.length > 1 ? 's' : ''}`,
        sensorCount: data.points.length
      });
    } catch (error) {
      console.error('JSON validation error:', error);
      setJsonValidation({
        valid: false,
        message: error instanceof Error ? error.message : 'Format JSON invalide'
      });
    }
  };

  const handleJsonFileSelect = (file: File) => {
    setJsonFile(file);
    setJsonValidation(null);
    validateJsonFile(file);
  };

  const createSpace = async () => {
    if (!newSpaceName.trim()) {
      showError('Le nom de l\'espace est requis');
      return;
    }

    if (!gltfFile || !jsonFile) {
      showError('Les fichiers 3D et JSON sont requis');
      return;
    }

    if (!jsonValidation?.valid) {
      showError('Le fichier JSON n\'est pas valide');
      return;
    }

    setCreating(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const gltfPath = `${user.id}/${Date.now()}_${gltfFile.name}`;
      const { error: gltfError } = await supabase.storage
        .from('models')
        .upload(gltfPath, gltfFile);

      if (gltfError) throw gltfError;

      const jsonPath = `${user.id}/${Date.now()}_${jsonFile.name}`;
      const { error: jsonError } = await supabase.storage
        .from('models')
        .upload(jsonPath, jsonFile);

      if (jsonError) throw jsonError;

      const { data, error } = await supabase
        .from('spaces')
        .insert({
          user_id: user.id,
          name: newSpaceName,
          description: newSpaceDescription || null,
          gltf_file_path: gltfPath,
          gltf_file_name: gltfFile.name,
          json_file_path: jsonPath,
          json_file_name: jsonFile.name,
          latitude: newSpaceLatitude,
          longitude: newSpaceLongitude,
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Espace créé avec succès');
      setShowCreateForm(false);
      setNewSpaceName('');
      setNewSpaceDescription('');
      setNewSpaceLatitude(48.8566);
      setNewSpaceLongitude(2.3522);
      setGltfFile(null);
      setJsonFile(null);
      setJsonValidation(null);
      loadSpaces();
    } catch (error) {
      console.error('Error creating space:', error);
      showError('Erreur lors de la création de l\'espace');
    } finally {
      setCreating(false);
    }
  };

  const deleteSpace = async (space: Space) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'espace "${space.name}" ?\n\nCette action supprimera également toutes les données associées.`)) {
      return;
    }

    try {
      if (space.gltf_file_path) {
        await supabase.storage.from('models').remove([space.gltf_file_path]);
      }
      if (space.json_file_path) {
        await supabase.storage.from('models').remove([space.json_file_path]);
      }

      const { error } = await supabase
        .from('spaces')
        .delete()
        .eq('id', space.id);

      if (error) throw error;

      showSuccess('Espace supprimé avec succès');
      loadSpaces();
    } catch (error) {
      console.error('Error deleting space:', error);
      showError('Erreur lors de la suppression de l\'espace');
    }
  };

  const handleUploadGltf = async (space: Space) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.glb,.gltf';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        const gltfPath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('models')
          .upload(gltfPath, file);

        if (uploadError) throw uploadError;

        if (space.gltf_file_path) {
          await supabase.storage.from('models').remove([space.gltf_file_path]);
        }

        const { error: updateError } = await supabase
          .from('spaces')
          .update({
            gltf_file_path: gltfPath,
            gltf_file_name: file.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', space.id);

        if (updateError) throw updateError;

        showSuccess('Modèle 3D chargé avec succès');
        loadSpaces();
      } catch (error) {
        console.error('Error uploading GLTF:', error);
        showError('Erreur lors du chargement du modèle 3D');
      }
    };
    input.click();
  };

  const handleDeleteGltf = async (space: Space) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer le modèle 3D ?')) {
      return;
    }

    try {
      if (space.gltf_file_path) {
        await supabase.storage.from('models').remove([space.gltf_file_path]);
      }

      const { error } = await supabase
        .from('spaces')
        .update({
          gltf_file_path: null,
          gltf_file_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', space.id);

      if (error) throw error;

      showSuccess('Modèle 3D supprimé avec succès');
      loadSpaces();
    } catch (error) {
      console.error('Error deleting GLTF:', error);
      showError('Erreur lors de la suppression du modèle 3D');
    }
  };

  const handleUploadJson = async (space: Space) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        let text = await file.text();
        text = text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
        const data = JSON.parse(text);

        if (!data.points || !Array.isArray(data.points) || data.points.length === 0) {
          throw new Error('Format JSON invalide');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Non authentifié');

        const jsonPath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('models')
          .upload(jsonPath, file);

        if (uploadError) throw uploadError;

        if (space.json_file_path) {
          await supabase.storage.from('models').remove([space.json_file_path]);
        }

        const { error: updateError } = await supabase
          .from('spaces')
          .update({
            json_file_path: jsonPath,
            json_file_name: file.name,
            updated_at: new Date().toISOString()
          })
          .eq('id', space.id);

        if (updateError) throw updateError;

        showSuccess('Mapping des capteurs chargé avec succès');
        loadSpaces();
      } catch (error) {
        console.error('Error uploading JSON:', error);
        showError('Erreur lors du chargement du mapping');
      }
    };
    input.click();
  };

  const handleDeleteJson = async (space: Space) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer le mapping des capteurs ?')) {
      return;
    }

    try {
      if (space.json_file_path) {
        await supabase.storage.from('models').remove([space.json_file_path]);
      }

      const { error } = await supabase
        .from('spaces')
        .update({
          json_file_path: null,
          json_file_name: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', space.id);

      if (error) throw error;

      showSuccess('Mapping des capteurs supprimé avec succès');
      loadSpaces();
    } catch (error) {
      console.error('Error deleting JSON:', error);
      showError('Erreur lors de la suppression du mapping');
    }
  };

  const openRenameDialog = (space: Space) => {
    setSelectedSpaceForRename(space);
    setNewName(space.name);
    setShowRenameDialog(true);
  };

  const handleRename = async () => {
    if (!selectedSpaceForRename || !newName.trim()) return;

    setRenaming(true);
    try {
      const { error } = await supabase
        .from('spaces')
        .update({
          name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSpaceForRename.id);

      if (error) throw error;

      showSuccess('Espace renommé avec succès');
      setShowRenameDialog(false);
      loadSpaces();
    } catch (error) {
      console.error('Error renaming space:', error);
      showError('Erreur lors du renommage de l\'espace');
    } finally {
      setRenaming(false);
    }
  };

  const formatDateRange = (start: Date | null, end: Date | null): string => {
    if (!start || !end) return 'Aucune donnée';
    
    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return `${diffHours}h`;
    }
    
    return `${diffDays}j`;
  };

  const formatPreciseDateRange = (start: Date | null, end: Date | null): string => {
    if (!start || !end) return 'Aucune donnée disponible';
    
    const startStr = start.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const endStr = end.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `Du ${startStr} au ${endStr}`;
  };

  const handleObserveSpace = (space: Space) => {
    if (!space.latitude || !space.longitude) {
      showError('La localisation de cet espace n\'est pas définie. Veuillez la configurer avant d\'observer.');
      return;
    }
    onSpaceSelected(space);
  };

  const openMapDialog = (space: Space) => {
    setSelectedSpaceForMap(space);
    setTempMapLat(space.latitude || 48.8566);
    setTempMapLng(space.longitude || 2.3522);
    setShowMapDialog(true);
  };

  const handleUpdateLocation = async () => {
    if (!selectedSpaceForMap) return;

    setUpdatingLocation(true);
    try {
      const { error } = await supabase
        .from('spaces')
        .update({
          latitude: tempMapLat,
          longitude: tempMapLng,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedSpaceForMap.id);

      if (error) throw error;

      showSuccess('Localisation mise à jour avec succès');
      setShowMapDialog(false);
      loadSpaces();
    } catch (error) {
      console.error('Error updating location:', error);
      showError('Erreur lors de la mise à jour de la localisation');
    } finally {
      setUpdatingLocation(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Space
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gérez vos modèles 3D et données de capteurs
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(!showCreateForm)}>
          <Plus size={16} className="mr-2" />
          Nouvel Espace
        </Button>
      </div>

      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <LiquidGlassCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Créer un nouvel espace</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="space-name">Nom de l'espace *</Label>
                  <Input
                    id="space-name"
                    value={newSpaceName}
                    onChange={(e) => setNewSpaceName(e.target.value)}
                    placeholder="Ex: Salon Vesta"
                  />
                </div>

                <div>
                  <Label htmlFor="space-description">Description</Label>
                  <Textarea
                    id="space-description"
                    value={newSpaceDescription}
                    onChange={(e) => setNewSpaceDescription(e.target.value)}
                    placeholder="Description de l'espace..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="mb-2 block">Localisation *</Label>
                  <MapPicker
                    initialLat={newSpaceLatitude}
                    initialLng={newSpaceLongitude}
                    onLocationSelect={(lat, lng) => {
                      setNewSpaceLatitude(lat);
                      setNewSpaceLongitude(lng);
                    }}
                  />
                </div>

                <div>
                  <Label>Modèle 3D (GLB/GLTF) *</Label>
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.glb,.gltf';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) setGltfFile(file);
                        };
                        input.click();
                      }}
                    >
                      <Upload size={16} className="mr-2" />
                      {gltfFile ? gltfFile.name : 'Choisir un fichier'}
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Positions des capteurs (JSON) *</Label>
                  <div className="mt-2 space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.json';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleJsonFileSelect(file);
                        };
                        input.click();
                      }}
                    >
                      <Upload size={16} className="mr-2" />
                      {jsonFile ? jsonFile.name : 'Choisir un fichier'}
                    </Button>

                    {jsonValidation && (
                      <Alert className={jsonValidation.valid 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }>
                        {jsonValidation.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                        <AlertDescription className={`text-xs whitespace-pre-line ${
                          jsonValidation.valid 
                            ? 'text-green-800 dark:text-green-200'
                            : 'text-red-800 dark:text-red-200'
                        }`}>
                          {jsonValidation.message}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="font-medium mb-1">Format JSON attendu :</p>
                    <pre className="text-xs overflow-x-auto bg-white dark:bg-black p-2 rounded">
{`{
  "points": [
    {
      "name": "Capteur 1",
      "x": -2.046877,
      "y": 2.426022,
      "z": 3.303156
    }
  ]
}`}
                    </pre>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={createSpace}
                    disabled={creating || !newSpaceName || !gltfFile || !jsonFile || !jsonValidation?.valid}
                    className="flex-1"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Création...
                      </>
                    ) : (
                      'Créer l\'espace'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      setNewSpaceName('');
                      setNewSpaceDescription('');
                      setNewSpaceLatitude(48.8566);
                      setNewSpaceLongitude(2.3522);
                      setGltfFile(null);
                      setJsonFile(null);
                      setJsonValidation(null);
                    }}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            </LiquidGlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {spaces.length === 0 ? (
        <LiquidGlassCard className="p-12">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">Aucun espace créé</p>
            <p className="text-sm">Créez votre premier espace pour commencer</p>
          </div>
        </LiquidGlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {spaces.map((space) => {
            const stats = spaceStats.get(space.id);
            const address = spaceAddresses.get(space.id);
            
            return (
              <motion.div
                key={space.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <LiquidGlassCard className="p-5 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1 truncate">{space.name}</h3>
                      {space.description && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                          {space.description}
                        </p>
                      )}
                      {(space.latitude && space.longitude) && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 space-y-0.5">
                          {address && (
                            <p className="line-clamp-1" title={address}>
                              📍 {address}
                            </p>
                          )}
                          <p className="font-mono">
                            {space.latitude.toFixed(6)}, {space.longitude.toFixed(6)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openRenameDialog(space)}>
                          <Edit2 size={14} className="mr-2" />
                          Renommer l'espace
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link2 size={14} className="mr-2" />
                          Rattacher un système
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openMapDialog(space)}>
                          <MapPin size={14} className="mr-2" />
                          Changer la localisation
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {space.gltf_file_path ? (
                          <DropdownMenuItem onClick={() => handleDeleteGltf(space)}>
                            <FileX size={14} className="mr-2" />
                            Effacer modèle 3D
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUploadGltf(space)}>
                            <FileUp size={14} className="mr-2" />
                            Charger modèle 3D
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {space.json_file_path ? (
                          <DropdownMenuItem onClick={() => handleDeleteJson(space)}>
                            <FileX size={14} className="mr-2" />
                            Effacer mapping capteurs
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleUploadJson(space)}>
                            <FileUp size={14} className="mr-2" />
                            Charger mapping capteurs
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => deleteSpace(space)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Supprimer l'espace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${space.gltf_file_name ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-800/20'}`}
                          >
                            <Box size={12} className="mr-1" />
                            Modèle 3D
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">{space.gltf_file_name || 'Aucun modèle 3D chargé'}</p>
                          {space.gltf_file_name && (
                            <p className="text-xs text-gray-400">Fichier: {space.gltf_file_name}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${stats?.indoorSensorCount ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700' : 'bg-gray-50 dark:bg-gray-800/20'}`}
                          >
                            <Activity size={12} className="mr-1" />
                            {stats?.indoorSensorCount || 0} capteurs
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs font-medium">{stats?.indoorSensorCount || 0} capteur{(stats?.indoorSensorCount || 0) > 1 ? 's' : ''} intérieur{(stats?.indoorSensorCount || 0) > 1 ? 's' : ''}</p>
                          {space.json_file_name && (
                            <p className="text-xs text-gray-400">Mapping: {space.json_file_name}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="space-y-2 mb-4 flex-1">
                    {stats?.isLiveConnected ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Radio size={12} className="text-green-500 animate-pulse" />
                        <span className="text-green-600 dark:text-green-400 font-medium">Système connecté (Live)</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <Radio size={12} className="text-gray-400" />
                          <span>Hors ligne - Données historiques</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${stats?.hasOutdoorData ? 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700' : 'bg-gray-50 dark:bg-gray-800/20 opacity-50'}`}
                                >
                                  <Cloud size={12} className="mr-1" />
                                  Extérieur
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-medium">
                                  {stats?.hasOutdoorData ? 'Données extérieures disponibles' : 'Aucune donnée extérieure'}
                                </p>
                                {stats?.hasOutdoorData && (
                                  <p className="text-xs text-gray-400">Capteur météo configuré</p>
                                )}
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${stats?.dataStartDate ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' : 'bg-gray-50 dark:bg-gray-800/20 opacity-50'}`}
                                >
                                  <Calendar size={12} className="mr-1" />
                                  {formatDateRange(stats?.dataStartDate || null, stats?.dataEndDate || null)}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs font-medium">Période couverte</p>
                                <p className="text-xs text-gray-400">
                                  {formatPreciseDateRange(stats?.dataStartDate || null, stats?.dataEndDate || null)}
                                </p>
                              </TooltipContent>
                            </Tooltip>

                            {stats?.dataDelayDays !== null && stats?.dataDelayDays !== undefined && stats.dataDelayDays > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${
                                      stats.dataDelayDays > 7 
                                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700' 
                                        : stats.dataDelayDays > 1
                                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700'
                                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                                    }`}
                                  >
                                    <Clock size={12} className="mr-1" />
                                    -{stats.dataDelayDays}j
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs font-medium">Retard des données</p>
                                  <p className="text-xs text-gray-400">
                                    Dernière mise à jour il y a {stats.dataDelayDays} jour{stats.dataDelayDays > 1 ? 's' : ''}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>

                        {stats?.hasDataGaps && (
                          <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 py-2">
                            <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            <AlertDescription className="text-xs text-orange-800 dark:text-orange-200">
                              Périodes de données manquantes détectées
                            </AlertDescription>
                          </Alert>
                        )}

                        {!stats?.dataStartDate && (
                          <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 py-2">
                            <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                            <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                              Aucune donnée historique disponible
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            className="flex-1 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                            onClick={() => handleObserveSpace(space)}
                            disabled={!space.latitude || !space.longitude}
                          >
                            <Eye size={16} className="mr-2" />
                            Observer
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {space.latitude && space.longitude 
                              ? 'Entrer dans la visualisation 3D' 
                              : 'Localisation requise pour observer'}
                          </p>
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-10 p-0"
                            onClick={() => openMapDialog(space)}
                          >
                            <MapPin size={16} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">
                            {space.latitude && space.longitude 
                              ? `Voir sur la carte (${space.latitude.toFixed(4)}, ${space.longitude.toFixed(4)})` 
                              : 'Définir la localisation'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </LiquidGlassCard>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Localisation de {selectedSpaceForMap?.name}</DialogTitle>
            <DialogDescription>
              Visualisez ou modifiez la position géographique de cet espace
            </DialogDescription>
          </DialogHeader>
          
          <MapPicker
            initialLat={tempMapLat}
            initialLng={tempMapLng}
            onLocationSelect={(lat, lng) => {
              setTempMapLat(lat);
              setTempMapLng(lng);
            }}
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMapDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateLocation} disabled={updatingLocation}>
              {updatingLocation ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Mise à jour...
                </>
              ) : (
                'Enregistrer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer l'espace</DialogTitle>
            <DialogDescription>
              Modifier le nom de "{selectedSpaceForRename?.name}"
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="new-name">Nouveau nom</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Entrez le nouveau nom"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={renaming || !newName.trim()}>
              {renaming ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={16} />
                  Renommage...
                </>
              ) : (
                'Renommer'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};