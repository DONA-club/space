"use client";

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';
import { showError } from '@/utils/toast';

const Index = () => {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const machineId = useAppStore((state) => state.machineId);
  const setGltfModel = useAppStore((state) => state.setGltfModel);
  const setSensors = useAppStore((state) => state.setSensors);
  const setAuth = useAppStore((state) => state.setAuth);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedMachineId = localStorage.getItem('machineId');
    
    if (token && storedMachineId) {
      setAuth(token, storedMachineId);
    }
  }, [setAuth]);

  useEffect(() => {
    if (isAuthenticated && machineId && !isLoading) {
      loadInitialData();
    }
  }, [isAuthenticated, machineId]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Charger les positions des capteurs depuis le fichier JSON
      const response = await fetch('/45bdVoltaire_SalonVesta.points.json');
      
      if (!response.ok) {
        throw new Error('Impossible de charger les positions des capteurs');
      }
      
      const data = await response.json();
      
      if (!data.points || !Array.isArray(data.points)) {
        throw new Error('Format de données invalide');
      }
      
      const sensors = data.points.map((point: any, index: number) => ({
        id: index + 1,
        position: [point.x, point.y, point.z] as [number, number, number],
        name: `Capteur ${index + 1}`,
      }));
      
      setSensors(sensors);
      
      // Le modèle 3D est maintenant représenté par une boîte simple
      // Pour utiliser le vrai modèle GLTF, décommentez la ligne suivante:
      // setGltfModel('/45bdVoltaire_SalonVesta.gltf');
      
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      showError('Erreur lors du chargement des données');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <Dashboard />;
};

export default Index;