"""checkout revamp: fulfilment, payment method, VAT, B2B details

Revision ID: b7e2c41a9d10
Revises: 5dbc44d64b6a
Create Date: 2026-11-16 12:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7e2c41a9d10"
down_revision: Union[str, None] = "5dbc44d64b6a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing orders were all home-delivery + M-Pesa STK with no VAT charged.
    op.add_column(
        "orders",
        sa.Column("fulfilment", sa.String(16), nullable=False, server_default="delivery"),
    )
    op.add_column(
        "orders",
        sa.Column("payment_method", sa.String(20), nullable=False, server_default="mpesa_stk"),
    )
    op.add_column(
        "orders",
        sa.Column("vat_kes", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column("orders", sa.Column("company_name", sa.String(200)))
    op.add_column("orders", sa.Column("kra_pin", sa.String(20)))
    op.add_column("orders", sa.Column("po_number", sa.String(60)))
    op.add_column("orders", sa.Column("payment_reference", sa.String(64)))
    op.add_column("orders", sa.Column("payment_due_at", sa.DateTime(timezone=True)))
    op.create_index("ix_orders_payment_method", "orders", ["payment_method"])


def downgrade() -> None:
    op.drop_index("ix_orders_payment_method", table_name="orders")
    for col in (
        "payment_due_at",
        "payment_reference",
        "po_number",
        "kra_pin",
        "company_name",
        "vat_kes",
        "payment_method",
        "fulfilment",
    ):
        op.drop_column("orders", col)
