"""Media storage for product photos, brand logos and quote PDFs.

Two backends (settings.STORAGE_BACKEND):
  - "local": files are written under MEDIA_ROOT (a Docker volume on the VPS)
             and served by the API itself at /media (see app.main).
  - "s3":    any S3-compatible store — MinIO in dev, R2/AWS if ever needed.

Uploaded photos are normalised before storing: EXIF rotation applied, metadata
stripped, downscaled to MEDIA_MAX_DIMENSION and re-encoded as WebP. A phone
photo of several MB typically becomes ~100–300 KB, which matters because the
storefront serves these files directly.
"""
from __future__ import annotations

import io
import logging
import os
import tempfile
import uuid
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.client import Config
from PIL import Image, ImageOps

from app.core.config import settings

log = logging.getLogger(__name__)

ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
}

# Refuse decompression bombs (a tiny file that expands to gigapixels).
Image.MAX_IMAGE_PIXELS = 50_000_000


class StorageNotConfigured(RuntimeError):
    pass


class InvalidImage(ValueError):
    pass


def _check_config() -> None:
    problems = settings.storage_problems()
    if problems:
        raise StorageNotConfigured(
            "Media storage is not configured on the server: " + "; ".join(problems)
        )


# ── Image processing ──────────────────────────────────────
def optimize_image(data: bytes, content_type: str) -> tuple[bytes, str, str]:
    """Return (bytes, content_type, ext) ready to store.

    Raises InvalidImage if the bytes aren't a readable image. If Pillow can't
    decode a declared-allowed format (e.g. AVIF without codec support) the
    original is stored untouched rather than failing the upload.
    """
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except Image.DecompressionBombError as exc:
        raise InvalidImage("Image dimensions are too large") from exc
    except Exception as exc:  # noqa: BLE001
        if content_type == "image/avif":
            return data, content_type, ALLOWED_TYPES[content_type]
        raise InvalidImage("File is not a valid image") from exc

    img = ImageOps.exif_transpose(img)
    limit = settings.MEDIA_MAX_DIMENSION
    if max(img.size) > limit:
        img.thumbnail((limit, limit), Image.LANCZOS)

    has_alpha = img.mode in ("RGBA", "LA") or (
        img.mode == "P" and "transparency" in img.info
    )
    img = img.convert("RGBA" if has_alpha else "RGB")

    out = io.BytesIO()
    # exif/icc not passed → metadata (incl. GPS location from phones) dropped.
    img.save(out, "WEBP", quality=82, method=4)
    optimized = out.getvalue()
    # Already-small, well-compressed images can grow; keep the smaller one.
    if len(optimized) >= len(data) and max(img.size) <= limit and content_type != "image/png":
        return data, content_type, ALLOWED_TYPES[content_type]
    return optimized, "image/webp", "webp"


# ── Backends ──────────────────────────────────────────────
def _local_put(key: str, data: bytes) -> None:
    root = Path(settings.MEDIA_ROOT).resolve()
    dest = (root / key).resolve()
    if root not in dest.parents:
        raise ValueError("invalid media key")
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file then rename, so a reader never sees half a file.
    fd, tmp = tempfile.mkstemp(dir=dest.parent, prefix=".upload-")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        os.chmod(tmp, 0o644)
        os.replace(tmp, dest)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise


@lru_cache
def _client():
    _check_config()
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 2},
        ),
    )


_bucket_ready = False


def ensure_bucket() -> None:
    """Dev only: auto-create the MinIO bucket. In production the bucket already
    exists, and R2 API tokens scoped to objects aren't allowed to HeadBucket /
    CreateBucket — trying would make every upload fail."""
    global _bucket_ready
    client = _client()
    if _bucket_ready or settings.ENVIRONMENT != "development":
        return
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET)
    except Exception:  # noqa: BLE001
        client.create_bucket(Bucket=settings.S3_BUCKET)
    _bucket_ready = True


def _put(key: str, data: bytes, content_type: str) -> str:
    _check_config()
    if settings.STORAGE_BACKEND == "local":
        _local_put(key, data)
    else:
        ensure_bucket()
        _client().upload_fileobj(
            io.BytesIO(data),
            settings.S3_BUCKET,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    return settings.public_object_url(key)


# ── Public API ────────────────────────────────────────────
def upload_bytes(data: bytes, content_type: str, prefix: str, ext: str) -> str:
    """Store raw bytes (e.g. a generated PDF) as-is and return a public URL."""
    return _put(f"{prefix}/{uuid.uuid4().hex}.{ext}", data, content_type)


def upload_image(fileobj, content_type: str, prefix: str = "products") -> str:
    """Validate, optimise and store an uploaded image; return its public URL."""
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported content type: {content_type}")
    _check_config()
    data, ctype, ext = optimize_image(fileobj.read(), content_type)
    return _put(f"{prefix}/{uuid.uuid4().hex}.{ext}", data, ctype)
