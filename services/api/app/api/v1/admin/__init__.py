from fastapi import APIRouter, Depends

from app.api.deps import require_staff
from app.api.v1.admin import (
    content,
    inventory,
    media,
    orders,
    products,
    quotes,
    taxonomy,
)

# Everything under /admin requires a staff-level user.
admin_router = APIRouter(dependencies=[Depends(require_staff)])
admin_router.include_router(products.router, prefix="/products", tags=["admin:products"])
admin_router.include_router(taxonomy.router, tags=["admin:taxonomy"])
admin_router.include_router(inventory.router, prefix="/inventory", tags=["admin:inventory"])
admin_router.include_router(orders.router, prefix="/orders", tags=["admin:orders"])
admin_router.include_router(quotes.router, prefix="/quotes", tags=["admin:quotes"])
admin_router.include_router(content.router, prefix="/content", tags=["admin:content"])
admin_router.include_router(media.router, prefix="/media", tags=["admin:media"])
