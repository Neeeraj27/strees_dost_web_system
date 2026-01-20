"""Generate stress popups via GPT with strict validation."""
from __future__ import annotations

import json
import logging

from pydantic import ValidationError

from .popup_schemas import Popup
from .popup_validator import validate_popup_message
from .openai_client import chat_json

logger = logging.getLogger(__name__)

FALLBACK_TEMPLATES = {
    "pressure": "Schedule feels crushing right now 😔\nSlow inhale, slow exhale, one step at a time.",
    "self_doubt": "Mind says you aren't prepared enough.\nCounter it: you have survived tougher days.",
    "panic": "Heart racing like the bell already rang.\nCount 5-4-3-2-1, eyes back to the sheet.",
    "motivation": "Dream college still needs your fight.\nTiny effort now beats big regret later.",
    "distraction": "Phone gossip will still be there later.\nGive me 10 focused mins, then check it.",
}


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
    for popup_type in _fallback_sequence(emotion_signals):
        if len(created) >= count:
            break
        message = FALLBACK_TEMPLATES.get(popup_type)
        if not message:
            continue
        key = (popup_type, message.strip())
        if key in seen:
            continue
        lines = [ln.strip() for ln in message.split("\n") if ln.strip()]
        for line in lines or [message]:
            sub_key = (popup_type, line)
            if sub_key in seen:
                continue
            payload = {
                "type": popup_type,
                "message": line,
                "ttl": 12000,
            }
            created.append(payload)
            seen.add(sub_key)
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


def _explode_popup(validated: Popup) -> list[dict]:
    """Split multi-line messages into individual popup cards."""
    lines = [ln.strip() for ln in (validated.message or "").split("\n") if ln.strip()]
    base = {
        "type": validated.type,
        "ttl": validated.ttl,
    }
    if len(lines) <= 1:
        payload = base | {"message": validated.message.strip()}
        return [payload]

    exploded: list[dict] = []
    for line in lines:
        exploded.append(base | {"message": line})
    return exploded

SYSTEM_PROMPT_POPUPS = """
You generate intrusive, focus-breaking pop-ups during a high-stakes task.

Return STRICT JSON only:
{"popups":[{"type":"distraction","message":"...","ttl":8000}]}

Allowed types ONLY:
distraction, self_doubt, panic, pressure, motivation, parental_pressure, fear, doubt, stress, anxiety

Hard limits:
- Generate 40-50 popups.
- message must be EXACTLY 2 lines using \\n.
- Total message length <= 180 characters.
- Each line <= 90 characters.
- Use simple English; light Hinglish allowed for bite.
- Use up to 1 emoji at the end of a line (optional).
- Do NOT repeat the same message.

Tone rules (IMPORTANT):
- Be pesky, sarcastic, and interruptive; feel like an annoying inner voice breaking focus.
- Jab using the student's own stress_profile details (apps, weak_subject, family pressure, comparisons, time left).
- If distraction/phone/gaming/scrolling is present, be brutal: name the app, time lost, what they are dodging right now, who will roast them, what burns if they don't stop; no polite nudges.
- Use rhetorical questions/taunts to spike urgency; no therapy tone, no long advice paragraphs.
- Keep it sharp and playful-snarky; avoid slurs/hate/abuse. Frustrate, not harm.
- Reference whatever they shared (exams or not): time they waste, people they fear, money/pressure, relationships. Use it against them.
- If the user's name is known (from clarifier answers), use it in some popups to make it personal.
 - Do NOT invent apps, people, or situations. If a detail isn't in stress_profile or clarifier_answers, don't mention it.
 - Quote or tightly paraphrase their exact wording when possible so it feels like a mirror.
Attention hooks (mix them across popups):
- curiosity gap: hint at hidden cost, “tap if you dare”, “want to see where time went?”
- micro-CTA: “Snap back for 2 Qs”, “Claim 5 focus points”, “Silence me for 5 mins?”
- social proof/leaderboard: “Friend <Name> solved 3 Qs while you scrolled.”
- timer pressure: explicit countdowns, “⏳ 7 mins till next block.”
- faux system nudges: “Focus Mode Alert: background apps detected – tap to resume.”

Personalization:
- Use stress_profile details (weak_subject, phone_app/gaming_app, friend_name/comparison_person, family_member, deadlines/time pressure).
- If weak_subject exists, weave it into line 1 or 2 to poke at it.
- If family_member present, you MAY prefix with "Mom:", "Dad:", or "Family:".
- If friend_name/comparison_person present, you MAY prefix with "<Name>:". 
- If clarifier_answers include a name, sprinkle it in for extra sting.

TTL:
- ttl between 7000 and 11000.
"""



