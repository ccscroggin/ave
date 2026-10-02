"""Build content/readings/YYYY-MM-DD.json for a date range.

    python3 scripts/readings/build.py --from 2026-10-01 --to 2027-11-27

Day titles and citations come from the USCCB daily readings pages (facts
only; see usccb.py). Verse text is the World English Bible from
ebible.org, mapped from NABRE to English versification (versification.py).
Rerunnable: everything fetched is cached under scripts/readings/cache/.
A machine-readable log of every decision is written to
scripts/readings/build-log.json for validate.py and the report.
"""
import argparse
import datetime
import json
import os
import re
import sys

import assemble
import citations
import cpbjr
import fetch
import usccb
import versification
import web

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "content", "readings")
LOG_PATH = os.path.join(HERE, "build-log.json")
PROTO_PATH = os.path.join(HERE, "prototype-readings.json")
COMPANION_DIR = os.path.join(ROOT, "content", "companion")
PROPOSED_DIR = os.path.join(HERE, "cache", "proposed")

# Sub-page name fragments, in order of preference, for the Mass to print
# when a date has several (Christmas, Easter, vigils, All Souls).
DAY_MASS_HINTS = ["day", "mass-during-the-day", "during-the-day"]


def _is_readings(p):
    return any(r["l"].lower().startswith("gospel") for r in p["readings"])


def _summary(name, p):
    cits = "; ".join(f"{r['l']}: {r['c']}" for r in p["readings"] if r["c"])
    return f"{p['title'] or name}: {cits}"


def choose_mass(pages):
    """pages: [(name, parsed)] main first. Returns (chosen, others)."""
    with_readings = [(n, p) for n, p in pages if _is_readings(p)]
    if not with_readings:
        return None, pages
    main_name, main = pages[0]
    subs = [(n, p) for n, p in with_readings if n != main_name]

    def is_day(n, p):
        suffix = n[7:-4].lower() if len(n) > 10 else ""
        title = (p["title"] or "").lower()
        return any(h == suffix or suffix.endswith(h) for h in DAY_MASS_HINTS) or "mass during the day" in title

    day = [(n, p) for n, p in with_readings if is_day(n, p)]
    if day:
        chosen = day[0]
    elif _is_readings(main):
        chosen = (main_name, main)
    else:
        chosen = subs[0]
    others = [(n, p) for n, p in with_readings if n != chosen[0]]
    return chosen, others


def prototype_pages(proto, date):
    """Present a prototype-readings.json day in the same shape usccb.parse
    returns, so build_day treats both sources alike."""
    day = proto.get(date.isoformat())
    if not day:
        return []
    p = {"title": day["title"], "lectionary": None, "links": [],
         "readings": [{"l": r["l"], "c": r["c"], "slugs": []} for r in day["r"]]}
    return [("prototype:" + date.isoformat(), p)]


def cpbjr_pages(date):
    """Present a cpbjr dataset day in usccb.parse's shape. The dataset has
    no Alleluia citation, so none is emitted."""
    got = cpbjr.day(date)
    if got is None:
        return []
    title, items = got
    p = {"title": title, "lectionary": None, "links": [],
         "readings": [{"l": l, "c": c.rstrip(". "), "slugs": []} for l, c in items]}
    return [("cpbjr:" + date.isoformat(), p)]


def build_day(date, pages, bible, vs, log):
    chosen, others = choose_mass(pages)
    entry = {"date": date.isoformat(), "title": None, "r": []}
    day_log = {"date": date.isoformat(), "page": None, "readings": [], "alt": [], "problems": []}
    if chosen is None:
        day_log["problems"].append("no page with readings")
        return None, day_log
    name, p = chosen
    day_log["page"] = name
    entry["title"] = p["title"]
    if not p["title"]:
        day_log["problems"].append("title missing in source")
    alt = []
    for n, op in others:
        alt.append("Other Mass. " + _summary(n, op))
    seen_labels = set()
    for r in p["readings"]:
        label, cit = r["l"].strip(), r["c"].strip()
        if not cit:
            day_log["problems"].append(f"{label}: no citation on page")
            continue
        cit, clean_notes = citations.clean(cit, label)
        options = citations.split_alternatives(cit)
        main_cit = options[0]
        # A repeated label is a second option for the same reading
        # (for example an optional memorial's proper readings, or a
        # shorter form). Keep the first, note the rest.
        key = label.lower()
        if key in seen_labels and re.match(r"^(reading \d|reading|responsorial psalm|alleluia|gospel|epistle)$", key):
            alt.append(f"{label} (alternative): {cit}")
            continue
        seen_labels.add(key)
        for o in options[1:]:
            alt.append(f"{label}: or {o}")
        item = {"l": label, "c": main_cit}
        rl = {"label": label, "citation": main_cit, "page_citation": r["c"].strip(), "clean_notes": clean_notes}
        try:
            res = assemble.resolve(main_cit, bible, vs)
        except citations.CitationError as e:
            item["b"] = None
            item["t"] = []
            rl["error"] = str(e)
            day_log["problems"].append(f"{label}: {e}")
            entry["r"].append(item)
            day_log["readings"].append(rl)
            continue
        item["b"] = res["book"]
        item["t"] = res["verses"]
        rl.update({k: res[k] for k in ("book", "missing", "omitted_in_web", "skipped_nabre_omitted", "fixes", "partials")})
        rl["count"] = len(res["verses"])
        entry["r"].append(item)
        day_log["readings"].append(rl)
    if alt:
        entry["alt"] = alt
    day_log["alt"] = alt
    return entry, day_log


