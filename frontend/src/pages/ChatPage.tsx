import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link, useParams } from 'react-router-dom';
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
  ChevronRight,
  Shirt,
  MessageSquare,
  Plus,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  X,
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
  onAddToCart: (product: Product, size?: string) => void;
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
  const { session_id } = useParams<{ session_id?: string }>();

  // Session & History State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => session_id || `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [messages, setMessages] = useState<ChatMessageItem[]>([INITIAL_WELCOME_MSG]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeAgentStep, setActiveAgentStep] = useState<string>('');
  const [suggestedIdeas, setSuggestedIdeas] = useState<string[]>([
    "Suggest beach linen shirt under ₹3000",
    "What size suits a relaxed fit?",
    "Which bottoms pair well with ivory shirts?",
    "I want to checkout my curated look"
  ]);

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

  // Sync currentSessionId and load messages when URL session_id changes
  useEffect(() => {
    if (session_id) {
      setCurrentSessionId(session_id);
      setIsLoadingHistory(true);
      
      fetch(`/api/chat/history/${session_id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.status === 'success' && Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            setMessages([INITIAL_WELCOME_MSG]);
          }
        })
        .catch((err) => {
          console.error('Failed to load session history:', err);
          setMessages([INITIAL_WELCOME_MSG]);
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      // No session_id in URL, start with welcome screen
      setMessages([INITIAL_WELCOME_MSG]);
    }
  }, [session_id]);

  // Switch / Load Session History
  const handleSelectSession = (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    navigate(`/chat/${sessionId}`);
  };

  // Start a fresh new chat session
  const handleNewChat = () => {
    navigate('/chat');
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentSessionId(newId);
    setMessages([INITIAL_WELCOME_MSG]);
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
    setActiveAgentStep('Initializing KAZU styling engine...');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: currentSessionId,
          stream: true,
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

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let finalDataReceived: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'step') {
              setActiveAgentStep(parsed.label);
            } else if (parsed.type === 'final') {
              finalDataReceived = parsed;
            } else if (parsed.type === 'error') {
              throw new Error(parsed.detail || 'Agent execution error');
            }
          } catch (e) {
            // Ignore parse errors on partial chunks
          }
        }
      }

      if (finalDataReceived) {
        const data = finalDataReceived;
        
        if (data.suggested_questions && Array.isArray(data.suggested_questions) && data.suggested_questions.length > 0) {
          setSuggestedIdeas(data.suggested_questions);
        }
        
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
        fetchSessions();

        // If they were on a new blank session ('/chat'), update URL to '/chat/:session_id'
        if (!session_id) {
          navigate(`/chat/${currentSessionId}`, { replace: true });
        }

        // Auto-launch Razorpay modal if client explicitly requested checkout
        if (data.checkout_ready && data.razorpay_order) {
          setTimeout(() => {
            handleRazorpayPay(data.razorpay_order);
          }, 400);
        }

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
      setActiveAgentStep('');
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

  const handleAddSkuToCart = (skuId: string, size?: string) => {
    const fullProduct = products.find((p) => p.sku_id === skuId);
    if (fullProduct) {
      onAddToCart(fullProduct, size || 'L');
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
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
      
      {/* ------------------------------------------------------------- */}
      {/* Left Sidebar - Gemini-Style Chat History */}
      {/* ------------------------------------------------------------- */}
      <aside
        className={`fixed inset-y-16 left-0 z-30 flex flex-col border-r border-zinc-200 dark:border-zinc-800/60 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl transition-all duration-300 lg:static lg:inset-auto ${
          isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-0 lg:border-none lg:p-0 overflow-hidden'
        }`}
      >
        <div className="flex flex-col h-full p-4 justify-between">
          <div className="space-y-4">
            {/* Header & Close Button */}
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
                className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/50 transition-all cursor-pointer"
                title="Collapse history"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            {/* Actions Stack: New Consultation & Stylist Specs */}
            <div className="space-y-2.5">
              <button
                onClick={handleNewChat}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-purple-500/20 transition-all cursor-pointer group"
              >
                <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
                <span>New Consultation</span>
              </button>

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-900 hover:border-purple-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 cursor-pointer shadow-sm"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />
                <span>Stylist Specs: {userFitPreference}</span>
              </button>
            </div>

            {/* History Sessions List */}
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-17rem)] pr-1 no-scrollbar">
              {sessions.length === 0 ? (
                <div className="text-center py-10 px-2 space-y-2">
                  <Clock className="h-5 w-5 mx-auto text-zinc-400" />
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">No Past Consultations</p>
                  <p className="text-[9px] text-zinc-500 leading-normal">Ask a question to save your style history.</p>
                </div>
              ) : (
                <>
                  {todaySessions.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2 block mb-1">
                        Today
                      </span>
                      {todaySessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                            currentSessionId === s.session_id
                              ? 'bg-purple-500/5 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-semibold border-purple-200/60 dark:border-purple-800/40 shadow-sm'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border-transparent hover:border-zinc-100 dark:hover:border-zinc-900/60'
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
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2 block mb-1">
                        Previous 7 Days
                      </span>
                      {pastWeekSessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                            currentSessionId === s.session_id
                              ? 'bg-purple-500/5 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-semibold border-purple-200/60 dark:border-purple-800/40 shadow-sm'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border-transparent hover:border-zinc-100 dark:hover:border-zinc-900/60'
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
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-2 block mb-1">
                        Older
                      </span>
                      {olderSessions.map((s) => (
                        <div
                          key={s.session_id}
                          onClick={() => handleSelectSession(s.session_id)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all border ${
                            currentSessionId === s.session_id
                              ? 'bg-purple-500/5 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 font-semibold border-purple-200/60 dark:border-purple-800/40 shadow-sm'
                              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 border-transparent hover:border-zinc-100 dark:hover:border-zinc-900/60'
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
              className="flex items-center justify-between w-full p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-850 text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all shadow-inner"
            >
              <span className="flex items-center gap-2">
                <ArrowLeft className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Store Catalog
              </span>
              <span className="text-[10px] font-mono font-bold bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-md text-zinc-500 dark:text-zinc-400">{products.length} Items</span>
            </Link>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* Center Main Chat Area */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Floating Sidebar Toggle Button when Closed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-20 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md text-zinc-600 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-500/50 transition-all cursor-pointer shadow-md"
            title="Expand history"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        {/* Messages Scroll Container */}
        <div className={`flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-4xl w-full mx-auto space-y-6 ${!isSidebarOpen ? 'pt-16' : ''}`}>
          {/* Loading History Indicator */}
          {isLoadingHistory && (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400 animate-pulse">
                <RefreshCw className="h-4 w-4 animate-spin text-purple-600 dark:text-purple-400" />
                <span>Restoring consultation state...</span>
              </div>
            </div>
          )}

          {/* Welcome Screen & Quick Starter Cards when only initial message exists */}
          {!isLoadingHistory && messages.length === 1 && (
            <div className="py-8 space-y-8 animate-in fade-in duration-500">
              <div className="text-center space-y-3 max-w-lg mx-auto">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg mb-2">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white uppercase leading-none">
                  How may I style you today?
                </h2>
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  Select a styling consultation scenario below or ask for bespoke outfit coordination.
                </p>
              </div>

              {/* Starter Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {CURATED_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt.query)}
                    className="flex flex-col text-left p-5 rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/40 hover:border-purple-500 dark:hover:border-purple-500/70 hover:shadow-xl hover:shadow-purple-500/[0.02] dark:hover:shadow-purple-950/[0.05] transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold text-zinc-850 dark:text-white uppercase tracking-wide group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {prompt.title}
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-2 leading-relaxed">
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
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-600 border border-purple-500/30 text-white shadow-md">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={`flex flex-col max-w-[90%] sm:max-w-[80%] gap-2.5 ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Text Bubble */}
                <div
                  className={`rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed font-normal shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-none shadow-md shadow-purple-600/10 dark:shadow-none'
                      : 'bg-zinc-100/90 dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-850 text-zinc-900 dark:text-zinc-100 rounded-tl-none whitespace-pre-wrap'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Structured Rich Recommendation Card with IMAGE PREVIEW */}
                {msg.recommendation && (
                  <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/90 overflow-hidden shadow-xl transition-all duration-300 mt-1">
                    <div className="flex flex-col md:flex-row">
                      {/* Product Image Preview Thumbnail */}
                      <div className="relative md:w-48 md:min-w-[12rem] h-56 md:h-auto overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                        <img
                          src={msg.recommendation.image_url || getProductImage(msg.recommendation.sku_id)}
                          alt={msg.recommendation.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                          <Badge variant="purple" className="text-[9px] font-bold shadow-md">
                            Curated Piece
                          </Badge>
                          <Badge variant="secondary" className="text-[9px] font-bold bg-white/95 dark:bg-zinc-950/95 shadow-sm">
                            {msg.recommendation.fit_type} fit
                          </Badge>
                        </div>
                      </div>

                      {/* Product Metadata & Swarm Verdicts */}
                      <div className="flex-1 p-5 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-purple-400 uppercase tracking-widest">
                                {msg.recommendation.sku_id} • {msg.recommendation.fabric}
                              </span>
                              <h3 className="font-black text-zinc-900 dark:text-white text-base uppercase tracking-tight mt-0.5 leading-snug">
                                {msg.recommendation.title}
                              </h3>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-lg font-black text-zinc-900 dark:text-white font-mono">
                                ₹{msg.pricing_result?.final_price || msg.recommendation.price}
                              </span>
                              {msg.pricing_result?.discount_applied > 0 && (
                                <div className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mt-0.5">
                                  {Math.round(msg.pricing_result.discount_applied * 100)}% off applied
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Swarm Verdict Badges */}
                          <div className="flex flex-wrap gap-2 mt-4">
                            {msg.evaluations?.[0]?.size_verdict && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 text-[10px] font-bold text-emerald-850 dark:text-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Recommended size: {msg.evaluations[0].size_verdict.recommended_size} ({msg.evaluations[0].size_verdict.fit_confidence ? `${Math.round(msg.evaluations[0].size_verdict.fit_confidence * 100)}% match` : 'optimal'})</span>
                              </div>
                            )}

                            {msg.evaluations?.[0]?.fabric_verdict && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/40 text-[10px] font-bold text-zinc-650 dark:text-zinc-300">
                                <Shirt className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                <span>{msg.recommendation.fabric} {msg.recommendation.gsm ? `(${msg.recommendation.gsm} GSM)` : ''}</span>
                              </div>
                            )}

                            {msg.pricing_result?.coupon_code && msg.pricing_result.coupon_code !== 'NONE' && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-850 text-[10px] font-bold text-purple-850 dark:text-purple-300">
                                <Tag className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                <span>Coupon {msg.pricing_result.coupon_code} Active</span>
                              </div>
                            )}
                          </div>

                          {/* Reasoning Snippet if available */}
                          {msg.evaluations?.[0]?.size_verdict?.reasoning && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3.5 italic border-l-2 border-purple-500 pl-3 leading-relaxed">
                              "{msg.evaluations[0].size_verdict.reasoning}"
                            </p>
                          )}
                        </div>

                        {/* Interactive Buttons: Add to Cart & Razorpay Direct Checkout */}
                        <div className="flex flex-wrap items-center gap-2.5 pt-3.5 border-t border-zinc-100 dark:border-zinc-850">
                          <Button
                            variant={isSkuInCart(msg.recommendation.sku_id) ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => handleAddSkuToCart(msg.recommendation!.sku_id, msg.evaluations?.[0]?.size_verdict?.recommended_size)}
                            className={`rounded-xl cursor-pointer ${
                              isSkuInCart(msg.recommendation.sku_id)
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 bg-emerald-50/20 dark:bg-emerald-950/5'
                                : 'bg-zinc-900 text-white hover:bg-black dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100'
                            }`}
                          >
                            {isSkuInCart(msg.recommendation.sku_id) ? (
                              <>
                                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
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
                              className="rounded-xl gap-1.5 shadow-md cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Pay ₹{msg.razorpay_order.amount / 100} with Razorpay
                            </Button>
                          ) : (
                            <Button
                              variant="gradient"
                              size="sm"
                              onClick={async () => {
                                try {
                                  const res = await fetch('/api/checkout/create', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      user_id: 'usr_guest',
                                      anchor_sku: msg.recommendation!.sku_id,
                                      final_total: msg.pricing_result?.final_price || msg.recommendation!.price,
                                      coupon: msg.pricing_result?.coupon_code || 'NONE'
                                    })
                                  });
                                  const data = await res.json();
                                  if (data.status === 'success' && data.order) {
                                    handleRazorpayPay(data.order);
                                  } else {
                                    alert('Failed to initiate instant checkout.');
                                  }
                                } catch (e) {
                                  alert('Instant buy network error');
                                }
                              }}
                              className="rounded-xl gap-1.5 shadow-md cursor-pointer"
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              Instant Buy Now (₹{msg.pricing_result?.final_price || msg.recommendation!.price})
                            </Button>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Candidate Alternatives Carousel / Thumbnails */}
                {msg.candidate_skus && msg.candidate_skus.length > 1 && (
                  <div className="w-full space-y-2 pt-1.5">
                    <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">
                      COMPLEMENTARY PIECES CURATED FOR YOU:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {msg.candidate_skus.slice(1, 4).map((cand) => (
                        <div
                          key={cand.sku_id}
                          onClick={() => handleSendMessage(`Tell me more about ${cand.metadata.title}`)}
                          className="flex items-center gap-2.5 p-2 rounded-xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/60 hover:border-purple-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer group shadow-sm"
                        >
                          <img
                            src={getProductImage(cand.sku_id)}
                            alt={cand.metadata.title}
                            className="h-10 w-10 object-cover rounded-lg group-hover:scale-105 transition-all duration-300"
                          />
                          <div className="overflow-hidden">
                            <h5 className="text-[10px] font-bold text-zinc-850 dark:text-zinc-200 truncate uppercase leading-none">
                              {cand.metadata.title}
                            </h5>
                            <span className="text-[9px] font-mono text-purple-600 dark:text-purple-400 font-bold block mt-1 leading-none">
                              ₹{cand.metadata.price}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 px-1 mt-0.5 block">
                  {msg.timestamp}
                </span>
              </div>

              {msg.sender === 'user' && (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-900/40 text-purple-600 dark:text-purple-450 shadow-inner">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {/* Typing / Swarm Loading State with Real-Time SSE Agent Step */}
          {isLoading && (
            <div className="flex gap-3 sm:gap-4 items-center animate-in fade-in">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-purple-600 rounded-xl border border-purple-500/20 text-white shadow-md">
                <Bot className="h-4 w-4 animate-spin" />
              </div>
              <div className="bg-purple-500/5 dark:bg-purple-950/20 border border-purple-200/50 dark:border-purple-800/40 rounded-2xl px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-3 shadow-sm max-w-sm backdrop-blur-md">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-600"></span>
                </span>
                <span>{activeAgentStep || 'STYLO Swarm is consulting fabric, fit & inventory...'}</span>
              </div>
            </div>
          )}


          <div ref={messagesEndRef} />
        </div>

        {/* Gemini-Style Bottom Input Area */}
        <div className="border-t border-zinc-200 dark:border-zinc-850 bg-white/95 dark:bg-[#09090b]/95 backdrop-blur-xl p-4 sm:p-5">
          <div className="max-w-4xl mx-auto space-y-3.5">
            {/* Quick Prompt Pill Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <Sparkles className="h-3 w-3 text-purple-600" /> Ideas:
              </span>
              {suggestedIdeas.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(chip)}
                  className="rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 px-4 py-1.5 text-[10px] font-bold text-zinc-650 dark:text-zinc-300 hover:border-purple-600 hover:text-purple-600 dark:hover:border-purple-400 hover:bg-white dark:hover:bg-zinc-900/80 transition-all shrink-0 cursor-pointer shadow-sm"
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
                className="w-full h-13 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 pl-5 pr-14 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white dark:focus:bg-zinc-950 transition-all shadow-inner"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="absolute right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-35 transition-all cursor-pointer shadow-md shadow-purple-600/10"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-1">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
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
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-zinc-200 dark:border-zinc-800">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-pulse" />
                  <h3 className="font-black text-xs uppercase tracking-wider text-zinc-900 dark:text-white">
                    Stylist & Swarm Specs
                  </h3>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Fit Preference Control */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                  Cut & Fit Proportions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['relaxed', 'slim', 'oversized', 'tailored'] as const).map((fit) => (
                    <button
                      key={fit}
                      onClick={() => setUserFitPreference(fit)}
                      className={`text-[10px] font-bold uppercase py-2.5 px-3 rounded-xl border transition-all duration-300 cursor-pointer ${
                        userFitPreference === fit
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/15'
                          : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/55'
                      }`}
                    >
                      {fit}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                  Swarm sizing algorithms evaluate dimensions against this fit threshold.
                </p>
              </div>

              {/* Climate Context */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
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
                      className={`text-[10px] font-bold uppercase py-2.5 px-2 rounded-xl border transition-all duration-300 cursor-pointer ${
                        userClimate === climate.id
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/15'
                          : 'bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-purple-500/55'
                      }`}
                    >
                      {climate.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Swarm Nodes Specs */}
              <div className="space-y-2 pt-3 border-t border-zinc-200/50 dark:border-zinc-800/50">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-2">
                  Swarm Architecture Status
                </h4>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Fabric Analysis</span>
                    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">GSM & Breathability</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Sizing Match</span>
                    <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Proportional Cut</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-zinc-800/60">
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Razorpay Hand-off</span>
                    <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider">Frozen Cart Lock</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="pt-6 border-t border-zinc-200 dark:border-zinc-850">
              <Button
                variant="default"
                size="default"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full bg-purple-600 text-white hover:bg-purple-700 uppercase tracking-wider font-bold h-11"
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
