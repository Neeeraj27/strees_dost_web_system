"""Popup validation helpers."""
from __future__ import annotations

import re

FAMILY_TAGS = ["mom", "mother", "dad", "father", "brother", "parents", "family"]
FAMILY_PREFIXES = [
    "mom:",
    "mummy:",
    "dad:",
    "papa:",
    "father:",
    "brother:",
    "bhai:",
    "parents:",
    "family:",
]


def _norm(value: str | None) -> str:
    return (value or "").strip().lower()


def _has_family(profile: dict) -> bool:
    member = _norm((profile.get("family_pressure") or {}).get("family_member"))
    return any(tag in member for tag in FAMILY_TAGS)


def _extract_names(value) -> list[str]:
    if isinstance(value, str):
        parts = re.split(r",|/|\band\b|\&", value, flags=re.IGNORECASE)
        return [part.strip() for part in parts if part and part.strip()]
    if isinstance(value, (list, tuple, set)):
        out: list[str] = []
        for item in value:
            out.extend(_extract_names(item))
        return out
    return []


def _allowed_friend_names(profile: dict) -> set[str]:
    names: set[str] = set()
    distractions = profile.get("distractions") or {}
    comparison = profile.get("social_comparison") or {}

    for token in _extract_names(distractions.get("friend_name")):
        names.add(token.lower())
    for token in _extract_names(comparison.get("comparison_person")):
        names.add(token.lower())

    names.add("friend")
    names.add("friends")
    return names


def validate_popup_message(message: str, stress_profile: dict) -> bool:
    """Validation + guardrails for chat-style popup prefixes."""
    msg = (message or "").strip()
    if not msg:
        return False

    lowered = msg.lower()
    stripped = msg.lstrip().lower()

    if any(stripped.startswith(prefix) for prefix in FAMILY_PREFIXES):
        if not _has_family(stress_profile):
            return False

    friend_match = re.match(r"\s*([a-zA-Z][a-zA-Z0-9 _\-]{1,30})\s*:", msg)
    if friend_match:
        prefix = friend_match.group(1).strip().lower()
        family_roots = {p.rstrip(":") for p in FAMILY_PREFIXES}
        if prefix not in family_roots:
            if prefix not in _allowed_friend_names(stress_profile):
                if prefix not in {"friend", "friends"}:
                    return False

    lines = [line.strip() for line in msg.split("\n") if line.strip()]
    if len(lines) >= 1:
        return True

    replaced = lowered.replace("!", ".").replace("?", ".")
    sentences = [part.strip() for part in replaced.split(".") if part.strip()]
    if len(sentences) >= 2:
        return True

    return False


__all__ = ["validate_popup_message"]
