"""AI-driven trigger recommendation routes."""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from flask import Blueprint, jsonify, request

from ..services.openai_client import chat_json

logger = logging.getLogger(__name__)

bp = Blueprint("triggers", __name__, url_prefix="/api/triggers")


ALLOWED_TRIGGERS = {
	"optionShuffle",
	"phantomCompetitor",
	"stressTimer",
	"confidenceBreaker",
	"mirageHighlight",
	"blurAttack",
	"screenFlip",
	"colorInversion",
	"heartbeatVibration",
	"waveDistortion",
	"fakeMentorCount",
	"chaosBackground",
	"shepardTone",
	"spatialTicking",
	"fakeLowBattery",
	"fakeCrashScreen",
	"blackout",
	"hesitationHeatmap",
	"bollywoodReelTrap",
}


EVENT_PRIORITY = {
	"wrong_answer": ["confidenceBreaker", "stressTimer", "phantomCompetitor"],
	"answer_changed": ["optionShuffle", "hesitationHeatmap", "mirageHighlight"],
	"hover_hesitation": ["mirageHighlight", "hesitationHeatmap"],
	"long_hesitation": ["phantomCompetitor", "stressTimer", "spatialTicking"],
	"idle_resumed": ["blurAttack", "chaosBackground", "bollywoodReelTrap"],
	"time_pressure": ["heartbeatVibration", "stressTimer", "fakeLowBattery", "spatialTicking"],
	"question_loaded": ["fakeMentorCount", "phantomCompetitor"],
	"submit_attempt": ["spatialTicking", "stressTimer"],
}


SYSTEM_PROMPT = """
You are a trigger policy engine for a student test simulation.
Pick at most one trigger based on user interaction signals.

Output strict JSON only in this shape:
{
  "trigger_name": "<name or empty>",
  "timeout_ms": <integer>,
  "reason": "<short reason>"
}

Rules:
- trigger_name MUST be one of available_triggers from the input.
- Choose no trigger (empty string) if no meaningful trigger is warranted.
- Prefer interaction-linked decisions over random selections.
- Keep timeout_ms between 2500 and 12000.
- If event_type is wrong_answer, prioritize confidenceBreaker when available.
- If event_type is answer_changed, prioritize optionShuffle or hesitationHeatmap when available.
- If event_type is time_pressure, prioritize heartbeatVibration or stressTimer when available.
- Be conservative: avoid aggressive visual/audio triggers for low confidence situations.
"""


DEVIL_BRIEF_PROMPT = """
You are writing a dramatic but useful pre-test briefing from a devil persona.
Use student follow-up answers and planned trigger policy context.

Output strict JSON only:
{
	"devil_name": "...",
	"intro": "...",
	"taunt": "...",
	"problems": ["...", "...", "..."],
	"design_points": ["...", "...", "..."],
	"challenge_lines": ["...", "..."]
}

Rules:
- Keep tone creative and cinematic, but not abusive.
- Problems must be specific to follow-up themes when available.
- Keep each bullet under 120 chars.
- Do not mention medical diagnosis.
"""


def _clamp_timeout(value: Any, default_value: int = 5200) -> int:
	try:
		num = int(value)
	except Exception:
		num = default_value
	return max(2500, min(12000, num))


def _fallback_decision(event_type: str, available: list[str], user_state: dict[str, Any]) -> dict[str, Any]:
	candidates = EVENT_PRIORITY.get(event_type, [])
	for name in candidates:
		if name in available:
			return {
				"trigger_name": name,
				"timeout_ms": 5200,
				"reason": f"fallback:{event_type}",
				"source": "fallback",
			}

	answer_changes = int(user_state.get("answer_change_count") or 0)
	time_on_question = int(user_state.get("time_on_question_ms") or 0)
	if answer_changes >= 3 and "optionShuffle" in available:
		return {
			"trigger_name": "optionShuffle",
			"timeout_ms": 4600,
			"reason": "fallback:high_answer_changes",
			"source": "fallback",
		}
	if time_on_question > 12000 and "phantomCompetitor" in available:
		return {
			"trigger_name": "phantomCompetitor",
			"timeout_ms": 5400,
			"reason": "fallback:long_hesitation",
			"source": "fallback",
		}

	return {
		"trigger_name": "",
		"timeout_ms": 0,
		"reason": "fallback:no_action",
		"source": "fallback",
	}


