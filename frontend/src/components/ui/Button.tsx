import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'gradient';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-semibold uppercase tracking-wider transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer';

    const variants = {
      default: 'bg-purple-600 text-white hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-600/20 active:bg-purple-700 shadow-md shadow-purple-900/10 dark:shadow-purple-950/20',
      gradient: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-500/25 dark:hover:shadow-purple-500/15 border border-purple-400/20 shadow-md',
      outline: 'border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-700',
      secondary: 'bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-800/50',
      ghost: 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white',
      destructive: 'bg-rose-600 text-white hover:bg-rose-500 hover:shadow-lg hover:shadow-rose-600/20 dark:hover:shadow-rose-600/10 active:bg-rose-700 shadow-md',
    };

    const sizes = {
      default: 'h-10 px-5 py-2 text-xs',
      sm: 'h-8.5 rounded-lg px-3.5 text-[10px]',
      lg: 'h-12 rounded-xl px-7 text-sm',
      icon: 'h-10 w-10 p-0 rounded-xl',
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
