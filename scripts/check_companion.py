"""Validate companion drafts against their readings files.

Usage: python3 scripts/check_companion.py [--from DATE] [--through DATE] [DATE ...]

With no DATE arguments, checks every companion file, and checks that every
Sunday and US holy day of obligation from the first companion date to the
last has a companion file. --from and --through widen or narrow that
calendar window; with DATE arguments the calendar is checked only if one of
them is given. Prints OK or a list of problems. Exit code 1 on any problem.

Each file:
  - has every field its editions need (plain, kids, family) and a "date"
    that matches its name;
  - has plain and kids entries for every reading the day has, and none for a
    reading the day does not have; chunk verse ranges cover each reading in
    order, within the size limit;
  - agrees with the day's readings wherever the text names something a
    wrong-day draft would get wrong: the Gospel writer ("Mark's Gospel"), the
    psalm number in the psalm box, a named Sunday ("Third Sunday of Advent"),
    the lectionary year ("Year B"), and the season (no Advent in Ordinary
    Time, and the reverse); a holy day on a weekday does not call itself
    Sunday;
  - follows house style: no exclamation marks (CONTRIBUTING.md), and double
    quotes that open also close.

US holy days of obligation: every Sunday; Christmas; the Immaculate
Conception, unless it falls on a Sunday (then it moves to Monday without the
obligation); Mary, Mother of God, the Assumption and All Saints, unless they
fall on a Saturday or a Monday; the Ascension wherever content/readings puts
it (Sunday in most of the US).
"""
import argparse
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
READ = ROOT / "content" / "readings"
COMPANION = ROOT / "content" / "companion"
CHUNKED = ("Reading 1", "Reading 2", "Gospel")
EDITIONS = ("plain", "kids", "family")
EVANGELIST = {"MAT": "Matthew", "MRK": "Mark", "LUK": "Luke", "JHN": "John"}
EVANGELIST_RE = re.compile(r"\b(Matthew|Mark|Luke|John)['’]s Gospel\b"
                           r"|\bGospel (?:of|according to) (?:Saint |St\. )?(Matthew|Mark|Luke|John)\b")
PSALM_RE = re.compile(r"\bPsalm (\d+)\b")
NAMED_SUNDAY_RE = re.compile(r"\b((?:[A-Z][a-z]+-)?[A-Za-z]+) Sunday (?:of|in) (?:Advent|Lent|Easter|Ordinary Time)\b")
RELATIVE_RE = re.compile(r"\b(next|last|previous|following|coming)\b", re.I)
YEAR_RE = re.compile(r"\bYear ([ABC])\b")
SELF_SUNDAY_RE = re.compile(r"\b(?:this|today['’]s)(?: \w+)? Sunday\b|\btoday is(?: \w+){0,2} Sunday\b", re.I)


def verses(reading):
    return [f"{c}:{v}" for c, v, *_ in reading["t"]]


def check_chunks(errs, where, chunks, vs, max_len):
    if not isinstance(chunks, list) or not chunks:
        errs.append(f"{where}: chunks missing")
        return
    i = 0
    for n, ch in enumerate(chunks):
        a, b = ch.get("from"), ch.get("to")
        if not ch.get("text", "").strip():
            errs.append(f"{where} chunk {n}: empty text")
        if a not in vs or b not in vs:
            errs.append(f"{where} chunk {n}: from/to {a}-{b} not in {vs}")
            return
        ia, ib = vs.index(a), vs.index(b)
        if ia != i:
            errs.append(f"{where} chunk {n}: starts at {a}, expected {vs[i]}")
            return
        if ib < ia:
            errs.append(f"{where} chunk {n}: to before from")
            return
        if ib - ia + 1 > max_len:
            errs.append(f"{where} chunk {n}: {ib - ia + 1} verses, max {max_len}")
        i = ib + 1
    if i != len(vs):
        errs.append(f"{where}: chunks stop at {vs[i - 1]}, last verse is {vs[-1]}")


