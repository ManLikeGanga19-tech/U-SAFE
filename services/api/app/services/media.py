"""Object storage (S3-compatible: MinIO in dev, R2 in prod). Uploads product
imagery and returns a public URL. Endpoint-driven so dev/prod differ by config.
"""
from __future__ import annotations

import uuid
from functools import lru_cache

import boto3
from botocore.client import Config

from app.core.config import settings

ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
}


@lru_cache
def _client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket() -> None:
    client = _client()
    try:
        client.head_bucket(Bucket=settings.S3_BUCKET)
    except Exception:  # noqa: BLE001
        client.create_bucket(Bucket=settings.S3_BUCKET)


def upload_bytes(data: bytes, content_type: str, prefix: str, ext: str) -> str:
    """Upload raw bytes (e.g. a generated PDF) and return a public URL."""
    import io

    ensure_bucket()
    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    _client().upload_fileobj(
        io.BytesIO(data),
        settings.S3_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"{settings.S3_PUBLIC_ENDPOINT}/{settings.S3_BUCKET}/{key}"


def upload_image(fileobj, content_type: str, prefix: str = "products") -> str:
    if content_type not in ALLOWED_TYPES:
        raise ValueError(f"Unsupported content type: {content_type}")
    ensure_bucket()
    ext = ALLOWED_TYPES[content_type]
    key = f"{prefix}/{uuid.uuid4().hex}.{ext}"
    # Bucket is configured for anonymous download (see minio-init), so no
    # per-object ACL is needed; just set the content type.
    _client().upload_fileobj(
        fileobj,
        settings.S3_BUCKET,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"{settings.S3_PUBLIC_ENDPOINT}/{settings.S3_BUCKET}/{key}"
