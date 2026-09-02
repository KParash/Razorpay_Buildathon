import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'gradient';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] cursor-pointer';

    const variants = {
      default: 'bg-purple-600 text-white hover:bg-purple-500 shadow-md shadow-purple-900/30',
      gradient: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-900/40 border border-purple-400/30',
      outline: 'border border-zinc-700 bg-zinc-900/60 text-zinc-100 hover:bg-zinc-800 hover:border-zinc-500',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/50',
      ghost: 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
      destructive: 'bg-rose-600 text-white hover:bg-rose-500 shadow-md shadow-rose-900/30',
    };

    const sizes = {
      default: 'h-10 px-4 py-2 text-sm',
      sm: 'h-8 rounded-lg px-3 text-xs',
      lg: 'h-12 rounded-xl px-6 text-base',
      icon: 'h-9 w-9 p-0 rounded-xl',
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
