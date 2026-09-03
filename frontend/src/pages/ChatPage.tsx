import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Bot,
  User,
  ShieldCheck,
  CreditCard,
  ShoppingCart,
  Check,
  Tag,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  SlidersHorizontal,
  Info,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Flame,
  Shirt,
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  X,
  Settings2,
  Clock
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Product, getProductImage } from '../types/product';
import { openRazorpayCheckout } from '../lib/razorpay';

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
    gsm?: string;
    color?: string;
    image_url?: string;
  };
  candidate_skus?: Array<{
    sku_id: string;
    metadata: {
      title: string;
      price: string;
      fabric: string;
      fit_type: string;
      color: string;
    };
  }>;
  evaluations?: any[];
  pricing_result?: any;
  checkout_ready?: boolean;
  razorpay_order?: any;
}

export interface ChatSession {
  session_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count?: number;
}

interface ChatPageProps {
  products: Product[];
  cart: Product[];
  onAddToCart: (product: Product) => void;
  onOpenCart: () => void;
}

const CURATED_PROMPTS = [
  {
    title: "🏖️ Goa Beach Vacation",
    subtitle: "Breathable linen shirts & relaxed bottoms under ₹4000",
    query: "I need a breathable linen outfit for an outdoor beach wedding in Goa under ₹4000."
  },
  {
    title: "🍸 Rooftop Cocktail Party",
    subtitle: "Structured evening blazer with tailored fit",
    query: "Recommend a sharp evening look for a summer rooftop cocktail party."
  },
  {
    title: "☕ Casual Weekend Brunch",
    subtitle: "Comfortable pique polo with relaxed chinos",
    query: "What's the best casual smart outfit for a Sunday brunch date?"
  },
  {
    title: "🔥 Maximize Discounts",
    subtitle: "Outfits eligible for STYLE20 coupon code",
    query: "Show me trending tops that qualify for the STYLE20 discount coupon."
  }
];

const INITIAL_WELCOME_MSG: ChatMessageItem = {
  id: 'welcome-init',
  sender: 'assistant',
  text: "Welcome to the AURA Luxe Styling Studio. I'm your dedicated personal fashion consultant.\n\nWhether you're dressing for a tropical destination, a formal reception, or building a bespoke capsule wardrobe, I'll analyze fabric drape, climate breathability, and fit proportions to curate the perfect piece.",
  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
};

