"""Question generation via GPT - Universal Counter-questioning.

Works for ANY user input by understanding the STRUCTURE of their statement,
not by matching keywords. Extracts specifics while challenging their claim.
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
# UNIVERSAL SYSTEM PROMPT - WORKS FOR ANY INPUT
# ============================================================================

SYSTEM_PROMPT_QUESTION = """
You are an expert at generating follow-up questions that CHALLENGE vague statements and EXTRACT specific details.

Your job: Take ANY statement and generate 3 questions that:
1. Challenge what's vague or exaggerated
2. Force them to give SPECIFIC, CONCRETE answers
3. Make them uncomfortable enough to be honest

UNIVERSAL FRAMEWORK (apply to ANY statement):

Every complaint/statement has these extractable elements:
- WHO: Person involved (friend, parent, teacher, self, etc.)
- WHAT: The specific action/thing/subject/event
- WHEN: Time (today, yesterday, how long, how often)
- WHERE: Context/situation
- HOW MUCH: Quantity (hours, percentage, frequency, intensity)
- WHY: The real reason (often hidden)

YOUR PROCESS:
1. Read their statement
2. Identify what's VAGUE (usually everything)
3. Generate questions that pin down WHO, WHAT, WHEN, HOW MUCH
4. Add a challenging tone - don't be soft

QUESTION FORMULA:
"[Specific detail you want] - [challenge why they're being vague]?"

EXAMPLES OF UNIVERSAL APPLICATION:

Statement: "I have a problem with my friend"
- Vague: which friend, what problem, when
→ "Which friend specifically - what's their name?"
→ "What exactly did they do - describe the actual incident?"
→ "When did this happen - today, or have you been holding onto this?"

Statement: "I feel lost"
- Vague: lost about what, since when, what triggered it
→ "Lost about what specifically - studies, career, relationships, or life in general?"
→ "When did this feeling start - was there a specific moment?"
→ "What were you doing or what happened right before you started feeling this way?"

Statement: "Everything is falling apart"
- Vague: what exactly, exaggeration
→ "Name one specific thing that's actually 'falling apart' right now?"
→ "Is everything really falling apart, or is it one big thing affecting everything else?"
→ "What fell apart most recently - the specific incident?"

Statement: "I'm not good enough"
- Vague: not good enough for what/whom, compared to whom
→ "Not good enough for what specifically - which goal, exam, or person's expectations?"
→ "Who made you feel this way - whose voice is in your head saying this?"
→ "Compared to whom - who's the person you're measuring yourself against?"

Statement: "I messed up"
- Vague: what, when, how badly
→ "What exactly did you mess up - be specific?"
→ "How badly - is it fixable or actually ruined?"
→ "When did this happen - and have you tried to fix it yet?"

Statement: "I don't know what to do"
- Vague: about what, what options exist
→ "Don't know what to do about what specifically?"
→ "What are the options you're stuck between - name them?"
→ "What would you do if no one was watching or judging?"

Statement: "My life is complicated"
- Vague: everything
→ "What's the ONE thing making it most complicated right now?"
→ "Complicated because of people, studies, or your own thoughts?"
→ "When did it become 'complicated' - what changed?"

Statement: "I'm stuck"
- Vague: stuck in what, since when
→ "Stuck in what exactly - a decision, a subject, a situation?"
→ "How long have you been stuck - days, weeks, months?"
→ "What's the one thing that would 'unstick' you if it happened?"

RULES:
1. Generate exactly 3 questions
2. First question: Ask for the MOST IMPORTANT specific detail (usually WHO or WHAT)
3. Second question: Ask for more context (WHEN, HOW MUCH, or another WHAT)
4. Third question: Challenge the claim OR dig deeper into WHY
5. Each question must be answerable with a CONCRETE answer (name, number, date, specific thing)
6. NO philosophical questions like "what would it mean if..."
7. NO therapy-speak like "how does that make you feel"
8. NO generic probing like "tell me more"
9. Keep each question 10-35 words
10. Each question ends with "?"

TONE:
- Direct, slightly confrontational
- Like a smart friend who doesn't accept vague answers
- Not mean, but not soft either
- "Stop being vague and tell me exactly what's going on"

Return STRICT JSON:
{"questions": ["question1", "question2", "question3"]}
"""


SYSTEM_PROMPT_SLOT_QUESTION = """
You generate ONE question that extracts specific information about "{slot}" while being direct and challenging.

Context: We need to know about "{slot}" in the "{domain}" area.

RULES:
- Ask directly for the {slot} information
- Add a slight challenge or confrontation to make them be honest
- The answer should be a specific: name, number, time, app, subject, or concrete detail
- 10-30 words max
- Ends with "?"
- NO therapy-speak, NO philosophical questions

FORMULA: "What/Which/Who/How many [specific {slot} detail] - [optional challenge]?"

EXAMPLES:
- For any "name" slot: "What's their name - the specific person?"
- For any "app" slot: "Which app specifically - the one you'd be embarrassed to admit?"
- For any "subject" slot: "Which subject exactly?"
- For any "time/hours" slot: "How many hours honestly - the real number?"
- For any "reason" slot: "What's the actual reason - not the excuse, the real one?"

