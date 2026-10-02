"""Turn one Lectionary citation into WEB verses, recording how every verse
was resolved, for build.py and validate.py."""
import citations

# Verses the NABRE prints as a number with no text (later manuscript
# additions). eng-web includes them, so a Lectionary range that spans one
# must skip it. Only applied inside ranges; a verse cited on its own is kept.
NABRE_OMITTED = {
    ("MAT", 17, 21), ("MAT", 18, 11), ("MAT", 23, 14),
    ("MRK", 7, 16), ("MRK", 9, 44), ("MRK", 9, 46), ("MRK", 11, 26), ("MRK", 15, 28),
    ("LUK", 17, 36), ("LUK", 23, 17),
    ("JHN", 5, 4),
    ("ACT", 8, 37), ("ACT", 15, 34), ("ACT", 24, 7), ("ACT", 28, 29),
    ("ROM", 16, 24),
}


def resolve(citation, web, vs):
    """Return dict with keys:
      book, verses [[ch, v, text]], prefix,
      missing [(nabre ref, web ref)], omitted_in_web [...],
      skipped_nabre_omitted [...], fixes [(nabre ref, web refs, rule)]."""
    p = citations.parse(citation, vs.chapter_len)
    book = p["book"]
    out = {"book": book, "verses": [], "prefix": p["prefix"], "missing": [],
           "omitted_in_web": [], "skipped_nabre_omitted": [], "fixes": [], "partials": []}
    labels = {}  # WEB (b, c, x) -> [(nabre ch, nabre v)]
    seen = set()
    explicit_single = len(p["verses"]) == 1
    for ch, v, letters in p["verses"]:
        if (book, ch, v) in NABRE_OMITTED and not explicit_single:
            out["skipped_nabre_omitted"].append(f"{book} {ch}:{v}")
            continue
        targets, rule = vs.map(book, ch, v, letters)
        nref = f"{book} {ch}:{v}{letters}"
        if letters:
            out["partials"].append(f"{ch}:{v}{letters}")
        for t in targets:
            labels.setdefault(t, [])
            if (ch, v) not in labels[t]:
                labels[t].append((ch, v))
        if [(book, ch, v)] != targets:
            out["fixes"].append((nref, [f"{b} {c}:{x}" for b, c, x in targets], rule))
        for b, c, x in targets:
            if (b, c, x) in seen:
                continue
            seen.add((b, c, x))
            text = web.get(b, {}).get(c, {}).get(x)
            if text is None:
                out["missing"].append((nref, f"{b} {c}:{x}"))
            elif text == "":
                out["omitted_in_web"].append((nref, f"{b} {c}:{x}"))
            else:
                out["verses"].append([c, x, text, (b, c, x)])
    for item in out["verses"]:
        item[3] = nabre_label(labels.get(item[3], []))
    return out


def nabre_label(refs):
    """Lectionary (NABRE) number for a printed WEB verse: "ch:v", or
    "ch:v-w" when several NABRE verses fall in one WEB verse (3 John 14-15,
    a psalm superscription counted as verses 1-2)."""
    if not refs:
        return None
    (c1, v1), (c2, v2) = refs[0], refs[-1]
    if len(refs) == 1:
        return f"{c1}:{v1}"
    if c1 == c2:
        return f"{c1}:{v1}-{v2}"
    return f"{c1}:{v1}-{c2}:{v2}"
