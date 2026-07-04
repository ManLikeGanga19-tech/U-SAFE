from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.commerce import Cart, CartItem
from app.schemas.cart import CartItemIn, CartItemUpdate, CartOut
from app.services import cart as cart_service

router = APIRouter()


def _cart_or_404(db: Session, token: str | None) -> Cart:
    cart = cart_service.get_by_token(db, token)
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    return cart


@router.get("", response_model=CartOut)
def get_cart(
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CartOut:
    cart = cart_service.get_by_token(db, x_cart_token)
    if not cart:
        # Return an empty, tokenless cart rather than 404 for a fresh visitor.
        return CartOut(token=x_cart_token or "", items=[], item_count=0, subtotal_kes=0.0)
    return cart_service.serialize(db, cart)


@router.post("/items", response_model=CartOut, status_code=201)
def add_item(
    payload: CartItemIn,
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CartOut:
    cart = cart_service.get_or_create(db, x_cart_token)
    try:
        cart_service.add_item(db, cart, payload.variant_id, payload.quantity)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    db.commit()
    return cart_service.serialize(db, cart)


@router.patch("/items/{item_id}", response_model=CartOut)
def update_item(
    item_id: uuid.UUID,
    payload: CartItemUpdate,
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CartOut:
    cart = _cart_or_404(db, x_cart_token)
    item = db.scalar(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.quantity = payload.quantity
    db.commit()
    return cart_service.serialize(db, cart)


@router.delete("/items/{item_id}", response_model=CartOut)
def remove_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    x_cart_token: str | None = Header(default=None),
) -> CartOut:
    cart = _cart_or_404(db, x_cart_token)
    item = db.scalar(
        select(CartItem).where(CartItem.id == item_id, CartItem.cart_id == cart.id)
    )
    if item:
        db.delete(item)
        db.commit()
    return cart_service.serialize(db, cart)
