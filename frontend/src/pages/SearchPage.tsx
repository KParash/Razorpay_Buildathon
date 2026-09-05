import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Product } from '../types/product';
import { Input } from '../components/ui/Input';

interface SearchPageProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product, size?: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  products,
  cart,
  onAddToCart,
  searchQuery,
  setSearchQuery,
}) => {
  const navigate = useNavigate();
  const [activeSegment, setActiveSegment] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

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
    const q = searchQuery.toLowerCase();
    const titleMatch = p.metadata.title?.toLowerCase().includes(q) || false;
    const catMatch = p.metadata.category?.toLowerCase().includes(q) || false;
    const subMatch = p.metadata.sub_category?.toLowerCase().includes(q) || false;
    const descMatch = p.metadata.description?.toLowerCase().includes(q) || false;
    const fabricMatch = p.metadata.fabric?.toLowerCase().includes(q) || false;

    const matchesSearch = !q || titleMatch || catMatch || subMatch || descMatch || fabricMatch;
    
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

    return matchesSearch && matchesSegment && matchesCategory;
  });

  const handleStartChatWithPrompt = (prompt: string) => {
    navigate('/chat', { state: { initialPrompt: prompt } });
  };

  const tooltipText = "Only Men's collection is available right now";

  return (
    <div className="bg-[#fcfbf9] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 min-h-screen transition-colors duration-300">
      
      {/* Search Page Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-850 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md py-12 px-6 sm:px-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 dark:text-purple-400 block">
              CATALOG DIRECTORY
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white leading-none">
              {searchQuery ? `Results for: "${searchQuery}"` : "Search Catalog"}
            </h1>
          </div>

          {/* Search Box on Page */}
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search by silhouette, fabric (e.g. linen, seersucker), or occasion..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-12 bg-white dark:bg-zinc-950 text-sm font-medium border-zinc-200 dark:border-zinc-800 rounded-xl"
            />
          </div>
        </div>
      </header>

      {/* Product Catalog Grid Container */}
      <main className="mx-auto max-w-7xl px-6 sm:px-8 py-12">
        
        {/* Section Header */}
        <div className="flex flex-col gap-6 pb-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight uppercase text-zinc-900 dark:text-white">
                {activeSegment === 'all' ? 'All Matches' :
                 activeSegment === 'men' ? 'Men\'s Matches' : 'Filtered Collection'}
              </h2>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1.5 leading-none">
                Found {filteredProducts.length} matching items
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
                    title={!isAvailable ? tooltipText : undefined}
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
                      : 'bg-transparent text-zinc-655 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400'
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
                No matching products found. Try typing a different keyword.
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
