import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Truck, RefreshCw, ShieldCheck, Lock } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types/product';

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

  // Use externally controlled segment if provided (from Navbar click), else internal
  const activeSegment = externalSegment ?? internalSegment;
  const setActiveSegment = externalSetSegment ?? setInternalSegment;

  const handleStartChatWithPrompt = (prompt: string) => {
    navigate('/chat', { state: { initialPrompt: prompt } });
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const titleMatch = p.metadata.title?.toLowerCase().includes(q) || false;
    const catMatch = p.metadata.category?.toLowerCase().includes(q) || false;
    const subMatch = p.metadata.sub_category?.toLowerCase().includes(q) || false;
    const descMatch = p.metadata.description?.toLowerCase().includes(q) || false;
    const fabricMatch = p.metadata.fabric?.toLowerCase().includes(q) || false;

    const matchesSearch = !q || titleMatch || catMatch || subMatch || descMatch || fabricMatch;
    
    // Segment filter using the `segment` metadata field
    let matchesSegment = true;
    if (activeSegment && activeSegment !== 'all') {
      const productSegment = (p.metadata.segment || '').toLowerCase();
      matchesSegment = productSegment === activeSegment.toLowerCase();
    }

    return matchesSearch && matchesSegment;
  });

  return (
    <div className="bg-[#f4f2ee] dark:bg-[#0c0c0d] text-[#121212] dark:text-[#f2f2f0] transition-colors duration-300">
      
      {/* ============================================================ */}
      {/* 1. HERO SECTION: Clean Minimal Editorial                      */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden bg-[#e9e6df] dark:bg-[#151518] min-h-[580px] lg:min-h-[640px] border-b border-black/10 dark:border-white/10 flex items-center justify-center">
        
        {/* Watermark KAZU Typography Behind Model */}
        <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none z-0">
          <span className="font-display font-black text-[25vw] tracking-[-0.04em] text-black/[0.05] dark:text-white/[0.03] leading-none">
            KAZU
          </span>
        </div>

        {/* Hero Content Container */}
        <div className="mx-auto max-w-7xl w-full px-6 sm:px-8 lg:px-12 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Text Block */}
          <div className="lg:col-span-4 space-y-6 text-left">
            <div className="space-y-1">
              <span className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block font-semibold">
                FASHION
              </span>
              <span className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block font-semibold">
                THAT MOVES
              </span>
              <span className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block font-semibold">
                WITH YOU.
              </span>
              <div className="w-8 h-[1.5px] bg-black dark:bg-white mt-3" />
            </div>

            {/* Buttons Row */}
            <div className="flex flex-wrap items-center gap-3 pt-6">
              <button
                onClick={() => {
                  const el = document.getElementById('catalog-grid');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-[#0d0d0d] text-white hover:bg-neutral-800 dark:bg-[#f2f2f0] dark:text-[#0d0d0d] dark:hover:bg-white px-7 py-3.5 text-[11px] font-mono-tight font-bold tracking-widest uppercase transition-all shadow-sm cursor-pointer"
              >
                SHOP NOW
              </button>

              <button
                onClick={() => handleStartChatWithPrompt('Curate a complete editorial outfit for an upcoming dinner evening')}
                className="border border-black/25 dark:border-white/25 hover:border-black dark:hover:border-white text-black dark:text-white px-5 py-3.5 text-[11px] font-mono-tight font-bold tracking-widest uppercase transition-all flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>ASK STYLO</span>
              </button>
            </div>
          </div>

          {/* Center Fashion Editorial Model Photo — clean minimal */}
          <div className="lg:col-span-4 flex items-center justify-center relative">
            <div className="relative w-full max-w-sm aspect-[3/4] shadow-2xl border border-black/10 overflow-hidden bg-[#e0ddd8]">
              <img
                src="https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&auto=format&fit=crop&q=85"
                alt="KAZU Editorial Fashion"
                className="w-full h-full object-cover object-center grayscale hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-[10px] font-mono-tight tracking-widest uppercase">
                <span>KAZU STYLO</span>
                <span>VOL. 24 / 25</span>
              </div>
            </div>
          </div>

          {/* Right Text Block: NEW COLLECTION 2026 */}
          <div className="lg:col-span-4 text-left lg:text-right space-y-2">
            <span className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block font-semibold">
              NEW
            </span>
            <span className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 block font-semibold">
              COLLECTION
            </span>
            <span className="font-display text-3xl font-black tracking-tight text-black dark:text-white block">
              2026
            </span>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 pt-2 font-normal leading-relaxed max-w-xs ml-auto">
              Tailored silhouettes, high-GSM organic weaves, and AI-curated outfits for every occasion and every season.
            </p>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 2. FOUR-COLUMN SEGMENT STRIP: Men / Women / Kids / Beauty      */}
      {/* ============================================================ */}
      <section className="bg-[#0e0e10] text-white py-12 px-6 sm:px-8 border-b border-white/10">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6">
          
          {/* Card 1: MEN */}
          <div
            onClick={() => {
              setActiveSegment('men');
              const el = document.getElementById('catalog-grid');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-4 p-4 group cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&auto=format&fit=crop&q=80"
                alt="Men Category"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase">MEN</h3>
              <p className="text-[11px] text-neutral-400 font-normal">Elevated essentials.</p>
              <div className="pt-1 flex items-center gap-1 text-[10px] font-mono-tight font-bold tracking-widest text-white group-hover:translate-x-1 transition-transform">
                <span>SHOP</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 2: WOMEN */}
          <div
            onClick={() => {
              setActiveSegment('women');
              const el = document.getElementById('catalog-grid');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-4 p-4 group cursor-pointer hover:bg-white/5 transition-colors border-l border-white/10"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop&q=80"
                alt="Women Category"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase">WOMEN</h3>
              <p className="text-[11px] text-neutral-400 font-normal">Effortless style.</p>
              <div className="pt-1 flex items-center gap-1 text-[10px] font-mono-tight font-bold tracking-widest text-white group-hover:translate-x-1 transition-transform">
                <span>SHOP</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 3: KIDS */}
          <div
            onClick={() => {
              setActiveSegment('kids');
              const el = document.getElementById('catalog-grid');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-4 p-4 group cursor-pointer hover:bg-white/5 transition-colors border-l border-white/10"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=400&auto=format&fit=crop&q=80"
                alt="Kids Category"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase">KIDS</h3>
              <p className="text-[11px] text-neutral-400 font-normal">Comfort meets cool.</p>
              <div className="pt-1 flex items-center gap-1 text-[10px] font-mono-tight font-bold tracking-widest text-white group-hover:translate-x-1 transition-transform">
                <span>SHOP</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

          {/* Card 4: BEAUTY */}
          <div
            onClick={() => {
              setActiveSegment('beauty');
              const el = document.getElementById('catalog-grid');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex items-center gap-4 p-4 group cursor-pointer hover:bg-white/5 transition-colors border-l border-white/10"
          >
            <div className="w-16 h-20 overflow-hidden shrink-0 border border-white/10">
              <img
                src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&auto=format&fit=crop&q=80"
                alt="Beauty Category"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
              />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-black tracking-wider uppercase">BEAUTY</h3>
              <p className="text-[11px] text-neutral-400 font-normal">Glow essentials.</p>
              <div className="pt-1 flex items-center gap-1 text-[10px] font-mono-tight font-bold tracking-widest text-white group-hover:translate-x-1 transition-transform">
                <span>SHOP</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 3. NEW VIBES EDITORIAL SPLIT SECTION                          */}
      {/* ============================================================ */}
      <section className="py-16 lg:py-24 px-6 sm:px-8 border-b border-black/10 dark:border-white/10 bg-[#f4f2ee] dark:bg-[#0c0c0d]">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: NEW SEASON / NEW VIBES */}
            <div className="lg:col-span-5 space-y-6">
              <div className="text-[11px] font-mono-tight uppercase tracking-[0.25em] text-neutral-500 dark:text-neutral-400 font-bold">
                NEW SEASON
              </div>
              <h2 className="font-display text-5xl sm:text-7xl font-black tracking-[-0.03em] uppercase leading-[0.95] text-black dark:text-white">
                NEW<br />VIBES
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-md font-normal leading-relaxed">
                Everything new and now. From curated linen silhouettes to beauty essentials and kids' statement pieces — handpicked by STYLO, KAZU's AI stylist, for every person and every moment.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleStartChatWithPrompt('Tell me about the new season vibe and curate a linen ensemble')}
                  className="bg-[#0d0d0d] text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200 px-8 py-3.5 text-[11px] font-mono-tight font-bold tracking-widest uppercase transition-all shadow-sm cursor-pointer"
                >
                  EXPLORE WITH STYLO
                </button>
              </div>
            </div>

            {/* Right Column: Editorial Hero Portrait */}
            <div className="lg:col-span-7 relative">
              <div className="aspect-[16/10] overflow-hidden border border-black/10 dark:border-white/10 shadow-lg">
                <img
                  src="https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=1200&auto=format&fit=crop&q=85"
                  alt="New Vibes Editorial"
                  className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-700"
                />
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* ============================================================ */}
      {/* 4. VALUE PROPOSITION STRIP: Delivery, Returns, Security       */}
      {/* ============================================================ */}
      <section className="bg-[#eae7df] dark:bg-[#151518] py-8 px-6 sm:px-8 border-b border-black/10 dark:border-white/10 text-black dark:text-white">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6">
          
          <div className="flex items-center gap-3">
            <div className="p-2 border border-black/15 dark:border-white/15">
              <Truck className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono-tight font-bold uppercase tracking-wider">FAST DELIVERY</h4>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Quick & safe delivery</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 border border-black/15 dark:border-white/15">
              <RefreshCw className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono-tight font-bold uppercase tracking-wider">EASY RETURNS</h4>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Within 15 days</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 border border-black/15 dark:border-white/15">
              <ShieldCheck className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono-tight font-bold uppercase tracking-wider">QUALITY ASSURED</h4>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">Premium, curated</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 border border-black/15 dark:border-white/15">
              <Lock className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div>
              <h4 className="text-[11px] font-mono-tight font-bold uppercase tracking-wider">SECURE PAYMENT</h4>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">100% secure Razorpay</p>
            </div>
          </div>

        </div>
      </section>


      {/* ============================================================ */}
      {/* 5. "BEST OF KAZU" CATALOG GRID                                */}
      {/* ============================================================ */}
      <main id="catalog-grid" className="mx-auto max-w-7xl px-6 sm:px-8 py-16">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 pb-10 border-b border-black/10 dark:border-white/10">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-black dark:text-white">
              {activeSegment === 'all' ? 'BEST OF KAZU' :
               activeSegment === 'men' ? 'KAZU MEN' :
               activeSegment === 'women' ? 'KAZU WOMEN' :
               activeSegment === 'kids' ? 'KAZU KIDS' :
               activeSegment === 'beauty' ? 'KAZU BEAUTY' : 'BEST OF KAZU'}
            </h2>
            <p className="text-xs font-mono-tight text-neutral-500 uppercase tracking-widest mt-1">
              Curated Essentials & Handpicked Pieces ({filteredProducts.length} Items)
            </p>
          </div>

          {/* Segment Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {['all', 'men', 'women', 'kids', 'beauty'].map((seg) => (
              <button
                key={seg}
                onClick={() => setActiveSegment(seg)}
                className={`px-4 py-1.5 text-[10px] font-mono-tight font-bold uppercase tracking-widest border transition-all cursor-pointer ${
                  activeSegment === seg
                    ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                    : 'bg-transparent text-neutral-600 dark:text-neutral-400 border-black/15 dark:border-white/15 hover:border-black'
                }`}
              >
                {seg}
              </button>
            ))}
          </div>
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
            <div className="col-span-4 py-20 text-center">
              <p className="text-sm font-mono-tight uppercase tracking-widest text-neutral-400">
                No products found. Try a different filter or search.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* Footer Minimalist Strip */}
      <footer className="border-t border-black/10 dark:border-white/10 py-12 px-6 sm:px-8 text-center bg-[#eae7df] dark:bg-[#101012]">
        <span className="font-display text-2xl font-black tracking-tight uppercase block text-black dark:text-white mb-2">
          KAZU
        </span>
        <p className="text-[11px] font-mono-tight uppercase tracking-widest text-neutral-500">
          © 2026 KAZU ATELIER. POWERED BY STYLO — AI STYLE ENGINE & RAZORPAY VERIFIED CHECKOUT.
        </p>
      </footer>

    </div>
  );
};
