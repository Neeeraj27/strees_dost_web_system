"""Generate stress popups via GPT - Sharp, Short, Cutting."""
from __future__ import annotations

import ast
import json
import logging
import re

from pydantic import ValidationError

from .popup_schemas import Popup
from .popup_validator import validate_popup_message
from .openai_client import chat_json

logger = logging.getLogger(__name__)

FALLBACK_TEMPLATES = {
    "pressure": "They're preparing. You're panicking.",
    "self_doubt": "You know you're not ready. So do they.",
    "panic": "Clock's ticking. You're not.",
    "motivation": "Dreams don't wait. Neither do results.",
    "distraction": "Phone won. You lost. Again.",
}


def _to_text(value) -> str:
    if isinstance(value, str):
        text = value
    elif isinstance(value, (list, tuple, set)):
        for item in value:
            text = _to_text(item)
            if text:
                return text
        return ""
    elif isinstance(value, dict):
        for key in ("name", "value", "text", "label"):
            text = _to_text(value.get(key))
            if text:
                return text
        return ""
    elif value is None:
        return ""
    else:
        text = str(value)

    text = " ".join(text.strip().split())
    if not text:
        return ""

    # Recover from accidentally stringified lists like "['Rahul']".
    if text.startswith("[") and text.endswith("]"):
        for parser in (json.loads, ast.literal_eval):
            try:
                parsed = parser(text)
                parsed_text = _to_text(parsed)
                if parsed_text:
                    return parsed_text
            except Exception:
                continue

    return text


def _preferred_friend_name(profile_summary: dict) -> str:
    for key in ("friend", "rival"):
        name = _to_text(profile_summary.get(key))
        if name and name.lower() not in {"friend", "friends", "name", "unknown"}:
            return name
    return ""


def _normalize_popup_message(raw_message, friend_name: str) -> str:
    msg = _to_text(raw_message)
    if not msg:
        return ""

    # Turn bracket placeholders like [Rahul] into plain text.
    msg = re.sub(r"\[\s*([^\[\]]+?)\s*\]", r"\1", msg)
    msg = msg.replace("[", "").replace("]", "")

    if friend_name:
        msg = re.sub(r"\bfriends\b", friend_name, msg, count=1, flags=re.IGNORECASE)
        msg = re.sub(r"\bfriend's\b", f"{friend_name}'s", msg, count=1, flags=re.IGNORECASE)
        msg = re.sub(r"\bfriend\b", friend_name, msg, count=1, flags=re.IGNORECASE)

    return " ".join(msg.split())


def _fallback_sequence(emotion_signals: list[str] | None) -> list[str]:
    ordered: list[str] = []
    for signal in emotion_signals or []:
        if signal in FALLBACK_TEMPLATES and signal not in ordered:
            ordered.append(signal)
    for default in ["pressure", "self_doubt", "panic", "motivation", "distraction"]:
        if default in FALLBACK_TEMPLATES and default not in ordered:
            ordered.append(default)
    return ordered


def _fallback_popups(
    count: int,
    seen: set[tuple[str, str]],
    emotion_signals: list[str],
) -> list[dict]:
    created: list[dict] = []
    sequence = _fallback_sequence(emotion_signals)
    if not sequence:
        return created
    idx = 0
    while len(created) < count:
        popup_type = sequence[idx % len(sequence)]
        idx += 1
        message = FALLBACK_TEMPLATES.get(popup_type)
        if not message:
            continue
        key = (popup_type, message.strip())
        if key in seen:
            continue
        payload = {
            "type": popup_type,
            "message": message,
            "ttl": 8000,
        }
        created.append(payload)
        seen.add(key)
    return created


def _ensure_minimum_popups(
    popups: list[dict],
    seen: set[tuple[str, str]],
    emotion_signals: list[str],
    minimum: int = 40,
    limit: int = 50,
) -> list[dict]:
    augmented = list(popups)
    if len(augmented) < minimum:
        needed = minimum - len(augmented)
        augmented.extend(_fallback_popups(needed, seen, emotion_signals))
    return augmented[:limit]


# ============================================================================
# SHARP, SHORT, CUTTING POPUP PROMPT
# ============================================================================

