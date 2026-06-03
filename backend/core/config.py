# backend/core/config.py
"""Central application configuration loaded from environment / .env.

Single source of truth for secrets and tunables. Nothing else in the code
should read os.environ directly — import `get_settings()` instead.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Provider API keys ---
    groq_api_key: str = Field(default="", alias="GROQ_API_KEY")
    cerebras_api_key: str = Field(default="", alias="CEREBRAS_API_KEY")
    sambanova_api_key: str = Field(default="", alias="SAMBANOVA_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")

    # --- CORS ---
    cors_allow_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ALLOW_ORIGINS",
    )

    # --- Request limits / rate limiting ---
    max_message_length: int = Field(default=8000, alias="MAX_MESSAGE_LENGTH")
    rate_limit_requests: int = Field(default=60, alias="RATE_LIMIT_REQUESTS")
    rate_limit_window_seconds: int = Field(
        default=60, alias="RATE_LIMIT_WINDOW_SECONDS"
    )

    # --- Logging ---
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # --- Responders (PH13/PH16) ---
    # Global output budget for responder models. Reasoning models spend tokens
    # on hidden reasoning and may return an empty `content` if max_tokens is too
    # small / unset; a sufficient default keeps Compare at a stable 3 answers and
    # full (non-truncated) replies. Per-provider overrides below.
    responder_max_tokens: int = Field(default=2048, alias="RESPONDER_MAX_TOKENS")
    # Cerebras runs GLM-4.7, a reasoning model: it needs extra headroom so the
    # hidden reasoning never crowds out the visible answer (PH16, OD-1).
    cerebras_max_tokens: int = Field(default=4096, alias="CEREBRAS_MAX_TOKENS")

    # --- Responder model roster (PH16, D-11) ---
    # Each responder runs a *distinct*, truthfully-named model so Compare shows
    # three genuinely different answers (Llama / GLM / DeepSeek) and the judge
    # (Qwen) shares no family with any of them. IDs are env-overridable (swap a
    # model without code changes); defaults are the live-verified lineup.
    # Display names live in config/models_config.py (the single registry).
    groq_model: str = Field(default="llama-3.3-70b-versatile", alias="GROQ_MODEL")
    cerebras_model: str = Field(default="zai-glm-4.7", alias="CEREBRAS_MODEL")
    sambanova_model: str = Field(default="DeepSeek-V3.1", alias="SAMBANOVA_MODEL")

    # --- Database ---
    # Async SQLAlchemy URL. Dev default: SQLite. Prod: postgresql+asyncpg://...
    database_url: str = Field(
        default="sqlite+aiosqlite:///./ai_gateway.db",
        alias="DATABASE_URL",
    )

    # Max interactions kept per user in history (sliding window).
    history_limit: int = Field(default=10, alias="HISTORY_LIMIT")

    # Max saved Compare chats per user (PH16/OD-3: 25). On reaching it the UI
    # shows an explicit notice and the user deletes a chat manually — no
    # auto-eviction. Keep in sync with the frontend SAVED_CHATS_LIMIT constant.
    saved_chats_limit: int = Field(default=25, alias="SAVED_CHATS_LIMIT")

    # --- Auth / sessions ---
    # Mark session cookies Secure (HTTPS-only). Keep false for local http dev.
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    # Session lifetime in hours.
    session_ttl_hours: int = Field(default=168, alias="SESSION_TTL_HOURS")

    # --- Admin / quotas (PH15, D-10) ---
    # The username that is granted admin (admin panel + unlimited quota) on
    # registration. Match is case-insensitive.
    admin_username: str = Field(default="admin", alias="ADMIN_USERNAME")
    # Required to register: registration is refused without this exact code.
    # Empty disables registration entirely (admin creates accounts in the panel).
    registration_code: str = Field(default="", alias="REGISTRATION_CODE")
    # Default per-user request quotas assigned to non-admin accounts. A Compare
    # (multi) request counts as one. Admins get NULL/NULL (unlimited).
    default_max_requests_per_minute: int = Field(
        default=5, alias="DEFAULT_MAX_REQUESTS_PER_MINUTE"
    )
    default_max_requests_per_day: int = Field(
        default=30, alias="DEFAULT_MAX_REQUESTS_PER_DAY"
    )

    # --- BYOK encryption (PH30, D-20) ---
    # Key Encryption Key (KEK) for the AES-256-GCM envelope that protects stored
    # BYOK keys at rest. base64 of 32 random bytes. Generate with:
    #   python -c "import os,base64;print(base64.b64encode(os.urandom(32)).decode())"
    # Empty disables BYOK storage entirely (server can't decrypt → explicit error
    # at use). MUST be the SAME value in every environment that reads the same DB:
    # changing/losing it invalidates all stored keys (users re-enter them).
    byok_encryption_key: str = Field(default="", alias="BYOK_ENCRYPTION_KEY")

    # --- RAG (PH10) ---
    # Persistent ChromaDB directory.
    chroma_path: str = Field(default="./chroma_data", alias="CHROMA_PATH")
    # Gemini embedding model (abstracted; swap via EmbeddingClient).
    embedding_model: str = Field(
        default="models/gemini-embedding-001", alias="EMBEDDING_MODEL"
    )
    # Upload limits and chunking.
    rag_max_file_bytes: int = Field(default=5_000_000, alias="RAG_MAX_FILE_BYTES")
    rag_chunk_size: int = Field(default=1000, alias="RAG_CHUNK_SIZE")
    rag_chunk_overlap: int = Field(default=150, alias="RAG_CHUNK_OVERLAP")
    rag_top_k: int = Field(default=4, alias="RAG_TOP_K")
    rag_max_documents: int = Field(default=10, alias="RAG_MAX_DOCUMENTS")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
