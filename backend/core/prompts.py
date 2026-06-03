# backend/core/prompts.py
"""Versioned prompt loading and rendering.

Prompts live in ``prompts/prompts.yaml`` (externalized from code). Templates use
``$name`` placeholders (``string.Template``) so literal ``{...}`` JSON examples
in a prompt need no escaping. Use ``$$`` for a literal ``$``.
"""

import string
from functools import lru_cache
from pathlib import Path

import yaml

PROMPTS_PATH = Path(__file__).resolve().parent.parent / "prompts" / "prompts.yaml"


class PromptError(RuntimeError):
    pass


@lru_cache
def _load() -> dict:
    if not PROMPTS_PATH.exists():
        raise PromptError(f"Prompts file not found: {PROMPTS_PATH}")

    with open(PROMPTS_PATH, encoding="utf-8") as handle:
        data = yaml.safe_load(handle)

    if not isinstance(data, dict):
        raise PromptError("prompts.yaml must be a mapping")
    if "version" not in data:
        raise PromptError("prompts.yaml is missing the 'version' field")
    if not isinstance(data.get("prompts"), dict):
        raise PromptError("prompts.yaml must contain a 'prompts' mapping")

    return data


def prompt_version() -> int:
    """Return the prompt-set version."""
    return _load()["version"]


def get_prompt(name: str) -> str:
    """Return the raw template string for ``name``."""
    prompts = _load()["prompts"]
    if name not in prompts:
        raise PromptError(f"Unknown prompt: {name!r}")

    entry = prompts[name]
    template = entry.get("template") if isinstance(entry, dict) else entry
    if not isinstance(template, str):
        raise PromptError(f"Prompt {name!r} has no template string")

    return template


def render_prompt(name: str, **values) -> str:
    """Render ``name`` substituting ``$placeholders`` from ``values``.

    Uses ``safe_substitute`` so an unfilled placeholder is left intact rather
    than raising.
    """
    return string.Template(get_prompt(name)).safe_substitute(**values)


# Supported UI locales → human language name used as the response-language
# FALLBACK when the user's message language is ambiguous (PH33/B3b, D-23). The
# model detects the message language itself; this is only the tiebreaker.
_LOCALE_LANGUAGE = {
    "uk": "Ukrainian",
    "pl": "Polish",
    "en": "English",
}
_DEFAULT_LANGUAGE = "English"


def language_directive(locale: str | None) -> str:
    """A short instruction telling a responder to answer in the language of the
    user's message, falling back to the UI ``locale`` (PH33/B3b).

    Prepended to the responder's message (responders only — the judge and
    embeddings are untouched). Unknown/None locales fall back to English.
    """
    name = _LOCALE_LANGUAGE.get((locale or "").strip().lower(), _DEFAULT_LANGUAGE)
    return render_prompt("responder_language", fallback_language=name)


def with_language_directive(message: str, locale: str | None) -> str:
    """Prepend the response-language directive to a responder message (PH33/B3b)."""
    return f"{language_directive(locale)}\n\n{message}"


def render_template_string(template: str, **values) -> str:
    """Render an arbitrary ``$placeholder`` template string (PH24, E2).

    Used for a per-user judge-prompt override that is stored outside the YAML
    file. Same ``safe_substitute`` semantics as :func:`render_prompt`.
    """
    return string.Template(template).safe_substitute(**values)


# Placeholders a custom judge prompt MUST keep so the judge still sees the
# question, the responses, and the allowed labels (PH24, E2). Validated on save.
def default_judge_prompt() -> str:
    """The built-in, user-editable **judging criteria** shown as the default.

    Only the criteria are editable (the user's judging philosophy / what to weigh).
    The mechanical scaffold — role lock, selection rules and the JSON/0-100 output
    contract — lives in the fixed ``selector_judge`` template and is never exposed
    or overridable, so a user can't break parsing or the scoring scale.
    """
    return get_prompt("selector_judge_criteria")
