import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { CartDrawer } from './components/CartDrawer';
import { Home } from './pages/Home';
import { ChatPage } from './pages/ChatPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { OrdersPage } from './pages/OrdersPage';
import { Product } from './types/product';


const FALLBACK_PRODUCTS: Product[] = [
  {
    sku_id: 'M_001',
    metadata: {
      title: 'Slim Fit Oxford Cotton Shirt',
      fit_type: 'slim',
      fabric: 'Oxford Cotton',
      gsm: '170',
      color: 'White',
      price: '2299',
      eligible_coupon: 'STYLE20',
      category: 'Shirts',
      sub_category: 'Shirts',
      segment: 'Men',
      image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=600&auto=format&fit=crop&q=80',
      description: 'A refined slim-fit Oxford weave shirt in classic white.',
    },
  },
  {
    sku_id: 'W_001',
    metadata: {
      title: 'Flowy Maxi Dress',
      fit_type: 'relaxed',
      fabric: 'Viscose',
      gsm: '120',
      color: 'Dusty Rose',
      price: '2799',
      eligible_coupon: 'STYLE20',
      category: 'Dresses',
      sub_category: 'Dresses',
      segment: 'Women',
      image_url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&auto=format&fit=crop&q=80',
      description: 'Effortless viscose maxi dress in dusty rose.',
    },
  },
  {
    sku_id: 'K_001',
    metadata: {
      title: 'Kids Dinosaur Graphic Tee',
      fit_type: 'regular',
      fabric: '100% Cotton Jersey',
      gsm: '180',
      color: 'Cobalt Blue',
      price: '699',
      eligible_coupon: 'STYLE20',
      category: 'Kids Tops',
      sub_category: 'Kids Tops',
      segment: 'Kids',
      image_url: 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=600&auto=format&fit=crop&q=80',
      description: 'Fun dinosaur graphic t-shirt for kids.',
    },
  },
  {
    sku_id: 'B_001',
    metadata: {
      title: 'Hydrating Vitamin C Face Serum',
      fit_type: 'standard',
      fabric: 'Organic Formulation',
      gsm: 'N/A',
      color: 'Clear',
      price: '1299',
      eligible_coupon: 'STYLE20',
      category: 'Skincare',
      sub_category: 'Skincare',
      segment: 'Beauty',
      image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80',
      description: 'Brightening 15% Vitamin C serum.',
    },
  },
];

export function App() {
  const [products, setProducts] = useState<Product[]>(FALLBACK_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [activeSegment, setActiveSegment] = useState('all');

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.products) {
          setProducts(data.products);
        }
      })
      .catch((err) => console.log('Using local fallback catalog data:', err));

    // Fetch active persistent cart items from database
    fetch('/api/cart?user_id=usr_guest')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.cart) {
          setCart(data.cart);
        }
      })
      .catch((err) => console.error('Failed to retrieve persistent cart:', err));
  }, []);

  const handleAddToCart = (product: Product, size: string = 'L') => {
    const isAlreadyInCart = cart.some((p) => p.sku_id === product.sku_id);
    
    if (isAlreadyInCart) {
      fetch('/api/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'usr_guest', product_id: product.sku_id, size })
      }).catch((err) => console.error('Failed to sync cart removal with backend:', err));
      
      setCart((prev) => prev.filter((p) => p.sku_id !== product.sku_id));
    } else {
      fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'usr_guest', product_id: product.sku_id, quantity: 1, size })
      }).catch((err) => console.error('Failed to sync cart addition with backend:', err));
      
      setCart((prev) => [...prev, product]);
    }
  };

  const handleRemoveFromCart = (skuId: string, size: string = 'L') => {
    fetch('/api/cart/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'usr_guest', product_id: skuId, size })
    }).catch((err) => console.error('Failed to sync cart removal with backend:', err));

    setCart((prev) => prev.filter((item) => item.sku_id !== skuId));
  };

  const handleClearCart = () => {
    fetch('/api/cart/clear', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'usr_guest' })
    }).catch((err) => console.error('Failed to clear cart with backend:', err));

    setCart([]);
  };

  // Called from Navbar category clicks — scroll to grid is handled by Home
  const handleSelectCategory = (category: string) => {
    setActiveSegment(category.toLowerCase());
    // Scroll to catalog grid after a brief delay to allow state to update
    setTimeout(() => {
      const el = document.getElementById('catalog-grid');
      el?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-purple-600 selection:text-white transition-colors duration-300">
      {/* Top Navigation */}
      <Navbar
        onOpenCart={() => setIsCartOpen(true)}
        cartCount={cart.length}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSelectCategory={handleSelectCategory}
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
              activeSegment={activeSegment}
              setActiveSegment={setActiveSegment}
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
        <Route
          path="/product/:sku_id"
          element={
            <ProductDetailsPage
              products={products}
              cart={cart}
              onAddToCart={handleAddToCart}
              onOpenCart={() => setIsCartOpen(true)}
            />
          }
        />
        <Route
          path="/orders"
          element={
            <OrdersPage />
          }
        />
      </Routes>


      {/* Global Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onRemoveFromCart={handleRemoveFromCart}
        onClearCart={handleClearCart}
        onOpenChat={() => {}}
      />
    </div>
  );
}
