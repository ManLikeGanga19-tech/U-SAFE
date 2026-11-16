"""Image upload: config validation and the admin upload endpoint."""
from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import Settings, settings
from app.services import media


def make_image(fmt="PNG", size=(40, 30), color=(200, 30, 30), mode="RGB", exif=None) -> bytes:
    buf = io.BytesIO()
    img = Image.new(mode, size, color)
    kw = {"exif": exif} if exif is not None else {}
    img.save(buf, fmt, **kw)
    return buf.getvalue()


PNG = make_image()

R2 = dict(
    ENVIRONMENT="production",
    S3_ENDPOINT="https://acct.r2.cloudflarestorage.com",
    S3_ACCESS_KEY="ak",
    S3_SECRET_KEY="sk",
    S3_BUCKET="usafe-media",
    S3_PUBLIC_BASE_URL="https://pub-123.r2.dev",
    S3_PUBLIC_ENDPOINT="",
)


def test_dev_defaults_are_fine_in_development():
    assert Settings(_env_file=None, ENVIRONMENT="development").storage_problems() == []


def test_blank_r2_in_production_is_reported():
    """The VPS migration left R2 blank → API fell back to MinIO dev defaults."""
    s = Settings(_env_file=None, ENVIRONMENT="production")
    problems = " ".join(s.storage_problems())
    for var in ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_PUBLIC_BASE_URL"]:
        assert var in problems


def test_empty_strings_in_env_file_are_reported():
    s = Settings(_env_file=None, **{**R2, "S3_ACCESS_KEY": "", "S3_PUBLIC_BASE_URL": ""})
    problems = " ".join(s.storage_problems())
    assert "S3_ACCESS_KEY" in problems and "S3_PUBLIC_BASE_URL" in problems


def test_full_r2_config_is_ok():
    s = Settings(_env_file=None, **R2)
    assert s.storage_problems() == []
    assert s.public_object_url("products/a.png") == "https://pub-123.r2.dev/products/a.png"


@pytest.fixture
def prod_settings(monkeypatch):
    real_client = media._client  # the lru_cached one (tests may monkeypatch it)

    def _apply(**overrides):
        for k, v in {**R2, **overrides}.items():
            monkeypatch.setattr(settings, k, v)
        real_client.cache_clear()

    yield _apply
    real_client.cache_clear()


class FakeS3:
    def __init__(self):
        self.uploads = []
        self.bucket_calls = 0

    def upload_fileobj(self, fileobj, bucket, key, ExtraArgs):
        self.uploads.append((bucket, key, ExtraArgs, fileobj.read()))

    def head_bucket(self, **kw):
        self.bucket_calls += 1

    def create_bucket(self, **kw):
        self.bucket_calls += 1


def _upload(client, headers, content=PNG, ctype="image/png", name="a.png"):
    return client.post(
        "/api/v1/admin/media/upload", files={"file": (name, content, ctype)}, headers=headers
    )


def test_upload_requires_staff(client):
    assert _upload(client, {}).status_code == 401


def test_upload_misconfigured_storage_says_why(client, admin_headers, prod_settings):
    prod_settings(S3_ENDPOINT="http://minio:9000", S3_ACCESS_KEY="usafe_minio")
    r = _upload(client, admin_headers)
    assert r.status_code == 503
    assert "S3_ENDPOINT" in r.json()["detail"]


def test_upload_success_in_production_skips_bucket_admin_calls(
    client, admin_headers, prod_settings, monkeypatch
):
    prod_settings()
    fake = FakeS3()
    monkeypatch.setattr(media, "_client", lambda: fake)
    r = _upload(client, admin_headers)
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("https://pub-123.r2.dev/products/") and url.endswith(".webp")
    assert fake.uploads[0][2] == {"ContentType": "image/webp"}
    assert Image.open(io.BytesIO(fake.uploads[0][3])).format == "WEBP"
    # R2 object-scoped tokens can't HeadBucket/CreateBucket — we must not try.
    assert fake.bucket_calls == 0


def test_upload_storage_error_is_502_with_reason(client, admin_headers, prod_settings, monkeypatch):
    prod_settings()

    class Broken(FakeS3):
        def upload_fileobj(self, *a, **kw):
            raise RuntimeError("AccessDenied")

    monkeypatch.setattr(media, "_client", lambda: Broken())
    r = _upload(client, admin_headers)
    assert r.status_code == 502
    assert "AccessDenied" in r.json()["detail"]


