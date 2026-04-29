"""Direct extraction routes for client apps."""
from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..services.academic_topic_extractor import extract_academic_topics

bp = Blueprint("extract", __name__, url_prefix="/api/extract")


@bp.post("/academic-topics")
def extract_academic_topics_direct():
    body = request.get_json(force=True, silent=True) or {}
    initial_text = str(body.get("text") or body.get("initial_text") or "").strip()
    history_raw = body.get("conversation_history")
    conversation_history = history_raw if isinstance(history_raw, list) else []

    topics = extract_academic_topics(
        initial_text=initial_text,
        conversation_history=conversation_history,
    )
    return jsonify(topics)

