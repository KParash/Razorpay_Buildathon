"""
db.py — SQLAlchemy Models & Database Engine

Defines ORM models for:
  - users           : User identity, preferences, and AI-learned metadata
  - conversations   : Chat threads with JSON message arrays
  - sub_categories  : Normalized fashion sub-category lookup table
  - products        : Fashion product catalog

Uses PostgreSQL (Supabase) for persistent storage in both local dev and production.
"""

import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    event,
    inspect,
    text,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    relationship,
    sessionmaker,
    Session,
)

load_dotenv(override=True)

# ---------------------------------------------------------------------------
# Database Engine & Session Factory
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is required. "
        "Set it to your Supabase PostgreSQL connection string."
    )

engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Session:
    """FastAPI dependency — yields a DB session and auto-closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Base Model
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Helper: auto-update `updated_at` on any UPDATE
# ---------------------------------------------------------------------------
def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# 1. Users Table
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    user_id = Column(String(50), primary_key=True)
    username = Column(String(50), nullable=False, unique=True)
    email = Column(String(255), unique=True, nullable=True)
    avatar_url = Column(Text, nullable=True)
    pincode = Column(String(10), default="560001")
    fit_preference = Column(String(20), default="relaxed")
    disliked_colors = Column(JSON, default=list)
    size_history = Column(JSON, default=lambda: {"tops": "M", "bottoms": "32"})
    budget_tier = Column(String(10), default="mid")
    search_history = Column(JSON, default=list)
    metadata_ = Column("metadata", JSON, default=dict)  # 'metadata' is reserved in SA
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    cart_items = relationship("CartItem", back_populates="user", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "user_id": self.user_id,
            "username": self.username,
            "email": self.email,
            "avatar_url": self.avatar_url,
            "pincode": self.pincode,
            "fit_preference": self.fit_preference,
            "disliked_colors": self.disliked_colors or [],
            "size_history": self.size_history or {},
            "budget_tier": self.budget_tier,
            "search_history": self.search_history or [],
            "metadata": self.metadata_ or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_customer_profile(self):
        """Convert to the CustomerProfile dict expected by the LangGraph agent."""
        return {
            "user_id": self.user_id,
            "pincode": self.pincode or "560001",
            "fit_preference": self.fit_preference or "relaxed",
            "disliked_colors": self.disliked_colors or [],
            "size_history": self.size_history or {"tops": "M", "bottoms": "32"},
            "budget_tier": self.budget_tier or "mid",
        }


# ---------------------------------------------------------------------------
# 2. Conversations Table
# ---------------------------------------------------------------------------
class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False)
    title = Column(String(100), nullable=False, default="New Consultation")
    messages = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    user = relationship("User", back_populates="conversations")

    def to_dict(self):
        return {
            "conversation_id": self.conversation_id,
            "user_id": self.user_id,
            "title": self.title,
            "messages": self.messages or [],
            "message_count": len(self.messages) if self.messages else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def to_session_summary(self):
        """Lightweight dict for the sidebar history list."""
        return {
            "conversation_id": self.conversation_id,
            "title": self.title,
            "message_count": len(self.messages) if self.messages else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# 3. Sub-Categories Table
# ---------------------------------------------------------------------------
class SubCategory(Base):
    __tablename__ = "sub_categories"

    sub_category_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True)
    slug = Column(String(50), nullable=False, unique=True)
    category = Column(String(50), nullable=False, default="Fashion")
    created_at = Column(DateTime, default=_utcnow)

    # Relationships
    products = relationship("Product", back_populates="sub_category", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "sub_category_id": self.sub_category_id,
            "name": self.name,
            "slug": self.slug,
            "category": self.category,
        }


# ---------------------------------------------------------------------------
# 4. Products Table
# ---------------------------------------------------------------------------
class Product(Base):
    __tablename__ = "products"

    product_id = Column(String(20), primary_key=True)
    title = Column(String(255), nullable=False)
    brand_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    document = Column(Text, nullable=False)  # Search text for catalog ranking
    sub_category_id = Column(Integer, ForeignKey("sub_categories.sub_category_id"), nullable=False)
    segment = Column(String(20), nullable=True, default="Men")  # Men, Women, Kids, Beauty
    price = Column(Float, nullable=False)
    fit_type = Column(String(30), nullable=False, default="regular")
    fabric = Column(String(100), nullable=True)
    gsm = Column(String(20), nullable=True)
    color = Column(String(50), nullable=False)
    size_options = Column(JSON, default=list)
    retailer = Column(String(50), nullable=True)
    eligible_coupon = Column(String(30), default="NONE")
    image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    sub_category = relationship("SubCategory", back_populates="products")

    def to_dict(self):
        return {
            "product_id": self.product_id,
            "title": self.title,
            "brand_name": self.brand_name,
            "description": self.description,
            "sub_category_id": self.sub_category_id,
            "sub_category": self.sub_category.name if self.sub_category else None,
            "segment": self.segment or "Men",
            "price": self.price,
            "fit_type": self.fit_type,
            "fabric": self.fabric,
            "gsm": self.gsm,
            "color": self.color,
            "size_options": self.size_options or [],
            "retailer": self.retailer,
            "eligible_coupon": self.eligible_coupon,
            "image_url": self.image_url,
            "is_active": self.is_active,
        }

    def to_catalog_item(self):
        """Convert to the dict shape expected by catalog_store.py."""
        return {
            "sku_id": self.product_id,
            "document": self.document,
            "metadata": {
                "title": self.title or "",
                "brand_name": self.brand_name or "",
                "fit_type": self.fit_type or "regular",
                "fabric": self.fabric or "N/A",
                "gsm": self.gsm or "N/A",
                "color": self.color or "",
                "price": str(self.price),
                "retailer": self.retailer or "",
                "eligible_coupon": self.eligible_coupon or "NONE",
                "segment": self.segment or "Men",
                "category": "Fashion",
                "sub_category": self.sub_category.name if self.sub_category else "",
                "image_url": self.image_url or "",
                "description": self.description or "",
            },
        }


# ---------------------------------------------------------------------------
# 5. Orders Table
# ---------------------------------------------------------------------------
class Order(Base):
    __tablename__ = "orders"

    order_id = Column(String(50), primary_key=True)
    user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False)
    anchor_sku = Column(String(50), nullable=True)
    paired_skus = Column(JSON, default=list)
    amount = Column(Float, nullable=False)  # in INR
    currency = Column(String(10), default="INR")
    status = Column(String(30), default="created")  # created, paid, failed, refunded
    coupon = Column(String(50), default="NONE")
    razorpay_order_id = Column(String(100), unique=True, nullable=True)
    razorpay_payment_id = Column(String(100), nullable=True)
    razorpay_signature = Column(String(255), nullable=True)
    receipt = Column(String(100), nullable=True)
    notes = Column(JSON, default=dict)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    user = relationship("User", back_populates="orders")

    def to_dict(self):
        return {
            "order_id": self.order_id,
            "user_id": self.user_id,
            "anchor_sku": self.anchor_sku,
            "paired_skus": self.paired_skus or [],
            "amount": self.amount,
            "currency": self.currency,
            "status": self.status,
            "coupon": self.coupon,
            "razorpay_order_id": self.razorpay_order_id,
            "razorpay_payment_id": self.razorpay_payment_id,
            "receipt": self.receipt,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ---------------------------------------------------------------------------
# 6. Cart Items Table
# ---------------------------------------------------------------------------
class CartItem(Base):
    __tablename__ = "cart_items"

    cart_item_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), ForeignKey("users.user_id"), nullable=False)
    product_id = Column(String(20), ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    size = Column(String(10), nullable=False, default="L")
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    user = relationship("User", back_populates="cart_items")
    product = relationship("Product")

    def to_dict(self):
        return {
            "cart_item_id": self.cart_item_id,
            "user_id": self.user_id,
            "product_id": self.product_id,
            "quantity": self.quantity,
            "size": self.size,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "product_details": self.product.to_catalog_item() if self.product else None
        }


# ---------------------------------------------------------------------------
# Create all tables
# ---------------------------------------------------------------------------
def _ensure_product_segment_column():
    """Backfill the legacy products table with the `segment` column if needed."""
    inspector = inspect(engine)
    if not inspector.has_table("products"):
        return

    columns = {column["name"] for column in inspector.get_columns("products")}
    if "segment" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE products ADD COLUMN segment VARCHAR(20) DEFAULT 'Men'"))
            conn.execute(text("UPDATE products SET segment = 'Men' WHERE segment IS NULL"))


def _ensure_user_search_history_column():
    """Backfill the legacy users table with the `search_history` column if needed."""
    inspector = inspect(engine)
    if not inspector.has_table("users"):
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "search_history" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN search_history JSONB DEFAULT '[]'::jsonb"))


def init_db():
    """Create all tables if they don't exist and apply small schema backfills."""
    Base.metadata.create_all(bind=engine)
    _ensure_product_segment_column()
    _ensure_user_search_history_column()


init_db()
