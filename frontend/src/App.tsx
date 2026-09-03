import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { Home } from './pages/Home';
import { ChatPage } from './pages/ChatPage';
import { Product } from './types/product';

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
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

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

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.some((p) => p.sku_id === product.sku_id)) {
        return prev.filter((p) => p.sku_id !== product.sku_id);
      }
      return [...prev, product];
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-300">
      {/* Top Navigation */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        cartCount={cart.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* Route Views */}
      <Routes>
        <Route
          path="/"
          element={
            <Home
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              searchQuery={searchQuery}
            />
          }
        />
        <Route
          path="/chat"
          element={
            <ChatPage
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              onOpenCart={() => setIsCartOpen(true)}
            />
          }
        />
      </Routes>

      {/* Global Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemoveFromCart={(skuId) => setCart((prev) => prev.filter((item) => item.sku_id !== skuId))}
        onClearCart={() => setCart([])}
        onOpenChat={() => {}}
      />
    </div>
  );
}
