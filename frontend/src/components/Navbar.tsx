import React from 'react';
import { ShoppingBag, Sparkles, Search, Sun, Moon, MessageSquareText, Home } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { useTheme } from '../lib/ThemeContext';

interface NavbarProps {
  onOpenCart: () => void;
  cartCount: number;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCart,
  cartCount,
  searchQuery = '',
  setSearchQuery,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl transition-colors duration-300">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-100 shadow-md group-hover:scale-105 transition-transform">
            <Sparkles className="h-5 w-5 text-white dark:text-zinc-900" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
              AURA<span className="font-normal text-purple-600 dark:text-purple-400">LUXE</span>
            </span>
            <span className="hidden sm:inline-block ml-2 rounded-sm bg-purple-100 dark:bg-purple-900 border border-purple-200 dark:border-purple-800 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
              AI Concierge
            </span>
          </div>
        </Link>

        {/* Search Bar - only shown on Store page */}
        {!isChatPage && setSearchQuery && (
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search shirts, trousers, fabrics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 rounded-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 pl-10 pr-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Navigation link between Store & Chat */}
          {isChatPage ? (
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Storefront</span>
            </Link>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/chat')}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-sm shadow-md hover:shadow-purple-500/25 transition-all cursor-pointer"
            >
              <MessageSquareText className="h-4 w-4" />
              <span className="font-bold uppercase text-[11px] tracking-wider">AI Stylist Chat</span>
            </Button>
          )}

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
            title="Toggle Theme"
          >
            {theme === 'light' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          {/* Cart Trigger */}
          <button
            onClick={onOpenCart}
            className="relative flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-all cursor-pointer"
            title="Open Shopping Cart"
          >
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-sm bg-red-600 text-[11px] font-bold text-white shadow-sm animate-scale-in">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