def dumps(entry):
    """Compact, diff-friendly JSON: one verse per line."""
    j = lambda x: json.dumps(x, ensure_ascii=False)
    lines = ["{" + f'"date": {j(entry["date"])}, "title": {j(entry["title"])}, "r": [']
    for i, r in enumerate(entry["r"]):
        head = f' {{"l": {j(r["l"])}, "c": {j(r["c"])}, "b": {j(r["b"])}, "t": ['
        verses = [f"  {j(v)}" for v in r["t"]]
        tail = "]}" + ("," if i < len(entry["r"]) - 1 else "")
        if verses:
            lines.append(head)
            lines.append(",\n".join(verses) + tail)
        else:
            lines.append(head + tail)
    end = "]"
    if entry.get("alt"):
        end += ', "alt": [\n' + ",\n".join(f"  {j(a)}" for a in entry["alt"]) + "]"
    lines.append(end + "}")
    return "\n".join(lines) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True)
    ap.add_argument("--edition", default="eng-web-c",
                    help="ebible.org edition id (default eng-web-c: WEB Catholic, US spelling, 'the LORD')")
    ap.add_argument("--offline", action="store_true",
                    help="use cached USCCB pages only; dates not yet cached are skipped and listed")
    ap.add_argument("--source", choices=["usccb", "prototype", "cpbjr"], default="usccb",
                    help="where titles and citations come from: usccb pages, prototype-readings.json, or the cpbjr dataset")
    ap.add_argument("--replace-companion-days", action="store_true",
                    help="overwrite readings for dates that have content/companion/ files")
    a = ap.parse_args()
    web.use_edition(a.edition)
    bible = web.load()
    vs = versification.Versification(bible)
    start = datetime.date.fromisoformat(a.start)
    end = datetime.date.fromisoformat(a.end)
    os.makedirs(OUT_DIR, exist_ok=True)
    # The log is merged across runs, so a range can be built in pieces.
    log = {"edition": a.edition, "days": []}
    if os.path.exists(LOG_PATH):
        with open(LOG_PATH, encoding="utf-8") as f:
            old = json.load(f)
        if old.get("edition") == a.edition:
            log["days"] = old.get("days", [])
    bydate = {d["date"]: d for d in log["days"]}
    proto = None
    if a.source == "cpbjr":
        cpbjr.ensure()
    if a.source == "prototype":
        with open(PROTO_PATH, encoding="utf-8") as f:
            proto = json.load(f)
    written, skipped, held = 0, [], []
    for d in fetch.daterange(start, end):
        if a.source == "cpbjr":
            pages = cpbjr_pages(d)
        elif proto is not None:
            pages = prototype_pages(proto, d)
        else:
            pages = fetch.pages_for(d, offline=a.offline, quiet=a.offline)
        if not pages:
            skipped.append(d.isoformat())
            continue
        entry, day_log = build_day(d, pages, bible, vs, log)
        day_log["source"] = a.source
        bydate[d.isoformat()] = day_log
        if entry is None:
            print(f"{d}: NO READINGS ({'; '.join(day_log['problems'])})", file=sys.stderr)
            continue
        out_path = os.path.join(OUT_DIR, f"{d.isoformat()}.json")
        text = dumps(entry)
        comp = os.path.join(COMPANION_DIR, f"{d.isoformat()}.json")
        if not a.replace_companion_days and os.path.exists(comp) and os.path.exists(out_path):
            with open(out_path, encoding="utf-8") as f:
                current = f.read()
            if current != text:
                # A companion text was written against the existing readings;
                # do not change them silently. Park the new build for review.
                os.makedirs(PROPOSED_DIR, exist_ok=True)
                with open(os.path.join(PROPOSED_DIR, f"{d.isoformat()}.json"), "w", encoding="utf-8") as f:
                    f.write(text)
                held.append(d.isoformat())
                day_log["held_for_companion"] = True
                print(f"{d} HELD (has companion text; new build differs, see cache/proposed/)", flush=True)
                continue
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        written += 1
        probs = day_log["problems"] + [f"{r['label']}: missing {m}" for r in day_log["readings"] for m in r.get("missing", [])]
        flag = f"  !! {'; '.join(map(str, probs))}" if probs else ""
        print(f"{d} {entry['title'][:70]}{flag}", flush=True)
    log["days"] = [bydate[k] for k in sorted(bydate)]
    log["override_notes"] = [{"from": list(map(str, k)), "to": [" ".join(map(str, t)) for t in v], "note": n}
                             for k, v, n in versification.OVERRIDE_NOTES]
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(log, f, ensure_ascii=False, indent=1)
    print(f"wrote {written} files to {OUT_DIR}")
    if held:
        print(f"held {len(held)} companion dates unchanged (rerun with --replace-companion-days to overwrite): {', '.join(held)}")
    if skipped:
        print(f"skipped {len(skipped)} dates with no source data yet: {skipped[0]} .. {skipped[-1]}")


if __name__ == "__main__":
    main()
