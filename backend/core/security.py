# backend/core/security.py
"""Password hashing (argon2) and secure token generation."""

import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def generate_token() -> str:
    """Return a URL-safe random token (used for session ids / CSRF tokens)."""
    return secrets.token_urlsafe(32)
