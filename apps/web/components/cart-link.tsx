"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartLink() {
  const { cart } = useCart();
  return (
    <Link href="/cart" className="btn-signal">
      Cart · {cart.item_count}
    </Link>
  );
}
