import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, ShieldCheck, Truck, RefreshCw, Zap } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Product } from '../types/product';

interface HomeProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product) => void;
  searchQuery: string;
}

export const Home: React.FC<HomeProps> = ({
  products,
  cart,
  onAddToCart,
  searchQuery,
}) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.metadata.category).filter(Boolean))) as string[]];

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
    const matchesCategory = selectedCategory === 'all' || p.metadata.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-950 py-12 lg:py-20 transition-colors duration-300">
        <div className="hidden dark:block absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-purple-900/20 blur-3xl rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <Badge variant="purple" className="px-4 py-1 text-xs uppercase tracking-widest gap-2 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-none font-bold">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              Autonomous Swarm Powered Fashion Boutique
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-900 dark:text-white max-w-3xl leading-tight uppercase">
              Personalized Luxury Outfits Curated by <span className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:via-indigo-300 dark:to-pink-400 bg-clip-text text-transparent">AI Agents</span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl font-medium">
              Consult with our boutique AI Stylist to evaluate fabric breathability, silhouette fit, climate adaptability, and lock your Razorpay order seamlessly in our new full-screen AI chat concierge.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                variant="default"
                size="lg"
                onClick={() => handleStartChatWithPrompt('I am looking for a complete outfit for an upcoming vacation')}
                className="gap-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-purple-600 dark:hover:bg-purple-700 shadow-xl shadow-zinc-200 dark:shadow-purple-950/60 rounded-sm cursor-pointer"
              >
                <Sparkles className="h-5 w-5" />
                <span className="font-bold uppercase tracking-wide">Enter AI Stylist Studio</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleStartChatWithPrompt('Show me linen shirts for Goa trip under 3000')}
                className="gap-2 rounded-sm border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200 cursor-pointer"
              >
                <span>Try Goa Vacation Prompt</span>
                <ArrowRight className="h-4 w-4 text-zinc-400" />
              </Button>
            </div>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-8 max-w-4xl w-full text-left">
              <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-3.5 shadow-sm">
                <div className="rounded-md bg-purple-100 dark:bg-purple-950/80 p-2 text-purple-600 dark:text-purple-400">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase">LangGraph Swarm</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Multi-agent worker</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-3.5 shadow-sm">
                <div className="rounded-md bg-indigo-100 dark:bg-indigo-950/80 p-2 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase">Razorpay Secure</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Frozen cart lock</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-3.5 shadow-sm">
                <div className="rounded-md bg-pink-100 dark:bg-pink-950/80 p-2 text-pink-600 dark:text-pink-400">
                  <Truck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase">Express Shipping</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">BLR / DEL dispatch</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 p-3.5 shadow-sm">
                <div className="rounded-md bg-emerald-100 dark:bg-emerald-950/80 p-2 text-emerald-600 dark:text-emerald-400">
                  <RefreshCw className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase">Image Previews</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">In-Chat Visuals</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Catalog Grid */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Category Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-8">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400'
                }`}
              >
                {cat === 'all' ? 'All Products' : cat}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono font-bold text-zinc-500">
            Showing {filteredProducts.length} curated SKUs
          </span>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.sku_id}
              product={product}
              onAskAI={(title) => handleStartChatWithPrompt(`Tell me sizing and fabric styling advice for ${title}`)}
              onAddToCart={onAddToCart}
              isAdded={cart.some((c) => c.sku_id === product.sku_id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
};
