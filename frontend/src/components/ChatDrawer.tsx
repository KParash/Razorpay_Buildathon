import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Bot, User, ShieldCheck, CreditCard, ExternalLink, RefreshCw, Tag, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { openRazorpayCheckout } from '@/lib/razorpay';

export interface ChatMessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  recommendation?: {
    sku_id: string;
    title: string;
    price: number;
    fit_type: string;
    fabric: string;
  };
  evaluations?: any[];
  pricing_result?: any;
  checkout_ready?: boolean;
  razorpay_order?: any;
}

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

const QUICK_PROMPTS = [
  "Linen shirt for Goa trip under ₹3000",
  "Outfit for evening cocktail party",
  "What size should I order for relaxed fit?",
  "I'm ready to buy the recommended outfit",
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  isOpen,
  onClose,
  initialQuery,
}) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: "Hello! I'm your AURA AI Personal Stylist. Tell me your occasion, climate destination, or budget, and I'll curate your tailored outfit.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 10)}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (initialQuery && isOpen) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        const anchor = data.anchor_sku?.metadata;
        const assistantMsg: ChatMessageItem = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: data.message || "Here is my recommendation for you.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendation: anchor
            ? {
                sku_id: data.anchor_sku.sku_id,
                title: anchor.title,
                price: Number(anchor.price),
                fit_type: anchor.fit_type,
                fabric: anchor.fabric,
              }
            : undefined,
          evaluations: data.evaluations,
          pricing_result: data.pricing_result,
          checkout_ready: data.checkout_ready,
          razorpay_order: data.razorpay_order,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error(data.detail || 'Failed to communicate with AI agent');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Error: ${err.message || 'Could not connect to backend server.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRazorpayPay = (order: any) => {
    openRazorpayCheckout({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      razorpay_key_id: order.razorpay_key_id,
      is_mock: order.is_mock,
      onSuccess: () => {
        setMessages((prev) => [
          ...prev,
          {
            id: `pay-success-${Date.now()}`,
            sender: 'assistant',
            text: `🎉 Order #${order.id} confirmed and payment verified via Razorpay! Your outfit is being prepared for express delivery.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="flex h-full w-full max-w-lg flex-col bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800/80 shadow-2xl animate-in slide-in-from-right duration-300 text-zinc-900 dark:text-zinc-100">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/80 dark:bg-zinc-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-black dark:bg-purple-950 text-white dark:text-purple-300 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-zinc-900 dark:text-white text-sm flex items-center gap-2 uppercase tracking-wider">
                AURA Personal Stylist
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              </h2>
              <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Powered by Swarm & Razorpay</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-sm p-2 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Prompts Bar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 p-3 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 flex items-center gap-1 uppercase tracking-widest">
              <Sparkles className="h-3 w-3 text-purple-500 dark:text-purple-400" /> Prompts:
            </span>
            {QUICK_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="rounded-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-black dark:hover:border-purple-500/50 hover:text-black dark:hover:text-purple-300 hover:bg-zinc-100 dark:hover:bg-purple-950/40 transition-all cursor-pointer uppercase"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black dark:bg-purple-950 border border-black dark:border-purple-800/60 text-white dark:text-purple-300">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div className={`flex flex-col max-w-[85%] gap-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Text Bubble */}
                <div
                  className={`rounded-sm px-4 py-3 text-sm leading-relaxed font-medium ${
                    msg.sender === 'user'
                      ? 'bg-black text-white dark:bg-purple-600 dark:text-white'
                      : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Structured Recommendation Card inside Assistant Message */}
                {msg.recommendation && (
                  <div className="w-full rounded-sm border border-zinc-200 dark:border-purple-900/40 bg-white dark:bg-zinc-900/90 p-3.5 space-y-3 shadow-sm dark:shadow-purple-950/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-black tracking-widest uppercase text-purple-600 dark:text-purple-400">
                          Curated Outfit Match
                        </span>
                        <h4 className="font-bold text-zinc-900 dark:text-white text-sm uppercase">
                          {msg.recommendation.title}
                        </h4>
                      </div>
                      <span className="font-mono font-black text-zinc-900 dark:text-white text-sm">
                        ₹{msg.pricing_result?.final_price || msg.recommendation.price}
                      </span>
                    </div>

                    {/* Sizing & Fabric Verdict Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {msg.evaluations?.[0]?.size_verdict && (
                         <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-emerald-500 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Size {msg.evaluations[0].size_verdict.recommended_size} ({msg.recommendation.fit_type})
                        </Badge>
                      )}
                      {msg.evaluations?.[0]?.fabric_verdict && (
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                          Fabric: {msg.recommendation.fabric}
                        </Badge>
                      )}
                      {msg.pricing_result?.coupon_code && msg.pricing_result.coupon_code !== 'NONE' && (
                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-purple-500 text-purple-700 dark:text-purple-400">
                          <Tag className="h-3 w-3 mr-1" />
                          {msg.pricing_result.coupon_code} Applied
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Razorpay Checkout Trigger Button */}
                {msg.checkout_ready && msg.razorpay_order && (
                  <div className="w-full mt-1">
                    <Button
                      variant="default"
                      className="w-full gap-2 py-2.5 text-[11px] font-black uppercase tracking-wider rounded-sm bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                      onClick={() => handleRazorpayPay(msg.razorpay_order)}
                    >
                      <CreditCard className="h-4 w-4" />
                      Pay ₹{msg.razorpay_order.amount / 100} Securely
                    </Button>
                  </div>
                )}

                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-1">{msg.timestamp}</span>
              </div>

              {msg.sender === 'user' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="flex gap-3 items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-black dark:bg-purple-950 border border-black dark:border-purple-800/60 text-white dark:text-purple-300">
                <Bot className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-sm bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <span>Stylist Swarm is evaluating</span>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500 dark:bg-purple-400 animate-ping" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50/90 dark:bg-zinc-900/80 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="ASK FOR OUTFITS, CLIMATE FIT..."
              disabled={isLoading}
              className="flex-1 rounded-sm text-[11px] font-bold tracking-widest border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white"
            />
            <Button
              type="submit"
              variant="default"
              disabled={!inputMessage.trim() || isLoading}
              className="px-4 rounded-sm bg-black hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
};
