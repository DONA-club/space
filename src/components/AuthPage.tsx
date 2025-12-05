"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Loader2, Sparkles } from 'lucide-react';
import { FaGoogle, FaMicrosoft } from 'react-icons/fa';
import { Button } from './ui/button';
import { showError } from '@/utils/toast';
import { useAppStore } from '@/store/appStore';

export const AuthPage = () => {
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<'google' | 'azure' | 'demo' | null>(null);
  const setAuth = useAppStore((state) => state.setAuth);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setSigningIn('google');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google sign in error:', error);
      showError('Erreur lors de la connexion avec Google');
      setSigningIn(null);
    }
  };

  const handleMicrosoftSignIn = async () => {
    setSigningIn('azure');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
      });
      if (error) throw error;
    } catch (error) {
      console.error('Microsoft sign in error:', error);
      showError('Erreur lors de la connexion avec Microsoft');
      setSigningIn(null);
    }
  };

  const handleDemoSignIn = async () => {
    setSigningIn('demo');
    try {
      // Sign in anonymously for demo
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      
      // Set auth state to show initial configuration
      if (data.user) {
        setAuth(data.user);
      }
    } catch (error) {
      console.error('Demo sign in error:', error);
      showError('Erreur lors de la connexion démo');
      setSigningIn(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

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
              Space
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Jumeau Numérique & Data Science
            </p>
          </div>

          <div className="flex items-center justify-center gap-12 mb-8">
            {/* Google Logo */}
            <motion.button
              onClick={handleGoogleSignIn}
              disabled={signingIn !== null}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="relative group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingIn === 'google' ? (
                <Loader2 className="animate-spin h-12 w-12 text-gray-400" />
              ) : (
                <FaGoogle 
                  className="h-12 w-12 text-gray-400 group-hover:text-[#4285F4] transition-colors duration-300 filter grayscale group-hover:grayscale-0"
                />
              )}
            </motion.button>

            {/* Microsoft Logo */}
            <motion.button
              onClick={handleMicrosoftSignIn}
              disabled={signingIn !== null}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.95 }}
              className="relative group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signingIn === 'azure' ? (
                <Loader2 className="animate-spin h-12 w-12 text-gray-400" />
              ) : (
                <FaMicrosoft 
                  className="h-12 w-12 text-gray-400 group-hover:text-[#00A4EF] transition-colors duration-300 filter grayscale group-hover:grayscale-0"
                />
              )}
            </motion.button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-300 dark:border-gray-600" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-900 px-2 text-gray-500">ou</span>
            </div>
          </div>

          {/* Demo Account */}
          <Button
            onClick={handleDemoSignIn}
            disabled={signingIn !== null}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg relative overflow-hidden group"
          >
            {signingIn === 'demo' ? (
              <Loader2 className="animate-spin h-5 w-5" />
            ) : (
              <>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Sparkles className="mr-2 relative z-10" size={20} />
                <span className="relative z-10 font-semibold">Essayer la démo</span>
              </>
            )}
          </Button>
        </LiquidGlassCard>
      </motion.div>
    </div>
  );
};