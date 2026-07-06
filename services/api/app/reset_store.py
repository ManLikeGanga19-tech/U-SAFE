"""DANGER — wipe catalog + commerce data to a clean slate.

Deletes every product, variant, inventory record, stock movement, order, order
item, payment, quote, quote item, cart and cart item. KEEPS the seeded baseline:
users (your admin login), the 12 categories, the 19 brands + their logos, and
content blocks (home hero). The next deploy's seed leaves those baseline rows
untouched (idempotent).

Guarded: refuses to run unless you explicitly confirm with either
    RESET_CONFIRM=RESET   (env var)   or   --yes   (arg)

Usage:
    # Production (Render Shell on the API service, or locally with DB pointing at prod)
    RESET_CONFIRM=RESET python -m app.reset_store

    # Local dev
    python -m app.reset_store --yes
"""
from __future__ import annotations

import os
import sys

from sqlalchemy import delete

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.catalog import Product, ProductVariant
from app.models.commerce import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    Payment,
    Quote,
    QuoteItem,
)
from app.models.inventory import InventoryItem, StockMovement

# Deleted in child → parent order so foreign keys never block us.
WIPE_ORDER = [
    Payment,
    OrderItem,
    Order,
    QuoteItem,
    Quote,
    CartItem,
    Cart,
    StockMovement,
    InventoryItem,
    ProductVariant,
    Product,
]


def _confirmed() -> bool:
    return os.getenv("RESET_CONFIRM") == "RESET" or "--yes" in sys.argv[1:]


def main() -> None:
    if not _confirmed():
        print(
            "Refusing to run — this wipes ALL products + orders + quotes + carts.\n"
            "Confirm with RESET_CONFIRM=RESET (env) or pass --yes.",
            file=sys.stderr,
        )
        raise SystemExit(1)

    # Loud banner so you always know which database you're about to clear.
    print(f"[reset] target database host: {settings.POSTGRES_HOST}/{settings.POSTGRES_DB}")

    db = SessionLocal()
    try:
        for model in WIPE_ORDER:
            n = db.execute(delete(model)).rowcount
            print(f"[reset] {model.__tablename__:16s} deleted {n}")
        db.commit()
        print("[reset] done — catalog + commerce cleared. "
              "Admin, categories, brands, logos and content kept.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
