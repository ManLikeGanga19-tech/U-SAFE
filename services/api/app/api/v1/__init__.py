from fastapi import APIRouter

from app.api.v1 import auth, cart, catalog, checkout, content, health, payments, quotes
from app.api.v1.admin import admin_router

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router.include_router(checkout.router, tags=["checkout"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(quotes.router, prefix="/quotes", tags=["quotes"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(admin_router, prefix="/admin")
