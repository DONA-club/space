"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LiquidGlassCard } from './LiquidGlassCard';
import { authAPI } from '@/services/api';
import { useAppStore } from '@/store/appStore';
import { showError, showSuccess } from '@/utils/toast';
import { Lock, User, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAppStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await authAPI.login({ username, password });
      localStorage.setItem('token', response.token);
      localStorage.setItem('machineId', response.machineId);
      setAuth(response.token, response.machineId);
      showSuccess('Connexion réussie !');
    } catch (error) {
      showError('Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setUsername('demo');
    setPassword('demo123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <LiquidGlassCard className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              DONA.club Space
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Jumeau Numérique & Data Science
            </p>
          </div>

          <Alert className="mb-6 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Identifiants de démo :</strong>
              <br />
              Utilisateur : <code className="bg-white dark:bg-black px-1 rounded">demo</code>
              <br />
              Mot de passe : <code className="bg-white dark:bg-black px-1 rounded">demo123</code>
            </AlertDescription>
          </Alert>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <User size={16} />
                Identifiant
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant"
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock size={16} />
                Mot de passe
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                required
                className="bg-white/50 dark:bg-black/50 backdrop-blur-sm"
              />
            </div>

            <div className="space-y-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleDemoLogin}
                className="w-full bg-white/50 dark:bg-black/50"
              >
                Remplir avec les identifiants démo
              </Button>
            </div>
          </form>
        </LiquidGlassCard>
      </motion.div>
    </div>
  );
};