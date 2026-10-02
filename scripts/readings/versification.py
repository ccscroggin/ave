"""Map Lectionary (NABRE) verse numbers to World English Bible numbers.

Model
-----
* NABRE numbering is treated as Paratext "original" (org.vrs) numbering:
  Hebrew numbering for the Old Testament (psalm superscriptions counted,
  Exodus 21:37, Malachi 3:19-24, Joel 3-4, 1 Kings 5, ...), Greek for the
  New Testament.
* The World English Bible uses English numbering, Paratext "English"
  (eng.vrs). eng.vrs lists its own mappings as "ENGLISH = ORIGINAL"; they
  are inverted here to go original -> English.
* A short table of explicit overrides covers places where NABRE is not
  org numbering, where eng.vrs has no rule, or where the eng-web files
  depart from eng.vrs. Every override is listed in OVERRIDES with its
  reason, and in README.md.

Daniel and Esther are read from the Greek editions in eng-web (DAG, ESG,
loaded under the book codes DAN and EST).
"""
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
VRS_DIR = os.path.join(HERE, "cache", "vrs")
VRS_URL = "https://raw.githubusercontent.com/ubsicap/versification_json/master/examples/{}.vrs"

# Books in eng.vrs mapping lines that are not part of this model (the Greek
# Daniel/Esther and the split-out additions are handled by overrides).
_IGNORE_BOOKS = {"ESG", "DAG", "S3Y", "SUS", "BEL", "LJE"}


