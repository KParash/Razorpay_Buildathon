"""
seed_db.py — Seeds the database with:
  1. Local dev user (usr_local_dev)
  2. Five fashion sub-categories
  3. 100 fashion products (20 per sub-category) with Unsplash image URLs

Usage:
  python seed_db.py          # Seeds only if tables are empty
  python seed_db.py --force  # Drops and re-seeds all data
"""

import sys
import json
import os

from db import init_db, engine, SessionLocal, Base, User, SubCategory, Product, Conversation


# ---------------------------------------------------------------------------
# Seed Data
# ---------------------------------------------------------------------------

LOCAL_DEV_USER = {
    "user_id": "usr_local_dev",
    "username": "Local Dev User",
    "email": "dev@localhost",
    "pincode": "560001",
    "fit_preference": "relaxed",
    "disliked_colors": [],
    "size_history": {"tops": "M", "bottoms": "32"},
    "budget_tier": "mid",
    "metadata_": {},
}

SUB_CATEGORIES = [
    # Men
    {"sub_category_id": 1,  "name": "Pants/Trousers",  "slug": "pants-trousers",  "category": "Men"},
    {"sub_category_id": 2,  "name": "Shoes",           "slug": "shoes-men",       "category": "Men"},
    {"sub_category_id": 3,  "name": "Shirts",          "slug": "shirts",          "category": "Men"},
    {"sub_category_id": 4,  "name": "T-Shirts",        "slug": "tshirts-men",     "category": "Men"},
    {"sub_category_id": 5,  "name": "Sunglasses",      "slug": "sunglasses-men",  "category": "Men"},
    # Women
    {"sub_category_id": 6,  "name": "Dresses",         "slug": "dresses",         "category": "Women"},
    {"sub_category_id": 7,  "name": "Bottoms",         "slug": "bottoms-women",   "category": "Women"},
    {"sub_category_id": 8,  "name": "Tops",            "slug": "tops-women",      "category": "Women"},
    {"sub_category_id": 9,  "name": "Shoes (Women)",   "slug": "shoes-women",     "category": "Women"},
    {"sub_category_id": 10, "name": "Sunglasses (W)",  "slug": "sunglasses-women","category": "Women"},
    {"sub_category_id": 11, "name": "Bags",            "slug": "bags",            "category": "Women"},
    # Kids
    {"sub_category_id": 12, "name": "Kids Tops",       "slug": "kids-tops",       "category": "Kids"},
    {"sub_category_id": 13, "name": "Kids Bottoms",    "slug": "kids-bottoms",    "category": "Kids"},
    {"sub_category_id": 14, "name": "Kids Shoes",      "slug": "kids-shoes",      "category": "Kids"},
    {"sub_category_id": 15, "name": "Kids Accessories","slug": "kids-accessories","category": "Kids"},
    # Beauty
    {"sub_category_id": 16, "name": "Skincare",        "slug": "skincare",        "category": "Beauty"},
    {"sub_category_id": 17, "name": "Makeup",          "slug": "makeup",          "category": "Beauty"},
    {"sub_category_id": 18, "name": "Hair Care",       "slug": "haircare",        "category": "Beauty"},
    {"sub_category_id": 19, "name": "Fragrances",      "slug": "fragrances",      "category": "Beauty"},
    {"sub_category_id": 20, "name": "Grooming",        "slug": "grooming",        "category": "Beauty"},
]


def _load_seed_products():
    """Load product seed data from seed_catalog.json if it exists, otherwise use inline data."""
    seed_file = os.path.join(os.path.dirname(__file__), "seed_catalog.json")
    if os.path.exists(seed_file):
        with open(seed_file, "r", encoding="utf-8") as f:
            return json.load(f)
    # Fallback: return empty list (seed_catalog.json will be created separately)
    return []


# ---------------------------------------------------------------------------
# Seeding Logic
# ---------------------------------------------------------------------------