def normalize_two_lines(msg: str, max_total: int = 160, max_line: int = 80) -> str:
    msg = (msg or "").strip()
    lines = [ln.strip() for ln in msg.split("\n") if ln.strip()]

    if len(lines) < 2:
        cleaned = msg.replace("?", ".").replace("!", ".")
        parts = [p.strip() for p in cleaned.split(".") if p.strip()]
        if len(parts) >= 2:
            lines = [parts[0], parts[1]]
        else:
            words = msg.split()
            if len(words) >= 6:
                mid = max(3, min(len(words) // 2, len(words) - 3))
                lines = [" ".join(words[:mid]), " ".join(words[mid:])]
            else:
                lines = [msg, msg]

    line1, line2 = lines[0], lines[1]
    line1 = line1[:max_line].rstrip()
    line2 = line2[:max_line].rstrip()

    joined = f"{line1}\n{line2}"
    if len(joined) > max_total:
        overflow = len(joined) - max_total
        if overflow > 0:
            line2 = line2[: max(0, len(line2) - overflow)].rstrip()
        joined = f"{line1}\n{line2}"
        if len(joined) > max_total:
            overflow = len(joined) - max_total
            line1 = line1[: max(0, len(line1) - overflow)].rstrip()
            joined = f"{line1}\n{line2}"

    return joined


def generate_popups(stress_profile: dict, emotion_signals: list[str] | None = None) -> list[dict]:
    if not stress_profile:
        return []

    payload = {
        "stress_profile": stress_profile,
        "emotion_signals": emotion_signals or [],
    }
    logger.debug("generate_popups: stress_profile_keys=%s signals=%s", list(stress_profile.keys()), emotion_signals)
    # include clarifier answers if present in meta
    clarifiers = stress_profile.get("__clarifiers__")
    if clarifiers:
        payload["clarifier_answers"] = clarifiers

    for attempt in (1, 2):
        try:
            response = chat_json(
                model="gpt-4o-mini",
                system=SYSTEM_PROMPT_POPUPS,
                user=json.dumps(payload, ensure_ascii=False),
            )

            raw = (response.choices[0].message.content or "").strip()
            logger.info("POPUP_RAW attempt=%s raw=%s", attempt, raw)

            data = json.loads(raw)
            popups = data.get("popups") or []

            valid_popups: list[dict] = []
            seen: set[tuple[str, str]] = set()

            for popup in popups:
                if not isinstance(popup, dict):
                    continue
                popup["message"] = normalize_two_lines(popup.get("message", ""))
                popup["ttl"] = int(popup.get("ttl", 12000))
                popup["ttl"] = max(10000, min(14000, popup["ttl"]))

                try:
                    validated = Popup.model_validate(popup)
                except ValidationError as e:
                    logger.warning("POPUP_SCHEMA_FAIL popup=%s err=%s", popup, e)
                    continue

                if validate_popup_message(validated.message, stress_profile):
                    for sub in _explode_popup(validated):
                        key = (sub["type"], sub["message"].strip())
                        if key in seen:
                            continue
                        seen.add(key)
                        valid_popups.append(sub)

            if valid_popups:
                augmented = _ensure_minimum_popups(
                    valid_popups,
                    seen,
                    emotion_signals or [],
                )
                logger.info("POPUP_OK count=%s", len(augmented))
                return augmented

            logger.warning("POPUP_EMPTY_AFTER_VALIDATION attempt=%s", attempt)

        except (json.JSONDecodeError, ValidationError) as exc:
            logger.error("POPUP_PARSE_FAIL attempt=%s err=%s", attempt, exc)

        except Exception as exc:
            logger.exception("POPUP_CALL_FAIL attempt=%s err=%s", attempt, exc)
            break

    fallback = _fallback_popups(3, set(), emotion_signals or [])
    if fallback:
        return fallback[:50]

    return []



__all__ = ["generate_popups"]
