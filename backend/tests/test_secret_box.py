# backend/tests/test_secret_box.py
"""AES-256-GCM envelope round-trip + tamper detection (PH30, D-20).

The KEK is injected via conftest (BYOK_ENCRYPTION_KEY). These tests assert the
secret survives a round-trip and that any change to the binding (AAD = user+slot)
or the bytes fails the GCM tag — a swapped DB row can't be silently reused.
"""

import pytest
from cryptography.exceptions import InvalidTag

from core import secret_box


def test_round_trip_returns_original_plaintext():
    secret = "sk-super-secret-key-value"
    ciphertext, nonce, version = secret_box.encrypt_secret(
        secret, user_id=7, slot="groq"
    )
    assert version == secret_box.KEY_VERSION
    assert ciphertext != secret.encode()
    assert len(nonce) == secret_box.NONCE_BYTES

    out = secret_box.decrypt_secret(
        ciphertext, nonce, user_id=7, slot="groq", key_version=version
    )
    assert out == secret


def test_nonce_is_random_per_call():
    a = secret_box.encrypt_secret("x", user_id=1, slot="groq")
    b = secret_box.encrypt_secret("x", user_id=1, slot="groq")
    # Same plaintext, different nonce → different ciphertext (no ECB-style leak).
    assert a[1] != b[1]
    assert a[0] != b[0]


def test_wrong_user_id_fails_authentication():
    ciphertext, nonce, version = secret_box.encrypt_secret(
        "secret", user_id=7, slot="groq"
    )
    with pytest.raises(InvalidTag):
        secret_box.decrypt_secret(
            ciphertext, nonce, user_id=8, slot="groq", key_version=version
        )


def test_wrong_slot_fails_authentication():
    ciphertext, nonce, version = secret_box.encrypt_secret(
        "secret", user_id=7, slot="groq"
    )
    with pytest.raises(InvalidTag):
        secret_box.decrypt_secret(
            ciphertext, nonce, user_id=7, slot="mistral", key_version=version
        )


def test_tampered_ciphertext_fails():
    ciphertext, nonce, version = secret_box.encrypt_secret(
        "secret", user_id=7, slot="groq"
    )
    tampered = bytes([ciphertext[0] ^ 0x01]) + ciphertext[1:]
    with pytest.raises(InvalidTag):
        secret_box.decrypt_secret(
            tampered, nonce, user_id=7, slot="groq", key_version=version
        )


def test_unknown_key_version_rejected():
    ciphertext, nonce, _ = secret_box.encrypt_secret("secret", user_id=7, slot="groq")
    with pytest.raises(InvalidTag):
        secret_box.decrypt_secret(
            ciphertext, nonce, user_id=7, slot="groq", key_version=999
        )


def test_missing_kek_raises_disabled(monkeypatch):
    from core.config import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("BYOK_ENCRYPTION_KEY", "")
    try:
        assert secret_box.is_encryption_configured() is False
        with pytest.raises(secret_box.ByokEncryptionDisabledError):
            secret_box.encrypt_secret("x", user_id=1, slot="groq")
    finally:
        get_settings.cache_clear()
