"""Summary-driven binary question generation."""
from __future__ import annotations

import json
import logging
import re
from typing import Any

from .openai_client import chat_json

logger = logging.getLogger(__name__)


SYSTEM_PROMPT_BINARY_QUESTION = """
You write EXACTLY ONE binary A/B question for a user after their follow-up phase is complete.

Return STRICT JSON only:
{"question":"...","a":"...","b":"..."}

Rules:
- The question MUST be tightly tied to the user's exact query, conversation history, or summary.
- You MUST reuse at least one concrete anchor from the user's world:
  - an exact user word or phrase from the raw query
  - a key object from the summary
  - a pressure/distraction source from the summary
- If the raw query contains a strong phrase like "my friends", "studying physics", "my dad", "this exam",
  you should reuse that exact phrase in the question or an option.
- The question must feel specific, sharp, and uncomfortable, but not abusive.
- Keep the question under 18 words.
- Keep each option under 8 words.
- The two options must reveal a meaningful split, not synonyms.
- Prefer using the user's own wording when available.
- At least one option should also carry a user anchor when possible.
- Do not mention the summary explicitly.
- Do not produce generic survey phrasing.
- Question must end with "?".
- Do not repeat a previous binary question.

Good pattern:
- "What is more true right now?"
- A = one concrete interpretation
- B = a more revealing interpretation

Bad pattern:
- "What hurts more here?" with no user anchor
- "What is more true right now?" with no object, person, task, or pressure source
"""


def _clean_text(value: Any) -> str:
    return " ".join(str(value or "").strip().split())


def _extract_query_fragments(raw_text: str) -> list[str]:
    text = _clean_text(raw_text)
    lowered = text.lower()
    patterns = [
        r"\bmy\s+[a-z]{3,}(?:\s+[a-z]{3,})?",
        r"\bthe\s+[a-z]{4,}(?:\s+[a-z]{4,})?",
        r"\b[a-z]{4,}\s+(?:exam|studies|study|physics|chemistry|math|maths|assignment|assignments|friends|family)\b",
    ]
    seen: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, lowered):
            frag = _clean_text(match)
            if frag and frag not in seen:
                seen.append(frag)
    if len(text.split()) >= 2:
        words = [w.strip("'\"()[]{}!?.,").lower() for w in text.split()]
        for idx in range(len(words) - 1):
            pair = f"{words[idx]} {words[idx + 1]}".strip()
            if all(len(part) >= 3 for part in pair.split()) and pair not in seen:
                seen.append(pair)
            if len(seen) >= 8:
                break
    return seen[:8]


def _anchor_terms(raw_text: str, summary: dict[str, Any]) -> list[str]:
    terms: list[str] = []
    for chunk in [
        raw_text,
        summary.get("main_issue"),
        summary.get("what_bothers_them_most"),
        *(summary.get("key_objects") or []),
        *(summary.get("pressure_sources") or []),
        *(summary.get("distraction_sources") or []),
    ]:
        text = _clean_text(chunk).lower()
        if not text:
            continue
        for token in text.replace(",", " ").replace(".", " ").split():
            token = token.strip("'\"()[]{}!?")
            if len(token) < 4:
                continue
            if token not in terms:
                terms.append(token)
    return terms[:12]


def _primary_anchor(raw_text: str, summary: dict[str, Any]) -> str:
    key_objects = [str(v).strip() for v in (summary.get("key_objects") or []) if str(v).strip()]
    if key_objects:
        return key_objects[0]
    for source in (summary.get("distraction_sources") or []):
        text = str(source).strip()
        if text:
            return text
    for source in (summary.get("pressure_sources") or []):
        text = str(source).strip()
        if text:
            return text
    raw = _clean_text(raw_text)
    for token in raw.split():
        token = token.strip("'\"()[]{}!?.,")
        if len(token) >= 4:
            return token
    return "this"


def _valid_binary_question(
    data: dict[str, Any],
    previous_questions: list[str],
    anchors: list[str],
    fragments: list[str],
) -> bool:
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
    merged = f"{question} {option_a} {option_b}".lower()
    if anchors and not any(anchor in merged for anchor in anchors):
        return False
    if fragments and not any(fragment in merged for fragment in fragments[:4]):
        return False
    return True


def _keyword_fallback(raw_text: str, summary: dict[str, Any], previous_questions: list[str]) -> dict[str, str]:
    text = _clean_text(raw_text).lower()
    main_issue = _clean_text(summary.get("main_issue")).lower()
    pressure_sources = [str(v).lower() for v in (summary.get("pressure_sources") or [])]
    distraction_sources = [str(v).lower() for v in (summary.get("distraction_sources") or [])]
    anchor_object = _primary_anchor(raw_text, summary)
    anchor_lower = anchor_object.lower()
    fragments = _extract_query_fragments(raw_text)
    fragment = fragments[0] if fragments else anchor_lower

    candidates = [
        {
            "question": f"What is really shaping {fragment} now?",
            "a": f"{anchor_object} feels heavier",
            "b": f"{anchor_object} feels personal",
        },
    ]

    if "distract" in text or "distract" in main_issue or distraction_sources:
        candidates.insert(
            0,
            {
                "question": f"What pulls you off {fragment} first?",
                "a": f"Leaving {anchor_object}",
                "b": f"Avoiding {anchor_object}",
            },
        )
    if "friend" in text or "friends" in text:
        candidates.insert(
            0,
            {
                "question": f"In {fragment}, what cuts deeper?",
                "a": "What friends did",
                "b": "What friends exposed",
            },
        )
    if "hate" in text:
        hate_target = fragment if "hate" not in fragment else anchor_object
        candidates.insert(
            0,
            {
                "question": f"When you said hate {hate_target}, what was bigger?",
                "a": f"What {anchor_object} did",
                "b": f"What {anchor_object} triggered",
            },
        )
    if "study" in text or "exam" in text or "assignment" in text:
        candidates.insert(
            0,
            {
                "question": f"What breaks first around {fragment}?",
                "a": f"Starting {anchor_object}",
                "b": f"Facing {anchor_object}",
            },
        )
    if "family" in main_issue or "family" in pressure_sources or "parent" in text or "dad" in text or "mom" in text:
        candidates.insert(
            0,
            {
                "question": f"In {fragment}, what lands harder?",
                "a": "Family voice lands",
                "b": "Family pressure stays",
            },
        )
    if "compare" in text or "comparison" in main_issue:
        candidates.insert(
            0,
            {
                "question": f"In {fragment}, what hurts more?",
                "a": f"{anchor_object} proves gap",
                "b": f"{anchor_object} proves doubt",
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
    anchors = _anchor_terms(raw_text, summary)
    fragments = _extract_query_fragments(raw_text)

    payload = {
        "raw_text": _clean_text(raw_text)[:1200],
        "user_summary": summary,
        "conversation_history": history[-12:],
        "anchor_terms": anchors,
        "query_fragments": fragments,
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
            if _valid_binary_question(out, asked, anchors, fragments):
                return out
            logger.warning("generate_binary_question invalid attempt=%s data=%s", attempt, out)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("generate_binary_question failed attempt=%s err=%s", attempt, exc)

    return _keyword_fallback(raw_text, summary, asked)


__all__ = ["generate_binary_question"]
