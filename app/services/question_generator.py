"""Question generation via GPT with strict validation and fallbacks."""
from __future__ import annotations

import json
import logging

from .fallbacks import FALLBACK_QUESTIONS
from .validators import is_valid_question
from .openai_client import chat_json
from .generic_questions import get_generic_domain_question

logger = logging.getLogger(__name__)

_CLAIM_WORDS = [
    "hate",
    "cant",
    "can't",
    "unable",
    "impossible",
    "no",
    "never",
    "always",
    "distracted",
    "scrolling",
    "gaming",
    "reels",
    "youtube",
    "tired",
    "burnout",
    "burnt",
    "lazy",
    "dumb",
    "stupid",
    "bad",
    "pressure",
    "anxious",
    "anxiety",
    "panic",
    "scared",
    "fear",
    "stress",
    "stressed",
    "alone",
    "lonely",
    "overwhelmed",
    "busy",
    "avoid",
    "avoidance",
]

_SOFT_BANNED = {
    "how",
    "what",
    "when",
    "where",
    "why",
    "many",
    "much",
    "often",
    "time",
    "hours",
    "do",
    "you",
    "your",
    "feel",
    "this",
    "that",
    "there",
    "here",
    "them",
    "they",
    "with",
    "from",
    "have",
    "has",
    "had",
}


def _normalize_token(token: str) -> str:
    return "".join(ch for ch in token if ch.isalnum())


def _extract_user_tokens(user_text: str) -> list[str]:
    tokens = [_normalize_token(t) for t in (user_text or "").lower().split()]
    anchors = [
        t for t in tokens if t and (len(t) >= 4 or t in _CLAIM_WORDS) and t not in _SOFT_BANNED
    ]
    return list(dict.fromkeys(anchors))


def _extract_claim_words(user_text: str) -> list[str]:
    tokens = [_normalize_token(t) for t in (user_text or "").lower().split()]
    claims = [t for t in tokens if t in _CLAIM_WORDS]
    return list(dict.fromkeys(claims))


def question_matches_user_text(question: str, user_text: str) -> bool:
    if not uses_user_words(question, user_text):
        return False
    claim_words = _extract_claim_words(user_text)
    if claim_words and not any(word in (question or "").lower() for word in claim_words):
        return False
    return True


def _force_brutal_fallback(user_text: str) -> str | None:
    anchors = _extract_user_tokens(user_text)
    claims = _extract_claim_words(user_text)
    if claims:
        word = claims[0]
        return f"You said '{word}' - what happened that justified that word?"
    if anchors:
        word = anchors[0]
        return f"You said '{word}' - what did you avoid because of it?"
    return None


def _brutal_clarifier_fallbacks(user_text: str, limit: int = 3) -> list[str]:
    anchors = _extract_user_tokens(user_text)
    claims = _extract_claim_words(user_text)
    word = (claims[0] if claims else (anchors[0] if anchors else "")).strip()
    if not word:
        return []
    candidates = [
        f"You said '{word}' - what exactly triggered that word?",
        f"Name who '{word}' is aimed at and what they did.",
        f"What did '{word}' let you avoid today?",
    ]
    return candidates[:limit]
SYSTEM_PROMPT_QUESTION = """
You generate ONE psychologically aggressive follow-up question.

This is NOT clarification.
This is NOT therapy.
This is NOT neutral.

Your job is to turn the user's statement INTO A PERSONAL ACCUSATION.

ASSUME the user is:
- Avoiding responsibility
- Projecting blame
- Protecting ego
- Hiding insecurity

Ask ONE question that:
- Attacks their motive, not their wording
- Suggests an uncomfortable interpretation
- Forces self-doubt
- Sounds like it knows them too well

RULES:
- One question only.
- Ends with '?'.
- No quoting like “you said”.
- No empathy.
- No advice.
- No soft language.
- No “what happened” or “can you explain”.

STYLE:
- Cold
- Slightly hostile
- Psychologically invasive
- Like an elite coach or manipulator

GOOD EXAMPLES (STYLE ONLY):
- “Are you angry at them, or at who you become around them?”
- “Is this frustration really about them, or about your lack of progress?”
- “Do you push people away before they can see through you?”

BAD:
- “What did they do?”
- “Why do you feel this way?”
- “Can you clarify?”

Return STRICT JSON:
{"question":"..."}
"""



