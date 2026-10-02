"""Parse Lectionary citations (NABRE versification) into verse lists.

parse("Galatians 4:22-24, 26-27, 31–5:1") ->
    {"book": "GAL", "verses": [(4, 22, ""), ..., (4, 31, ""), (5, 1, "")],
     "alts": [], "prefix": ""}

Each verse is (chapter, verse, letters); letters ("a", "bc") mark a
partial verse, which the pipeline prints whole. Esther's Greek additions
use letter chapters (A-F) and are returned with the letter as chapter.
"""
import re

BOOKS = [
    ("Genesis", "GEN"), ("Exodus", "EXO"), ("Leviticus", "LEV"), ("Numbers", "NUM"),
    ("Deuteronomy", "DEU"), ("Joshua", "JOS"), ("Judges", "JDG"), ("Ruth", "RUT"),
    ("1 Samuel", "1SA"), ("2 Samuel", "2SA"), ("1 Kings", "1KI"), ("2 Kings", "2KI"),
    ("1 Chronicles", "1CH"), ("2 Chronicles", "2CH"), ("Ezra", "EZR"), ("Nehemiah", "NEH"),
    ("Tobit", "TOB"), ("Judith", "JDT"), ("Esther", "EST"), ("1 Maccabees", "1MA"),
    ("2 Maccabees", "2MA"), ("Job", "JOB"), ("Psalms", "PSA"), ("Psalm", "PSA"),
    ("Proverbs", "PRO"), ("Ecclesiastes", "ECC"), ("Qoheleth", "ECC"),
    ("Song of Songs", "SNG"), ("Song of Solomon", "SNG"), ("Wisdom", "WIS"),
    ("Sirach", "SIR"), ("Isaiah", "ISA"), ("Jeremiah", "JER"), ("Lamentations", "LAM"),
    ("Baruch", "BAR"), ("Ezekiel", "EZK"), ("Daniel", "DAN"), ("Hosea", "HOS"),
    ("Joel", "JOL"), ("Amos", "AMO"), ("Obadiah", "OBA"), ("Jonah", "JON"),
    ("Micah", "MIC"), ("Nahum", "NAM"), ("Habakkuk", "HAB"), ("Zephaniah", "ZEP"),
    ("Haggai", "HAG"), ("Zechariah", "ZEC"), ("Malachi", "MAL"),
    ("Matthew", "MAT"), ("Mark", "MRK"), ("Luke", "LUK"), ("John", "JHN"),
    ("Acts of the Apostles", "ACT"), ("Acts", "ACT"), ("Romans", "ROM"),
    ("1 Corinthians", "1CO"), ("2 Corinthians", "2CO"), ("Galatians", "GAL"),
    ("Ephesians", "EPH"), ("Philippians", "PHP"), ("Colossians", "COL"),
    ("1 Thessalonians", "1TH"), ("2 Thessalonians", "2TH"), ("1 Timothy", "1TI"),
    ("2 Timothy", "2TI"), ("Titus", "TIT"), ("Philemon", "PHM"), ("Hebrews", "HEB"),
    ("James", "JAS"), ("1 Peter", "1PE"), ("2 Peter", "2PE"), ("1 John", "1JN"),
    ("2 John", "2JN"), ("3 John", "3JN"), ("Jude", "JUD"), ("Revelation", "REV"),
]
BOOKS.sort(key=lambda x: -len(x[0]))
SINGLE_CHAPTER = {"OBA", "PHM", "2JN", "3JN", "JUD"}

DASH = "[-–—]"
_PREFIX = re.compile(r"^\s*((?:cf|see)\.?\s+)", re.I)


class CitationError(ValueError):
    pass


def _book(s):
    for name, code in BOOKS:
        if s.startswith(name) and (len(s) == len(name) or not s[len(name)].isalpha()):
            return code, name, s[len(name):].strip()
    raise CitationError(f"unknown book in {s!r}")


def _ref(tok):
    """'31' -> (None, 31, '') ; '5:1' -> (5, 1, '') ; '8abc' -> (None, 8, 'abc');
    'C:12' -> ('C', 12, '')."""
    tok = tok.strip()
    m = re.fullmatch(r"(?:(\d+|[A-F]):)?(\d+)([a-g]*)", tok)
    if not m:
        raise CitationError(f"bad verse token {tok!r}")
    ch = m.group(1)
    if ch is not None and ch.isdigit():
        ch = int(ch)
    return ch, int(m.group(2)), m.group(3)


def split_alternatives(text):
    """Split 'Mark 14:1—15:47 or 15:1-39' into ['Mark 14:1—15:47', 'Mark 15:1-39']."""
    parts = re.split(r"\s+or\s+", text.strip(), flags=re.I)
    out = []
    book_prefix = None
    for p in parts:
        p = p.strip()
        try:
            _, name, _ = _book(_PREFIX.sub("", p))
            book_prefix = name
            out.append(p)
        except CitationError:
            if book_prefix and re.match(r"^[\dA-F]", p):
                out.append(book_prefix + " " + p)
            else:
                out.append(p)
    return out


def parse(text, chapter_len):
    """Parse one citation. chapter_len(book, ch) -> last verse number in
    NABRE numbering, used only to expand ranges that cross chapters."""
    raw = text
    text = re.sub(r"\(.*?\)", "", text).strip()
    m = _PREFIX.match(text)
    prefix = ""
    if m:
        prefix = m.group(1).strip()
        text = text[m.end():]
    code, name, rest = _book(text)
    rest = rest.replace(" ", " ").strip()
    if not rest:
        raise CitationError(f"no verses in {raw!r}")
    verses = []
    ch = 1 if code in SINGLE_CHAPTER else None
    for seg in rest.split(";"):
        seg = seg.strip().rstrip(".")
        if not seg:
            continue
        for part in re.split(r",|\band\b", seg):
            part = part.strip()
            if not part:
                continue
            bounds = [b for b in re.split(DASH, part) if b.strip()]
            if len(bounds) > 2:
                # e.g. "9-10-11-12" (a typo on one page): first to last
                bounds = [bounds[0], bounds[-1]]
            c1, v1, l1 = _ref(bounds[0])
            if c1 is not None:
                ch = c1
            if ch is None:
                raise CitationError(f"no chapter for {part!r} in {raw!r}")
            start = (ch, v1, l1)
            if len(bounds) == 1:
                verses.append(start)
                continue
            c2, v2, l2 = _ref(bounds[1])
            end_ch = c2 if c2 is not None else ch
            if end_ch == ch:
                if v2 < v1:
                    raise CitationError(f"descending range {part!r} in {raw!r}")
                for v in range(v1, v2 + 1):
                    lt = l1 if v == v1 else (l2 if v == v2 else "")
                    verses.append((ch, v, lt))
            else:
                if not (isinstance(ch, int) and isinstance(end_ch, int) and end_ch > ch):
                    raise CitationError(f"bad cross-chapter range {part!r} in {raw!r}")
                c, v = ch, v1
                while (c, v) <= (end_ch, v2):
                    last = chapter_len(code, c)
                    if last is None:
                        raise CitationError(f"unknown length of {code} {c} in {raw!r}")
                    if v > last:
                        c, v = c + 1, 1
                        continue
                    lt = l1 if (c, v) == (ch, v1) else (l2 if (c, v) == (end_ch, v2) else "")
                    verses.append((c, v, lt))
                    v += 1
                ch = end_ch
    return {"book": code, "verses": verses, "prefix": prefix}


if __name__ == "__main__":
    import sys
    lens = lambda b, c: 40
    for t in sys.argv[1:]:
        print(t, "->", parse(t, lens))
