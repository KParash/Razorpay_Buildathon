import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Check, Sparkles, Heart, ShieldCheck, Truck, RefreshCw, Tag, ChevronRight } from 'lucide-react';
import { Product, getProductImage } from '../types/product';

interface ProductDetailsPageProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product) => void;
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
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#f4f2ee] dark:bg-[#0c0c0d]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-display font-black uppercase">Product Not Found</h2>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-black text-white dark:bg-white dark:text-black font-mono-tight text-xs font-bold uppercase"
          >
            Return to Atelier
          </button>
        </div>
      </div>
    );
  }

  const { metadata } = product;
  const isAdded = cart.some((c) => c.sku_id === product.sku_id);
  const primaryImage = metadata.image_url || getProductImage(product.sku_id);

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
    <div className="bg-[#f4f2ee] dark:bg-[#0c0c0d] text-[#121212] dark:text-[#f2f2f0] min-h-screen transition-colors duration-300">
      
      {/* 1. Puma-Style Breadcrumb Bar */}
      <div className="border-b border-black/10 dark:border-white/10 px-4 sm:px-8 py-3 bg-[#eae7df]/60 dark:bg-[#121214]/60">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-mono-tight text-neutral-500 uppercase tracking-wider">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <Link to="/" className="hover:text-black dark:hover:text-white transition-colors">Home</Link>
            <ChevronRight className="h-3 w-3 text-neutral-400 shrink-0" />
            <span className="hover:text-black dark:hover:text-white cursor-pointer">{metadata.category || 'Apparel'}</span>
            <ChevronRight className="h-3 w-3 text-neutral-400 shrink-0" />
            <span className="text-black dark:text-white font-bold truncate max-w-[200px] sm:max-w-none">{metadata.title}</span>
          </div>

          <button
            onClick={() => navigate('/')}
            className="hidden sm:flex items-center gap-1 font-bold text-black dark:text-white hover:opacity-75 transition-opacity cursor-pointer"
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
                  onClick={() => setActiveImageIndex(idx)}
                  className={`aspect-[3/4] bg-[#e4e1d7] dark:bg-[#18181b] overflow-hidden border transition-all cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-black dark:border-white shadow-md'
                      : 'border-black/5 dark:border-white/5 opacity-90 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${metadata.title} angle ${idx + 1}`}
                    className="w-full h-full object-cover object-center grayscale-[10%] hover:grayscale-0 hover:scale-105 transition-all duration-500"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT 5-COL: Product Buying Specs & Pricing Details */}
          <div className="lg:col-span-5 sticky top-24 space-y-6 bg-white dark:bg-[#141416] p-6 sm:p-8 border border-black/10 dark:border-white/10 shadow-lg">
            
            {/* Title & Category Tag */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono-tight text-neutral-500 uppercase tracking-widest mb-1">
                <span>SKU: {sku_id}</span>
                <span className="bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 font-bold text-[10px]">
                  NEW RELEASE
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight uppercase text-black dark:text-white leading-tight">
                {metadata.title}
              </h1>
              <p className="text-xs font-mono-tight text-neutral-500 uppercase tracking-widest mt-1">
                {metadata.fabric} • {metadata.fit_type} silhouette
              </p>
            </div>

            {/* Price & Discounts Block */}
            <div className="border-y border-black/10 dark:border-white/10 py-4 flex items-baseline justify-between">
              <div>
                <span className="text-2xl sm:text-3xl font-mono-tight font-black text-black dark:text-white">
                  ₹{Number(metadata.price).toLocaleString('en-IN')}
                </span>
                <span className="text-xs text-neutral-500 block font-normal mt-0.5">Includes all taxes & duties</span>
              </div>
              {metadata.eligible_coupon && metadata.eligible_coupon !== 'NONE' && (
                <div className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-3 py-1 text-xs font-mono-tight font-bold">
                  <Tag className="h-3.5 w-3.5" />
                  <span>CODE: {metadata.eligible_coupon}</span>
                </div>
              )}
            </div>

            {/* Size Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono-tight font-bold uppercase tracking-wider">
                <span>SELECT SIZE</span>
                <button
                  onClick={handleAskStylistForThisSKU}
                  className="text-purple-600 dark:text-purple-400 underline hover:opacity-80 cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Ask AI Fit Consultant</span>
                </button>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {['S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setSelectedSize(sz)}
                    className={`py-3 border text-xs font-mono-tight font-bold transition-all cursor-pointer ${
                      selectedSize === sz
                        ? 'bg-black text-white border-black dark:bg-white dark:text-black dark:border-white'
                        : 'bg-transparent text-black dark:text-white border-black/15 dark:border-white/15 hover:border-black'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to Cart & Wishlist CTAs */}
            <div className="space-y-3 pt-2">
              <button
                onClick={() => {
                  onAddToCart(product);
                  onOpenCart();
                }}
                className={`w-full py-4 text-xs font-mono-tight font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isAdded
                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'bg-black text-white dark:bg-white dark:text-black hover:opacity-90'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>ADDED TO SHOPPING BAG</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" />
                    <span>ADD TO CART • ₹{Number(metadata.price).toLocaleString('en-IN')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleAskStylistForThisSKU}
                className="w-full py-3.5 border border-purple-600 text-purple-700 dark:border-purple-500 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/30 text-xs font-mono-tight font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>CONSULT AI STYLIST FOR THIS SKU</span>
              </button>

              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className="w-full py-3 border border-black/20 dark:border-white/20 text-xs font-mono-tight font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-black dark:hover:border-white transition-all cursor-pointer"
              >
                <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-red-500 text-red-500' : ''}`} />
                <span>{isWishlisted ? 'SAVED TO WISHLIST' : 'ADD TO WISHLIST'}</span>
              </button>
            </div>

            {/* Product Details & Care Specifications */}
            <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
              <h3 className="text-xs font-mono-tight font-bold uppercase tracking-widest">PRODUCT SPECIFICATIONS</h3>
              <ul className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1.5 list-disc pl-4 font-normal">
                <li>Silhouette: {metadata.fit_type} tailored cut</li>
                <li>Textile: {metadata.fabric} ({metadata.gsm || '180'} GSM weight)</li>
                <li>Shade: {metadata.color}</li>
                <li>Care: Dry clean or cold delicate wash</li>
                <li>Express Shipping: Dispatch within 24 hours</li>
              </ul>
            </div>

            {/* Guarantees */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-[10px] font-mono-tight text-neutral-500 uppercase tracking-widest border-t border-black/10 dark:border-white/10">
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-black dark:text-white" />
                <span>Free Express Shipping</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5 text-black dark:text-white" />
                <span>15 Days Return</span>
              </div>
            </div>

          </div>

        </div>
      </main>

    </div>
  );
};
