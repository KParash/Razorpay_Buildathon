import React from 'react';
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
    <Card className="group relative flex flex-col justify-between transition-all duration-300 hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-xl dark:hover:shadow-2xl dark:hover:shadow-black bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <img
          src={imageUrl}
          alt={metadata.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60 dark:opacity-80" />

        {/* Fit Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="bg-white/90 text-zinc-900 dark:bg-zinc-900/90 dark:text-white backdrop-blur-md text-[10px] font-bold uppercase tracking-widest border-none">
            {metadata.fit_type} fit
          </Badge>
          {hasCoupon && (
            <Badge variant="purple" className="flex items-center gap-1 text-[10px]">
              <Tag className="h-3 w-3" />
              {metadata.eligible_coupon}
            </Badge>
          )}
        </div>

        {/* Floating Quick Ask Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onAskAI(metadata.title)}
          className="absolute bottom-3 right-3 opacity-90 hover:opacity-100 backdrop-blur-md bg-white/90 text-purple-600 dark:bg-zinc-900/90 dark:text-purple-400 border border-purple-200/50 dark:border-purple-500/30 text-[10px] font-bold uppercase tracking-wider gap-1.5 shadow-lg rounded-sm cursor-pointer"
        >
          <Sparkles className="h-3 w-3" />
          Style Info
        </Button>
      </div>

      <CardContent className="flex flex-col gap-1 p-4">
        <div className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 tracking-widest uppercase">
          {metadata.fabric}
        </div>
        <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm line-clamp-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors uppercase tracking-wide">
          {metadata.title}
        </h3>

        <div className="flex items-baseline justify-between mt-2">
          <span className="text-lg font-black text-zinc-900 dark:text-white">
            ₹{Number(metadata.price).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {metadata.color} • {metadata.gsm ? `${metadata.gsm} GSM` : 'Mid'}
          </span>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 gap-2">
        <Button
          variant={isAdded ? 'outline' : 'default'}
          className={`w-full gap-2 rounded-sm font-bold uppercase tracking-wider text-[11px] cursor-pointer ${
            isAdded
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950'
              : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
          }`}
          onClick={() => onAddToCart(product)}
        >
          {isAdded ? (
            <>
              <Check className="h-4 w-4" />
              <span>Added to Cart</span>
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              <span>Add to Cart</span>
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};
