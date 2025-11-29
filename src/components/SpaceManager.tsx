"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2, Plus, Trash2, Download, Upload, FolderOpen, AlertCircle, Info, CheckCircle2, Radio, History, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

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
}

interface SpaceManagerProps {
  onSpaceSelected: (space: Space) => void;
}

export const SpaceManager = ({ onSpaceSelected }: SpaceManagerProps) => {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [gltfFile, setGltfFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [jsonValidation, setJsonValidation] = useState<{ valid: boolean; message: string; sensorCount?: number } | null>(null);

  useEffect(() => {
    loadSpaces();
  }, []);

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
      
      // Fix JSON: replace commas with dots in numeric values
      text = text.replace(/"([xyz])":\s*(-?\d+),(\d+)/g, '"$1":$2.$3');
      
      console.log('Validating JSON:', text);
      
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

      // Validate each point
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

      // Upload GLTF file
      const gltfPath = `${user.id}/${Date.now()}_${gltfFile.name}`;
      const { error: gltfError } = await supabase.storage
        .from('models')
        .upload(gltfPath, gltfFile);

      if (gltfError) throw gltfError;

      // Upload JSON file
      const jsonPath = `${user.id}/${Date.now()}_${jsonFile.name}`;
      const { error: jsonError } = await supabase.storage
        .from('models')
        .upload(jsonPath, jsonFile);

      if (jsonError) throw jsonError;

      // Create space record
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
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess('Espace créé avec succès');
      setShowCreateForm(false);
      setNewSpaceName('');
      setNewSpaceDescription('');
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
      // Delete files from storage
      if (space.gltf_file_path) {
        await supabase.storage.from('models').remove([space.gltf_file_path]);
      }
      if (space.json_file_path) {
        await supabase.storage.from('models').remove([space.json_file_path]);
      }

      // Delete space record (sensor_data will be deleted automatically via CASCADE)
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

  const downloadFile = async (path: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('models')
        .download(path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      showError('Erreur lors du téléchargement');
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
                    <p className="mt-2">✓ Supporte les virgules comme séparateurs décimaux</p>
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
          {spaces.map((space) => (
            <motion.div
              key={space.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <LiquidGlassCard className="p-6 hover:shadow-lg transition-shadow">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">{space.name}</h3>
                      {space.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {space.description}
                        </p>
                      )}
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => deleteSpace(space)}
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 size={14} className="mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">
                        {space.gltf_file_name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">
                        {space.json_file_name}
                      </Badge>
                    </div>
                  </div>

                  {space.last_csv_date && (
                    <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                        Dernières données : {new Date(space.last_csv_date).toLocaleDateString('fr-FR')}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border-purple-300 dark:border-purple-700"
                      onClick={() => onSpaceSelected(space)}
                    >
                      <History size={14} className="mr-2" />
                      Replay
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 border-green-300 dark:border-green-700"
                      onClick={() => onSpaceSelected(space)}
                    >
                      <Radio size={14} className="mr-2" />
                      Live
                    </Button>
                  </div>
                </div>
              </LiquidGlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};