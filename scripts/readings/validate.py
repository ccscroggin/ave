"""Validate content/readings/ and write docs/readings-report.md.

    python3 scripts/readings/validate.py --from 2026-10-01 --to 2027-11-27

Checks:
  1. every date has a file with a title and a Gospel with verses;
  2. every reading with a book resolved to at least one verse, and every
     cited verse was found in the WEB after versification mapping;
  3. regression against prototype-readings.json (titles, citations, text),
     with a reason for every difference;
  4. fixed spot checks (Exodus 22 mapping, Christmas Mass during the Day,
     Palm Sunday and Easter 2027 computed independently of the source).
Exits 1 if any hard check fails.
"""
import argparse
import collections
import datetime
import json
import os
import re
import sys

import web
import citations
import cpbjr
import usccb

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_DIR = os.path.join(ROOT, "content", "readings")
LOG_PATH = os.path.join(HERE, "build-log.json")
PROTO_PATH = os.path.join(HERE, "prototype-readings.json")
REPORT = os.path.join(ROOT, "docs", "readings-report.md")


def easter(year):
    """Anonymous Gregorian computus."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return datetime.date(year, month, day + 1)


def load_edition(name):
    web.use_edition(name)
    return web.load()


def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += datetime.timedelta(days=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", default="2026-10-01")
    ap.add_argument("--to", dest="end", default="2027-11-27")
    ap.add_argument("--no-report", action="store_true")
    a = ap.parse_args()
    start = datetime.date.fromisoformat(a.start)
    end = datetime.date.fromisoformat(a.end)
    with open(LOG_PATH, encoding="utf-8") as f:
        log = json.load(f)
    logdays = {d["date"]: d for d in log["days"]}
    edition = log.get("edition", "eng-web-c")

    hard = []          # failures that make the run red
    files = {}
    # ---- 1. coverage
    for d in daterange(start, end):
        iso = d.isoformat()
        path = os.path.join(OUT_DIR, iso + ".json")
        if not os.path.exists(path):
            hard.append(f"{iso}: no file")
            continue
        with open(path, encoding="utf-8") as f:
            e = json.load(f)
        files[iso] = e
        if e.get("date") != iso:
            hard.append(f"{iso}: date field is {e.get('date')!r}")
        if not e.get("title"):
            hard.append(f"{iso}: no title")
        for r in e["r"]:
            for item in r["t"]:
                if len(item) != 4 or not item[3]:
                    hard.append(f"{iso} {r['l']}: verse {item[:2]} has no NABRE label")
                    break
        gospels = [r for r in e["r"] if r["l"].lower().startswith("gospel")]
        if not gospels:
            hard.append(f"{iso}: no Gospel")
        elif not any(r["t"] for r in gospels):
            hard.append(f"{iso}: Gospel has no verses")

    # ---- 2. resolution
    unresolved, missing, omitted_web, skipped, fixes = [], [], [], [], []
    partials, cleaned, no_alleluia, no_title = [], [], [], []
    fix_pairs = collections.Counter()
    fix_readings = 0
    readings_total = 0
    labels = collections.Counter()
    for iso, e in files.items():
        dl = logdays.get(iso, {})
        for r in e["r"]:
            readings_total += 1
            labels[r["l"]] += 1
            if not r.get("b"):
                unresolved.append(f"{iso} {r['l']}: {r['c']}")
                continue
            if not r["t"]:
                unresolved.append(f"{iso} {r['l']}: {r['c']} (no verses)")
        if not any(r["l"] == "Alleluia" for r in e["r"]):
            no_alleluia.append(iso)
        if dl.get("source") == "cpbjr" and "title missing in source" in dl.get("problems", []):
            no_title.append(iso)
        for rl in dl.get("readings", []):
            if rl.get("clean_notes"):
                cleaned.append(f"{iso} {rl['label']}: “{rl['page_citation']}” → “{rl['citation']}” ({'; '.join(rl['clean_notes'])})")
            if rl.get("partials"):
                partials.append(f"{iso} {rl['label']} {rl['citation']}: printed whole " + ", ".join(rl["partials"]))
            if rl.get("error"):
                continue
            for n, w in rl.get("missing", []):
                missing.append(f"{iso} {rl['label']} {rl['citation']}: {n} -> {w} not in WEB")
            for n, w in rl.get("omitted_in_web", []):
                omitted_web.append(f"{iso} {rl['label']} {rl['citation']}: {n} -> {w} (number present, text omitted in WEB)")
            for s in rl.get("skipped_nabre_omitted", []):
                skipped.append(f"{iso} {rl['label']} {rl['citation']}: skipped {s} (not in the NABRE text)")
            if rl.get("fixes"):
                fix_readings += 1
                for n, w, rule in rl["fixes"]:
                    fix_pairs[(n.rstrip("abcdefg"), " + ".join(w), rule)] += 1
    for u in unresolved:
        hard.append("unresolved: " + u)
    for m in missing:
        hard.append("missing verse: " + m)

    # ---- 3. regression
    with open(PROTO_PATH, encoding="utf-8") as f:
        proto = json.load(f)
    webbe = load_edition("eng-webbe")
    ed_bible = load_edition(edition)
    reg = []           # (date, kind, detail)
    reg_counts = collections.Counter()
    for iso in sorted(proto):
        if iso not in files:
            reg.append((iso, "missing day", "no built file"))
            continue
        p, e = proto[iso], files[iso]
        if p["title"] != e["title"]:
            reg.append((iso, "title", f"prototype {p['title']!r} / built {e['title']!r}"))
        pc = [(r["l"], r["c"]) for r in p["r"]]
        ec = [(r["l"], r["c"]) for r in e["r"]]
        if pc != ec:
            reg.append((iso, "citations", f"prototype {pc} / built {ec}"))
        ebyl = {}
        for r in e["r"]:
            ebyl.setdefault((r["l"], r["c"]), r)
        dl = logdays.get(iso, {})
        rlog = {(x["label"], x["citation"]): x for x in dl.get("readings", [])}
        for r in p["r"]:
            er = ebyl.get((r["l"], r["c"]))
            if er is None:
                continue
            pt = [(c, v) for c, v, *_ in r["t"]]
            et = [(c, v) for c, v, *_ in er["t"]]
            rl = rlog.get((r["l"], r["c"]), {})
            if pt != et:
                if not r["t"] and r["b"] == "PSA":
                    kind = "psalm text added (prototype had none)"
                elif rl.get("fixes"):
                    kind = "versification fix"
                elif rl.get("skipped_nabre_omitted"):
                    kind = "NABRE-omitted verse skipped"
                else:
                    kind = "verse set differs (unexplained)"
                reg_counts[kind] += 1
                detail = f"{r['l']} {r['c']}: prototype {fmt(pt)} / built {fmt(et)}"
                if rl.get("fixes"):
                    detail += " | " + "; ".join(f"{n}->{'+'.join(w)}" for n, w, _ in rl["fixes"][:6])
                    if len(rl["fixes"]) > 6:
                        detail += f"; ... ({len(rl['fixes'])} verses)"
                if rl.get("skipped_nabre_omitted"):
                    detail += " | skipped " + ", ".join(rl["skipped_nabre_omitted"])
                reg.append((iso, kind, detail))
            # text of verses present in both
            pmap = {(c, v): t for c, v, t, *_ in r["t"]}
            for c, v, t, *_ in er["t"]:
                if (c, v) not in pmap or pmap[(c, v)] == t:
                    continue
                b = er["b"]
                pb = webbe.get(b, {}).get(c, {}).get(v)
                eb = ed_bible.get(b, {}).get(c, {}).get(v)
                if pmap[(c, v)] == pb and t == eb:
                    kind = f"wording: prototype used eng-webbe, built uses {edition}"
                    reg_counts[kind] += 1
                    continue
                kind = "verse text differs (unexplained)"
                reg_counts[kind] += 1
                reg.append((iso, kind, f"{b} {c}:{v}"))
    src_reg = source_regression(proto)
    unexplained = [x for x in reg if "unexplained" in x[1] or x[1] in ("missing day",)]

    # ---- 4. spot checks
    spots = []

    def spot(name, ok, detail=""):
        spots.append((name, ok, detail))
        if ok is False:
            hard.append(f"spot check failed: {name} {detail}")

    def pending(name, iso):
        if not (start <= datetime.date.fromisoformat(iso) <= end) or iso not in files:
            spots.append((name, None, f"{iso} not built yet"))
            return True
        return False

    e = files.get("2026-10-25")
    if e:
        r1 = next((r for r in e["r"] if r["l"] == "Reading 1"), None)
        ok = bool(r1) and r1["c"] == "Exodus 22:20-26" and r1["t"][0][:2] == [22, 21] and r1["t"][-1][:2] == [22, 27] \
            and r1["t"][0][2].lstrip("“\"").startswith("You shall not wrong")
        spot("2026-10-25 Reading 1 is WEB Exodus 22:21-27", ok,
             f"{r1['c']}: {r1['t'][0][:2]}..{r1['t'][-1][:2]} “{r1['t'][0][2][:45]}…”" if r1 else "no Reading 1")
    e = files.get("2026-12-25")
    if e:
        g = next((r for r in e["r"] if r["l"] == "Gospel"), None)
        ok = bool(g) and g["c"] == "John 1:1-18" and len(g["t"]) == 18
        others = [x for x in e.get("alt", []) if x.startswith("Other Mass")]
        spot("2026-12-25 is the Mass during the Day (Gospel John 1:1-18)", ok,
             f"title {e['title']!r}; Gospel {g['c'] if g else None}; {len(others)} other Masses in alt")
    ea = easter(2027)
    palm = ea - datetime.timedelta(days=7)
    spot("Easter 2027 computed", ea == datetime.date(2027, 3, 28), ea.isoformat())
    e = None if pending(f"{palm} is Palm Sunday with the Passion", palm.isoformat()) else files[palm.isoformat()]
    if e:
        g = next((r for r in e["r"] if r["l"] == "Gospel"), None)
        ok = "palm sunday" in e["title"].lower() and bool(g) and g["c"].startswith("Mark 14:1")
        spot(f"{palm} is Palm Sunday with the Passion (Year B: Mark)", ok,
             f"title {e['title']!r}; Gospel {g['c'] if g else None}, {len(g['t']) if g else 0} verses")
    e = None if pending(f"{ea} is Easter Sunday", ea.isoformat()) else files[ea.isoformat()]
    if e:
        ok = "easter sunday" in e["title"].lower() or "resurrection" in e["title"].lower()
        spot(f"{ea} is Easter Sunday", ok, f"title {e['title']!r}")
    e = files.get("2027-03-28") if start <= datetime.date(2027, 3, 28) <= end else None
    if e:
        spot("2027-03-28 is not Palm Sunday (the brief's first guess)", "palm" not in e["title"].lower(), e["title"])

    # ---- print
    print(f"files: {len(files)} of {(end - start).days + 1} dates; readings: {readings_total}")
    print(f"unresolved readings: {len(unresolved)}; missing verses: {len(missing)}; "
          f"verses with number but no text in WEB: {len(omitted_web)}; NABRE-omitted skipped: {len(skipped)}")
    print(f"cpbjr citation regression: {src_reg['summary']}")
    print(f"partial-verse citations printed whole: {len(partials)}; citations cleaned: {len(cleaned)}; "
          f"days without Alleluia: {len(no_alleluia)}; cpbjr days missing a title: {len(no_title)}")
    print(f"versification: {len(fix_pairs)} distinct verse mappings applied, in {fix_readings} readings")
    print("regression:", dict(reg_counts), f"titles/citations differences: {sum(1 for x in reg if x[1] in ('title', 'citations'))}")
    for s in spots:
        print({True: "PASS ", False: "FAIL ", None: "PENDING "}[s[1]] + s[0] + (f" — {s[2]}" if s[2] else ""))
    for h in hard:
        print("FAIL", h)
    for u in unexplained:
        print("UNEXPLAINED", u)

    if not a.no_report:
        extra = {"partials": partials, "cleaned": cleaned, "no_alleluia": no_alleluia, "no_title": no_title,
                 "src_reg": src_reg}
        write_report(log, files, start, end, readings_total, labels, unresolved, missing, omitted_web,
                     skipped, fix_pairs, fix_readings, reg, reg_counts, spots, hard, edition, extra)
    sys.exit(1 if hard else 0)


def source_regression(proto):
    """Compare cpbjr citations with the prototype and cached USCCB pages."""
    cpbjr.ensure()
    norm = lambda c: re.sub(r"\s+", " ", re.sub(r"[–—]", "-", citations.clean(c)[0])).strip() if c else c
    lab = lambda l: "Reading 1" if l == "Reading" else l
    tot = exact = equiv = 0
    mism = []

    def compare(where, iso, ref, cp, sundayish):
        nonlocal tot, exact, equiv
        for l in sorted(set(ref) | set(cp)):
            tot += 1
            a, b = ref.get(l), cp.get(l)
            if a == b:
                exact += 1
            elif a and b and norm(a) == norm(b):
                equiv += 1
            else:
                mism.append(f"{iso}{' (Sunday/solemnity)' if sundayish else ''} {l}: {where} “{a}” / cpbjr “{b}”")

    for iso in sorted(proto):
        d = datetime.date.fromisoformat(iso)
        got = cpbjr.day(d)
        if not got:
            mism.append(f"{iso}: no cpbjr data")
            continue
        ref = {lab(r["l"]): r["c"] for r in proto[iso]["r"] if r["l"] != "Alleluia"}
        sundayish = d.weekday() == 6 or "Solemnity" in proto[iso]["title"] or "Nativity" in proto[iso]["title"]
        compare("prototype", iso, ref, dict(got[1]), sundayish)
    n_usccb = 0
    for name in sorted(os.listdir(usccb.CACHE_DIR)) if os.path.isdir(usccb.CACHE_DIR) else []:
        if not re.fullmatch(r"\d{6}\.cfm\.html", name):
            continue
        d = datetime.datetime.strptime(name[:6], "%m%d%y").date()
        with open(os.path.join(usccb.CACHE_DIR, name), encoding="utf-8") as f:
            p = usccb.parse(f.read())
        got = cpbjr.day(d)
        ref = {lab(r["l"]): r["c"] for r in p["readings"] if r["l"] != "Alleluia"}
        n_usccb += 1
        compare("USCCB", d.isoformat() + " [USCCB page]", ref, dict(got[1]) if got else {}, d.weekday() == 6)
    ok = exact + equiv
    summary = (f"{ok} of {tot} citations agree ({100 * ok / tot:.1f}%): {exact} identical, {equiv} identical after "
               f"normalising dashes, spacing and trailing periods; {len(mism)} disagree "
               f"(prototype: {len(proto)} days; USCCB pages: {n_usccb} days)")
    return {"summary": summary, "mismatches": mism}


def fmt(refs):
    if not refs:
        return "(none)"
    if len(refs) <= 4:
        return ", ".join(f"{c}:{v}" for c, v in refs)
    return f"{refs[0][0]}:{refs[0][1]}..{refs[-1][0]}:{refs[-1][1]} ({len(refs)})"


def write_report(log, files, start, end, readings_total, labels, unresolved, missing, omitted_web, skipped,
                 fix_pairs, fix_readings, reg, reg_counts, spots, hard, edition, extra):
    alt_days = [(iso, e["alt"]) for iso, e in sorted(files.items()) if e.get("alt")]
    L = []
    L.append("# Daily readings: build report")
    L.append("")
    L.append(f"Generated by `scripts/readings/validate.py` on {datetime.date.today().isoformat()}. "
             f"Range {start} to {end}. Bible text: `{edition}` from ebible.org.")
    L.append("")
    L.append("## Counts")
    L.append("")
    L.append(f"- Dates in range: {(end - start).days + 1}; files written: {len(files)}")
    L.append(f"- Readings: {readings_total} ("
             + ", ".join(f"“{k}” {v}" for k, v in labels.most_common()) + ")")
    L.append(f"- Hard check failures: {len(hard)}")
    src = collections.Counter(d.get("source", "usccb") for d in log["days"] if d["date"] in files)
    L.append("- Source of titles and citations: " + ", ".join(f"{k} {v} days" for k, v in sorted(src.items())))
    L.append("")
    if src.get("prototype"):
        L.append("Days built from `prototype-readings.json` take their titles and citations from it, so the "
                 "title and citation half of the regression below is not an independent check for those days; "
                 "the verse half is (it compares the prototype's verses with this pipeline's mapping and text).")
        L.append("")
    if end < datetime.date(2027, 11, 27):
        L.append(f"The rest of the liturgical year ({end + datetime.timedelta(days=1)} to 2027-11-27) is not built yet: "
                 "the USCCB pages are still being fetched at the pace the site allows (about one page every "
                 "90 seconds). When the fetch finishes, rerun `build.py --offline` and `validate.py` over the "
                 "full range.")
        L.append("")
    held = [d["date"] for d in log["days"] if d.get("held_for_companion") and d["date"] in files]
    if held:
        L.append("Dates with companion text whose USCCB rebuild differed from the committed readings were left "
                 "unchanged (new build parked in `scripts/readings/cache/proposed/`): " + ", ".join(held) + ".")
        L.append("")
    L.append("## Spot checks")
    L.append("")
    for name, ok, detail in spots:
        L.append(f"- {({True: 'PASS', False: 'FAIL', None: 'PENDING'})[ok]}: {name}" + (f" ({detail})" if detail else ""))
    L.append("")
    L.append("## Unresolved citations")
    L.append("")
    if not unresolved and not missing:
        L.append("None. Every reading with a book citation resolved, and every cited verse was found after mapping.")
    for u in unresolved:
        L.append(f"- {u}")
    for m in missing:
        L.append(f"- {m}")
    L.append("")
    if omitted_web:
        L.append("Verses whose number exists in the WEB but whose text the WEB omits (left out of the output):")
        L.append("")
        for o in omitted_web:
            L.append(f"- {o}")
        L.append("")
    if skipped:
        L.append("Verses inside a cited range that the NABRE itself prints without text, skipped:")
        L.append("")
        for s in skipped:
            L.append(f"- {s}")
        L.append("")
    L.append("## Versification fixes applied")
    L.append("")
    L.append(f"{len(fix_pairs)} distinct NABRE-to-WEB verse mappings were applied, in {fix_readings} readings. "
             "Grouped by book and rule:")
    L.append("")
    by_book = collections.defaultdict(list)
    for (n, w, rule), cnt in fix_pairs.items():
        by_book[(n.split()[0], rule)].append((n, w, cnt))
    for (book, rule), items in sorted(by_book.items()):
        items.sort(key=lambda x: _refkey(x[0]))
        sample = ", ".join(f"{n.split(' ', 1)[1]}→{w.replace(book + ' ', '')}" for n, w, _ in items[:12])
        more = f", … ({len(items)} in all)" if len(items) > 12 else ""
        L.append(f"- {book} ({rule}): {sample}{more}")
    L.append("")
    sr = extra["src_reg"]
    L.append("## Citation source check (cpbjr dataset)")
    L.append("")
    L.append("Dates from 2027-01-12 take titles and citations from "
             f"[cpbjr/catholic-readings-api](https://github.com/cpbjr/catholic-readings-api) (MIT), commit `{cpbjr.COMMIT}`. "
             "Before building, its citations were compared with the prototype (2026-10-01 to 2027-01-11) and with the "
             "USCCB pages fetched before the fetch was stopped. Labels compared: Reading 1, Responsorial Psalm, Reading 2, "
             "Gospel (the dataset has no Alleluia).")
    L.append("")
    L.append(f"- {sr['summary']}")
    L.append("- Every mismatch:")
    for m in sr["mismatches"]:
        L.append(f"  - {m}")
    L.append("")
    L.append("Known limits of the dataset, for days built from it:")
    L.append("")
    L.append(f"- No Alleluia citation: {len([d for d in extra['no_alleluia'] if d >= '2027-01-12'])} days from 2027-01-12 have no Alleluia entry (the app handles that).")
    L.append("- Titles are the dataset's calendar names, in its own style (\"Tuesday of the 1st week of Ordinary Time\", "
             "\"Saint Bruno, Priest\" on optional memorials), not the USCCB wording. "
             + (f"Missing titles: {', '.join(extra['no_title'])}." if extra["no_title"] else "No title is missing."))
    L.append("- Three days had wrong data in the dataset and are set by hand in `scripts/readings/overrides.json`: "
             "2027-03-27 (the dataset flattened the Easter Vigil into four slots; now all seven readings, Epistle, "
             "psalms and Gospel), 2027-05-06 (the dataset put the Ascension on Thursday; now the Thursday of the Sixth "
             "Week of Easter, with the six provinces that keep Thursday noted in alt), 2027-11-25 (the dataset gave the "
             "Thanksgiving Mass under a saint's title; now the weekday, with Thanksgiving noted in alt). 2026-11-26, "
             "built from the prototype, already had the weekday readings.")
    L.append("- 2027-05-09 still carries the dataset's title \"7th Sunday of Easter\" over the Ascension readings, which "
             "most US provinces use that day. Not overridden.")
    L.append("- These were found by reading the built files for the major days; other dataset errors of the same kind "
             "would not be caught by validate.py, which checks citations resolve, not that they are the right ones.")
    L.append("")
    if extra["cleaned"]:
        L.append("Citation formatting slips in the source, normalised (numbers unchanged):")
        L.append("")
        for c in extra["cleaned"]:
            L.append(f"- {c}")
        L.append("")
    L.append("## Partial verses printed whole")
    L.append("")
    L.append(f"{len(extra['partials'])} readings cite part of a verse (a letter after the number). The spec prints the whole "
             "verse, so the text includes the half the Lectionary leaves out. Check these when the trimmed half matters "
             "(for example Isaiah 61:2b, \"the day of vengeance of our God\", which the Lectionary omits).")
    L.append("")
    for p in extra["partials"]:
        L.append(f"- {p}")
    L.append("")
    L.append("## Days with alternatives")
    L.append("")
    L.append(f"{len(alt_days)} days carry `alt` notes (other Masses of the day, optional or \"or\" readings not chosen).")
    L.append("")
    for iso, alts in alt_days:
        L.append(f"- {iso}: " + " | ".join(alts))
    L.append("")
    L.append("## Regression against the prototype (2026-10-01 to 2027-01-11)")
    L.append("")
    L.append("Summary of differences by reason:")
    L.append("")
    for k, v in reg_counts.most_common():
        unit = "verses" if k.startswith("wording") or "text differs" in k else "readings"
        L.append(f"- {k}: {v} {unit}")
    tc = [x for x in reg if x[1] in ("title", "citations", "missing day")]
    L.append(f"- title or citation differences: {len(tc)}")
    L.append("")
    if tc:
        L.append("Title and citation differences:")
        L.append("")
        for iso, kind, detail in tc:
            L.append(f"- {iso} {kind}: {detail}")
        L.append("")
    L.append("Verse-set differences, each with its reason:")
    L.append("")
    for iso, kind, detail in reg:
        if kind in ("title", "citations", "missing day"):
            continue
        L.append(f"- {iso} [{kind}] {detail}")
    L.append("")
    with open(REPORT, "w", encoding="utf-8") as f:
        f.write("\n".join(L))
    print(f"wrote {REPORT}")


def _refkey(ref):
    try:
        b, cv = ref.split(" ", 1)
        c, v = cv.split(":")
        return (b, int(c) if c.isdigit() else 0, int(v.rstrip("abcdefg")))
    except ValueError:
        return (ref, 0, 0)


if __name__ == "__main__":
    main()
