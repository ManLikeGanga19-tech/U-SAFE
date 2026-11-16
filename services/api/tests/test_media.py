"""Image upload: config validation and the admin upload endpoint."""
from __future__ import annotations

import pytest

from app.core.config import Settings, settings
from app.services import media

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64

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
    assert url.startswith("https://pub-123.r2.dev/products/") and url.endswith(".png")
    assert fake.uploads[0][2] == {"ContentType": "image/png"}
    assert fake.uploads[0][3] == PNG
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


def test_health_reports_storage(client, prod_settings):
    prod_settings(S3_ACCESS_KEY="")
    assert client.get("/api/v1/health").json()["media_storage"] == "not_configured"
