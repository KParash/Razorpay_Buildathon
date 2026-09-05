export interface ProductMetadata {
  title: string;
  fit_type: string;
  fabric: string;
  gsm?: string;
  color: string;
  price: string;
  warehouse?: string;
  eligible_coupon?: string;
  category?: string;
  sub_category?: string;
  segment?: string;        // "Men" | "Women" | "Kids" | "Beauty"
  brand_name?: string;
  description?: string;
  image_url?: string;
}

export interface Product {
  sku_id: string;
  document?: string;
  metadata: ProductMetadata;
}

/** A cart entry: product plus the user's chosen size/quantity from the DB cart. */
export interface CartLineItem extends Product {
  selected_size?: string;
  quantity?: number;
}

export const SKU_IMAGES: Record<string, string> = {
  SKU_001: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&auto=format&fit=crop&q=80',
  SKU_002: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=800&auto=format&fit=crop&q=80',
  SKU_003: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
  SKU_004: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
  SKU_005: 'https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800&auto=format&fit=crop&q=80',
  SKU_006: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=800&auto=format&fit=crop&q=80',
  SKU_007: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
  SKU_008: 'https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=800&auto=format&fit=crop&q=80',
};

export const getProductImage = (skuId?: string, directUrl?: string): string => {
  if (directUrl && directUrl.trim().length > 0) return directUrl;
  if (!skuId) return SKU_IMAGES['SKU_001'];
  return SKU_IMAGES[skuId] || 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&auto=format&fit=crop&q=80';
};
