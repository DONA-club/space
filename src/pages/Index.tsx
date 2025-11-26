"use client";

import { useEffect } from 'react';
import { useAppStore } from '@/store/appStore';
import { LoginForm } from '@/components/LoginForm';
import { Dashboard } from '@/components/Dashboard';

const Index = () => {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const setAuth = useAppStore((state) => state.setAuth);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedMachineId = localStorage.getItem('machineId');
    
    if (token && storedMachineId) {
      setAuth(token, storedMachineId);
    }
  }, [setAuth]);

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return <Dashboard />;
};

export default Index;