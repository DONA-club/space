import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';
import { modelAPI } from '@/services/api';
import { showError } from '@/utils/toast';

const Index = () => {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const machineId = useAppStore((state) => state.machineId);
  const setGltfModel = useAppStore((state) => state.setGltfModel);
  const setSensors = useAppStore((state) => state.setSensors);
  const setAuth = useAppStore((state) => state.setAuth);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedMachineId = localStorage.getItem('machineId');
    
    if (token && storedMachineId) {
      setAuth(token, storedMachineId);
    }
  }, [setAuth]);

  useEffect(() => {
    if (isAuthenticated && machineId) {
      loadInitialData();
    }
  }, [isAuthenticated, machineId]);

  const loadInitialData = async () => {
    try {
      // Charger le modèle 3D depuis les fichiers locaux pour la démo
      setGltfModel('/45bdVoltaire_SalonVesta.gltf');
      
      // Charger les positions des capteurs depuis le fichier JSON
      const response = await fetch('/45bdVoltaire_SalonVesta.points.json');
      const data = await response.json();
      
      const sensors = data.points.map((point: any, index: number) => ({
        id: index + 1,
        position: [point.x, point.y, point.z] as [number, number, number],
        name: `Capteur ${index + 1}`,
      }));
      
      setSensors(sensors);
    } catch (error) {
      showError('Erreur lors du chargement des données');
      console.error(error);
    }
  };

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <Dashboard />;
};

export default Index;