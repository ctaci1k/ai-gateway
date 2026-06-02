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


def render_template_string(template: str, **values) -> str:
    """Render an arbitrary ``$placeholder`` template string (PH24, E2).

    Used for a per-user judge-prompt override that is stored outside the YAML
    file. Same ``safe_substitute`` semantics as :func:`render_prompt`.
    """
    return string.Template(template).safe_substitute(**values)


# Placeholders a custom judge prompt MUST keep so the judge still sees the
# question, the responses, and the allowed labels (PH24, E2). Validated on save.
JUDGE_PROMPT_REQUIRED_PLACEHOLDERS = (
    "$user_message",
    "$responses_block",
    "$allowed_models_inline",
    "$scores_example",
)


def default_judge_prompt() -> str:
    """The built-in judge prompt template shown as the editable default (E2)."""
    return get_prompt("selector_judge")
