"""Application settings, loaded from environment (12-factor)."""
from __future__ import annotations

from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    PROJECT_NAME: str = "U-SAFE KE"
    API_V1_PREFIX: str = "/api/v1"

    # ── Auth ──
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # ── CORS ──
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # ── Database ──
    POSTGRES_USER: str = "usafe"
    POSTGRES_PASSWORD: str = "usafe_dev_pw"
    POSTGRES_DB: str = "usafe"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432

    # ── Redis ──
    # In prod, set REDIS_URL to the managed connection string (Render Key Value).
    # Locally we fall back to host/port.
    REDIS_URL: str = ""
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379

    # ── Object storage (S3 / MinIO / R2) ──
    S3_ENDPOINT: str = "http://minio:9000"
    S3_PUBLIC_ENDPOINT: str = "http://localhost:9002"
    S3_REGION: str = "us-east-1"
    S3_ACCESS_KEY: str = "usafe_minio"
    S3_SECRET_KEY: str = "usafe_minio_pw"
    S3_BUCKET: str = "usafe-media"

    # ── Seed admin ──
    FIRST_ADMIN_EMAIL: str = "admin@u-safe.co.ke"
    FIRST_ADMIN_PASSWORD: str = "ChangeMe123!"
    # Seed demo products? Keep OFF in production (real catalog is imported/entered).
    SEED_DEMO_PRODUCTS: bool = True

    # ── M-Pesa (Safaricom Daraja) ──
    # mode: "mock" (local dev simulator) | "sandbox" | "live"
    MPESA_MODE: str = "mock"
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_SHORTCODE: str = "174379"      # Daraja sandbox default
    MPESA_PASSKEY: str = ""
    MPESA_CALLBACK_URL: str = "http://localhost:8080/api/v1/payments/mpesa/callback"
    # seconds the mock waits before "confirming" a payment
    MPESA_MOCK_DELAY: int = 6

    @property
    def mpesa_base_url(self) -> str:
        return (
            "https://api.safaricom.co.ke"
            if self.MPESA_MODE == "live"
            else "https://sandbox.safaricom.co.ke"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @computed_field  # type: ignore[prop-decorator]
    @property
    def redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
