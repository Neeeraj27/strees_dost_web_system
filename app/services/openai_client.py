"""Shared OpenAI chat helpers."""
from __future__ import annotations

from openai import OpenAI

client = OpenAI()


def chat_text(model: str, system: str, user: str, **kwargs):
    """Basic chat completion returning text."""
    return client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        **kwargs,
    )


def chat_json(model: str, system: str, user: str, **kwargs):
    """Chat completion forced to return JSON object."""
    options = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    options.update(kwargs)
    return client.chat.completions.create(**options)


__all__ = ["chat_text", "chat_json"]