@bp.post("/recommend")
def recommend_trigger():
	body = request.get_json(force=True, silent=True) or {}
	event_type = str(body.get("event_type") or "").strip().lower()
	user_state = body.get("user_state") if isinstance(body.get("user_state"), dict) else {}
	available_raw = body.get("available_triggers") if isinstance(body.get("available_triggers"), list) else []
	available = [name for name in available_raw if isinstance(name, str) and name in ALLOWED_TRIGGERS]

	if not available:
		return jsonify(
			{
				"trigger_name": "",
				"timeout_ms": 0,
				"reason": "no_available_triggers",
				"source": "server",
			}
		)

	payload = {
		"event_type": event_type,
		"user_state": user_state,
		"metrics": body.get("metrics") if isinstance(body.get("metrics"), dict) else {},
		"recent_triggers": body.get("recent_triggers") if isinstance(body.get("recent_triggers"), list) else [],
		"followup_answers": body.get("followup_answers") if isinstance(body.get("followup_answers"), list) else [],
		"available_triggers": available,
		"event_priority": EVENT_PRIORITY.get(event_type, []),
		"extra": body.get("extra") if isinstance(body.get("extra"), dict) else {},
	}

	model = os.getenv("TRIGGER_AI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
	try:
		response = chat_json(
			model=model,
			system=SYSTEM_PROMPT,
			user=json.dumps(payload, ensure_ascii=False),
			temperature=0.2,
		)
		content = response.choices[0].message.content or "{}"
		parsed = json.loads(content)
		trigger_name = str(parsed.get("trigger_name") or "").strip()
		timeout_ms = _clamp_timeout(parsed.get("timeout_ms"), 5200)
		reason = str(parsed.get("reason") or "ai_decision")[:160]

		if trigger_name and trigger_name not in available:
			raise ValueError("ai returned unavailable trigger")

		return jsonify(
			{
				"trigger_name": trigger_name,
				"timeout_ms": timeout_ms if trigger_name else 0,
				"reason": reason,
				"source": "ai",
			}
		)
	except Exception as exc:  # pragma: no cover - defensive
		logger.info("trigger recommend fallback event=%s reason=%s", event_type, exc)
		return jsonify(_fallback_decision(event_type, available, user_state))


@bp.post("/devil-brief")
def devil_brief():
	body = request.get_json(force=True, silent=True) or {}
	followups_raw = body.get("followup_answers") if isinstance(body.get("followup_answers"), list) else []
	planned = body.get("planned_test") if isinstance(body.get("planned_test"), dict) else {}

	followups: list[dict[str, str]] = []
	for item in followups_raw[-14:]:
		if not isinstance(item, dict):
			continue
		followups.append(
			{
				"answer": str(item.get("answer") or "")[:280],
				"domain": str(item.get("domain") or "")[:80],
				"slot": str(item.get("slot") or "")[:80],
			}
		)

	payload = {
		"followup_answers": followups,
		"planned_test": planned,
	}

	model = os.getenv("TRIGGER_AI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini"
	try:
		response = chat_json(
			model=model,
			system=DEVIL_BRIEF_PROMPT,
			user=json.dumps(payload, ensure_ascii=False),
			temperature=0.6,
		)
		content = response.choices[0].message.content or "{}"
		parsed = json.loads(content)

		problems = parsed.get("problems") if isinstance(parsed.get("problems"), list) else []
		design_points = parsed.get("design_points") if isinstance(parsed.get("design_points"), list) else []
		challenge_lines = parsed.get("challenge_lines") if isinstance(parsed.get("challenge_lines"), list) else []

		return jsonify(
			{
				"devil_name": str(parsed.get("devil_name") or "The Invigilator Devil")[:80],
				"intro": str(parsed.get("intro") or "I studied your responses and designed this test around your pressure points.")[:260],
				"taunt": str(parsed.get("taunt") or "Accept my challenge. I doubt you can beat me.")[:220],
				"problems": [str(x)[:120] for x in problems[:5] if str(x).strip()],
				"design_points": [str(x)[:120] for x in design_points[:5] if str(x).strip()],
				"challenge_lines": [str(x)[:120] for x in challenge_lines[:3] if str(x).strip()],
				"source": "ai",
			}
		)
	except Exception as exc:  # pragma: no cover - defensive
		logger.info("devil brief fallback reason=%s", exc)
		return jsonify(
			{
				"devil_name": "The Invigilator Devil",
				"intro": "I shaped this test from your answers: where you hesitate, where panic rises, where focus slips.",
				"taunt": "Accept my challenge. I know your weak moments; prove me wrong.",
				"problems": [
					"You lose speed when doubt appears.",
					"You overthink after one hard question.",
					"Distractions steal attention at critical moments.",
				],
				"design_points": [
					"Wrong answers trigger pressure responses.",
					"Hesitation patterns trigger decision traps.",
					"Time pressure increases near key transitions.",
				],
				"challenge_lines": [
					"Accept this challenge and hold your focus.",
					"Beat the devil by beating your own panic.",
				],
				"source": "fallback",
			}
		)