SYSTEM_PROMPT_POPUPS = """
You generate SHORT, SHARP popup messages that psychologically sting during an online test.

RETURN STRICT JSON:
{"popups":[{"type":"...","message":"...","ttl":8000}]}

=============================================================================
STYLE: SHORT & BRUTAL
=============================================================================

Each popup: 5-12 words MAX. One line. No fluff.

Like a slap, not a lecture.
Like an intrusive thought, not advice.
Like someone who KNOWS them calling them out.

=============================================================================
PSYCHOLOGICAL TECHNIQUES
=============================================================================

1. MIRROR THEIR WORDS BACK
   - They said "I hate my friends" → "You hate them, yet you're still behind them."
   - They said "I can't focus" → "Can't focus? Or won't?"
   - They said "I'm stressed" → "Stressed? Wait till results day."

2. CONTRADICTION ATTACK
   - "You blame them. Results blame you."
   - "They're not here. They're still winning."
   - "You hate studying. Failure loves you back."

3. COMPARISON STING
    - "Rahul is solving. You're scrolling."
   - "They moved on. You're still stuck."
   - "Everyone's ahead. You know it."

4. SHORT TRUTH BOMBS
   - "This test isn't hard. Your focus is."
   - "Phone won. You lost. Again."
   - "Excuses don't get marks."

5. ISOLATION/LEFT BEHIND
   - "Funny how everyone moved on except you."
   - "They'll celebrate. You'll explain."
   - "Group's done. You're not."

6. FAKE SYSTEM WARNINGS (sneaky)
   - "⚠️ Focus Drop Detected"
   - "📉 Performance declining"
   - "🔴 Attention span: critical"

7. THEIR FEAR OUT LOUD
   - "What if you actually fail?"
   - "They'll ask. You'll lie. Again."
   - "You already know the result."

=============================================================================
PERSONALIZATION
=============================================================================

USE their exact details from student_profile:

- If they mentioned a friend/person → Use the exact plain name: "Rahul finished. You?"
- If they mentioned an app → Use it: "Instagram won't get you marks."
- If they mentioned weak subject → Attack it: "Physics doesn't care about your excuses."
- If they mentioned family → Use them: "Dad's money. Your waste."
- If they mentioned gaming → Hit it: "BGMI rank won't save your percentage."

If a detail exists, USE IT. Makes it personal. Makes it hurt.

=============================================================================
GOOD EXAMPLES
=============================================================================

"You hate them, yet you're still behind them."
"Funny how everyone moved on except you."
"This test isn't hard. Your focus is."
"They're not here… but they're winning."
"You blame friends. Results blame you."
"Rahul's done. You're not."
"Instagram again? Really?"
"Can't focus? Or won't?"
"Excuses ready. Marks aren't."
"Phone: 3 hours. Books: 0."
"They'll pass. You'll panic."
"⚠️ Focus Drop Detected"
"You know you're not ready."
"Everyone knows except you."
"Still scrolling? Cool. Cool."
"Physics won't study itself."
"Mom will ask. What'll you say?"
"Failure isn't loud. It's this."
"Distractions win when you let them."
"They're solving Q5. You're here."

=============================================================================
BAD EXAMPLES (DON'T DO THESE)
=============================================================================

❌ "Hey! Focus on your studies please! You can do it!" (too soft, too long)
❌ "Time is running out, you should concentrate now" (lecture mode)
❌ "Remember your goals and stay motivated 💪" (cringe motivation)
❌ "Your parents believe in you, don't let them down" (too nice)
❌ "Take a deep breath and refocus on the test" (therapy mode)

=============================================================================
RULES
=============================================================================

1. Generate 45-50 popups
2. Each message: 5-12 words, ONE line only
3. NO emojis except in fake system warnings
4. NO motivational tone
5. NO "you can do it" energy
6. BE the annoying thought they're trying to ignore
7. USE their own words/details against them
8. MIX all 7 techniques across the popups
9. ttl: 6000-10000
10. NO duplicates
11. Do NOT use square brackets around names or words.

ALLOWED TYPES:
distraction, self_doubt, panic, pressure, comparison, guilt, fear, system_warning
"""


