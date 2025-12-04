"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

interface AdminLockProps {
  className?: string;
  onUnlocked?: () => void;
  size?: "sm" | "default" | "lg" | "icon";
  title?: string;
}

export const AdminLock: React.FC<AdminLockProps> = ({
  className,
  onUnlocked,
  size = "sm",
  title = "Actions protégées - cliquer pour déverrouiller"
}) => {
  const handleUnlock = () => {
    const pwd = window.prompt("Mot de passe administrateur ?");
    if (pwd === "admin") {
      localStorage.setItem("adminUnlocked", "true");
      showSuccess("Mode administrateur activé");
      onUnlocked?.();
    } else {
      showError("Mot de passe incorrect");
    }
  };

  return (
    <Button
      variant="ghost"
      size={size}
      className={className || "h-8 w-8 p-0 ml-2"}
      onClick={handleUnlock}
      title={title}
      aria-label="Déverrouiller"
    >
      <Lock size={16} />
    </Button>
  );
};

export default AdminLock;