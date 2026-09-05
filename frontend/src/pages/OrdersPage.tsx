import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock, ShieldCheck, Tag, ShoppingBag, ArrowRight, ExternalLink, Calendar } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { getProductImage } from '../types/product';

interface OrderItem {
  sku_id: string;
  metadata: {
    title: string;
    price: string;
    fabric: string;
    color: string;
    segment: string;
    image_url?: string;
  };
}

interface OrderRecord {
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  coupon: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  receipt?: string;
  created_at: string;
  items: OrderItem[];
}

export const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders?user_id=usr_guest')
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'success' && data.orders) {
          setOrders(data.orders);
        }
      })
      .catch((err) => console.error('Failed to fetch order history:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoStr;
    }
  };

  return (
    <div className="bg-[#fcfbf9] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 min-h-screen transition-colors duration-300">
      
      {/* Page Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-850 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md py-10 px-6 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-purple-600 dark:text-purple-400 block">
            ATELIER LOGS
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-black uppercase tracking-tight text-zinc-900 dark:text-white mt-1">
            Purchase History
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 font-medium">
            Chronological log of verified transactions, secure hand-offs, and custom outfits.
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-8 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Clock className="h-6 w-6 animate-spin text-purple-600 dark:text-purple-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Loading archives...</span>
          </div>
        ) : orders.length === 0 ? (
          /* Elegant Empty State */
          <div className="text-center py-20 px-4 max-w-sm mx-auto space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 flex items-center justify-center text-zinc-400 dark:text-zinc-500 shadow-inner mx-auto">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">No Orders Recorded Yet</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
                Your wardrobe log is currently empty. Complete your first checkout via the Cart Drawer or the AI Concierge to sync transactions here.
              </p>
            </div>
            <Button
              variant="default"
              size="lg"
              onClick={() => navigate('/')}
              className="w-full cursor-pointer shadow-md"
            >
              Browse Atelier Collection
            </Button>
          </div>
        ) : (
          /* Chronological Timeline List */
          <div className="relative border-l border-zinc-200 dark:border-zinc-850 ml-4 sm:ml-6 pl-6 sm:pl-10 space-y-12">
            {orders.map((order, idx) => (
              <div key={order.order_id} className="relative group animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                
                {/* Timeline Node Point */}
                <span className="absolute -left-[31px] sm:-left-[47px] top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#fcfbf9] dark:bg-[#09090b] border-2 border-purple-600 shadow-md shadow-purple-600/10 transition-transform duration-300 group-hover:scale-110">
                  <Calendar className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </span>

                {/* Main Order Card */}
                <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-850 p-5 sm:p-6 shadow-sm hover:border-purple-500/30 dark:hover:border-purple-500/30 transition-all duration-300">
                  
                  {/* Order Card Header */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-850">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                          ORDER ID: {order.order_id}
                        </span>
                        <Badge variant="success" className="flex items-center gap-1.5 shadow-sm text-[9px]">
                          <ShieldCheck className="h-3 w-3 text-emerald-500" />
                          <span>VERIFIED PAID</span>
                        </Badge>
                        {order.coupon && order.coupon !== 'NONE' && (
                          <Badge variant="purple" className="flex items-center gap-1 shadow-sm text-[9px]">
                            <Tag className="h-3 w-3" />
                            <span>COUPON: {order.coupon}</span>
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-405 uppercase tracking-wide">
                        Purchased on {formatDate(order.created_at)}
                      </h3>
                    </div>

                    <div className="text-left md:text-right shrink-0">
                      <span className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
                        ₹{order.amount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] text-zinc-400 block font-bold uppercase tracking-widest mt-0.5">Payment Secure</span>
                    </div>
                  </div>

                  {/* Purchased Items List */}
                  <div className="pt-5 space-y-4">
                    <h4 className="text-[9px] font-black text-zinc-400 dark:text-zinc-550 uppercase tracking-widest mb-2">
                      WARDROBE ACQUISITIONS ({order.items.length}):
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {order.items.map((item) => {
                        const img = item.metadata.image_url || getProductImage(item.sku_id);
                        return (
                          <Link
                            key={item.sku_id}
                            to={`/product/${item.sku_id}`}
                            className="flex items-center gap-3.5 p-3 rounded-xl border border-zinc-150 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/30 hover:border-purple-500/20 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-300 group/item shadow-sm"
                          >
                            <img
                              src={img}
                              alt={item.metadata.title}
                              className="h-14 w-11 object-cover rounded-lg group-hover/item:scale-102 transition-transform duration-300 shadow-sm shrink-0"
                            />
                            <div className="overflow-hidden space-y-1">
                              <h5 className="text-[11px] font-bold text-zinc-850 dark:text-zinc-200 truncate uppercase tracking-wide leading-none group-hover/item:text-purple-600 dark:group-hover/item:text-purple-400 transition-colors">
                                {item.metadata.title}
                              </h5>
                              <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider leading-none">
                                {item.metadata.fabric} • {item.metadata.color}
                              </p>
                              <span className="text-[10px] font-mono text-purple-600 dark:text-purple-450 font-bold block leading-none">
                                ₹{Number(item.metadata.price).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Technical Metadata Footer */}
                  <div className="mt-5 pt-4 border-t border-zinc-150 dark:border-zinc-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                      {order.razorpay_order_id && (
                        <span>RZP ORDER: <span className="font-mono text-zinc-650 dark:text-zinc-400 font-bold">{order.razorpay_order_id}</span></span>
                      )}
                      {order.razorpay_payment_id && (
                        <span>RZP PAY: <span className="font-mono text-zinc-650 dark:text-zinc-400 font-bold">{order.razorpay_payment_id}</span></span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                      <span>Gateway Sandbox Verified</span>
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </div>

                </div>

              </div>
            ))}
          </div>
        )}
      </main>

    </div>
  );
};
