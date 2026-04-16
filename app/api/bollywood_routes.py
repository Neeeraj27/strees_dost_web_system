"""AI-backed Bollywood fact routes."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from flask import Blueprint, jsonify, request

from ..services.openai_client import chat_json, chat_text

logger = logging.getLogger(__name__)

bp = Blueprint("bollywood", __name__, url_prefix="/api/bollywood")


SYSTEM_PROMPT = """
You generate ONE concise factual Bollywood-oriented update for a distraction popup.

Output STRICT JSON only:
{
  "title": "...",
  "summary": "...",
    "detail": "...",
    "joke": "...",
  "source": "...",
  "topic": "movies|music|sports|technology|health|science|world"
}

Rules:
- Prioritize Bollywood/movie relevance whenever possible.
- Keep title under 110 chars.
- Keep summary under 260 chars.
- Keep detail under 260 chars.
- Keep joke under 140 chars.
- Must sound factual and neutral, not motivational.
- Joke should be light and harmless, related to the same update context.
- No markdown. No extra keys.
- If specific real-time claims are uncertain, generate an evergreen factual-style update.
"""


def _extract_first_json_object(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return None
    return None


def _normalize_ai_payload(data: dict[str, Any], topic_hint: str) -> dict[str, Any] | None:
    title = str(data.get("title") or "").strip()
    summary = str(data.get("summary") or "").strip()
    detail = str(data.get("detail") or "").strip()
    joke = str(data.get("joke") or "").strip()
    source = str(data.get("source") or "AI Fact Wire").strip() or "AI Fact Wire"
    topic = _normalize_topic(str(data.get("topic") or topic_hint))

    if not title:
        return None
    if not summary:
        summary = "Quick factual update generated from your recent response pattern."
    if not detail:
        detail = "Audience engagement data indicates this trend continues to hold attention among student age groups."
    if not joke:
        joke = "Director said one more take; students said one more attempt."

    return {
        "title": title[:110],
        "summary": summary[:260],
        "detail": detail[:260],
        "joke": joke[:140],
        "source": source[:60],
        "topic": topic,
        "fallback": False,
    }


def _generate_with_ai(payload: dict[str, Any], topic_hint: str) -> dict[str, Any] | None:
    preferred_model = os.getenv("BOLLYWOOD_AI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
    model_candidates = [preferred_model]
    for extra in ("gpt-4o-mini", "gpt-5-mini"):
        if extra not in model_candidates:
            model_candidates.append(extra)

    for model in model_candidates:
        # Attempt 1: strict JSON response format.
        try:
            response = chat_json(
                model=model,
                system=SYSTEM_PROMPT,
                user=json.dumps(payload, ensure_ascii=False),
                temperature=0.65,
            )
            data = _extract_first_json_object(response.choices[0].message.content or "")
            if isinstance(data, dict):
                normalized = _normalize_ai_payload(data, topic_hint)
                if normalized:
                    return normalized
        except Exception as exc:
            logger.info("reel_fact chat_json failed model=%s reason=%s", model, exc)

        # Attempt 2: free text with explicit JSON instruction.
        try:
            response = chat_text(
                model=model,
                system=SYSTEM_PROMPT,
                user=(
                    f"{json.dumps(payload, ensure_ascii=False)}\n"
                    "Return valid JSON only. No markdown, no extra text."
                ),
                temperature=0.65,
            )
            data = _extract_first_json_object(response.choices[0].message.content or "")
            if isinstance(data, dict):
                normalized = _normalize_ai_payload(data, topic_hint)
                if normalized:
                    return normalized
        except Exception as exc:
            logger.info("reel_fact chat_text failed model=%s reason=%s", model, exc)

    return None


def _normalize_topic(value: str) -> str:
    topic = " ".join((value or "").strip().lower().split())
    allowed = {"movies", "music", "sports", "technology", "health", "science", "world"}
    if topic in allowed:
        return topic
    return "movies"


@bp.post("/reel-fact")
def reel_fact():
    body = request.get_json(force=True, silent=True) or {}
    topic_hint = _normalize_topic(str(body.get("topic_hint") or "movies"))
    followup_answers = body.get("followup_answers")
    if not isinstance(followup_answers, list):
        followup_answers = []

    compact_answers = []
    for item in followup_answers[-12:]:
        if not isinstance(item, dict):
            continue
        compact_answers.append(
            {
                "answer": str(item.get("answer") or "")[:240],
                "domain": str(item.get("domain") or "")[:80],
                "slot": str(item.get("slot") or "")[:80],
            }
        )

    payload: dict[str, Any] = {
        "topic_hint": topic_hint,
        "followup_answers": compact_answers,
        "priority": "Prefer Bollywood/movie angle.",
        "randomize_if_missing_context": True,
        "instruction": "If follow-up context is empty, generate a random Bollywood-oriented factual update.",
    }

    try:
        generated = _generate_with_ai(payload, topic_hint)
        if generated:
            return jsonify(generated)
        raise ValueError("no valid AI payload from model candidates")
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("reel_fact fallback topic=%s reason=%s", topic_hint, exc)
        return jsonify(
            {
                "title": "Bollywood box office trends continue to favor youth-focused stories",
                "summary": "Recent Indian film audience patterns show stronger traction for fast-paced, emotionally relatable cinema among students.",
                "detail": "Streaming and campus viewing behavior both indicate higher repeat watchability for emotionally direct story arcs.",
                "joke": "Exam hall has one hero too: the one who remembers formulas after interval.",
                "source": "Fallback Fact Desk",
                "topic": "movies",
                "fallback": True,
            }
        )
