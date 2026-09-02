import React, { useState } from 'react';
import { ShoppingBag, X, Trash2, ArrowRight, ShieldCheck, Tag, CreditCard, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Product } from './ProductCard';
import { openRazorpayCheckout } from '@/lib/razorpay';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: Product[];
  onRemoveFromCart: (skuId: string) => void;
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
  const [appliedDiscount, setAppliedDiscount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
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
      setCouponError('');
    } else if (code === 'AURA10') {
      setAppliedDiscount(10);
      setAppliedCoupon('AURA10');
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="flex h-full w-full max-w-md flex-col bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800/80 shadow-2xl animate-in slide-in-from-right duration-300 text-zinc-900 dark:text-zinc-100">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/80 dark:bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-zinc-900 dark:bg-purple-950 border border-zinc-900 dark:border-purple-800/60 text-white dark:text-purple-400">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 dark:text-white text-sm uppercase tracking-wider">Your Shopping Cart</h2>
              <p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                {cart.length} {cart.length === 1 ? 'item' : 'items'} selected
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-sm p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Order Success State */}
        {orderSuccess ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase">Payment Verified!</h3>
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 max-w-xs">
              Order <span className="text-emerald-600 dark:text-purple-400 font-mono font-bold">#{orderSuccess.orderId}</span> has been confirmed.
            </p>
            <div className="rounded-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 w-full text-left space-y-2 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Payment ID:</span>
                <span className="text-zinc-900 dark:text-zinc-200 font-mono">{orderSuccess.paymentId}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Amount Paid:</span>
                <span className="text-emerald-600 dark:text-emerald-400">₹{orderSuccess.amount}</span>
              </div>
            </div>
            <Button
              variant="gradient"
              onClick={() => {
                setOrderSuccess(null);
                onClose();
              }}
              className="w-full"
            >
              Continue Shopping
            </Button>
          </div>
        ) : cart.length === 0 ? (
          /* Empty Cart State */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
              <ShoppingBag className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-900 dark:text-white uppercase tracking-wider">Your Cart is Empty</h3>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-2 max-w-xs">
                Explore our AI-curated catalog or ask our AI Stylist for personalized recommendations.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full pt-2">
              <Button
                variant="gradient"
                onClick={() => {
                  onClose();
                  onOpenChat('Help me choose an outfit');
                }}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Ask AI Stylist
              </Button>
              <Button variant="outline" onClick={onClose}>
                Browse Catalog
              </Button>
            </div>
          </div>
        ) : (
          /* Cart Content & Items List */
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item) => (
                <div
                  key={item.sku_id}
                  className="flex items-center justify-between rounded-sm border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 p-3 backdrop-blur-md gap-3 shadow-sm"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-purple-400 uppercase font-bold">
                        {item.sku_id}
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 px-1.5 uppercase font-bold tracking-widest border-zinc-300 dark:border-zinc-700">
                        {item.metadata.fit_type}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-zinc-900 dark:text-white text-xs mt-1 line-clamp-1 uppercase tracking-wide">
                      {item.metadata.title}
                    </h4>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {item.metadata.fabric} • {item.metadata.color}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-black text-zinc-900 dark:text-white text-sm font-mono">
                      ₹{item.metadata.price}
                    </span>
                    <button
                      onClick={() => onRemoveFromCart(item.sku_id)}
                      className="rounded-sm p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Coupon Code Section */}
            <div className="border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-3">
              {appliedCoupon ? (
                <div className="flex items-center justify-between rounded-sm bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 p-2.5 text-xs text-purple-800 dark:text-purple-300 font-bold uppercase tracking-wide">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span>Coupon <strong>{appliedCoupon}</strong> ({appliedDiscount}% off)</span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] underline cursor-pointer"
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
                    className="text-[11px] font-bold tracking-widest flex-1 h-9 rounded-sm border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white placeholder:text-zinc-400"
                  />
                  <Button type="submit" variant="outline" size="sm" className="h-9 text-[11px] font-bold tracking-widest uppercase rounded-sm border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    Apply
                  </Button>
                </form>
              )}
              {couponError && (
                <p className="text-[11px] font-bold tracking-wide text-red-500 dark:text-red-400 uppercase">{couponError}</p>
              )}

              {/* Order Summary Calculations */}
              <div className="space-y-1.5 pt-2 text-[11px] font-bold uppercase tracking-widest">
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">₹{subtotal}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>Discount ({appliedDiscount}%)</span>
                    <span className="font-mono">-₹{discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                  <span>Shipping</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-black">FREE</span>
                </div>
                <div className="flex justify-between text-zinc-900 dark:text-white font-black text-sm pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <span>Total</span>
                  <span className="font-mono text-purple-700 dark:text-purple-400">₹{finalTotal}</span>
                </div>
              </div>

              {/* Razorpay Checkout Button */}
              <Button
                variant="default"
                className="w-full gap-2 py-3 text-[11px] font-black uppercase tracking-wider rounded-sm bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 mt-2 shadow-lg dark:shadow-white/10"
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                <CreditCard className="h-4 w-4" />
                {isCheckingOut ? 'Initiating Razorpay...' : `Pay ₹${finalTotal} Securely`}
              </Button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500 pt-1">
                <ShieldCheck className="h-3 w-3 text-zinc-600 dark:text-zinc-400" />
                <span>256-Bit Encrypted Checkout</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
