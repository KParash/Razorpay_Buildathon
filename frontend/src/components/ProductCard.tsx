import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ShoppingCart, Check, Tag } from 'lucide-react';
import { Card, CardContent, CardFooter } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Product, getProductImage } from '../types/product';

export type { Product };

interface ProductCardProps {
  product: Product;
  onAskAI: (productTitle: string) => void;
  onAddToCart: (product: Product) => void;
  isAdded?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAskAI,
  onAddToCart,
  isAdded,
}) => {
  const { sku_id, metadata } = product;
  const imageUrl = metadata.image_url || getProductImage(sku_id);
  const hasCoupon = metadata.eligible_coupon && metadata.eligible_coupon !== 'NONE';

  return (
    <Card className="group relative flex flex-col justify-between transition-all duration-300 hover:border-purple-500/50 dark:hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5 dark:hover:shadow-purple-950/10 border-zinc-200 dark:border-zinc-800">
      
      {/* Clickable Image Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 rounded-t-2xl">
        <Link to={`/product/${sku_id}`} className="block w-full h-full cursor-pointer">
          <img
            src={imageUrl}
            alt={metadata.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 dark:opacity-80 transition-opacity group-hover:opacity-70" />
        </Link>

        {/* Fit Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10 pointer-events-none">
          <Badge variant="secondary" className="bg-white/95 text-zinc-800 dark:bg-zinc-900/95 dark:text-white backdrop-blur-md shadow-sm border-none">
            {metadata.fit_type} fit
          </Badge>
          {hasCoupon && (
            <Badge variant="purple" className="flex items-center gap-1 shadow-sm">
              <Tag className="h-2.5 w-2.5" />
              {metadata.eligible_coupon}
            </Badge>
          )}
        </div>

        {/* Floating Quick Ask Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAskAI(metadata.title);
          }}
          className="absolute bottom-3 right-3 opacity-95 hover:opacity-100 backdrop-blur-md bg-white/90 text-purple-600 hover:text-purple-700 dark:bg-zinc-950/90 dark:text-purple-400 dark:hover:text-purple-300 border border-purple-200/50 dark:border-purple-500/30 text-[9px] font-bold tracking-widest gap-1.5 shadow-md rounded-xl transition-all duration-300 transform group-hover:translate-y-[-2px] cursor-pointer z-10"
        >
          <Sparkles className="h-3 w-3 animate-pulse" />
          Style Advisor
        </Button>
      </div>

      <CardContent className="flex flex-col gap-1 p-5">
        <div className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 tracking-widest uppercase">
          {metadata.fabric}
        </div>
        
        {/* Clickable Product Title */}
        <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm line-clamp-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors uppercase tracking-wide">
          <Link to={`/product/${sku_id}`} className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer">
            {metadata.title}
          </Link>
        </h3>

        <div className="flex items-baseline justify-between mt-2">
          <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
            ₹{Number(metadata.price).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            {metadata.color} • {metadata.gsm ? `${metadata.gsm} GSM` : 'Mid'}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-5 pt-0 gap-2">
        <Button
          variant={isAdded ? 'outline' : 'default'}
          className={`w-full gap-2 rounded-xl transition-all duration-300 cursor-pointer ${
            isAdded
              ? 'border-emerald-500 hover:border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-emerald-50/50 dark:bg-emerald-950/10'
              : 'bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
        >
          {isAdded ? (
            <>
              <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Added to Cart</span>
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span>Add to Cart</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
