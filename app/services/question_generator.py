"""Question generation via GPT - Counter-questioning approach.

Generates questions that CHALLENGE and COUNTER the user's statements,
forcing them to reconsider their position and dig deeper.
"""
from __future__ import annotations

import json
import logging

from .fallbacks import FALLBACK_QUESTIONS
from .validators import is_valid_question
from .openai_client import chat_json
from .generic_questions import get_generic_domain_question

logger = logging.getLogger(__name__)


# ============================================================================
# SYSTEM PROMPT - COUNTER-QUESTIONING APPROACH
# ============================================================================

SYSTEM_PROMPT_QUESTION = """
You generate follow-up questions that CHALLENGE and COUNTER the user's statement.

Your job is NOT to clarify or probe for details.
Your job is to make the user DEFEND or RECONSIDER their own words.

APPROACH:
1. Find the CONTRADICTION in their statement
2. Find what they're AVOIDING admitting
3. Suggest an ALTERNATIVE interpretation they haven't considered
4. Point out what their words REVEAL about them

QUESTION TYPES TO USE:
- "If X, then why Y?" (expose contradiction)
- "Is it possible that [opposite interpretation]?" (challenge premise)
- "What would it mean if [their statement] wasn't actually true?" (force reflection)
- "Are you sure it's [their word] and not [softer/different word]?" (challenge word choice)
- "What's stopping you from [logical action based on their claim]?" (expose inaction)

RULES:
- Generate exactly 3 questions
- Each question must COUNTER or CHALLENGE the statement
- Questions should make them uncomfortable defending their position
- No empathy, no validation, no "I understand"
- No "what happened" or "tell me more" style questions
- Each question ends with "?"
- Each question is 15-30 words max

GOOD EXAMPLES:
User: "I hate my friends"
→ "If you truly hated them, why do you still call them 'friends' instead of just 'people you know'?"
→ "Can you name one moment they helped you - and if so, does that fit with 'hate'?"
→ "Is it possible you're hurt by something specific, and 'hate' is just the easiest word?"

User: "I can't focus on studies"
→ "If you truly couldn't focus, how did you manage to write this message so clearly?"
→ "Is 'can't focus' actually true, or do you just not want to focus on things that bore you?"
→ "What would change if you admitted you're choosing distraction over discipline?"

User: "My parents don't understand me"
→ "Have you explained yourself in words they'd actually understand, or just in your own way?"
→ "Is it that they don't understand, or that they understand but disagree?"
→ "What would it mean if they understood perfectly but still expected more from you?"

User: "I'm stressed about exams"
→ "If you removed the exam tomorrow, would the stress disappear or find something else?"
→ "Is the stress about the exam itself, or about what failing would say about you?"
→ "What's the worst realistic outcome - and have you actually prepared for it?"

BAD EXAMPLES (don't do these):
- "What exactly is stressing you?" (just probing)
- "You said 'hate' - what triggered that?" (just clarifying)
- "Tell me more about your friends" (generic)
- "How does that make you feel?" (therapy-speak)

Return STRICT JSON:
{"questions": ["question1", "question2", "question3"]}
"""


SYSTEM_PROMPT_SLOT_QUESTION = """
You generate ONE question that CHALLENGES the user's situation while extracting specific info.

Context: We need to know about "{slot}" in the "{domain}" area.
But instead of asking directly, CHALLENGE their current mindset.

APPROACH:
- Frame the question to make them DEFEND their choices
- Expose the contradiction between what they say and what they do
- Make them uncomfortable with their own answer

RULES:
- One question only
- Must naturally lead to revealing {slot} info
- Must challenge, not just ask
- 15-25 words max
- Ends with "?"

EXAMPLE for gaming_app slot:
Instead of: "Which game do you play most?"
Ask: "Which game steals your time even when you promise yourself 'just 5 minutes'?"

EXAMPLE for weak_subject slot:
Instead of: "Which subject troubles you most?"
Ask: "Which subject do you keep avoiding even though you know ignoring it makes things worse?"

EXAMPLE for friend_name slot:
Instead of: "Which friend distracts you most?"
Ask: "Which friend do you blame for wasted time when deep down you know you'd waste it anyway?"

Return STRICT JSON:
{"question": "your challenging question here"}
"""


