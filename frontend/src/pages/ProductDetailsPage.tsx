import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Check, Sparkles, Heart, ShieldCheck, Truck, RefreshCw, Tag, ChevronRight } from 'lucide-react';
import { Product, getProductImage } from '../types/product';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

interface ProductDetailsPageProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product, size?: string) => void;
  onOpenCart: () => void;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({
  products,
  cart,
  onAddToCart,
  onOpenCart,
}) => {
  const { sku_id } = useParams<{ sku_id: string }>();
  const navigate = useNavigate();
  const [selectedSize, setSelectedSize] = useState<string>('L');
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isWishlisted, setIsWishlisted] = useState(false);

  const product = products.find((p) => p.sku_id === sku_id) || products[0];

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [sku_id]);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#fcfbf9] dark:bg-[#09090b]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-display font-black uppercase">Product Not Found</h2>
          <Button
            onClick={() => navigate('/')}
            className="cursor-pointer"
          >
            Return to Atelier
          </Button>
        </div>
      </div>
    );
  }

  const { metadata } = product;
  const isAdded = cart.some((c) => c.sku_id === product.sku_id);
  const primaryImage = metadata.image_url || getProductImage(product.sku_id);

  // Only Men's products are currently available
  const isMenProduct = metadata.segment?.toLowerCase() === 'men';
  const tooltipText = "Only Men's collection is available right now";

  // Puma-style multi-angle product gallery mockups
  const galleryImages = [
    primaryImage,
    'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1000&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=1000&auto=format&fit=crop&q=85',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1000&auto=format&fit=crop&q=85',
  ];

  const handleAskStylistForThisSKU = () => {
    navigate('/chat', {
      state: {
        initialPrompt: `Evaluate tailoring fit, fabric breathability, and styling pairing options for ${metadata.title} (${metadata.fabric}, ${metadata.fit_type} fit).`
      }
    });
  };

  return (
    <div className="bg-[#fcfbf9] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 min-h-screen transition-colors duration-300">
      
      {/* 1. Puma-Style Breadcrumb Bar */}
      <div className="border-b border-zinc-200 dark:border-zinc-850 px-4 sm:px-8 py-3.5 bg-zinc-50/60 dark:bg-zinc-900/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Link to="/" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-550 shrink-0" />
            <span className="hover:text-purple-600 dark:hover:text-purple-400 cursor-pointer">{metadata.category || 'Apparel'}</span>
            <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-550 shrink-0" />
            <span className="text-zinc-800 dark:text-white font-black truncate max-w-[200px] sm:max-w-none">{metadata.title}</span>
          </div>

          <button
            onClick={() => navigate('/')}
            className="hidden sm:flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>BACK TO STORE</span>
          </button>
        </div>
      </div>

      {/* 2. Main Product Layout (Puma Website Grid Structure) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT 7-COL: Puma-Style Multi-Image Grid Showcase */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (isMenProduct) setActiveImageIndex(idx);
                  }}
                  className={`aspect-[3/4] overflow-hidden border transition-all duration-300 rounded-2xl ${
                    !isMenProduct
                      ? 'border-zinc-200/50 dark:border-zinc-800/50 opacity-80 cursor-not-allowed shadow-inner'
                      : activeImageIndex === idx
                      ? 'border-purple-500 dark:border-purple-500 shadow-md shadow-purple-500/10 cursor-pointer'
                      : 'border-zinc-200/50 dark:border-zinc-800/50 opacity-95 hover:opacity-100 hover:border-zinc-300 dark:hover:border-zinc-700 cursor-pointer'
                  }`}
                  title={!isMenProduct ? tooltipText : undefined}
                >
                  <img
                    src={img}
                    alt={`${metadata.title} angle ${idx + 1}`}
                    className={`w-full h-full object-cover object-center transition-all duration-700 ease-out ${
                      !isMenProduct ? 'grayscale opacity-60' : 'grayscale-[10%] hover:grayscale-0 hover:scale-102'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT 5-COL: Product Buying Specs & Pricing Details */}
          <div className="lg:col-span-5 sticky top-24 space-y-6 bg-white dark:bg-zinc-950 p-6 sm:p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-xl shadow-zinc-500/[0.02] dark:shadow-none">
            
            {/* Title & Category Tag */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2.5">
                <span>SKU: {sku_id}</span>
                {isMenProduct ? (
                  <Badge variant="purple">NEW RELEASE</Badge>
                ) : (
                  <Badge variant="secondary" className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400">UNAVAILABLE</Badge>
                )}
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-zinc-900 dark:text-white leading-tight">
                {metadata.title}
              </h1>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1.5 leading-none">
                {metadata.fabric} • {metadata.fit_type} silhouette
              </p>
            </div>

            {/* Price & Discounts Block */}
            <div className="border-y border-zinc-200/60 dark:border-zinc-800/60 py-4.5 flex items-center justify-between">
              <div>
                <span className={`text-2xl sm:text-3xl font-black font-mono leading-none ${isMenProduct ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-550'}`}>
                  ₹{Number(metadata.price).toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block font-bold mt-1.5 uppercase tracking-wide">Includes all taxes & duties</span>
              </div>
              {isMenProduct && metadata.eligible_coupon && metadata.eligible_coupon !== 'NONE' && (
                <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/25 border border-purple-200/60 dark:border-purple-800/40 text-purple-750 dark:text-purple-300 px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm">
                  <Tag className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0 animate-pulse" />
                  <span>CODE: {metadata.eligible_coupon}</span>
                </div>
              )}
            </div>

            {/* Size Selector */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                <span>SELECT SIZE</span>
                {isMenProduct && (
                  <button
                    onClick={handleAskStylistForThisSKU}
                    className="text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                  >
                    <Sparkles className="h-3 w-3 animate-pulse" />
                    <span>Ask AI Fit Consultant</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-5 gap-2">
                {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                  <button
                    key={sz}
                    disabled={!isMenProduct}
                    onClick={() => {
                      if (isMenProduct) setSelectedSize(sz);
                    }}
                    className={`py-3 rounded-xl border text-xs font-mono font-bold transition-all duration-300 ${
                      !isMenProduct
                        ? 'bg-transparent text-zinc-400 dark:text-zinc-650 border-zinc-250 dark:border-zinc-850 cursor-not-allowed'
                        : selectedSize === sz
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/15 cursor-pointer'
                        : 'bg-transparent text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-450 cursor-pointer'
                    }`}
                    title={!isMenProduct ? tooltipText : undefined}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to Cart & Wishlist CTAs */}
            <div className="space-y-3 pt-2">
              {isMenProduct ? (
                <>
                  <Button
                    variant={isAdded ? 'outline' : 'default'}
                    size="lg"
                    onClick={() => {
                      onAddToCart(product, selectedSize);
                      onOpenCart();
                    }}
                    className={`w-full py-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isAdded
                        ? 'border-emerald-500 hover:border-emerald-600 text-emerald-600 dark:text-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 shadow-lg shadow-zinc-950/10'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>ADDED TO SHOPPING BAG</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-4 w-4 shrink-0" />
                        <span>ADD TO BAG • ₹{Number(metadata.price).toLocaleString('en-IN')}</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleAskStylistForThisSKU}
                    className="w-full py-3.5 border-purple-200 hover:border-purple-300 text-purple-700 dark:border-purple-800 dark:text-purple-300 bg-purple-500/[0.02] dark:bg-purple-950/10 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-all cursor-pointer shadow-sm"
                  >
                    <Sparkles className="h-4 w-4 animate-pulse text-purple-600 dark:text-purple-400" />
                    <span>CONSULT AI STYLIST FOR THIS SKU</span>
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    disabled
                    className="w-full py-4 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-not-allowed bg-zinc-100 dark:bg-zinc-900/60 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-850"
                    title={tooltipText}
                  >
                    <ShoppingBag className="h-4 w-4 shrink-0" />
                    <span>UNAVAILABLE</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    disabled
                    className="w-full py-3.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-not-allowed bg-zinc-100 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-850 text-zinc-400 dark:text-zinc-505"
                    title={tooltipText}
                  >
                    <Sparkles className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                    <span>CONSULT AI STYLIST FOR THIS SKU</span>
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  if (isMenProduct) setIsWishlisted(!isWishlisted);
                }}
                disabled={!isMenProduct}
                className={`w-full py-3 border text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  isMenProduct
                    ? 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 cursor-pointer'
                    : 'bg-zinc-150 dark:bg-zinc-900/20 border-zinc-200 dark:border-zinc-850 text-zinc-400 dark:text-zinc-555 cursor-not-allowed pointer-events-none'
                }`}
                title={!isMenProduct ? tooltipText : undefined}
              >
                <Heart className={`h-4 w-4 transition-colors ${isWishlisted ? 'fill-rose-550 text-rose-500' : 'text-zinc-405 dark:text-zinc-500'}`} />
                <span>{isWishlisted ? 'SAVED TO WISHLIST' : 'ADD TO WISHLIST'}</span>
              </Button>
            </div>

            {/* Product Details & Care Specifications */}
            <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800 space-y-3.5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white">PRODUCT SPECIFICATIONS</h3>
              <ul className="text-xs text-zinc-550 dark:text-zinc-400 space-y-2 list-disc pl-4 font-normal leading-relaxed">
                <li>Silhouette: <strong className="font-bold text-zinc-700 dark:text-zinc-200">{metadata.fit_type}</strong> tailored cut</li>
                <li>Textile: <strong className="font-bold text-zinc-700 dark:text-zinc-200">{metadata.fabric}</strong> ({metadata.gsm || '180'} GSM weight)</li>
                <li>Shade: <strong className="font-bold text-zinc-700 dark:text-zinc-200">{metadata.color}</strong></li>
                <li>Care: Dry clean or cold delicate wash</li>
                <li>Express Shipping: Dispatch within 24 hours</li>
              </ul>
            </div>

            {/* Guarantees */}
            <div className="grid grid-cols-2 gap-3 pt-4 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest border-t border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Free Express Delivery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>15 Days Easy Return</span>
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  );
};
