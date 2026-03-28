"""
User Memory Module
==================
Extracts personal facts from conversations, persists them to a JSON file,
and formats them for inclusion in AI prompts.

Stored fields per user:
  name, location, profession, preferences (list), other_facts (list)
"""

import json
import os
import re
from logger import setup_logger

logger = setup_logger("user_memory")

MEMORY_FILE = "user_memory.json"

# ── Persistence ────────────────────────────────────────────────────────────

def _load_all() -> dict:
    """Load the full memory dict from disk."""
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_all(data: dict):
    """Write the full memory dict to disk."""
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def get_memory(user_id: str) -> dict:
    """Return the memory dict for a user, or an empty template."""
    all_mem = _load_all()
    return all_mem.get(user_id, _empty_profile())


def save_memory(user_id: str, profile: dict):
    """Persist a single user's profile."""
    all_mem = _load_all()
    all_mem[user_id] = profile
    _save_all(all_mem)


def _empty_profile() -> dict:
    return {
        "name": "",
        "location": "",
        "profession": "",
        "preferences": [],
        "other_facts": [],
    }


# ── Extraction ─────────────────────────────────────────────────────────────

# Simple keyword patterns — lightweight and runs without an extra AI call.
_PATTERNS: list[tuple[str, str, str]] = [
    # (regex, target_field, group_to_use)
    (r"(?:my name is|i(?:'?m| am))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", "name", "1"),
    (r"(?:i live in|i(?:'?m| am) from|i(?:'?m| am) based in|i(?:'?m| am) in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", "location", "1"),
    (r"(?:i(?:'?m| am) an?|i work as(?: an?)?|my (?:job|profession|role) is)\s+(\w[\w\s]{1,30})", "profession", "1"),
    (r"(?:i (?:like|love|enjoy|prefer))\s+(.+?)(?:\.|,|$)", "preference", "1"),
]


def extract_facts(message: str, profile: dict) -> dict:
    """
    Scan *message* for personal facts and merge them into *profile*.
    Returns the (possibly updated) profile dict.
    """
    for pattern, field, group in _PATTERNS:
        match = re.search(pattern, message, re.IGNORECASE)
        if not match:
            continue

        value = match.group(int(group)).strip().rstrip(".")

        if field == "preference":
            if value and value not in profile["preferences"]:
                profile["preferences"].append(value)
                logger.info(f"Extracted preference: {value}")
        elif field in ("name", "location", "profession"):
            if value:
                profile[field] = value
                logger.info(f"Extracted {field}: {value}")

    return profile


# ── Prompt formatting ──────────────────────────────────────────────────────

def format_memory_for_prompt(profile: dict) -> str:
    """
    Return a human-readable summary of the user profile,
    or an empty string if nothing is stored.
    """
    lines = []
    if profile.get("name"):
        lines.append(f"Name: {profile['name']}")
    if profile.get("location"):
        lines.append(f"Location: {profile['location']}")
    if profile.get("profession"):
        lines.append(f"Profession: {profile['profession']}")
    if profile.get("preferences"):
        lines.append(f"Preferences: {', '.join(profile['preferences'])}")
    if profile.get("other_facts"):
        lines.append(f"Other facts: {'; '.join(profile['other_facts'])}")

    return "\n".join(lines)
