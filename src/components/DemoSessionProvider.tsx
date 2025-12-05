"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/appStore";

type Props = { children: React.ReactNode };

const DemoSessionProvider: React.FC<Props> = ({ children }) => {
  const setAuth = useAppStore((s) => s.setAuth);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let unsub: { subscription: { unsubscribe: () => void } } | null = null;

    const init = async () => {
      // Écoute de l'état d'auth pour garder le store en phase
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuth(session?.user ?? null);
      });
      unsub = listener as any;

      // Si pas de session, on tente d'utiliser un compte démo partagé (si configuré), sinon anonyme
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const demoEmail = import.meta.env.VITE_DEMO_EMAIL as string | undefined;
        const demoPassword = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

        if (demoEmail && demoPassword) {
          const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: demoPassword });
          if (error) {
            console.warn('Échec de connexion démo, bascule en session anonyme', error);
            await supabase.auth.signInAnonymously();
          }
        } else {
          // Fallback: session anonyme Supabase (cela crée un nouvel utilisateur si cookies effacés)
          await supabase.auth.signInAnonymously();
        }
      } else {
        setAuth(sessionData.session.user);
      }

      setInitialized(true);
    };

    init();

    return () => {
      if (unsub) unsub.subscription.unsubscribe();
    };
  }, [setAuth]);

  if (!initialized) return <>{children}</>;

  return <>{children}</>;
};

export default DemoSessionProvider;