"""Question generation via GPT with strict validation and fallbacks."""
from __future__ import annotations

import json
import logging

from .fallbacks import FALLBACK_QUESTIONS
from .validators import is_valid_question
from .openai_client import chat_json
from .generic_questions import get_generic_domain_question

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_QUESTION = """
You write ONE sharp, confrontational follow-up that uses the user's own words + prior answers to push them and make them uncomfortable.

Return STRICT JSON only:
{"question":"..."}

Rules:
- Single question, ends with "?" - no numbering/preamble.
- Make it feel like you read them: use student_text, clarifier_answers, filled_slots (apps, weak_subjects, family pressure, money, relationships, time, habits). Quote their phrases.
- Apply pressure: expose contradictions, urgency, and costs of their behavior. Demand specifics (numbers, names, timings, "why not already?", "who's watching you fail?"). Avoid yes/no.
- If the topic is distraction/phone/gaming/scrolling, be brutal: call out exact apps and hours wasted, ask what they avoided, who noticed, what it cost them today; shame the dodge. No soft wording.
- NEVER ask for info they already revealed; push deeper into the same thread (if they mention scrolling, ask exact hours/apps; if stress about people, ask names/words they said; if family, ask what happens when they fail).
- Ask ONLY about the requested domain+slot. If __negated__ contains the slot, do NOT ask it.
- Do not repeat last_question. No generic "tell me more," no therapy tone.
- Keep it crisp, simple English; light Hinglish is fine if it adds bite.
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
            return question

        logger.warning("Invalid question (attempt %s): %s", attempt, question)

    return fallback


__all__ = ["generate_question", "get_generic_domain_question"]


def generate_initial_clarifiers(initial_text: str) -> list[str]:
    """Generate up to 3 sharp, adversarial clarifier questions from the initial vent."""
    text = (initial_text or "").strip()
    logger.debug("generate_initial_clarifiers: len=%s", len(text))
    if not text:
        return []

    system = """
You write up to 3 ultra-specific clarifier questions for a stressed JEE/NEET student based ONLY on their initial vent.

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
                    if q_clean.endswith("?") and len(q_clean) <= 140:
                        out.append(q_clean)
                if len(out) >= 3:
                    break
        if out:
            return out
    except Exception:  # pragma: no cover
        out = []

    # Lightweight fallback when the LLM fails
    lowered = text.lower()
    fallback: list[str] = []
    if any(word in lowered for word in ["reel", "shorts", "scroll", "phone", "instagram", "youtube"]):
        fallback.append("How many hours do you lose daily on reels/shorts, and at what time?")
    if any(word in lowered for word in ["exam", "test", "paper", "mock"]):
        fallback.append("How many days are left for your next big exam, and what's the scariest section?")
    if any(word in lowered for word in ["math", "physics", "chemistry", "bio"]):
        fallback.append("Which topic in that subject is currently killing your confidence?")
    if any(word in lowered for word in ["friend", "topper", "compare", "rank"]):
        fallback.append("Who are you comparing yourself to, and what's the gap that's bothering you?")
    if any(word in lowered for word in ["mom", "dad", "parents", "family"]):
        fallback.append("What exactly did your family say last about your studies, and how did it hit you?")
    if not fallback:
        fallback = [
            "What's the single thing draining you the most right now?",
            "If you had one hour today, where would you actually put it?",
        ]
    return fallback[:3]