def _ensure(name):
    path = os.path.join(VRS_DIR, name + ".vrs")
    if not os.path.exists(path):
        os.makedirs(VRS_DIR, exist_ok=True)
        req = urllib.request.Request(VRS_URL.format(name), headers={"User-Agent": "curl/8.7.1"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        with open(path, "wb") as f:
            f.write(data)
    with open(path, encoding="utf-8") as f:
        return f.read()


def _parse_lengths(text):
    lens = {}
    for line in text.splitlines():
        line = line.split("#")[0].strip()
        if not line or "=" in line:
            continue
        parts = line.split()
        if not re.fullmatch(r"[0-9A-Z]{3}", parts[0]):
            continue
        for p in parts[1:]:
            m = re.fullmatch(r"(\d+):(\d+)", p)
            if m:
                lens.setdefault(parts[0], {})[int(m.group(1))] = int(m.group(2))
    return lens


def _expand(ref):
    """'PSA 51:1-19' -> ('PSA', [(51,1),...,(51,19)])"""
    m = re.fullmatch(r"([0-9A-Z]{3}) (\d+):(\d+)(?:-(\d+))?", ref.strip())
    if not m:
        return None
    b, c, v1 = m.group(1), int(m.group(2)), int(m.group(3))
    v2 = int(m.group(4)) if m.group(4) else v1
    return b, [(c, v) for v in range(v1, v2 + 1)]


def _parse_mappings(text):
    """Return {(book, ch, v) in org: [(book, ch, v) in eng, ...]}."""
    out = {}
    for line in text.splitlines():
        line = line.split("#")[0].strip()
        if "=" not in line:
            continue
        left, right = [s.strip() for s in line.split("=")]
        a, b = _expand(left), _expand(right)
        if not a or not b:
            continue
        if a[0] in _IGNORE_BOOKS or b[0] in _IGNORE_BOOKS:
            continue
        eng_list, org_list = a[1], b[1]
        if len(eng_list) == len(org_list):
            pairs = zip(eng_list, org_list)
        elif len(eng_list) == 1:
            pairs = [(eng_list[0], o) for o in org_list]
        elif len(org_list) == 1:
            pairs = [(e, org_list[0]) for e in eng_list]
        else:
            raise ValueError(f"unequal mapping {line!r}")
        for e, o in pairs:
            out.setdefault((b[0],) + o, []).append((a[0],) + e)
    return out


# Explicit overrides: (book, ch, v, letters-or-None) -> [(book, ch, v)] in
# WEB numbering. letters=None matches any partial-verse letters.
OVERRIDES = {}
OVERRIDE_NOTES = []


def _override(key_from, targets, note):
    OVERRIDES[key_from] = targets
    OVERRIDE_NOTES.append((key_from, targets, note))


# Isaiah 63:19b (NABRE/Hebrew) is English 64:1; eng.vrs maps 64:1-11 ->
# 64:2-12 but leaves the half verse implicit.
_override(("ISA", 63, 19, "b"), [("ISA", 64, 1)], "NABRE Isa 63:19b = Eng 64:1 (Hebrew 63:19 is split in English)")
_override(("ISA", 63, 19, None), [("ISA", 63, 19), ("ISA", 64, 1)], "NABRE Isa 63:19 (whole) = Eng 63:19 + 64:1")
# Romans 16:25-27: eng-web prints the doxology at 14:24-26 (Byzantine
# placement) and leaves 16:25-27 empty.
for i in range(3):
    _override(("ROM", 16, 25 + i, None), [("ROM", 14, 24 + i)], "eng-web prints Rom 16:25-27 at 14:24-26")
# 2 Corinthians 13:12-13 (NABRE) = English 13:12-14.
_override(("2CO", 13, 12, None), [("2CO", 13, 12), ("2CO", 13, 13)], "NABRE 2 Cor 13:12 = Eng 13:12-13")
_override(("2CO", 13, 13, None), [("2CO", 13, 14)], "NABRE 2 Cor 13:13 = Eng 13:14")
# 3 John 14-15 (NABRE) = English 14.
_override(("3JN", 1, 15, None), [("3JN", 1, 14)], "NABRE 3 John 15 = Eng 3 John 14b")
# Revelation 12:18 (NABRE) = English 13:1a.
_override(("REV", 12, 18, None), [("REV", 13, 1)], "NABRE Rev 12:18 = Eng 13:1a")
# Baruch 3: NABRE follows the Greek, which splits English 3:34 into 3:34-35,
# so NABRE 3:35-38 = English 3:34-37. org.vrs counts 38 verses and eng.vrs
# 37, but eng.vrs has no mapping line for it.
for n in range(35, 39):
    _override(("BAR", 3, n, None), [("BAR", 3, n - 1)], "NABRE Baruch 3:35-38 = Eng 3:34-37 (Greek splits Eng 3:34)")
# Daniel: NABRE chapter 3 carries the Greek prayer (3:24-90) and so
# numbers the Hebrew 3:24-33 as 3:91-100. eng-web DAG uses the same Greek
# numbering for 3:1-97 and puts Hebrew 3:31-33 at 4:1-3.
for i in range(3):
    _override(("DAN", 3, 98 + i, None), [("DAN", 4, 1 + i)], "NABRE Dan 3:98-100 = eng-web (DAG) 4:1-3")
# Esther: NABRE numbers the Greek additions A-F. eng-web ESG appends
# Addition C (prayers of Mordecai and Esther) after 4:17 as 4:18-47,
# so C:n = 4:17+n.
for n in range(1, 31):
    _override(("EST", "C", n, None), [("EST", 4, 17 + n)], "NABRE Esther C:n = eng-web (ESG) 4:17+n")


class Versification:
    def __init__(self, web):
        self.web = web
        self.org_len = _parse_lengths(_ensure("org"))
        self.eng_len = _parse_lengths(_ensure("eng"))
        self.org_to_eng = _parse_mappings(_ensure("eng"))
        # NABRE chapter lengths: org.vrs, with Daniel's Greek chapters.
        self.nabre_len = {b: dict(c) for b, c in self.org_len.items()}
        self.nabre_len["DAN"][3] = 100
        self.nabre_len["DAN"][13] = 64
        self.nabre_len["DAN"][14] = 42

    def chapter_len(self, book, ch):
        if isinstance(ch, str):
            return None
        n = self.nabre_len.get(book, {}).get(ch)
        if n is None:
            n = len(self.web.get(book, {}).get(ch, {})) or None
        return n

    def map(self, book, ch, v, letters=""):
        """Return (targets, rule) where targets is a list of (book, ch, v)
        in WEB numbering and rule names what decided it."""
        key = (book, ch, v, letters or None)
        if letters and key in OVERRIDES:
            return OVERRIDES[key], "override"
        key_any = (book, ch, v, None)
        if key_any in OVERRIDES:
            return OVERRIDES[key_any], "override"
        if book == "DAN" and ch in (3, 13, 14):
            return [(book, ch, v)], "identity (Greek Daniel)"
        if (book, ch, v) in self.org_to_eng:
            return self.org_to_eng[(book, ch, v)], "eng.vrs"
        return [(book, ch, v)], "identity"


if __name__ == "__main__":
    import web as webmod
    vs = Versification(webmod.load())
    for ref in [("EXO", 22, 20), ("EXO", 22, 26), ("EXO", 21, 37), ("PSA", 51, 3), ("PSA", 80, 9),
                ("MAL", 3, 19), ("JOL", 3, 1), ("JOL", 4, 1), ("DAN", 3, 52), ("DAN", 6, 12),
                ("ISA", 64, 2), ("EST", "C", 12), ("ISA", 9, 1), ("SNG", 7, 1), ("HOS", 2, 16)]:
        print(ref, vs.map(*ref))