def texts(obj, path):
    """Every string in a guide, with where it sits ("kids.readings[Gospel].box")."""
    if isinstance(obj, str):
        yield path, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if k in ("from", "to"):
                continue
            yield from texts(v, f"{path}[{k}]" if path.endswith(".readings") else f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from texts(v, f"{path}[{i}]")


def first_sunday_of_advent(year):
    d = datetime.date(year, 11, 27)
    return d + datetime.timedelta(days=(6 - d.weekday()) % 7)


def sunday_cycle(d):
    """Lectionary year for Sundays: A for the year that begins in Advent 2025."""
    ends = d.year + (1 if d >= first_sunday_of_advent(d.year) else 0)
    return "ABC"[(ends - 2026) % 3]


def balanced(errs, where, s):
    if s.count('"') % 2:
        errs.append(f'{where}: an opening or closing " is missing')
    if s.count("“") != s.count("”"):
        errs.append(f"{where}: curly quotes do not pair up")


def wrong_day(errs, date, day, doc):
    d = datetime.date.fromisoformat(date)
    title = day["title"].lower()
    by_label = {r["l"]: r for r in day["r"]}
    gospel = EVANGELIST.get((by_label.get("Gospel") or {}).get("b"))
    psalm = by_label.get("Responsorial Psalm") or {}
    psalm_no = int(psalm["t"][0][0]) if psalm.get("b") == "PSA" and psalm.get("t") else None
    for where, s in texts({e: doc.get(e) or {} for e in EDITIONS}, ""):
        where = where.lstrip(".")
        if "!" in s:
            errs.append(f"{where}: exclamation mark (house style is none)")
        for m in EVANGELIST_RE.finditer(s):
            named = m.group(1) or m.group(2)
            if gospel and named != gospel:
                errs.append(f"{where}: names {named}'s Gospel, but today's Gospel is {gospel}")
        for m in NAMED_SUNDAY_RE.finditer(s):
            if m.group(0).lower() not in title and not RELATIVE_RE.search(s[max(0, m.start() - 25):m.start()]):
                errs.append(f'{where}: says "{m.group(0)}", but today is "{day["title"]}"')
        for m in YEAR_RE.finditer(s):
            if m.group(1) != sunday_cycle(d):
                errs.append(f"{where}: says Year {m.group(1)}, but {date} is in Year {sunday_cycle(d)}")
        if d.weekday() != 6 and SELF_SUNDAY_RE.search(s):
            errs.append(f"{where}: calls today Sunday, but {date} is a {d.strftime('%A')}")
        if "ordinary time" in title and re.search(r"\bAdvent\b", s):
            errs.append(f"{where}: mentions Advent on a Sunday in Ordinary Time")
        if "advent" in title and re.search(r"\bOrdinary Time\b", s):
            errs.append(f"{where}: mentions Ordinary Time in Advent")
        if where.endswith("readings[Responsorial Psalm].box"):
            for m in PSALM_RE.finditer(s):
                if psalm_no is None:
                    errs.append(f"{where}: names Psalm {m.group(1)}, but today's response is {psalm.get('c')}")
                elif int(m.group(1)) != psalm_no:
                    errs.append(f"{where}: names Psalm {m.group(1)}, but today's psalm is {psalm_no}")
        if ".chunks[" not in where:
            balanced(errs, where, s)
    for ed in ("plain", "kids"):
        for label, r in ((doc.get(ed) or {}).get("readings") or {}).items():
            balanced(errs, f"{ed}.readings[{label}] chunks", " ".join(c.get("text", "") for c in r.get("chunks") or []))


def main(date):
    rpath, path = READ / f"{date}.json", COMPANION / f"{date}.json"
    if not rpath.exists():
        print(f"no readings file {rpath}")
        return 1
    day = json.loads(rpath.read_text())
    if not path.exists():
        print(f"missing {path}")
        return 1
    doc = json.loads(path.read_text())
    errs = []
    if doc.get("date") != date:
        errs.append(f'"date" is {doc.get("date")!r}, file is {date}')
    by_label = {r["l"]: r for r in day["r"]}
    for ed, max_len in (("plain", 4), ("kids", 5)):
        e = doc.get(ed) or {}
        for k in ("headline", "intro", "listen"):
            if not str(e.get(k, "")).strip():
                errs.append(f"{ed}.{k} missing")
        rd = e.get("readings") or {}
        for label in rd:
            if label not in by_label:
                errs.append(f"{ed}.readings[{label}]: {date} has no such reading ({', '.join(by_label)})")
        for label in CHUNKED:
            if label not in by_label:
                continue
            r = rd.get(label) or {}
            if not str(r.get("box", "")).strip():
                errs.append(f"{ed}.readings[{label}].box missing")
            check_chunks(errs, f"{ed}.readings[{label}]", r.get("chunks"), verses(by_label[label]), max_len)
        if not str((rd.get("Responsorial Psalm") or {}).get("box", "")).strip():
            errs.append(f"{ed}.readings[Responsorial Psalm].box missing")
    p = doc.get("plain") or {}
    if not str(p.get("carry", "")).strip():
        errs.append("plain.carry missing")
    k = doc.get("kids") or {}
    w = k.get("word") or {}
    if not (str(w.get("term", "")).strip() and str(w.get("meaning", "")).strip()):
        errs.append("kids.word missing")
    for f in ("draw", "ask"):
        if not str(k.get(f, "")).strip():
            errs.append(f"kids.{f} missing")
    f = doc.get("family") or {}
    for key in ("opener", "try", "pray"):
        if not str(f.get(key, "")).strip():
            errs.append(f"family.{key} missing")
    qs = f.get("questions")
    if not (isinstance(qs, list) and len(qs) == 3 and all(isinstance(q, str) and q.strip() for q in qs)):
        errs.append("family.questions must be a list of 3")
    wrong_day(errs, date, day, doc)
    if errs:
        print("\n".join(errs))
        return 1
    print("OK")
    return 0


def obligation(d, title):
    if d.weekday() == 6 or (d.month, d.day) == (12, 25) or "ascension of the lord" in title.lower():
        return True
    if (d.month, d.day) == (12, 8):
        return True  # on a Sunday it is a Sunday anyway; the Monday it moves to carries no obligation
    if (d.month, d.day) in ((1, 1), (8, 15), (11, 1)):
        return d.weekday() not in (0, 5)
    return False


def calendar(start, end):
    """Every Sunday and US holy day of obligation in [start, end] has a draft."""
    errs, d = [], start
    while d <= end:
        s, rp = d.isoformat(), READ / f"{d.isoformat()}.json"
        title = json.loads(rp.read_text())["title"] if rp.exists() else ""
        if obligation(d, title):
            if not rp.exists():
                errs.append(f"{s}: no readings file")
            elif not (COMPANION / f"{s}.json").exists():
                errs.append(f"{s} {d.strftime('%a')} {title}: no companion draft")
        d += datetime.timedelta(days=1)
    return errs


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("dates", nargs="*")
    ap.add_argument("--from", dest="start", type=datetime.date.fromisoformat)
    ap.add_argument("--through", dest="end", type=datetime.date.fromisoformat)
    a = ap.parse_args()
    have = sorted(f.stem for f in COMPANION.glob("????-??-??.json"))
    dates = a.dates or have
    bad = 0
    for d in dates:
        print(d, end=" ")
        bad |= main(d)
    if (not a.dates or a.start or a.end) and have:
        start = a.start or datetime.date.fromisoformat(have[0])
        end = a.end or datetime.date.fromisoformat(have[-1])
        errs = calendar(start, end)
        print(f"calendar {start}..{end}", "OK" if not errs else "\n" + "\n".join(errs))
        bad |= bool(errs)
    sys.exit(bad)
