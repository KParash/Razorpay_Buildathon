# LangGraph Multi-Agent E-Commerce Architecture Spec

## 1. High-Level Flow & Topology

The graph coordinates between a **Master Persona Node** (Qwen 3.8 27B / Gemini), **5 Parallel Attribute Evaluators** (Qwen 3.6 27B / Groq LPU), an **Auxiliary Vector Retriever** (ChromaDB / Qdrant), and a **Deterministic Razorpay Guardrail Node**.

```mermaid
flowchart TD
    START([User Message]) --> MasterRouter[Master Orchestrator: Profile & Intent Extraction]
    MasterRouter --> ContextGate{Sufficient Context to Recommend?}

    ContextGate -- NO --> ClarifierNode[Targeted Clarifier Node: 1-2 Sharp Questions]
    ClarifierNode --> END([Stream Response to Customer])

    ContextGate -- YES --> RetrieverNode[Candidate Retriever: Semantic Vibe + Budget Filter]
    RetrieverNode --> ParallelFanOut{Parallel Fan-Out}

    ParallelFanOut --> SizeWorker[Size & Fit Worker Node]
    ParallelFanOut --> FabricWorker[Fabric & Climate Worker Node]
    ParallelFanOut --> DeliveryWorker[Delivery SLA Worker Node]
    ParallelFanOut --> StylistWorker[Stylist / Outfit Builder Worker Node]

    SizeWorker --> PricingWorker[Pricing & Promo Worker Node]
    FabricWorker --> PricingWorker
    DeliveryWorker --> PricingWorker
    StylistWorker --> PricingWorker

    PricingWorker --> SynthesisNode[Master Synthesis & Reasoning Node]
    SynthesisNode --> CheckoutDecision{User Initiates Purchase?}

    CheckoutDecision -- NO --> ReturnChat[Stream Look & Reasoning to Customer]
    ReturnChat --> END

    CheckoutDecision -- YES --> RazorpayBoundary[Deterministic Checkout Node: Freeze Cart & Create Razorpay Order]
    RazorpayBoundary --> RazorpayModal([Razorpay Standard Checkout Modal - AI REVOKED])
```