def _build_profile_summary(stress_profile: dict) -> dict:
    """Extract key details for personalization."""
    summary = {}
    
    # Distractions
    distractions = stress_profile.get("distractions", {})
    if distractions:
        if distractions.get("phone_app"):
            summary["app"] = _to_text(distractions.get("phone_app"))
        if distractions.get("gaming_app"):
            summary["game"] = _to_text(distractions.get("gaming_app"))
        if distractions.get("gaming_time"):
            summary["gaming_hours"] = _to_text(distractions.get("gaming_time"))
        if distractions.get("friend_name"):
            summary["friend"] = _to_text(distractions.get("friend_name"))
    
    # Academic
    academic = stress_profile.get("academic_confidence", {})
    if academic:
        if academic.get("weak_subject"):
            summary["weak_subject"] = _to_text(academic.get("weak_subject"))
        if academic.get("last_test_experience"):
            summary["last_test"] = _to_text(academic.get("last_test_experience"))
    
    # Time pressure
    time_pressure = stress_profile.get("time_pressure", {})
    if time_pressure:
        if time_pressure.get("exam_time_left"):
            summary["days_left"] = _to_text(time_pressure.get("exam_time_left"))
        if time_pressure.get("study_hours_per_day"):
            summary["study_hours"] = _to_text(time_pressure.get("study_hours_per_day"))
    
    # Social comparison
    social = stress_profile.get("social_comparison", {})
    if social:
        if social.get("comparison_person"):
            summary["rival"] = _to_text(social.get("comparison_person"))
    
    # Family pressure
    family = stress_profile.get("family_pressure", {})
    if family:
        if family.get("family_member"):
            summary["family"] = _to_text(family.get("family_member"))
        if family.get("expectation_type"):
            summary["expectation"] = _to_text(family.get("expectation_type"))
    
    return summary


def _extract_user_words(stress_profile: dict) -> list[str]:
    """Extract the user's own words/phrases to mirror back."""
    words = []
    
    # Get raw initial text if available
    raw_text = stress_profile.get("__raw_text__", "")
    if raw_text:
        words.append(raw_text)
    
    # Get any clarifier answers
    clarifiers = stress_profile.get("__clarifiers__", [])
    if clarifiers:
        for item in clarifiers:
            if isinstance(item, dict):
                answer = item.get("answer") or ""
                if isinstance(answer, str) and answer.strip():
                    words.append(answer)
            elif isinstance(item, str):
                if item.strip():
                    words.append(item)
    
    return words


def generate_popups(stress_profile: dict, emotion_signals: list[str] | None = None) -> list[dict]:
    if not stress_profile:
        return []

    profile_summary = _build_profile_summary(stress_profile)
    friend_name = _preferred_friend_name(profile_summary)
    user_words = _extract_user_words(stress_profile)
    
    payload = {
        "student_profile": profile_summary,
        "emotion_signals": emotion_signals or [],
        "user_said": user_words,  # Their exact words to mirror
    }
    
    logger.debug("generate_popups: profile=%s signals=%s", profile_summary, emotion_signals)

    for attempt in (1, 2):
        try:
            response = chat_json(
                model="gpt-4o-mini",
                system=SYSTEM_PROMPT_POPUPS,
                user=json.dumps(payload, ensure_ascii=False),
                max_tokens=3000,
                temperature=0.85,
            )

            raw = (response.choices[0].message.content or "").strip()
            logger.info("POPUP_RAW attempt=%s len=%s", attempt, len(raw))

            data = json.loads(raw)
            popups = data.get("popups") or []

            valid_popups: list[dict] = []
            seen: set[str] = set()

            for popup in popups:
                if not isinstance(popup, dict):
                    continue
                
                msg = _normalize_popup_message(popup.get("message"), friend_name)

                # Enforce one-line, short messages
                if "\n" in msg:
                    continue
                if not (5 <= len(msg.split()) <= 12):
                    continue
                
                # Skip duplicates
                if msg.lower() in seen:
                    continue
                seen.add(msg.lower())
                
                popup["message"] = msg
                popup["ttl"] = int(popup.get("ttl", 8000))
                popup["ttl"] = max(6000, min(10000, popup["ttl"]))

                try:
                    validated = Popup.model_validate(popup)
                    if not validate_popup_message(validated.message, stress_profile):
                        continue
                    valid_popups.append(
                        {
                            "type": validated.type,
                            "message": validated.message,
                            "ttl": validated.ttl,
                        }
                    )
                except ValidationError as e:
                    logger.warning("POPUP_SCHEMA_FAIL: %s", e)
                    continue

            if valid_popups:
                augmented = _ensure_minimum_popups(
                    valid_popups,
                    {(p["type"], p["message"]) for p in valid_popups},
                    emotion_signals or [],
                )
                logger.info("POPUP_OK count=%s", len(augmented))
                return augmented

            logger.warning("POPUP_EMPTY attempt=%s", attempt)

        except (json.JSONDecodeError, ValidationError) as exc:
            logger.error("POPUP_PARSE_FAIL attempt=%s err=%s", attempt, exc)

        except Exception as exc:
            logger.exception("POPUP_CALL_FAIL attempt=%s err=%s", attempt, exc)
            break

    fallback = _fallback_popups(40, set(), emotion_signals or [])
    return fallback[:50]


__all__ = ["generate_popups"]
