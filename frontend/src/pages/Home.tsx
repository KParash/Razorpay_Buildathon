import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Truck, RefreshCw, ShieldCheck, Lock } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types/product';
import { Button } from '../components/ui/Button';

interface HomeProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery: string;
  activeSegment?: string;
  setActiveSegment?: (seg: string) => void;
}

export const Home: React.FC<HomeProps> = ({
  products,
  cart,
  onAddToCart,
  searchQuery,
  activeSegment: externalSegment,
  setActiveSegment: externalSetSegment,
}) => {
  const navigate = useNavigate();
  const [internalSegment, setInternalSegment] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Use externally controlled segment if provided (from Navbar click), else internal
  const activeSegment = externalSegment ?? internalSegment;
  const setActiveSegment = externalSetSegment ?? setInternalSegment;

  const handleStartChatWithPrompt = (prompt: string) => {
    navigate('/chat', { state: { initialPrompt: prompt } });
  };

  const handleSegmentChange = (seg: string) => {
    setActiveSegment(seg);
    setSelectedCategory('all');
  };

  // Derive available categories dynamically from products matching the current segment
  const availableCategories = Array.from(
    new Set(
      products
        .filter((p) => {
          if (activeSegment === 'all') return true;
          return (p.metadata.segment || '').toLowerCase() === activeSegment.toLowerCase();
        })
        .map((p) => p.metadata.sub_category)
        .filter((cat): cat is string => !!cat && cat.trim() !== '')
    )
  );

  const filteredProducts = products.filter((p) => {
    // 1. Segment filter using the `segment` metadata field
    let matchesSegment = true;
    if (activeSegment && activeSegment !== 'all') {
      const productSegment = (p.metadata.segment || '').toLowerCase();
      matchesSegment = productSegment === activeSegment.toLowerCase();
    }

    // 2. Category/Sub-category filter
    let matchesCategory = true;
    if (selectedCategory && selectedCategory !== 'all') {
      const productCat = (p.metadata.sub_category || '').toLowerCase();
      matchesCategory = productCat === selectedCategory.toLowerCase();
    }

    return matchesSegment && matchesCategory;
  });

  return (
    <div className="bg-[#fcfbf9] dark:bg-[#09090b] text-[#121212] dark:text-[#f2f2f0] transition-colors duration-300 min-h-screen">
      
      {/* ============================================================ */}
      {/* 1. HERO SECTION: Clean Minimal Editorial                      */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[#f4f2ee] dark:bg-[#0f0f12] min-h-[580px] lg:min-h-[640px] border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-center">
        
        {/* Watermark KAZU Typography Behind Model */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none z-0">
          <span className="font-display font-black text-[25vw] tracking-[-0.04em] text-black/[0.04] dark:text-white/[0.02] leading-none">
            KAZU
          </span>
        </div>

        {/* Hero Content Container */}
        <div className="mx-auto max-w-7xl w-full px-6 sm:px-8 lg:px-12 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Text Block */}
          <div className="lg:col-span-4 space-y-6 text-left">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 dark:text-purple-400 block">
                FASHION
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block">
                THAT MOVES
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block">
                WITH YOU.
              </span>
              <div className="w-8 h-[2px] bg-purple-600 dark:bg-purple-400 mt-3" />
            </div>

            {/* Buttons Row */}
            <div className="flex flex-wrap items-center gap-3 pt-4">
              <Button
                variant="default"
                size="lg"
                onClick={() => {
                  const el = document.getElementById('catalog-grid');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="shadow-lg shadow-purple-600/10 cursor-pointer"
              >
                SHOP NOW
              </Button>

              <Button
                variant="outline"
                size="lg"
                onClick={() => handleStartChatWithPrompt('Curate a complete editorial outfit for an upcoming dinner evening')}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>ASK STYLO</span>
              </Button>
            </div>
          </div>

          {/* Center Fashion Editorial Model Photo — clean minimal */}
          <div className="lg:col-span-4 flex items-center justify-center relative">
            <div className="relative w-full max-w-sm aspect-[3/4] shadow-2xl rounded-2xl overflow-hidden bg-[#e0ddd8] dark:bg-[#1c1c24] border border-zinc-200/50 dark:border-zinc-800/80">
              <img
                src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=85"
                alt="KAZU Editorial Fashion"
                className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition-all duration-1000 ease-out"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-white text-[9px] font-bold tracking-widest uppercase">
                <span>KAZU STYLO</span>
                <span className="bg-purple-600 px-2 py-0.5 rounded-sm">VOL. 24 / 25</span>
              </div>
            </div>
          </div>

          {/* Right Text Block: NEW COLLECTION 2026 */}
          <div className="lg:col-span-4 text-left lg:text-right space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500 block">
              NEW
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-400 dark:text-neutral-500 block">
              COLLECTION
            </span>
            <span className="font-display text-4xl sm:text-5xl font-black tracking-tight text-neutral-900 dark:text-white block leading-none">
              2026
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 pt-3 leading-relaxed max-w-xs lg:ml-auto">
              Tailored silhouettes, high-GSM organic weaves, and AI-curated outfits for every occasion and every season.
            </p>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 2. FOUR-COLUMN SEGMENT STRIP: Men / Women / Kids / Beauty      */}
      {/* ============================================================ */}
      <section className="bg-white dark:bg-zinc-950 py-12 px-6 sm:px-8 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6">
          
          {/* Card 1: MEN */}
          <div
            onClick={() => {
              setActiveSegment('men');
              const el = document.getElementById('catalog-grid');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-4 p-4 rounded-2xl group cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border border-transparent hover:border-zinc-200/60 dark:hover:border-zinc-800/60 transition-all duration-300"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&auto=format&fit=crop&q=80"
                alt="Men Category"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase text-zinc-900 dark:text-white">MEN</h3>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Elevated essentials.</p>
              <div className="pt-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform uppercase">
                <span>SHOP</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 2: WOMEN */}
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/10 opacity-55 cursor-not-allowed md:border-l md:border-zinc-200/50 dark:md:border-zinc-800/50 md:rounded-l-none transition-all duration-300"
            title="Only Men's collection is available right now"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop&q=80"
                alt="Women Category"
                className="w-full h-full object-cover grayscale opacity-60 transition-all duration-700"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">WOMEN</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-medium">Effortless style.</p>
              <div className="pt-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-zinc-400 dark:text-zinc-550 uppercase">
                <span>Unavailable</span>
                <ArrowRight className="h-3 w-3 text-zinc-400 dark:text-zinc-550" />
              </div>
            </div>
          </div>

          {/* Card 3: KIDS */}
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/10 opacity-55 cursor-not-allowed md:border-l md:border-zinc-200/50 dark:md:border-zinc-800/50 md:rounded-l-none transition-all duration-300"
            title="Only Men's collection is available right now"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=400&auto=format&fit=crop&q=80"
                alt="Kids Category"
                className="w-full h-full object-cover grayscale opacity-60 transition-all duration-700"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">KIDS</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-medium">Comfort meets cool.</p>
              <div className="pt-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-zinc-400 dark:text-zinc-550 uppercase">
                <span>Unavailable</span>
                <ArrowRight className="h-3 w-3 text-zinc-400 dark:text-zinc-550" />
              </div>
            </div>
          </div>

          {/* Card 4: BEAUTY */}
          <div
            className="flex items-center gap-4 p-4 rounded-2xl border border-zinc-200/60 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/10 opacity-55 cursor-not-allowed md:border-l md:border-zinc-200/50 dark:md:border-zinc-800/50 md:rounded-l-none transition-all duration-300"
            title="Only Men's collection is available right now"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <img
                src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&auto=format&fit=crop&q=80"
                alt="Beauty Category"
                className="w-full h-full object-cover grayscale opacity-60 transition-all duration-700"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500">BEAUTY</h3>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-550 font-medium">Glow essentials.</p>
              <div className="pt-1.5 flex items-center gap-1 text-[9px] font-bold tracking-widest text-zinc-400 dark:text-zinc-550 uppercase">
                <span>Unavailable</span>
                <ArrowRight className="h-3 w-3 text-zinc-400 dark:text-zinc-550" />
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 3. NEW VIBES EDITORIAL SPLIT SECTION                          */}
      {/* ============================================================ */}
      <section className="py-16 lg:py-24 px-6 sm:px-8 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-[#f9f8f6] dark:bg-[#0b0b0d]">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: NEW SEASON / NEW VIBES */}
            <div className="lg:col-span-5 space-y-6">
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 dark:text-purple-400">
                NEW SEASON
              </div>
              <h2 className="font-display text-5xl sm:text-7xl font-black tracking-[-0.03em] uppercase leading-[0.95] text-zinc-900 dark:text-white">
                NEW<br />VIBES
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-md font-normal leading-relaxed">
                Everything new and now. From curated linen silhouettes to beauty essentials and kids' statement pieces — handpicked by STYLO, KAZU's AI stylist, for every person and every moment.
              </p>
              <div className="pt-2">
                <Button
                  variant="gradient"
                  size="lg"
                  onClick={() => handleStartChatWithPrompt('Tell me about the new season vibe and curate a linen ensemble')}
                  className="cursor-pointer shadow-md"
                >
                  EXPLORE WITH STYLO
                </Button>
              </div>
            </div>

            {/* Right Column: Editorial Hero Portrait */}
            <div className="lg:col-span-7 relative">
              <div className="aspect-[16/10] overflow-hidden border border-zinc-200 dark:border-zinc-800/80 shadow-2xl rounded-2xl">
                <img
                  src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop&q=85"
                  alt="New Vibes Editorial"
                  className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-1000 ease-out"
                />
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ============================================================ */}
      {/* 4. VALUE PROPOSITION STRIP: Delivery, Returns, Security       */}
      {/* ============================================================ */}
      <section className="bg-white dark:bg-zinc-950 py-10 px-6 sm:px-8 border-b border-zinc-200/50 dark:border-zinc-800/50 text-zinc-800 dark:text-zinc-200">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 shadow-sm">
              <Truck className="h-5 w-5 stroke-[1.5] text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">FAST DELIVERY</h4>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Quick & safe dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 shadow-sm">
              <RefreshCw className="h-5 w-5 stroke-[1.5] text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">EASY RETURNS</h4>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Within 15 days</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 shadow-sm">
              <ShieldCheck className="h-5 w-5 stroke-[1.5] text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">QUALITY ASSURED</h4>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Premium curated weaves</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 shadow-sm">
              <Lock className="h-5 w-5 stroke-[1.5] text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-900 dark:text-white">SECURE PAYMENT</h4>
              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Razorpay verified</p>
            </div>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 5. "BEST OF KAZU" CATALOG GRID                                */}
      {/* ============================================================ */}
      <main id="catalog-grid" className="mx-auto max-w-7xl px-6 sm:px-8 py-16">
        
        {/* Section Header */}
        <div className="flex flex-col gap-6 pb-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-3xl font-black tracking-tight uppercase text-zinc-900 dark:text-white">
                {activeSegment === 'all' ? 'BEST OF KAZU' :
                 activeSegment === 'men' ? 'KAZU MEN' :
                 activeSegment === 'women' ? 'KAZU WOMEN' :
                 activeSegment === 'kids' ? 'KAZU KIDS' :
                 activeSegment === 'beauty' ? 'KAZU BEAUTY' : 'BEST OF KAZU'}
              </h2>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">
                Curated Essentials & Handpicked Pieces ({filteredProducts.length} Items)
              </p>
            </div>

            {/* Segment Quick Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              {['all', 'men', 'women', 'kids', 'beauty'].map((seg) => {
                const isAvailable = seg === 'all' || seg === 'men';
                return (
                  <button
                    key={seg}
                    onClick={() => {
                      if (isAvailable) handleSegmentChange(seg);
                    }}
                    disabled={!isAvailable}
                    className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all duration-300 ${
                      !isAvailable
                        ? 'bg-transparent text-zinc-350 dark:text-zinc-700 border-zinc-200 dark:border-zinc-850 cursor-not-allowed'
                        : activeSegment === seg
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/15 cursor-pointer'
                        : 'bg-transparent text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer'
                    }`}
                    title={!isAvailable ? "Only Men's collection is available right now" : undefined}
                  >
                    {seg}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Category Filter Pills (Second Row) */}
          {availableCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-150/50 dark:border-zinc-800/50">
              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-555 uppercase tracking-widest mr-2 block">
                Filter by Category:
              </span>
              
              {/* All Categories Pill */}
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm'
                    : 'bg-transparent text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400'
                }`}
              >
                All Items
              </button>

              {/* Dynamic Sub-Category Pills */}
              {availableCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-950 dark:border-white shadow-sm'
                      : 'bg-transparent text-zinc-650 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10">
          {filteredProducts.length > 0 ? filteredProducts.map((product) => (
            <ProductCard
              key={product.sku_id}
              product={product}
              onAskAI={(title) => handleStartChatWithPrompt(`Tell me more about this and suggest complete styling: ${title}`)}
              onAddToCart={onAddToCart}
              isAdded={cart.some((c) => c.sku_id === product.sku_id)}
            />
          )) : (
            <div className="col-span-4 py-24 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                No products found. Try a different filter or search.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer Minimalist Strip */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800/80 py-12 px-6 sm:px-8 text-center bg-zinc-50 dark:bg-zinc-950/80">
        <span className="font-display text-2xl font-black tracking-tight uppercase block text-purple-600 dark:text-purple-500 mb-2">
          KAZU
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 leading-relaxed max-w-md mx-auto">
          © 2026 KAZU ATELIER. POWERED BY STYLO — AI STYLE ENGINE & RAZORPAY VERIFIED CHECKOUT.
        </p>
      </footer>

    </div>
  );
};
