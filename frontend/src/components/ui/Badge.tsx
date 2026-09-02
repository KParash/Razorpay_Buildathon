import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'outline' | 'purple' | 'amber';
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-purple-950/80 text-purple-300 border-purple-800/50',
    secondary: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50',
    success: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50',
    amber: 'bg-amber-950/80 text-amber-300 border-amber-800/50',
    purple: 'bg-purple-900/60 text-purple-200 border-purple-500/40 shadow-sm shadow-purple-950',
    outline: 'border-zinc-700 text-zinc-300 bg-transparent',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