export const ChatPage: React.FC<ChatPageProps> = ({
  products,
  cart,
  onAddToCart,
  onOpenCart,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Session & History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [messages, setMessages] = useState<ChatMessageItem[]>([INITIAL_WELCOME_MSG]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // UI Control states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Customer Profile Mock State
  const [userFitPreference, setUserFitPreference] = useState<'relaxed' | 'slim' | 'oversized' | 'tailored'>('relaxed');
  const [userClimate, setUserClimate] = useState<string>('tropical');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load all sessions on mount
  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/chat/sessions?user_id=usr_guest');
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load chat sessions:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  // Handle passed initial prompt from navigation state
  useEffect(() => {
    if (location.state && (location.state as any).initialPrompt) {
      const prompt = (location.state as any).initialPrompt;
      window.history.replaceState({}, document.title);
      handleSendMessage(prompt);
    }
  }, [location.state]);

  // Switch / Load Session History
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    setCurrentSessionId(sessionId);
    setIsLoadingHistory(true);

    try {
      const res = await fetch(`/api/chat/history/${sessionId}`);
      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.messages) && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([INITIAL_WELCOME_MSG]);
      }
    } catch (err) {
      console.error('Failed to load session history:', err);
      setMessages([INITIAL_WELCOME_MSG]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Start a fresh new chat session
  const handleNewChat = () => {
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentSessionId(newId);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        text: "New consultation started. How can I curate your style today? Specify an occasion, fabric preferences, or climate needs.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  // Delete a chat session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
      if (sessionId === currentSessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

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
          session_id: currentSessionId,
          customer_profile: {
            user_id: 'usr_guest',
            pincode: '560001',
            fit_preference: userFitPreference,
            disliked_colors: [],
            size_history: { tops: 'M', bottoms: '32' },
            budget_tier: 'mid'
          }
        }),
      });

      const data = await response.json();

      if (data.status === 'success') {
        const anchor = data.anchor_sku?.metadata;
        const skuId = data.anchor_sku?.sku_id;

        const assistantMsg: ChatMessageItem = {
          id: `asst-${Date.now()}`,
          sender: 'assistant',
          text: data.message || "Here is my tailored recommendation for you.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          recommendation: anchor
            ? {
                sku_id: skuId,
                title: anchor.title,
                price: Number(anchor.price),
                fit_type: anchor.fit_type,
                fabric: anchor.fabric,
                gsm: anchor.gsm,
                color: anchor.color,
                image_url: anchor.image_url || getProductImage(skuId)
              }
            : undefined,
          candidate_skus: data.candidate_skus,
          evaluations: data.evaluations,
          pricing_result: data.pricing_result,
          checkout_ready: data.checkout_ready,
          razorpay_order: data.razorpay_order,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        // Refresh session list so new titles or timestamps show up immediately
        fetchSessions();
      } else {
        throw new Error(data.detail || 'Failed to communicate with AI agent');
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `⚠️ Styling Concierge Notice: ${err.message || 'Could not connect to backend server.'}`,
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
      onSuccess: (paymentRes: any) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `pay-success-${Date.now()}`,
            sender: 'assistant',
            text: `🎉 Order #${order.id} confirmed and payment verified via Razorpay! Your curated outfit is locked and en route to the dispatch hub.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      },
    });
  };

  const handleAddSkuToCart = (skuId: string) => {
    const fullProduct = products.find((p) => p.sku_id === skuId);
    if (fullProduct) {
      onAddToCart(fullProduct);
    }
  };

  const isSkuInCart = (skuId: string) => {
    return cart.some((c) => c.sku_id === skuId);
  };

  // Group sessions by date for Gemini-like organization
  const now = Date.now() / 1000;
  const oneDay = 86400;
  const todaySessions = sessions.filter((s) => now - s.updated_at < oneDay);
  const pastWeekSessions = sessions.filter((s) => now - s.updated_at >= oneDay && now - s.updated_at < oneDay * 7);
  const olderSessions = sessions.filter((s) => now - s.updated_at >= oneDay * 7);

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      
      {/* ------------------------------------------------------------- */}
      {/* Left Sidebar - Gemini-Style Chat History */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-16 left-0 z-30 flex flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/90 backdrop-blur-2xl transition-all duration-300 lg:static lg:inset-auto ${
          isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:p-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col h-full p-3.5 justify-between">
          <div className="space-y-4">
            {/* Header & New Chat Button */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white shadow-md">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                  Studio History
                </span>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Gemini-Style Prominent "+ New Chat" Button */}
            <button
              onClick={handleNewChat}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer group"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              <span>New Consultation</span>
            </button>

            {/* History Sessions List */}
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-17rem)] pr-1 no-scrollbar">
              {sessions.length === 0 ? (
                <div className="text-center py-8 px-2 space-y-1">
                  <Clock className="h-5 w-5 mx-auto text-zinc-400" />
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">No Past Consultations</p>
                  <p className="text-[10px] text-zinc-500">Ask a question to save your style history.</p>
                </div>
              ) : (
                <>
                  {todaySessions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2">
                        Today
                      </span>
                      {todaySessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                            currentSessionId === s.session_id
                              ? 'bg-zinc-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50 dark:border-purple-800/60 shadow-sm'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${currentSessionId === s.session_id ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'}`} />
                            <span className="truncate text-[11px]">{s.title}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(s.session_id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity"
                            title="Delete consultation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {pastWeekSessions.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2">
                        Previous 7 Days
                      </span>
                      {pastWeekSessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                            currentSessionId === s.session_id
                              ? 'bg-zinc-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50 dark:border-purple-800/60 shadow-sm'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${currentSessionId === s.session_id ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'}`} />
                            <span className="truncate text-[11px]">{s.title}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(s.session_id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity"
                            title="Delete consultation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {olderSessions.length > 0 && (
                    <div className="space-y-1 pt-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2">
                        Older
                      </span>
                      {olderSessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                            currentSessionId === s.session_id
                              ? 'bg-zinc-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200/50 dark:border-purple-800/60 shadow-sm'
                              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${currentSessionId === s.session_id ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400'}`} />
                            <span className="truncate text-[11px]">{s.title}</span>
                          </div>
                          <button
                            onClick={(e) => handleDeleteSession(s.session_id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 rounded transition-opacity"
                            title="Delete consultation"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Bottom Link to Catalog */}
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <Link
              to="/"
              className="flex items-center justify-between w-full p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Store Catalog
              </span>
              <span className="text-[10px] font-mono text-zinc-400">{products.length} Items</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* Center Main Chat Area */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Control Bar with Sidebar Toggle & Relocated Fit Controls Button */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
              title={isSidebarOpen ? "Collapse history" : "Expand history"}
            >
              {isSidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-900 dark:text-white">
                AURA Atelier
              </span>
              <Badge variant="purple" className="text-[9px] font-mono uppercase tracking-widest hidden sm:inline-flex">
                Swarm Live
              </Badge>
            </div>
          </div>

          {/* Relocated Fit Preference & Atelier Specs Trigger */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 hover:border-purple-500/60 dark:hover:border-purple-500/60 transition-all text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 cursor-pointer shadow-sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span className="hidden sm:inline">Stylist Specs:</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 capitalize">{userFitPreference}</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNewChat}
              className="text-[10px] font-bold uppercase tracking-wider h-8 px-2.5 border-zinc-200 dark:border-zinc-800"
            >
              New Chat
            </Button>
          </div>
        </header>

        {/* Messages Scroll Container */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-6">
          {/* Loading History Indicator */}
          {isLoadingHistory && (
            <div className="flex justify-center py-6">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 animate-pulse">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Restoring consultation state...</span>
              </div>
            </div>
          )}

          {/* Welcome Screen & Quick Starter Cards when only initial message exists */}
          {!isLoadingHistory && messages.length === 1 && (
            <div className="py-6 space-y-6 animate-in fade-in duration-500">
              <div className="text-center space-y-2 max-w-lg mx-auto">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg mb-2">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
                  How may I style you today?
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  Select a styling consultation scenario below or ask for bespoke outfit coordination.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl mx-auto">
                {CURATED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt.query)}
                    className="flex flex-col text-left p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-purple-500 dark:hover:border-purple-500/70 hover:shadow-lg dark:hover:shadow-purple-950/30 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wide group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {prompt.title}
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                      {prompt.subtitle}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Stream */}
          {!isLoadingHistory && messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 sm:gap-4 ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'assistant' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 dark:bg-purple-950 border border-zinc-800 dark:border-purple-800/80 text-white dark:text-purple-300 shadow-md">
                  <Bot className="h-5 w-5" />
                </div>
              )}

              <div
                className={`flex flex-col max-w-[90%] sm:max-w-[80%] gap-3 ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Text Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed font-normal shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-zinc-900 text-white dark:bg-purple-600 dark:text-white rounded-br-none'
                      : 'bg-white dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 text-zinc-900 dark:text-zinc-100 rounded-tl-none whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Structured Rich Recommendation Card with IMAGE PREVIEW */}
                {msg.recommendation && (
                  <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 overflow-hidden shadow-xl transition-all duration-300 mt-1">
                    <div className="flex flex-col md:flex-row">
                      {/* Product Image Preview Thumbnail */}
                      <div className="relative md:w-48 md:min-w-[12rem] h-56 md:h-auto overflow-hidden bg-zinc-100 dark:bg-zinc-950">
                        <img
                          src={msg.recommendation.image_url || getProductImage(msg.recommendation.sku_id)}
                          alt={msg.recommendation.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          <Badge variant="purple" className="text-[10px] font-bold uppercase tracking-wider shadow-md">
                            Curated Piece
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
                            {msg.recommendation.fit_type}
                          </Badge>
                        </div>
                      </div>

                      {/* Product Metadata & Swarm Verdicts */}
                      <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[10px] font-mono font-bold text-zinc-400 dark:text-purple-400 uppercase tracking-widest">
                                {msg.recommendation.sku_id} • {msg.recommendation.fabric}
                              </span>
                              <h3 className="font-black text-zinc-900 dark:text-white text-base uppercase tracking-tight mt-0.5">
                                {msg.recommendation.title}
                              </h3>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
                                ₹{msg.pricing_result?.final_price || msg.recommendation.price}
                              </span>
                              {msg.pricing_result?.discount_applied > 0 && (
                                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                  {Math.round(msg.pricing_result.discount_applied * 100)}% Discount Applied
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Swarm Verdict Badges */}
                          <div className="flex flex-wrap gap-2 mt-3.5">
                            {msg.evaluations?.[0]?.size_verdict && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Recommended Size: {msg.evaluations[0].size_verdict.recommended_size} ({msg.evaluations[0].size_verdict.fit_confidence ? `${Math.round(msg.evaluations[0].size_verdict.fit_confidence * 100)}% Match` : 'Optimal'})</span>
                              </div>
                            )}

                            {msg.evaluations?.[0]?.fabric_verdict && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                <Shirt className="h-3.5 w-3.5 text-zinc-500" />
                                <span>{msg.recommendation.fabric} {msg.recommendation.gsm ? `(${msg.recommendation.gsm} GSM)` : ''}</span>
                              </div>
                            )}

                            {msg.pricing_result?.coupon_code && msg.pricing_result.coupon_code !== 'NONE' && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-[11px] font-bold text-purple-800 dark:text-purple-300">
                                <Tag className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                                <span>Coupon {msg.pricing_result.coupon_code} Active</span>
                              </div>
                            )}
                          </div>

                          {/* Reasoning Snippet if available */}
                          {msg.evaluations?.[0]?.size_verdict?.reasoning && (
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-3 italic border-l-2 border-purple-500 pl-2.5">
                              "{msg.evaluations[0].size_verdict.reasoning}"
                            </p>
                          )}
                        </div>

                        {/* Interactive Buttons: Add to Cart & Razorpay Direct Checkout */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                          <Button
                            variant={isSkuInCart(msg.recommendation.sku_id) ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleAddSkuToCart(msg.recommendation!.sku_id)}
                            className={`text-xs font-bold uppercase tracking-wider rounded-lg cursor-pointer ${
                              isSkuInCart(msg.recommendation.sku_id)
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
                            }`}
                          >
                            {isSkuInCart(msg.recommendation.sku_id) ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                                Added to Cart
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                                Add to Cart
                              </>
                            )}
                          </Button>

                          {msg.checkout_ready && msg.razorpay_order ? (
                            <Button
                              variant="gradient"
                              size="sm"
                              onClick={() => handleRazorpayPay(msg.razorpay_order)}
                              className="text-xs font-black uppercase tracking-wider rounded-lg gap-1.5 shadow-md"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay ₹{msg.razorpay_order.amount / 100} with Razorpay
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSendMessage(`I would like to checkout and purchase ${msg.recommendation!.title}`)}
                              className="text-xs font-bold uppercase tracking-wider rounded-lg border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                              Instant Buy Now
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Alternatives Carousel / Thumbnails */}
                {msg.candidate_skus && msg.candidate_skus.length > 1 && (
                  <div className="w-full space-y-2 pt-1">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Alternative Options Evaluated by Swarm:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {msg.candidate_skus.slice(1, 4).map((cand) => (
                        <div
                          key={cand.sku_id}
                          onClick={() => handleSendMessage(`Tell me more about ${cand.metadata.title}`)}
                          className="flex items-center gap-2.5 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-purple-500 transition-all cursor-pointer group"
                        >
                          <img
                            src={getProductImage(cand.sku_id)}
                            alt={cand.metadata.title}
                            className="h-10 w-10 object-cover rounded-md group-hover:scale-105 transition-transform"
                          />
                          <div className="overflow-hidden">
                            <h5 className="text-[11px] font-bold text-zinc-900 dark:text-white truncate uppercase">
                              {cand.metadata.title}
                            </h5>
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold">
                              ₹{cand.metadata.price}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-1">
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-sm">
                  <User className="h-5 w-5" />
                </div>
              )}
            </div>
          ))}

          {/* Typing / Swarm Loading State */}
          {isLoading && (
            <div className="flex gap-3 sm:gap-4 items-center animate-in fade-in">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 dark:bg-purple-950 border border-zinc-800 dark:border-purple-800/80 text-white dark:text-purple-300 shadow-md">
                <Bot className="h-5 w-5 animate-spin" />
              </div>
              <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 flex items-center gap-2 shadow-sm">
                <span>Stylist Swarm is consulting fabric, fit & inventory</span>
                <span className="h-2 w-2 rounded-full bg-purple-600 dark:bg-purple-400 animate-ping" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Gemini-Style Bottom Input Area */}
        <div className="border-t border-zinc-200 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl p-4 sm:p-5">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Quick Prompt Pill Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <Sparkles className="h-3 w-3 text-purple-600" /> Ideas:
              </span>
              {[
                "Suggest beach linen shirt under ₹3000",
                "What size suits a relaxed fit?",
                "Which bottoms pair well with ivory shirts?",
                "I want to checkout my curated look"
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3.5 py-1 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:border-purple-600 hover:text-purple-600 dark:hover:text-purple-300 transition-all shrink-0 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Main Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about fabrics, occasion styling, sizing, or instant checkout..."
                disabled={isLoading}
                className="w-full h-13 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 pl-5 pr-14 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="absolute right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white hover:bg-black dark:bg-purple-600 dark:hover:bg-purple-700 disabled:opacity-30 transition-all cursor-pointer shadow-md"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Live Swarm Evaluation & Razorpay Secure
              </span>
              <span className="hidden sm:inline">Press Enter to Send</span>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* Slide-Out Drawer: Stylist Specs & Swarm Controls */}
      {/* ------------------------------------------------------------- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-zinc-200 dark:border-zinc-800">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900 dark:text-white">
                    Stylist & Swarm Specs
                  </h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Fit Preference Control */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Cut & Fit Proportions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['relaxed', 'slim', 'oversized', 'tailored'] as const).map((fit) => (
                    <button
                      key={fit}
                      onClick={() => setUserFitPreference(fit)}
                      className={`text-xs font-bold uppercase py-2.5 px-3 rounded-xl border transition-all cursor-pointer ${
                        userFitPreference === fit
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-purple-600 dark:border-purple-600 shadow-md'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                      }`}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Swarm sizing algorithms evaluate dimensions against this fit threshold.
                </p>
              </div>

              {/* Climate Context */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Climate & Region Context
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'tropical', label: '🌴 Tropical' },
                    { id: 'temperate', label: '⛅ Mild' },
                    { id: 'cool', label: '❄️ Cold' }
                  ].map((climate) => (
                    <button
                      key={climate.id}
                      onClick={() => setUserClimate(climate.id)}
                      className={`text-[11px] font-bold uppercase py-2 px-2 rounded-xl border transition-all cursor-pointer ${
                        userClimate === climate.id
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {climate.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Swarm Nodes Specs */}
              <div className="space-y-2 pt-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  Swarm Architecture Status
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Fabric Analysis</span>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">GSM & Breathability</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Sizing Match</span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Proportional Cut</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Razorpay Hand-off</span>
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase">Frozen Cart Lock</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="default"
                size="default"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-zinc-900 text-white dark:bg-purple-600 uppercase tracking-wider font-bold"
              >
                Apply & Return to Studio
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