def generate_question(
    domain: str,
    slot: str,
    excerpt: str | None = None,
    context: dict | None = None,
) -> str | None:
    """Generate a slot-specific question with validation and fallback."""
    logger.debug("generate_question: domain=%s slot=%s", domain, slot)
    context = context or {}
    stress_profile = context.get("filled_slots") or {}
    negated_slots = []
    if isinstance(stress_profile.get("__negated__"), list):
        negated_slots = [slot for slot in stress_profile["__negated__"] if isinstance(slot, str)]
    meta = context.get("meta") or {}
    last_question = (meta.get("last_question") or "").strip()
    clarifiers = meta.get("clarifier_answers") or []

    fallback = (FALLBACK_QUESTIONS.get(domain, {}) or {}).get(slot)
    if not fallback:
        fallback = "Can you share one quick detail about this?"

    payload = {
        "domain": domain,
        "slot": slot,
        "student_text": (context.get("user_text") or "")[:1200],
        "filled_slots": stress_profile,
        "negated_slots": negated_slots,
        "excerpt": excerpt or "",
        "last_question": last_question,
        "clarifier_answers": clarifiers,
    }

    for attempt in (1, 2):
        question = ""
        try:
            resp = chat_json(
                model="gpt-4o-mini",
                system=SYSTEM_PROMPT_QUESTION,
                user=json.dumps(payload, ensure_ascii=False),
            )
            raw = (resp.choices[0].message.content or "").strip()
            data = json.loads(raw)
            question = " ".join((data.get("question") or "").strip().split())
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("QUESTION_LLM_FAIL attempt=%s err=%s", attempt, exc)
            question = ""

        if question and question != last_question and is_valid_question(question):
            user_text = context.get("user_text", "")
            if not question_matches_user_text(question, user_text):
                logger.warning("Question missing user wording: %s", question)
                continue
            return question


        logger.warning("Invalid question (attempt %s): %s", attempt, question)

    forced = _force_brutal_fallback(context.get("user_text", ""))
    if forced and is_valid_question(forced):
        return forced

    return fallback


__all__ = ["generate_question", "get_generic_domain_question"]

def uses_user_words(question: str, user_text: str) -> bool:
    """Require direct reuse of the user's exact wording."""
    q = (question or "").lower()
    anchors = _extract_user_tokens(user_text)

    if not anchors:
        return True

    matches = [t for t in anchors if t in q]
    if len(anchors) >= 2 and len(matches) < 2:
        return False

    return True


def generate_initial_clarifiers(initial_text: str) -> list[str]:
    """Generate up to 3 sharp, adversarial clarifier questions from the initial vent."""
    text = (initial_text or "").strip()
    logger.debug("generate_initial_clarifiers: len=%s", len(text))
    if not text:
        return []

    system = """
You write up to 3 ultra-specific clarifier questions based ONLY on their initial vent.

Return STRICT JSON:
{"questions":["...","...","..."]}

Rules:
- Use their own context (apps, time left, people, subjects, habits) so it feels personal.
- Keep each question <= 120 chars, ends with "?".
- No therapy tone, no generic "tell me more".
- Be probing and a bit confrontational; expose weak spots to pull details out.
- Avoid yes/no. Ask for numbers, names, times, and specifics.
"""
    payload = {"initial_text": text[:1200]}
    try:
        resp = chat_json(
            model="gpt-4o-mini",
            system=system,
            user=json.dumps(payload, ensure_ascii=False),
            max_tokens=240,
            temperature=0.6,
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw)
        questions = data.get("questions") if isinstance(data, dict) else None
        out: list[str] = []
        if isinstance(questions, list):
            for q in questions:
                if isinstance(q, str):
                    q_clean = " ".join(q.strip().split())
                    if (
                        q_clean.endswith("?")
                        and len(q_clean) <= 140
                        and question_matches_user_text(q_clean, text)
                    ):
                        out.append(q_clean)
                if len(out) >= 3:
                    break
        if out:
            return out
    except Exception:  # pragma: no cover
        out = []

    fallback = _brutal_clarifier_fallbacks(text, limit=3)
    if fallback:
        return fallback[:3]

    return []
