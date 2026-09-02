import React, { useState, useEffect } from 'react';
import { Sparkles, ShoppingBag, ArrowRight, ShieldCheck, Truck, RefreshCw, Zap } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { ProductCard, Product } from './components/ProductCard';
import { ChatDrawer } from './components/ChatDrawer';
import { CartDrawer } from './components/CartDrawer';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';

const FALLBACK_PRODUCTS: Product[] = [
  {
    sku_id: 'SKU_001',
    metadata: {
      title: 'Ivory Linen Mandarin Collar Shirt',
      fit_type: 'relaxed',
      fabric: '100% Linen',
      gsm: '140',
      color: 'Ivory',
      price: '2499',
      eligible_coupon: 'STYLE20',
      category: 'tops',
    },
  },
  {
    sku_id: 'SKU_002',
    metadata: {
      title: 'Beige Cotton Chino Trousers',
      fit_type: 'slim',
      fabric: 'Cotton Twill',
      gsm: '220',
      color: 'Beige',
      price: '1899',
      eligible_coupon: 'NONE',
      category: 'bottoms',
    },
  },
  {
    sku_id: 'SKU_003',
    metadata: {
      title: 'Teal Floral Camp Collar Shirt',
      fit_type: 'relaxed',
      fabric: 'Rayon',
      gsm: '130',
      color: 'Teal',
      price: '1599',
      eligible_coupon: 'STYLE20',
      category: 'tops',
    },
  },
  {
    sku_id: 'SKU_004',
    metadata: {
      title: 'Navy Structured Linen Blazer',
      fit_type: 'tailored',
      fabric: 'Linen Blend',
      gsm: '200',
      color: 'Navy',
      price: '4999',
      eligible_coupon: 'NONE',
      category: 'outerwear',
    },
  },
  {
    sku_id: 'SKU_005',
    metadata: {
      title: 'White Pique Cotton Polo',
      fit_type: 'regular',
      fabric: 'Cotton Pique',
      gsm: '180',
      color: 'White',
      price: '1299',
      eligible_coupon: 'STYLE20',
      category: 'tops',
    },
  },
  {
    sku_id: 'SKU_006',
    metadata: {
      title: 'Olive Stretch Cargo Joggers',
      fit_type: 'relaxed',
      fabric: 'Cotton-Spandex',
      gsm: '260',
      color: 'Olive',
      price: '2199',
      eligible_coupon: 'NONE',
      category: 'bottoms',
    },
  },
  {
    sku_id: 'SKU_007',
    metadata: {
      title: 'Lavender Oversized Linen Shirt',
      fit_type: 'oversized',
      fabric: '100% Linen',
      gsm: '135',
      color: 'Lavender',
      price: '2299',
      eligible_coupon: 'STYLE20',
      category: 'tops',
    },
  },
  {
    sku_id: 'SKU_008',
    metadata: {
      title: 'Black Formal Pleated Trousers',
      fit_type: 'tailored',
      fabric: 'Polyester-Viscose',
      gsm: '240',
      color: 'Black',
      price: '2799',
      eligible_coupon: 'NONE',
      category: 'bottoms',
    },
  },
];

export function App() {
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<Product[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState<string>('');

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.products) {
          setProducts(data.products);
        }
      })
      .catch((err) => console.log('Using local fallback catalog data:', err));
  }, []);

  const handleOpenChat = (query?: string) => {
    if (query) setChatInitialQuery(query);
    else setChatInitialQuery('');
    setIsChatOpen(true);
  };

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((p) => p.sku_id === product.sku_id)) {
        return prev.filter((p) => p.sku_id !== product.sku_id);
      }
      return [...prev, product];
    });
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.metadata.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.metadata.fabric.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.metadata.fit_type.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === 'all' || p.metadata.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-300">
      {/* Top Banner */}
      <Navbar
        onOpenChat={handleOpenChat}
        onOpenCart={() => setIsCartOpen(true)}
        cartCount={cart.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-950 py-12 lg:py-20 transition-colors duration-300">
        <div className="hidden dark:block absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-purple-900/20 blur-3xl rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6">
            <Badge variant="purple" className="px-4 py-1 text-xs uppercase tracking-widest gap-2 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-none">
              <Sparkles className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              Autonomous Swarm Powered Fashion Store
            </Badge>

            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-zinc-900 dark:text-white max-w-3xl leading-tight uppercase">
              Personalized Luxury Outfits Curated by <span className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:via-indigo-300 dark:to-pink-400 bg-clip-text text-transparent">AI Agents</span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl font-medium">
              Talk directly with our LangGraph Swarm Agent to evaluate fabric breathability, sizing fit match, climate suitability, and lock your Razorpay order in real time.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button
                variant="default"
                size="lg"
                onClick={() => handleOpenChat('I am looking for a complete outfit for an upcoming vacation')}
                className="gap-2.5 bg-black hover:bg-zinc-800 text-white dark:bg-purple-600 dark:hover:bg-purple-700 shadow-xl shadow-zinc-200 dark:shadow-purple-950/60 rounded-sm"
              >
                <Sparkles className="h-5 w-5" />
                <span className="font-bold uppercase tracking-wide">Start AI Consultation</span>
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => handleOpenChat('Show me linen shirts for Goa trip under 3000')}
                className="gap-2 rounded-sm border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-200"
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
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase">LibreChat Ready</h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">OpenAI compat API</p>
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
          <div className="flex items-center gap-2 overflow-x-auto">
            {['all', 'tops', 'bottoms', 'outerwear'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  selectedCategory === cat
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white'
                    : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400'
                }`}
              >
                {cat === 'all' ? 'All Catalog' : cat}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono text-zinc-500">
            Showing {filteredProducts.length} curated SKUs
          </span>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.sku_id}
              product={product}
              onAskAI={(title) => handleOpenChat(`Tell me sizing and fabric advice for ${title}`)}
              onAddToCart={handleAddToCart}
              isAdded={cart.some((c) => c.sku_id === product.sku_id)}
            />
          ))}
        </div>
      </main>

      {/* Chat Assistant Drawer */}
      <ChatDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        initialQuery={chatInitialQuery}
      />

      {/* Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemoveFromCart={(skuId) => setCart((prev) => prev.filter((item) => item.sku_id !== skuId))}
        onClearCart={() => setCart([])}
        onOpenChat={handleOpenChat}
      />
    </div>
  );
}