def seed_database(force: bool = False):
    """Seed the database with initial data."""
    
    if force:
        print("[FORCE] Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
    
    # Create tables
    print("[INFO] Creating tables...")
    init_db()
    
    db = SessionLocal()
    try:
        # ----- 1. Seed local dev user -----
        existing_user = db.query(User).filter_by(user_id="usr_local_dev").first()
        if not existing_user:
            user = User(**LOCAL_DEV_USER)
            db.add(user)
            db.commit()
            print("[OK] Seeded local dev user: usr_local_dev")
        else:
            print("[SKIP]  Local dev user already exists, skipping")

        # ----- 2. Seed sub-categories -----
        existing_cats = db.query(SubCategory).count()
        if existing_cats == 0:
            for cat_data in SUB_CATEGORIES:
                cat = SubCategory(**cat_data)
                db.add(cat)
            db.commit()
            print(f"[OK] Seeded {len(SUB_CATEGORIES)} sub-categories")
        else:
            print(f"[SKIP]  {existing_cats} sub-categories already exist, skipping")

        # ----- 3. Seed products -----
        existing_products = db.query(Product).count()
        if existing_products == 0:
            products_data = _load_seed_products()
            if not products_data:
                print("[WARN]  No seed_catalog.json found — skipping product seeding")
                print("   Create seed_catalog.json and re-run: python seed_db.py --force")
                return
            
            for p in products_data:
                product = Product(
                    product_id=p["product_id"],
                    title=p["title"],
                    brand_name=p["brand_name"],
                    description=p.get("description"),
                    document=p["document"],
                    sub_category_id=p["sub_category_id"],
                    segment=p.get("segment", "Men"),
                    price=p["price"],
                    fit_type=p.get("fit_type", "regular"),
                    fabric=p.get("fabric"),
                    gsm=p.get("gsm"),
                    color=p["color"],
                    size_options=p.get("size_options", []),
                    retailer=p.get("retailer"),
                    eligible_coupon=p.get("eligible_coupon", "NONE"),
                    image_url=p.get("image_url"),
                    is_active=True,
                )
                db.add(product)
            
            db.commit()
            print(f"[OK] Seeded {len(products_data)} products")
        else:
            print(f"[SKIP]  {existing_products} products already exist, skipping")

        # ----- 4. Seed sample conversations -----
        existing_convs = db.query(Conversation).count()
        if existing_convs == 0:
            chat_hist_file = os.path.join(os.path.dirname(__file__), "chat_history.json")
            if os.path.exists(chat_hist_file):
                try:
                    with open(chat_hist_file, "r", encoding="utf-8") as f:
                        hist_data = json.load(f)
                    sessions_dict = hist_data.get("sessions", {})
                    messages_dict = hist_data.get("messages", {})

                    seeded_c = 0
                    for s_id, s_info in sessions_dict.items():
                        c = Conversation(
                            conversation_id=s_id,
                            user_id="usr_local_dev",
                            title=s_info.get("title", "New Consultation"),
                            messages=messages_dict.get(s_id, []),
                        )
                        db.add(c)
                        seeded_c += 1

                    db.commit()
                    print(f"[OK] Seeded {seeded_c} conversations from chat_history.json")
                except Exception as ex:
                    print(f"[WARN]  Could not seed conversations from chat_history.json: {ex}")
            else:
                # Seed default sample consultation
                sample_conv = Conversation(
                    conversation_id="conv_sample_summer_01",
                    user_id="usr_local_dev",
                    title="Breathable linen look for summer",
                    messages=[
                        {
                            "id": "msg_001_u",
                            "sender": "user",
                            "text": "I need a breathable linen outfit for a summer day in Goa under ₹4000.",
                            "timestamp": "10:30 AM"
                        },
                        {
                            "id": "msg_002_a",
                            "sender": "assistant",
                            "text": "I recommend the FabIndia Linen Mandarin Collar Shirt paired with H&M Relaxed Fit Linen Trousers.",
                            "timestamp": "10:30 AM"
                        }
                    ]
                )
                db.add(sample_conv)
                db.commit()
                print("[OK] Seeded default sample conversation")
        else:
            print(f"[SKIP]  {existing_convs} conversations already exist, skipping")

        # ----- Summary -----
        print("\n[SUMMARY] Database Summary:")
        print(f"   Users:          {db.query(User).count()}")
        print(f"   Sub-categories: {db.query(SubCategory).count()}")
        print(f"   Products:       {db.query(Product).count()}")
        print(f"   Conversations:  {db.query(Conversation).count()}")
        
        # Show product counts per sub-category
        for cat in db.query(SubCategory).all():
            count = db.query(Product).filter_by(sub_category_id=cat.sub_category_id).count()
            print(f"     └─ {cat.name}: {count} products")
        
        print(f"\n[DB] Database file: {os.path.abspath('app.db')}")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seeding failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    force = "--force" in sys.argv
    seed_database(force=force)


