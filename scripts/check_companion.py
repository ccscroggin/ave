"""Validate a companion draft against its readings file.

Usage: python3 scripts/check_companion.py [DATE ...]   (no dates: check every companion file)
Prints OK or a list of problems. Exit code 1 on any problem.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
READ = ROOT / "content" / "readings"
COMPANION = ROOT / "content" / "companion"
CHUNKED = ("Reading 1", "Reading 2", "Gospel")


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


def main(date):
    day = json.loads((READ / f"{date}.json").read_text())
    path = COMPANION / f"{date}.json"
    if not path.exists():
        print(f"missing {path}")
        return 1
    doc = json.loads(path.read_text())
    errs = []
    by_label = {r["l"]: r for r in day["r"]}
    for ed, max_len in (("plain", 4), ("kids", 5)):
        e = doc.get(ed) or {}
        for k in ("headline", "intro", "listen"):
            if not str(e.get(k, "")).strip():
                errs.append(f"{ed}.{k} missing")
        rd = e.get("readings") or {}
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
    if not (isinstance(f.get("questions"), list) and len(f["questions"]) == 3):
        errs.append("family.questions must be a list of 3")
    if errs:
        print("\n".join(errs))
        return 1
    print("OK")
    return 0


if __name__ == "__main__":
    dates = sys.argv[1:] or sorted(f.stem for f in COMPANION.glob("????-??-??.json"))
    bad = 0
    for d in dates:
        print(d, end=" ")
        bad |= main(d)
    sys.exit(bad)
