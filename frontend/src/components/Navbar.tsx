import React, { useState } from 'react';
import { ShoppingBag, Search, Sun, Moon, Sparkles, Heart, User as UserIcon, X, ArrowRight } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTheme } from '../lib/ThemeContext';

interface NavbarProps {
  onOpenCart: () => void;
  cartCount: number;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCart,
  cartCount,
  searchQuery = '',
  setSearchQuery,
  onSelectCategory,
}) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatPage = location.pathname === '/chat';
  const [showSearchModal, setShowSearchModal] = useState(false);

  const navLinks = [
    { label: 'MEN', key: 'men' },
    { label: 'WOMEN', key: 'women' },
    { label: 'KIDS', key: 'kids' },
    { label: 'BEAUTY', key: 'beauty' },
  ];

  const handleNavClick = (key: string) => {
    if (isChatPage) {
      navigate('/', { state: { targetCategory: key } });
    } else if (onSelectCategory) {
      onSelectCategory(key);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full transition-colors duration-200">
      {/* 1. Top Black Utility Bar (Exact match: Download App removed, centered text) */}
      <div className="bg-[#0e0e0e] text-[#b3b3b3] text-[10px] font-mono-tight tracking-widest uppercase border-b border-white/5 py-2 px-4 sm:px-8 flex items-center justify-between">
        <div>FREE DELIVERY ON ORDERS ABOVE ₹999</div>
        {/* <div className="hidden sm:flex items-center gap-5 text-[10px]">
          <span
            onClick={() => alert("Orders are dispatched via BlueDart / Delhivery Express.")}
            className="hover:text-white cursor-pointer transition-colors"
          >
            TRACK ORDER
          </span>
          <span className="text-white/20">|</span>
          <span
            onClick={() => alert("KAZU Concierge Support is online 24/7.")}
            className="hover:text-white cursor-pointer transition-colors"
          >
            HELP
          </span>
        </div> */}
      </div>

      {/* 2. Main Editorial Header with Grid Layout to ensure KAZU is strictly centered */}
      <div className="bg-[#f4f2ee]/95 dark:bg-[#0c0c0d]/95 backdrop-blur-md border-b border-black/10 dark:border-white/10 px-4 sm:px-8 py-3.5 transition-colors">
        <div className="mx-auto grid grid-cols-12 max-w-7xl items-center">
          
          {/* Left Navigation Links (Cols 1-4) */}
          <nav className="col-span-4 hidden lg:flex items-center gap-7 text-[12px] font-bold tracking-widest text-[#222222] dark:text-[#d1d1d1]">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.key)}
                className="hover:text-black dark:hover:text-white transition-colors uppercase cursor-pointer relative py-1 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-black dark:bg-white transition-all duration-200 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Center: Iconic KAZU Brand Logo (Cols 5-8 strictly centered) */}
          <div className="col-span-6 lg:col-span-4 text-left lg:text-center">
            <Link to="/" className="inline-block group">
              <span className="font-display text-3xl sm:text-4xl font-black tracking-[0.05em] text-[#0d0d0d] dark:text-[#f2f2f0] transition-transform duration-200 group-hover:scale-[1.02]">
                KAZU
              </span>
            </Link>
          </div>

          {/* Right Action Icons & AI Atelier Trigger (Cols 9-12) */}
          <div className="col-span-6 lg:col-span-4 flex items-center justify-end gap-3 sm:gap-5 text-[11px] font-bold tracking-wider text-[#1a1a1a] dark:text-[#e0e0e0]">
            
            {/* Search Trigger */}
            <button
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer uppercase"
              title="Search Catalog"
            >
              <Search className="h-4 w-4 stroke-[1.8]" />
              <span className="hidden md:inline">SEARCH</span>
            </button>

            {/* STYLO AI Button */}
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-1.5 bg-[#0d0d0d] text-white dark:bg-[#f2f2f0] dark:text-[#0d0d0d] px-3 py-1.5 text-[10px] font-mono-tight tracking-wider uppercase hover:opacity-85 transition-opacity cursor-pointer"
            >
              <Sparkles className="h-3 w-3" />
              <span>STYLO</span>
            </button>

            {/* Login */}
            <button
              onClick={() => alert("Welcome to KAZU Client Portal")}
              className="hidden sm:flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer uppercase"
            >
              <UserIcon className="h-4 w-4 stroke-[1.8]" />
              <span className="hidden xl:inline">LOGIN</span>
            </button>

            {/* Wishlist */}
            <button
              onClick={() => alert("Wishlist saved to your KAZU session.")}
              className="hidden sm:flex items-center gap-1.5 hover:opacity-70 transition-opacity cursor-pointer uppercase"
            >
              <Heart className="h-4 w-4 stroke-[1.8]" />
              <span className="hidden xl:inline">WISHLIST</span>
            </button>

            {/* Cart Button */}
            <button
              onClick={onOpenCart}
              className="relative p-1 hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-center"
              title="Shopping Cart"
            >
              <ShoppingBag className="h-4 w-4 stroke-[1.8]" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-white text-[9px] font-black leading-none select-none">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-1 hover:opacity-70 transition-opacity cursor-pointer"
              title="Toggle Theme"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4 stroke-[1.8]" />
              ) : (
                <Sun className="h-4 w-4 stroke-[1.8]" />
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Search Drawer Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-24 px-4">
          <div className="bg-[#f4f2ee] dark:bg-[#121214] border border-black/10 dark:border-white/10 w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-black/10 dark:border-white/10">
              <span className="text-xs font-mono-tight font-bold uppercase tracking-widest text-zinc-500">
                SEARCH THE KAZU COLLECTION
              </span>
              <button onClick={() => setShowSearchModal(false)} className="p-1 hover:opacity-70 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search by silhouette, fabric (e.g. linen, seersucker), or occasion..."
                value={searchQuery}
                onChange={(e) => {
                  if (setSearchQuery) setSearchQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setShowSearchModal(false);
                }}
                className="w-full h-12 bg-white dark:bg-[#1c1c1f] border border-black/10 dark:border-white/10 pl-11 pr-4 text-sm font-medium text-black dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-black dark:focus:border-white"
              />
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-zinc-500">
              <span>Press <strong className="text-black dark:text-white">ENTER</strong> to apply filter</span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="flex items-center gap-1 font-bold text-black dark:text-white hover:underline cursor-pointer"
              >
                <span>View Results</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
