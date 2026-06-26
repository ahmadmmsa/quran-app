import configparser
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, PydanticBaseSettingsSource, SettingsConfigDict

_DEV_ENVS = {"development", "dev", "local", "test", "testing"}
_INSECURE_DEFAULTS = {
    "JWT_SECRET_KEY": ("", "dev_secret_key"),
    "ALTCHA_HMAC_KEY": ("", "altcha_dev_secret"),
}

DB_PROFILES = {
    "docker": {"sslmode": None},
    "local": {"sslmode": None},
    "neon": {"sslmode": "require"},
    "google": {"sslmode": "require"},
}

_CONF_FILE = Path(__file__).resolve().parents[2] / "quran.conf"

class IniSettingsSource(PydanticBaseSettingsSource):
    """Loads quran.conf (INI) and flattens all sections into one dict.

    Section names are organizational only; keys map to the model's field aliases
    (the UPPERCASE names). Interpolation is OFF so '%', URLs and passwords are
    treated literally.
    """

    def __init__(self, settings_cls: type[BaseSettings], path: Path):
        super().__init__(settings_cls)
        self._values: dict[str, str] = {}
        if path.exists():
            parser = configparser.ConfigParser(interpolation=None)
            parser.read(path, encoding="utf-8")
            for section in parser.sections():
                for key, value in parser.items(section):
                    self._values[key.upper()] = value

    def get_field_value(self, field, field_name) -> tuple[Any, str, bool]:  # pragma: no cover
        return None, field_name, False

    def __call__(self) -> dict[str, Any]:
        return dict(self._values)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file_encoding="utf-8", extra="ignore")
    app_name: str = "Quran API"
    app_env: str = Field(default="development", alias="APP_ENV")
    app_host: str = Field(default="0.0.0.0", alias="APP_HOST")
    app_port: int = Field(default=8000, alias="APP_PORT")
    api_prefix: str = "/api"
    cors_origins: str = Field(default="*", alias="CORS_ORIGINS")

    db_type: str = Field(default="docker", alias="DB_TYPE")
    db_host: str = Field(default="", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_user: str = Field(default="", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")
    db_name: str = Field(default="", alias="DB_NAME")
    # Full connection string. Required when DB_TYPE=url; optional otherwise.
    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")

    jwt_secret_key: str = Field(default="dev_secret_key", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days
    altcha_hmac_key: str = Field(default="altcha_dev_secret", alias="ALTCHA_HMAC_KEY")
    google_client_id: str = Field(default="", alias="GOOGLE_CLIENT_ID")

    # Bootstrap admin (used by `python -m backend.scripts.create_admin`).
    admin_email: str | None = Field(default=None, alias="ADMIN_EMAIL")
    admin_password: str | None = Field(default=None, alias="ADMIN_PASSWORD")

    # Verse-level semantic search. embedding_dim must match the migration's
    # vector(...) column; changing the model means re-running the backfill.
    embedding_model_name: str = Field(default="intfloat/multilingual-e5-large", alias="EMBEDDING_MODEL_NAME")
    embedding_dim: int = Field(default=1024, alias="EMBEDDING_DIM")
    embedding_query_prefix: str = Field(default="query: ", alias="EMBEDDING_QUERY_PREFIX")
    embedding_passage_prefix: str = Field(default="passage: ", alias="EMBEDDING_PASSAGE_PREFIX")
    embedding_cache_dir: str | None = Field(default=None, alias="EMBEDDING_CACHE_DIR")
    embedding_threads: int | None = Field(default=None, alias="EMBEDDING_THREADS")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        # Precedence (first wins): init args > env vars > quran.conf > defaults.
        return (init_settings, env_settings, IniSettingsSource(settings_cls, _CONF_FILE))

    @computed_field
    @property
    def database_url(self) -> str:
        if self.db_type == "url" or self.database_url_override:
            if not self.database_url_override:
                raise ValueError("DB_TYPE=url requires DATABASE_URL to be set.")
            return self.database_url_override

        user = quote_plus(self.db_user)
        password = quote_plus(self.db_password)
        # Cloud SQL via unix socket (no host/port/ssl in the authority).
        if self.db_type == "google" and self.db_host.startswith("/cloudsql/"):
            return f"postgresql://{user}:{password}@/{self.db_name}?host={self.db_host}"

        sslmode = DB_PROFILES.get(self.db_type, {}).get("sslmode")
        query = f"?sslmode={sslmode}" if sslmode else ""
        return f"postgresql://{user}:{password}@{self.db_host}:{self.db_port}/{self.db_name}{query}"

    @model_validator(mode="after")
    def _require_database_config(self) -> "Settings":
        if self.db_type == "url" or self.database_url_override:
            if not self.database_url_override:
                raise ValueError("DB_TYPE=url requires DATABASE_URL to be set.")
            return self
        if not (self.db_host and self.db_name and self.db_user):
            raise ValueError(
                f"Database not configured for DB_TYPE={self.db_type!r}: "
                "set DB_HOST + DB_NAME + DB_USER (or DB_TYPE=url + DATABASE_URL)."
            )
        return self

    @model_validator(mode="after")
    def _reject_insecure_secrets_in_production(self) -> "Settings":
        if self.app_env.lower() in _DEV_ENVS:
            return self
        current = {
            "JWT_SECRET_KEY": self.jwt_secret_key,
            "ALTCHA_HMAC_KEY": self.altcha_hmac_key,
        }
        insecure = [name for name, value in current.items() if value in _INSECURE_DEFAULTS[name]]
        if insecure:
            raise ValueError(
                f"Refusing to start with insecure default secret(s) {insecure} while "
                f"APP_ENV={self.app_env!r}. Set strong values in quran.conf or the environment."
            )
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