# ============================================================================
# MAIN GENERATION FUNCTIONS
# ============================================================================

def generate_counter_questions(user_text: str, num_questions: int = 3) -> list[str]:
    """Generate questions that challenge and counter the user's statement."""
    text = (user_text or "").strip()
    if not text:
        return []

    logger.debug("generate_counter_questions: text=%s", text[:100])

    payload = {"user_statement": text[:1500]}

    try:
        resp = chat_json(
            model="gpt-4o-mini",
            system=SYSTEM_PROMPT_QUESTION,
            user=json.dumps(payload, ensure_ascii=False),
            max_tokens=400,
            temperature=0.7,
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw)
        questions = data.get("questions", [])

        valid_questions = []
        for q in questions:
            if isinstance(q, str):
                q_clean = " ".join(q.strip().split())
                if q_clean.endswith("?") and 10 <= len(q_clean) <= 200:
                    valid_questions.append(q_clean)

        if valid_questions:
            return valid_questions[:num_questions]

    except Exception as exc:
        logger.warning("Counter-question generation failed: %s", exc)

    # Fallback to rule-based counter-questions
    return _generate_fallback_counter_questions(text)[:num_questions]


def _generate_fallback_counter_questions(user_text: str) -> list[str]:
    """Rule-based fallback for counter-questions."""
    text = user_text.lower()
    questions = []

    # Detect patterns and generate appropriate counter-questions
    if any(word in text for word in ["hate", "can't stand", "despise"]):
        target = _extract_target(user_text)
        questions.extend([
            f"If you truly hated {target}, why haven't you cut them off completely?",
            f"Can you think of even one good moment with {target} - does that fit with 'hate'?",
            f"Is it actual hate, or disappointment that {target} didn't meet your expectations?",
        ])

    elif any(word in text for word in ["can't", "cannot", "unable", "impossible"]):
        questions.extend([
            "Is it truly 'can't', or is it 'won't' because it's uncomfortable?",
            "What would change if you admitted you're choosing not to, rather than unable to?",
            "If someone offered you ₹10 lakh to do it, would 'can't' suddenly become 'can'?",
        ])

    elif any(word in text for word in ["stressed", "stress", "anxious", "anxiety"]):
        questions.extend([
            "If the thing stressing you disappeared tomorrow, would you feel peace or just find something new to stress about?",
            "Is the stress about the situation, or about what failure would say about you?",
            "What's the actual worst-case scenario - and have you prepared for it at all?",
        ])

    elif any(word in text for word in ["distracted", "focus", "concentrate"]):
        questions.extend([
            "Do you lose focus on everything, or just on things you find boring?",
            "If your favorite game required the same focus as studying, would you still have this problem?",
            "Is it a focus problem, or a motivation problem you're calling 'focus'?",
        ])

    elif any(word in text for word in ["lazy", "procrastinat"]):
        questions.extend([
            "Are you lazy about everything, or just things that don't excite you?",
            "What would it mean if 'lazy' was actually 'scared of not being good enough'?",
            "If laziness is the problem, why do you have energy for things you enjoy?",
        ])

    elif any(word in text for word in ["don't understand", "doesn't understand", "no one understands"]):
        questions.extend([
            "Have you explained yourself in their language, or just expected them to decode yours?",
            "Is it that they don't understand, or that they understand but disagree?",
            "What if they understand perfectly but just don't give you the response you want?",
        ])

    elif any(word in text for word in ["pressure", "expect", "expectation"]):
        questions.extend([
            "Is the pressure from them, or from your own fear of disappointing them?",
            "If they expected nothing from you, would that feel like freedom or abandonment?",
            "What would happen if you just... didn't meet their expectations?",
        ])

    elif any(word in text for word in ["fail", "failing", "failure"]):
        questions.extend([
            "Is failing the actual fear, or is it what people will think of you after?",
            "If no one ever found out about the failure, would it still hurt as much?",
            "What's one thing you've failed at before that turned out fine eventually?",
        ])

    elif any(word in text for word in ["friend", "friends"]):
        questions.extend([
            "Are they actually bad friends, or just not the friends you wish they were?",
            "What would you lose if you stopped being their friend tomorrow?",
            "Is the problem them, or that you keep choosing the same type of people?",
        ])

    # Generic fallback
    if not questions:
        questions = [
            "What would it mean if the opposite of what you just said was actually true?",
            "Are you describing the situation accurately, or how it feels in this moment?",
            "What are you avoiding admitting to yourself right now?",
        ]

    return questions