def test_upload_rejects_bad_type_and_empty(client, admin_headers):
    assert _upload(client, admin_headers, ctype="image/gif", name="a.gif").status_code == 415
    assert _upload(client, admin_headers, ctype="image/heic", name="a.heic").status_code == 415
    assert _upload(client, admin_headers, content=b"").status_code == 400
    # Right content-type header, but not actually an image.
    r = _upload(client, admin_headers, content=b"<?php echo 1; ?>", ctype="image/jpeg", name="x.jpg")
    assert r.status_code == 400


def test_health_reports_storage(client, prod_settings):
    prod_settings(S3_ACCESS_KEY="")
    assert client.get("/api/v1/health").json()["media_storage"] == "not_configured"


# ── Local (on-VPS) storage ─────────────────────────────────
@pytest.fixture
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "STORAGE_BACKEND", "local")
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "MEDIA_ROOT", str(tmp_path / "media"))
    monkeypatch.setattr(settings, "MEDIA_URL_BASE", "https://api.example.test/media")
    from app.main import create_app

    with TestClient(create_app()) as c:
        yield c, tmp_path / "media"


def test_local_storage_needs_no_s3_settings():
    s = Settings(_env_file=None, ENVIRONMENT="production", STORAGE_BACKEND="local",
                 MEDIA_URL_BASE="https://api.u-safe.co.ke/media")
    assert s.storage_problems() == []
    assert s.public_object_url("products/a.webp") == "https://api.u-safe.co.ke/media/products/a.webp"
    missing = Settings(_env_file=None, ENVIRONMENT="production", STORAGE_BACKEND="local")
    assert "MEDIA_URL_BASE" in " ".join(missing.storage_problems())


def test_local_upload_is_saved_and_served(local_storage, admin_headers):
    client, root = local_storage
    big = make_image("JPEG", size=(4000, 3000), color=(10, 120, 200))
    r = _upload(client, admin_headers, content=big, ctype="image/jpeg", name="photo.jpg")
    assert r.status_code == 200, r.text
    url = r.json()["url"]
    assert url.startswith("https://api.example.test/media/products/") and url.endswith(".webp")

    key = url.split("/media/", 1)[1]
    stored = (root / key).read_bytes()
    img = Image.open(io.BytesIO(stored))
    assert img.format == "WEBP" and max(img.size) == settings.MEDIA_MAX_DIMENSION
    assert len(stored) < len(big)

    served = client.get(f"/media/{key}")
    assert served.status_code == 200
    assert served.headers["content-type"] == "image/webp"
    assert "immutable" in served.headers["cache-control"]
    assert served.content == stored
    assert not list(root.rglob(".upload-*"))  # no temp files left behind


def test_local_media_blocks_path_traversal(local_storage):
    client, root = local_storage
    (root.parent / "secret.txt").write_text("nope")
    for path in ["/media/../secret.txt", "/media/%2e%2e/secret.txt", "/media/products/missing.webp"]:
        r = client.get(path)
        assert r.status_code == 404 and "nope" not in r.text


def test_local_quote_pdf_and_logo_bytes_stored_as_is(local_storage):
    _, root = local_storage
    url = media.upload_bytes(b"%PDF-1.4 test", "application/pdf", "quotes", "pdf")
    assert url.endswith(".pdf")
    assert (root / url.split("/media/", 1)[1]).read_bytes() == b"%PDF-1.4 test"


def test_photo_metadata_and_rotation_handled():
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: rotate 90 deg CW
    exif[0x010F] = "PhoneMaker"
    src = make_image("JPEG", size=(300, 100), exif=exif.tobytes())
    data, ctype, ext = media.optimize_image(src, "image/jpeg")
    out = Image.open(io.BytesIO(data))
    assert (ctype, ext) == ("image/webp", "webp")
    assert out.size == (100, 300)  # upright
    assert not out.getexif()  # metadata stripped


def test_transparent_png_keeps_alpha():
    src = make_image("PNG", size=(50, 50), color=(0, 0, 0, 0), mode="RGBA")
    data, _, _ = media.optimize_image(src, "image/png")
    assert Image.open(io.BytesIO(data)).mode == "RGBA"


def test_decompression_bomb_rejected(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 1000)
    with pytest.raises(media.InvalidImage):
        media.optimize_image(make_image("PNG", size=(100, 100)), "image/png")