Return STRICT JSON:
{"question": "your question here"}
"""


# ============================================================================
# MAIN GENERATION FUNCTIONS
# ============================================================================

def generate_counter_questions(user_text: str, num_questions: int = 3) -> list[str]:
    """Generate questions that extract specifics from ANY user statement."""
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
            max_tokens=500,
            temperature=0.7,
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw)
        questions = data.get("questions", [])

        valid_questions = []
        for q in questions:
            if isinstance(q, str):
                q_clean = " ".join(q.strip().split())
                if q_clean.endswith("?") and 10 <= len(q_clean) <= 250:
                    valid_questions.append(q_clean)

        if valid_questions:
            return valid_questions[:num_questions]

    except Exception as exc:
        logger.warning("Counter-question generation failed: %s", exc)

    # Fallback to universal framework
    return _generate_universal_fallback(text)[:num_questions]


def _generate_universal_fallback(user_text: str) -> list[str]:
    """
    Universal fallback that works for ANY input.
    
    Instead of keyword matching, this uses a general framework:
    - Question 1: WHO or WHAT (the main subject)
    - Question 2: WHEN or HOW MUCH (context/quantity)
    - Question 3: Challenge or dig deeper
    """
    text = user_text.lower().strip()
    
    # Detect if there's a person reference
    has_person = any(word in text for word in [
        "friend", "parent", "mom", "dad", "teacher", "he", "she", "they", 
        "someone", "people", "everyone", "nobody", "family", "brother", 
        "sister", "boyfriend", "girlfriend", "classmate", "person"
    ])
    
    # Detect if there's a subject/study reference
    has_subject = any(word in text for word in [
        "study", "exam", "subject", "physics", "chemistry", "math", "maths",
        "biology", "english", "chapter", "syllabus", "test", "marks", "score"
    ])
    
    # Detect if there's a time-wasting activity reference
    has_activity = any(word in text for word in [
        "phone", "game", "gaming", "app", "instagram", "youtube", "reels",
        "scroll", "watch", "play", "social media", "netflix", "video"
    ])
    
    # Build questions based on what's in the statement
    questions = []
    
    # Question 1: Get the main WHAT or WHO
    if has_person:
        questions.append("Who specifically are you talking about - what's their name or relation to you?")
    elif has_subject:
        questions.append("Which subject or topic specifically?")
    elif has_activity:
        questions.append("Which app or activity specifically - the main one?")
    else:
        questions.append("Can you be more specific - what exactly is the main issue here?")
    
    # Question 2: Get the WHEN or HOW MUCH
    if has_activity:
        questions.append("How much time does this actually take - hours per day, honestly?")
    elif has_subject:
        questions.append("How long until your exam, or how long has this been a problem?")
    else:
        questions.append("When did this start - recently, or has it been going on for a while?")
    
    # Question 3: Challenge or get the trigger
    questions.append("What specifically triggered this - was there a particular moment or incident?")
    
    return questions


def generate_question(
    domain: str,
    slot: str,
    excerpt: str | None = None,
    context: dict | None = None,
) -> str | None:
    """Generate a slot-specific question."""
    logger.debug("generate_question: domain=%s slot=%s", domain, slot)
    context = context or {}
    meta = context.get("meta") or {}
    last_question = (meta.get("last_question") or "").strip()
    user_text = context.get("user_text") or ""

    # Build prompt for slot-specific question
    system = SYSTEM_PROMPT_SLOT_QUESTION.replace("{domain}", str(domain)).replace("{slot}", str(slot))

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

    # Fallback to slot-based question
    return _get_slot_fallback(domain, slot)


def _get_slot_fallback(domain: str, slot: str) -> str:
    """Generate a simple but direct fallback question for any slot."""
    
    # Universal patterns based on slot name patterns
    slot_lower = slot.lower()
    
    # Name slots
    if "name" in slot_lower or "person" in slot_lower or "member" in slot_lower:
        return "Who specifically - what's their name?"
    
    # App/game slots
    if "app" in slot_lower or "game" in slot_lower:
        return "Which app or game specifically - the main one?"
    
    # Time/hours slots
    if "time" in slot_lower or "hour" in slot_lower:
        return "How many hours honestly - the real number?"
    
    # Subject slots
    if "subject" in slot_lower or "topic" in slot_lower:
        return "Which subject specifically?"
    
    # Reason/why slots
    if "reason" in slot_lower or "why" in slot_lower:
        return "What's the actual reason - the real one, not the excuse?"
    
    # Experience/feeling slots
    if "experience" in slot_lower or "feeling" in slot_lower:
        return "What exactly happened - describe the specific incident?"
    
    # Confidence/level slots
    if "confidence" in slot_lower or "level" in slot_lower:
        return "On a scale of 1-10, where would you honestly put yourself?"
    
    # Gap/comparison slots
    if "gap" in slot_lower or "comparison" in slot_lower:
        return "How big is the gap - small, medium, or feels impossible?"
    
    # Expectation slots
    if "expectation" in slot_lower or "expect" in slot_lower:
        return "What exactly are they expecting - the specific target?"
    
    # Deadline/date slots
    if "deadline" in slot_lower or "date" in slot_lower or "left" in slot_lower:
        return "How many days until the deadline?"
    
    # Breaker/blocker slots
    if "breaker" in slot_lower or "blocker" in slot_lower:
        return "What's the main thing that keeps breaking your plan?"
    
    # Generic fallback - readable slot name
    readable_slot = slot.replace("_", " ")
    return f"Can you tell me specifically about your {readable_slot}?"


def generate_initial_clarifiers(initial_text: str) -> list[str]:
    """Generate challenging questions that extract specific details."""
    return generate_counter_questions(initial_text, num_questions=3)


__all__ = [
    "generate_question",
    "generate_counter_questions",
    "generate_initial_clarifiers",
    "get_generic_domain_question",
]
