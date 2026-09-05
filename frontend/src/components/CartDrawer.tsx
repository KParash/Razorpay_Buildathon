import React, { useState } from 'react';
import { ShoppingBag, X, Trash2, ShieldCheck, Tag, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { CartLineItem, getProductImage } from '@/types/product';
import { openRazorpayCheckout } from '@/lib/razorpay';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartLineItem[];
  onRemoveFromCart: (skuId: string, size?: string) => void;
  onClearCart: () => void;
  onOpenChat: (query?: string) => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cart,
  onRemoveFromCart,
  onClearCart,
  onOpenChat,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<number>(() => {
    const saved = localStorage.getItem('appliedDiscount');
    return saved ? Number(saved) : 0;
  });
  const [appliedCoupon, setAppliedCoupon] = useState<string>(() => {
    return localStorage.getItem('appliedCoupon') || '';
  });
  const [couponError, setCouponError] = useState('');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + Number(item.metadata.price || 0), 0);
  const discountAmount = Math.round((subtotal * appliedDiscount) / 100);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'STYLE20') {
      setAppliedDiscount(20);
      setAppliedCoupon('STYLE20');
      localStorage.setItem('appliedDiscount', '20');
      localStorage.setItem('appliedCoupon', 'STYLE20');
      setCouponError('');
    } else if (code === 'AURA10') {
      setAppliedDiscount(10);
      setAppliedCoupon('AURA10');
      localStorage.setItem('appliedDiscount', '10');
      localStorage.setItem('appliedCoupon', 'AURA10');
      setCouponError('');
    } else {
      setCouponError('Invalid coupon code. Try "STYLE20" for 20% off!');
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedDiscount(0);
    setAppliedCoupon('');
    setCouponCode('');
    setCouponError('');
    localStorage.removeItem('appliedDiscount');
    localStorage.removeItem('appliedCoupon');
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const response = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'usr_guest',
          anchor_sku: cart[0].sku_id,
          final_total: finalTotal,
          coupon: appliedCoupon || 'NONE',
        }),
      });

      const data = await response.json();
      if (data.status === 'success' && data.order) {
        openRazorpayCheckout({
          id: data.order.id,
          amount: data.order.amount,
          currency: data.order.currency,
          razorpay_key_id: data.order.razorpay_key_id,
          is_mock: data.order.is_mock,
          onSuccess: (paymentRes: any) => {
            setOrderSuccess({
              orderId: data.order.id,
              paymentId: paymentRes.razorpay_payment_id || 'pay_mock_verified',
              amount: finalTotal,
            });
            onClearCart();
            // Clear coupon state from localStorage on successful order
            localStorage.removeItem('appliedDiscount');
            localStorage.removeItem('appliedCoupon');
            setAppliedDiscount(0);
            setAppliedCoupon('');
          },
        });
      } else {
        alert('Failed to initiate Razorpay checkout.');
      }
    } catch (err: any) {
      alert(`Checkout error: ${err.message || 'Server error'}`);
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-all duration-300">
      <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-[#09090b] border-l border-zinc-200 dark:border-zinc-850 shadow-2xl animate-in slide-in-from-right duration-300 text-zinc-900 dark:text-zinc-100">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-850 p-5 bg-zinc-50/80 dark:bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 border border-purple-500/20 text-white shadow-md">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-905 dark:text-white text-sm uppercase tracking-wider leading-none">Your Shopping Cart</h2>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1.5 leading-none">
                {cart.length} {cart.length === 1 ? 'item' : 'items'} selected
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Success State */}
        {orderSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-250 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase leading-none">Payment Verified!</h3>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
              Order <span className="text-emerald-600 dark:text-purple-400 font-mono font-bold">#{orderSuccess.orderId}</span> has been confirmed and verified.
            </p>
            <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-855 p-4 w-full text-left space-y-2 text-xs shadow-inner">
              <div className="flex justify-between font-bold">
                <span className="text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-[10px]">Payment ID:</span>
                <span className="text-zinc-800 dark:text-zinc-200 font-mono select-all">{orderSuccess.paymentId}</span>
              </div>
              <div className="flex justify-between font-bold pt-1.5 border-t border-zinc-200/50 dark:border-zinc-800/50">
                <span className="text-zinc-400 dark:text-zinc-500 uppercase tracking-widest text-[10px]">Amount Paid:</span>
                <span className="text-emerald-600 dark:text-emerald-400">₹{orderSuccess.amount}</span>
              </div>
            </div>
            <Button
              variant="gradient"
              size="lg"
              onClick={() => {
                setOrderSuccess(null);
                onClose();
              }}
              className="w-full mt-4 cursor-pointer shadow-md"
            >
              Continue Shopping
            </Button>
          </div>
        ) : cart.length === 0 ? (
          /* Empty Cart State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-inner">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Your Cart is Empty</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs leading-relaxed">
                Explore our AI-curated catalog or ask our AI Stylist for personalized recommendations.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full pt-4 max-w-xs mx-auto">
              <Button
                variant="gradient"
                size="lg"
                onClick={() => {
                  onClose();
                  onOpenChat('Help me choose an outfit');
                }}
                className="gap-2 shadow-md cursor-pointer"
              >
                <Sparkles className="h-4 w-4 animate-pulse" />
                Ask AI Stylist
              </Button>
              <Button variant="outline" size="lg" onClick={onClose} className="cursor-pointer">
                Browse Catalog
              </Button>
            </div>
          </div>
        ) : (
          /* Cart Content & Items List */
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
              {cart.map((item) => (
                <div
                  key={`${item.sku_id}-${item.selected_size || 'L'}`}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900/40 p-3.5 gap-3 shadow-sm hover:border-purple-500/20 dark:hover:border-purple-500/20 transition-all duration-300"
                >
                  <img
                    src={getProductImage(item.sku_id, item.metadata.image_url)}
                    alt={item.metadata.title}
                    loading="lazy"
                    className="h-16 w-16 shrink-0 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900"
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-mono text-zinc-400 dark:text-purple-400 uppercase font-bold tracking-widest">
                        {item.sku_id}
                      </span>
                      <Badge variant="secondary" className="text-[9px] py-0 px-2 uppercase font-bold tracking-widest border-zinc-200 dark:border-zinc-800">
                        {item.metadata.fit_type}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-xs mt-1.5 truncate uppercase tracking-wide">
                      {item.metadata.title}
                    </h4>
                    <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-0.5 uppercase tracking-wider">
                      {item.metadata.fabric} • {item.metadata.color}
                      {item.selected_size && (
                        <span className="text-purple-600 dark:text-purple-400"> • Size {item.selected_size}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-black text-zinc-900 dark:text-white text-sm font-mono leading-none">
                      ₹{item.metadata.price}
                    </span>
                    <button
                      onClick={() => onRemoveFromCart(item.sku_id, item.selected_size)}
                      className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-red-500 dark:hover:text-red-400 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon Code Section */}
            <div className="border-t border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900/60 p-5 space-y-4">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 p-3 text-xs text-purple-800 dark:text-purple-300 font-bold uppercase tracking-wide shadow-sm">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span>Coupon <strong>{appliedCoupon}</strong> ({appliedDiscount}% off)</span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] font-black uppercase tracking-wider underline cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <Input
                    placeholder="ENTER COUPON (e.g. STYLE20)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="text-[10px] font-bold tracking-widest flex-1 h-10 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus-visible:bg-white dark:focus-visible:bg-zinc-950"
                  />
                  <Button type="submit" variant="outline" className="h-10 text-[10px] font-bold tracking-widest uppercase rounded-xl shrink-0 cursor-pointer">
                    Apply
                  </Button>
                </form>
              )}
              {couponError && (
                <p className="text-[10px] font-bold tracking-wide text-red-500 dark:text-red-450 uppercase px-1 leading-none">{couponError}</p>
              )}

              {/* Order Summary Calculations */}
              <div className="space-y-2 pt-1 text-[10px] font-bold uppercase tracking-widest border-t border-zinc-200/50 dark:border-zinc-800/50">
                <div className="flex justify-between text-zinc-500 dark:text-zinc-450">
                  <span>Subtotal</span>
                  <span className="font-mono text-zinc-805 dark:text-zinc-200">₹{subtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-450">
                    <span>Discount ({appliedDiscount}%)</span>
                    <span className="font-mono">-₹{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500 dark:text-zinc-450">
                  <span>Shipping</span>
                  <span className="text-emerald-600 dark:text-emerald-450 font-black tracking-widest">FREE</span>
                </div>
                <div className="flex justify-between text-zinc-900 dark:text-white font-black text-sm pt-2.5 border-t border-zinc-200 dark:border-zinc-800">
                  <span>Total</span>
                  <span className="font-mono text-purple-700 dark:text-purple-400 text-base">₹{finalTotal}</span>
                </div>
              </div>

              {/* Razorpay Checkout Button */}
              <Button
                variant="gradient"
                size="lg"
                className="w-full gap-2 py-3.5 text-xs font-black uppercase tracking-wider rounded-xl mt-2.5 shadow-lg shadow-purple-500/10 cursor-pointer"
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                <CreditCard className="h-4 w-4" />
                {isCheckingOut ? 'Initiating Razorpay...' : `Pay ₹${finalTotal} Securely`}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 pt-1 leading-none">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>256-Bit Encrypted Razorpay Checkout</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
