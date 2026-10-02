"""Citation source: github.com/cpbjr/catholic-readings-api (MIT).

readings/YYYY/MM-DD.json carries firstReading, psalm, secondReading and
gospel citations in Lectionary (NABRE) numbering; liturgical-calendar/
YYYY/MM-DD.json carries the celebration name. There is no Alleluia
citation, so days built from this source have no Alleluia entry.

The repository is cloned once into cache/cpbjr and pinned to COMMIT.
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = "https://github.com/cpbjr/catholic-readings-api.git"
COMMIT = "973e9864eb0f15accadfc48750f5b243a95b7a2c"  # 2026-08-29
DIR = os.path.join(HERE, "cache", "cpbjr")

FIELDS = [("firstReading", "Reading 1"), ("psalm", "Responsorial Psalm"),
          ("secondReading", "Reading 2"), ("gospel", "Gospel")]


def ensure():
    if not os.path.isdir(os.path.join(DIR, ".git")):
        subprocess.run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", REPO, DIR], check=True)
    head = subprocess.run(["git", "-C", DIR, "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    if head != COMMIT:
        subprocess.run(["git", "-C", DIR, "fetch", "-q", "--depth", "1", "origin", COMMIT], check=True)
        subprocess.run(["git", "-C", DIR, "checkout", "-q", COMMIT], check=True)


def _read(kind, date):
    path = os.path.join(DIR, kind, str(date.year), date.strftime("%m-%d") + ".json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def day(date):
    """Return (title or None, [(label, citation)]) or None if no data."""
    r = _read("readings", date)
    if r is None:
        return None
    c = _read("liturgical-calendar", date) or {}
    title = (c.get("celebration") or {}).get("name") or None
    rd = r.get("readings", {})
    items = [(label, rd[k].strip()) for k, label in FIELDS if rd.get(k)]
    return title, items
