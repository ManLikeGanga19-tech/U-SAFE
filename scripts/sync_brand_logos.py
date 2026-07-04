#!/usr/bin/env python3
"""Sync brand logos from the canonical assets folder into the API seed bundle.

`assets/` is the single source of truth for brand imagery. The API Docker image
is built with `services/api` as its context, so it can't read `assets/` at build
time — this script copies the logos into `services/api/app/seed_assets/brands/`
(renamed to brand slugs) so they ride along in the image and get uploaded to
object storage by the seeder (`app.seed.upsert_brand_logos`).

Run after adding/replacing a logo in assets:

    python scripts/sync_brand_logos.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SRC = REPO / "assets" / "company-profile"
DST = REPO / "services" / "api" / "app" / "seed_assets" / "brands"

# canonical asset filename (relative to assets/company-profile)  →  brand-slug output
LOGO_SOURCES = {
    "brands/3m.png": "3m.png",
    "brands/vaultex.png": "vaultex.png",
    "brands/portwest.jpg": "portwest.jpg",
    "brands/ansell.jpg": "ansell.jpg",
    "brands/jsp.png": "jsp.png",
    "pics/pics/safety jogger.png": "safety-jogger.png",
    "brands/Ace.png": "ace.png",
    "brands/bata.png": "bata.png",
    "brands/bova.png": "bova.png",
    "brands/ultimate.png": "ultimate.png",
    "brands/honey well.png": "honeywell.png",
    "brands/Uvex-logo.jpg": "uvex.jpg",
    "brands/timberland.png": "timberland.png",
    "brands/talan.jpeg": "talan.jpeg",
    "brands/jcb.png": "jcb.png",
    "brands/CAT-logo.png": "cat.png",
    "brands/protecta.png": "protecta.png",
    "brands/safetoe.jpeg": "safetoe.jpeg",
}


def main() -> int:
    DST.mkdir(parents=True, exist_ok=True)
    missing: list[str] = []
    for src_rel, out_name in LOGO_SOURCES.items():
        src = SRC / src_rel
        if not src.exists():
            missing.append(src_rel)
            continue
        shutil.copyfile(src, DST / out_name)
        print(f"[sync] {src_rel} -> seed_assets/brands/{out_name}")
    if missing:
        print(f"\n[sync] WARNING: {len(missing)} source(s) not found:", file=sys.stderr)
        for m in missing:
            print(f"  - assets/company-profile/{m}", file=sys.stderr)
        return 1
    print(f"\n[sync] {len(LOGO_SOURCES)} logos synced to {DST.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
