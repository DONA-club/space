"use client";

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
  animate?: boolean;
}

export const LiquidGlassCard = ({ children, className, animate = true }: LiquidGlassCardProps) => {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 20 } : {}}
      animate={animate ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-white/10 dark:bg-black/10",
        "backdrop-blur-xl backdrop-saturate-150",
        "border border-white/20 dark:border-white/10",
        "shadow-xl shadow-black/5",
        "before:absolute before:inset-0",
        "before:bg-gradient-to-br before:from-white/20 before:to-transparent",
        "before:opacity-50",
        className
      )}
    >
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};