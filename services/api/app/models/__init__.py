"""Import all models so Alembic autogenerate + metadata see them."""
from app.models.base import Base
from app.models.user import User, UserRole
from app.models.catalog import Brand, Category, Product, ProductStatus, ProductVariant
from app.models.inventory import InventoryItem, StockMovement, StockReason
from app.models.commerce import (
    Cart,
    CartItem,
    Order,
    OrderItem,
    OrderStatus,
    Payment,
    PaymentProvider,
    PaymentStatus,
    Quote,
    QuoteItem,
    QuoteStatus,
)
from app.models.content import AuditLog, ContentBlock

__all__ = [
    "Base",
    "User",
    "UserRole",
    "Brand",
    "Category",
    "Product",
    "ProductStatus",
    "ProductVariant",
    "InventoryItem",
    "StockMovement",
    "StockReason",
    "Cart",
    "CartItem",
    "Order",
    "OrderItem",
    "OrderStatus",
    "Payment",
    "PaymentProvider",
    "PaymentStatus",
    "Quote",
    "QuoteItem",
    "QuoteStatus",
    "AuditLog",
    "ContentBlock",
]
