"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { LiquidGlassCard } from './LiquidGlassCard';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { showError } from '@/utils/toast';

export const AuthPage = () => {
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState<'google' | 'azure' | 'demo' | null>(null);

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
        options: {
          redirectTo: window.location.origin,
        },
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
        options: {
          redirectTo: window.location.origin,
        },
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
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
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
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="text-blue-600" size={32} />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Space
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Jumeau Numérique & Data Science
            </p>
          </div>

          <div className="space-y-3">
            {/* Google Sign In */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={signingIn !== null}
              className="w-full h-14 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm relative overflow-hidden group"
              variant="outline"
            >
              {signingIn === 'google' ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-6 h-6 relative z-10" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                </>
              )}
            </Button>

            {/* Microsoft Sign In */}
            <Button
              onClick={handleMicrosoftSignIn}
              disabled={signingIn !== null}
              className="w-full h-14 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm relative overflow-hidden group"
              variant="outline"
            >
              {signingIn === 'azure' ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <svg className="w-6 h-6 relative z-10" viewBox="0 0 23 23">
                    <path fill="#f25022" d="M0 0h11v11H0z" />
                    <path fill="#00a4ef" d="M12 0h11v11H12z" />
                    <path fill="#7fba00" d="M0 12h11v11H0z" />
                    <path fill="#ffb900" d="M12 12h11v11H12z" />
                  </svg>
                </>
              )}
            </Button>

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
              className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg relative overflow-hidden group"
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
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-6">
            En vous connectant, vous acceptez nos conditions d'utilisation
          </p>
        </LiquidGlassCard>
      </motion.div>
    </div>
  );
};