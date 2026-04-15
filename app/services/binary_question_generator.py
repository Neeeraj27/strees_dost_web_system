"""Summary-driven binary question generation."""
from __future__ import annotations

import json
import logging
from typing import Any

from .openai_client import chat_json

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_BINARY_QUESTION = """
You write EXACTLY ONE binary A/B question for a user after their follow-up phase is complete.

Return STRICT JSON only:
{"question":"...","a":"...","b":"..."}

Rules:
- The question MUST be tightly tied to the user's exact query, conversation history, or summary.
- The question must feel specific, sharp, and uncomfortable, but not abusive.
- Keep the question under 18 words.
- Keep each option under 8 words.
- The two options must reveal a meaningful split, not synonyms.
- Prefer using the user's own wording when available.
- Do not mention the summary explicitly.
- Do not produce generic survey phrasing.
- Question must end with "?".
- Do not repeat a previous binary question.

Good pattern:
- "What is more true right now?"
- A = one concrete interpretation
- B = a more revealing interpretation
"""


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _valid_binary_question(data: dict[str, Any], previous_questions: list[str]) -> bool:
    question = _clean_text(data.get("question"))
    option_a = _clean_text(data.get("a"))
    option_b = _clean_text(data.get("b"))
    if not question or not option_a or not option_b:
        return False
    if not question.endswith("?"):
        return False
    if len(question.split()) > 18:
        return False
    if len(option_a.split()) > 8 or len(option_b.split()) > 8:
        return False
    if option_a.lower() == option_b.lower():
        return False
    if question in previous_questions:
        return False
    return True


def _keyword_fallback(raw_text: str, summary: dict[str, Any], previous_questions: list[str]) -> dict[str, str]:
    text = _clean_text(raw_text).lower()
    main_issue = _clean_text(summary.get("main_issue")).lower()
    pressure_sources = [str(v).lower() for v in (summary.get("pressure_sources") or [])]
    distraction_sources = [str(v).lower() for v in (summary.get("distraction_sources") or [])]

    candidates = [
        {
            "question": "What is more true right now?",
            "a": "This is pressure",
            "b": "This is avoidance",
        },
    ]

    if "distract" in text or "distract" in main_issue or distraction_sources:
        candidates.insert(
            0,
            {
                "question": "What steals more from you right now?",
                "a": "Easy distraction",
                "b": "Escaping pressure",
            },
        )
    if "friend" in text or "friends" in text:
        candidates.insert(
            0,
            {
                "question": "What hurts more here?",
                "a": "What they did",
                "b": "What it means",
            },
        )
    if "study" in text or "exam" in text or "assignment" in text:
        candidates.insert(
            0,
            {
                "question": "What is the real blocker?",
                "a": "The work itself",
                "b": "Facing the work",
            },
        )
    if "family" in main_issue or "family" in pressure_sources or "parent" in text or "dad" in text or "mom" in text:
        candidates.insert(
            0,
            {
                "question": "What weighs more on you?",
                "a": "Their pressure",
                "b": "Your response",
            },
        )
    if "compare" in text or "comparison" in main_issue:
        candidates.insert(
            0,
            {
                "question": "What stings more here?",
                "a": "They are ahead",
                "b": "You know why",
            },
        )

    for candidate in candidates:
        if candidate["question"] not in previous_questions:
            return candidate
    return candidates[0]


def generate_binary_question(
    raw_text: str,
    user_summary: dict[str, Any] | None = None,
    conversation_history: list[dict[str, Any]] | None = None,
    previous_questions: list[str] | None = None,
    previous_answers: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    """Generate one A/B question tied to the current user profile."""
    summary = user_summary or {}
    history = conversation_history or []
    asked = [q for q in (previous_questions or []) if isinstance(q, str)]
    binary_answers = previous_answers or []

    payload = {
        "raw_text": _clean_text(raw_text)[:1200],
        "user_summary": summary,
        "conversation_history": history[-12:],
        "previous_binary_questions": asked[-8:],
        "previous_binary_answers": binary_answers[-8:],
    }

    for attempt in (1, 2):
        try:
            resp = chat_json(
                model="gpt-4o-mini",
                system=SYSTEM_PROMPT_BINARY_QUESTION,
                user=json.dumps(payload, ensure_ascii=False),
                temperature=0.7,
                max_tokens=180,
            )
            raw = (resp.choices[0].message.content or "").strip()
            data = json.loads(raw)
            out = {
                "question": _clean_text(data.get("question")),
                "a": _clean_text(data.get("a")),
                "b": _clean_text(data.get("b")),
            }
            if _valid_binary_question(out, asked):
                return out
            logger.warning("generate_binary_question invalid attempt=%s data=%s", attempt, out)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("generate_binary_question failed attempt=%s err=%s", attempt, exc)

    return _keyword_fallback(raw_text, summary, asked)


__all__ = ["generate_binary_question"]
