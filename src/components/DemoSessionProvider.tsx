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
      // Écoute des changements de session pour garder le store à jour
      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuth(session?.user ?? null);
      });
      unsub = listener as any;

      // Session initiale (aucune tentative de connexion automatique)
      const { data: sessionData } = await supabase.auth.getSession();
      setAuth(sessionData.session?.user ?? null);

      setInitialized(true);
    };

    init();

    return () => {
      if (unsub) unsub.subscription.unsubscribe();
    };
  }, [setAuth]);

  // Aucun blocage d'UI; on rend systématiquement les enfants
  return <>{children}</>;
};

export default DemoSessionProvider;