def _extract_target(text: str) -> str:
    """Extract the target of emotion from text (friends, parents, etc.)."""
    text_lower = text.lower()
    if "friend" in text_lower:
        return "them"
    if "parent" in text_lower or "mom" in text_lower or "dad" in text_lower:
        return "them"
    if "teacher" in text_lower:
        return "them"
    if "myself" in text_lower or "i " in text_lower:
        return "yourself"
    return "them"


def generate_question(
    domain: str,
    slot: str,
    excerpt: str | None = None,
    context: dict | None = None,
) -> str | None:
    """Generate a slot-specific question using counter-questioning approach."""
    logger.debug("generate_question: domain=%s slot=%s", domain, slot)
    context = context or {}
    meta = context.get("meta") or {}
    last_question = (meta.get("last_question") or "").strip()
    user_text = context.get("user_text") or ""

    # Build prompt for slot-specific counter-question
    system = SYSTEM_PROMPT_SLOT_QUESTION.format(domain=domain, slot=slot)

    payload = {
        "user_statement": user_text[:1200],
        "domain": domain,
        "slot": slot,
        "context": excerpt or "",
    }

    for attempt in (1, 2):
        try:
            resp = chat_json(
                model="gpt-4o-mini",
                system=system,
                user=json.dumps(payload, ensure_ascii=False),
                max_tokens=150,
                temperature=0.7,
            )
            raw = (resp.choices[0].message.content or "").strip()
            data = json.loads(raw)
            question = " ".join((data.get("question") or "").strip().split())

            if question and question != last_question and is_valid_question(question):
                return question

        except Exception as exc:
            logger.warning("QUESTION_LLM_FAIL attempt=%s err=%s", attempt, exc)

    # Fallback to domain/slot specific
    fallback = (FALLBACK_QUESTIONS.get(domain, {}) or {}).get(slot)
    if fallback:
        return _make_challenging(fallback, domain, slot)

    return "What are you avoiding by not answering this directly?"


def _make_challenging(question: str, domain: str, slot: str) -> str:
    """Transform a bland question into a challenging one."""
    challenges = {
        ("distractions", "phone_app"): "Which app do you keep opening even when you promise yourself you won't?",
        ("distractions", "gaming_app"): "Which game steals hours from you while you tell yourself 'just one more match'?",
        ("distractions", "gaming_time"): "How many hours do you actually game - not what you tell others, but the real number?",
        ("distractions", "friend_name"): "Which friend do you blame for distractions when you'd probably waste time anyway without them?",
        ("academic_confidence", "weak_subject"): "Which subject do you keep avoiding even though ignoring it only makes things worse?",
        ("academic_confidence", "last_test_experience"): "What happened in your last test that you're still making excuses for?",
        ("time_pressure", "study_hours_per_day"): "How many hours do you actually study - not 'sit with books open' but real focused work?",
        ("time_pressure", "timetable_breaker"): "What keeps destroying your timetable that you could actually control if you wanted to?",
        ("social_comparison", "comparison_person"): "Who do you keep comparing yourself to even though it only makes you feel worse?",
        ("family_pressure", "family_member"): "Whose opinion are you most afraid of disappointing?",
        ("family_pressure", "expectation_type"): "What expectation feels impossible - and have you actually tried or just assumed you'd fail?",
    }

    return challenges.get((domain, slot), question)


def generate_initial_clarifiers(initial_text: str) -> list[str]:
    """Generate challenging counter-questions from the initial statement."""
    return generate_counter_questions(initial_text, num_questions=3)


__all__ = [
    "generate_question",
    "generate_counter_questions",
    "generate_initial_clarifiers",
    "get_generic_domain_question",
]