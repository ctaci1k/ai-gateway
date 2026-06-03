# backend/core/secret_box.py
"""AES-256-GCM envelope encryption for BYOK keys at rest (PH30, D-20).

The gateway calls providers server-side (Compare / judge / stream), so it MUST
be able to decrypt a user's key at use time — true zero-knowledge is impossible.
We therefore take custody of the keys under server-side envelope encryption:

- **KEK** (Key Encryption Key): ``settings.byok_encryption_key`` — base64 of 32
  random bytes. Maturity levels (documented honestly): *Good* — KEK in an env
  secret (our VPS level); *Better* — per-user DEK wrapped by the KEK; *Ideal* —
  KEK in a KMS / Vault. ``key_version`` prepares the ground for rotation.
- Each record is sealed with a fresh random **96-bit nonce**; we store the
  ciphertext, nonce and ``key_version``.
- **AAD = ``f"{user_id}:{slot}"``** binds the ciphertext to its owner + slot:
  moving a row to another user/slot in the DB fails the GCM tag check on
  decrypt, so a swapped row can't be silently reused.

The plaintext key and the plaintext KEK are NEVER stored and NEVER logged
(keeping "not logged" from D-12; replacing "not in DB" with "encrypted in DB").
"""

import base64
import os

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from core.config import get_settings

# Current envelope version written to new records. Bump when the scheme or KEK
# rotates; ``decrypt_secret`` can branch on the stored value during a migration.
KEY_VERSION = 1

# AES-256 needs a 32-byte key; GCM uses a 96-bit (12-byte) nonce.
_KEK_BYTES = 32
NONCE_BYTES = 12


class ByokEncryptionDisabledError(RuntimeError):
    """Raised when a BYOK crypto operation is attempted without a configured KEK."""


def _load_kek() -> bytes:
    """Decode the configured KEK (base64 → 32 bytes) or raise a clear error."""
    raw = (get_settings().byok_encryption_key or "").strip()
    if not raw:
        raise ByokEncryptionDisabledError(
            "BYOK disabled: set BYOK_ENCRYPTION_KEY (base64 of 32 random bytes)"
        )
    try:
        kek = base64.b64decode(raw, validate=True)
    except (ValueError, base64.binascii.Error) as error:  # type: ignore[attr-defined]
        raise ByokEncryptionDisabledError(
            "BYOK_ENCRYPTION_KEY is not valid base64"
        ) from error
    if len(kek) != _KEK_BYTES:
        raise ByokEncryptionDisabledError(
            f"BYOK_ENCRYPTION_KEY must decode to {_KEK_BYTES} bytes "
            f"(got {len(kek)})"
        )
    return kek


def is_encryption_configured() -> bool:
    """True when a usable KEK is configured (for a friendly API-level gate)."""
    try:
        _load_kek()
        return True
    except ByokEncryptionDisabledError:
        return False


def _aad(user_id: int, slot: str) -> bytes:
    return f"{user_id}:{slot}".encode()


def encrypt_secret(
    plaintext: str, *, user_id: int, slot: str
) -> tuple[bytes, bytes, int]:
    """Seal a secret for storage. Returns ``(ciphertext, nonce, key_version)``.

    A fresh random nonce is generated per call. The AAD binds the record to
    ``user_id``+``slot`` so the GCM tag also authenticates ownership."""
    kek = _load_kek()
    nonce = os.urandom(NONCE_BYTES)
    ciphertext = AESGCM(kek).encrypt(
        nonce, plaintext.encode("utf-8"), _aad(user_id, slot)
    )
    return ciphertext, nonce, KEY_VERSION


def decrypt_secret(
    ciphertext: bytes,
    nonce: bytes,
    *,
    user_id: int,
    slot: str,
    key_version: int = KEY_VERSION,
) -> str:
    """Open a sealed secret. Raises ``InvalidTag`` on a tampered/mismatched
    record (wrong KEK, swapped row, corrupted bytes) — never returns garbage."""
    if key_version != KEY_VERSION:
        # Single version today; reject unknown ones explicitly rather than
        # attempting to decrypt with the wrong key material.
        raise InvalidTag(f"Unsupported BYOK key_version {key_version}")
    kek = _load_kek()
    plaintext = AESGCM(kek).decrypt(nonce, ciphertext, _aad(user_id, slot))
    return plaintext.decode("utf-8")
