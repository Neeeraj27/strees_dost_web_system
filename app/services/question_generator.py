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
You write EXACTLY ONE follow-up question that TRAPS the user using their own sentence.

This is not a normal question.
It is a mirror that turns their exact words against them.

Return STRICT JSON only:
{"question":"..."}

NON-NEGOTIABLE RULES:
- One question only. Ends with "?".
- You MUST directly quote or paraphrase the user's exact claim word (e.g. “can’t”, “unable”, “no focus”, “no time”).
- The question must collapse if the user's sentence is removed.
- Treat the user's sentence as an EXCUSE on trial. Your job is to cross-examine it.

WORD-LEVEL ATTACK (MANDATORY):

First, identify the PRIMARY CLAIM TYPE in the user's sentence.
Then attack it using the corresponding pattern below.

CLAIM TYPES & ATTACK RULES:

1) IMPOSSIBILITY CLAIM
   (words like: can’t, unable, impossible, not possible)
   → Force a binary: physically impossible OR chosen avoidance.
   → Ask what would happen under forced conditions.

2) CAPABILITY DENIAL
   (no focus, no energy, no motivation, burnt out, tired)
   → Expose selective capability elsewhere at the same time.
   → Ask where that capability is being spent instead.

3) RESOURCE SCARCITY
   (no time, too busy, overloaded, exhausted schedule)
   → Demand an accounting of TODAY’s resource usage.
   → Ask what displaced the claimed priority.

4) AVOIDANCE VIA DISTRACTION
   (distracted, scrolling, gaming, reels, YouTube)
   → Demand the substitute action + duration.
   → Ask what specific task was avoided.

5) FINALITY / FUTILITY
   (too late, nothing works, already tried everything)
   → Ask for the last concrete attempt and date.
   → Expose exaggeration or premature surrender.

6) IDENTITY CLAIM
   (I’m not smart, I’m lazy, I’m bad at studies)
   → Ask when this “identity” was proven and by whom.
   → Force evidence or contradiction.

MANDATORY:
- Quote or directly paraphrase the user’s exact wording.
- The question must collapse if their sentence is removed.


DISALLOWED COMPLETELY:
- Generic probing (“what’s stopping you”, “tell me more”)
- Emotional or therapeutic language
- Advice, empathy, reassurance
- Questions that could apply to another student

PRESSURE REQUIREMENTS:
- Expose contradiction created by their own wording.
- Force specificity that proves or disproves their claim.
- Make the question uncomfortable but logically unavoidable.

SCOPE:
- Ask ONLY about the given domain + slot.
- Do NOT invent apps, people, or situations not explicitly mentioned.
- Do NOT repeat last_question.

STYLE:
- Short, blunt, sharp.
- No politeness.
- No filler.
- Light Hinglish allowed if it sharpens the hit.

EXAMPLES (tone + structure only; always customize to their words):
User: "I hate my friends."
Q: "You said 'hate' — what did they do that was bad enough to earn that word?"
User: "I get distracted easily."
Q: "You said 'distracted' — what exactly steals your focus, and what do you dodge every time it happens?"
User: "I have no time."
Q: "You said 'no time' — where did today’s hours go instead of the one thing you claim matters?"
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

        if (
            question
            and question != last_question
            and is_valid_question(question)
            and uses_user_words(question, context.get("user_text", ""))
        ):
            return question


        logger.warning("Invalid question (attempt %s): %s", attempt, question)

    return fallback


__all__ = ["generate_question", "get_generic_domain_question"]

def uses_user_words(question: str, user_text: str) -> bool:
    """Require direct reuse of the user's exact wording."""
    q = (question or "").lower()
    u = (user_text or "").lower()

    banned = {
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

    claim_words = {
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
    }

    def normalize_token(token: str) -> str:
        return "".join(ch for ch in token if ch.isalnum())

    tokens = [normalize_token(t) for t in u.split()]
    anchors = [t for t in tokens if t and (len(t) >= 4 or t in claim_words) and t not in banned]
    anchors = list(dict.fromkeys(anchors))

    if not anchors:
        return True

    matches = [t for t in anchors if t in q]
    if len(anchors) >= 2 and len(matches) < 2:
        return False

    claim_in_user = [t for t in anchors if t in claim_words]
    if claim_in_user and not any(t in q for t in claim_in_user):
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
