"""World English Bible (ebible.org USFM) loader. Default edition eng-web-c.

Parses the USFM download into plain text, one string per verse:
footnotes, cross references, Strong's tags and other markup are removed,
curly quotes are kept. Psalm superscriptions (\\d) are stored as verse 0,
which is how the English versification numbers them.
"""
import io
import os
import re
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
EDITION = "eng-web-c"  # World English Bible (Catholic): US spelling, "the LORD"
USFM_URL = f"https://ebible.org/Scriptures/{EDITION}_usfm.zip"
USFM_DIR = os.path.join(CACHE, f"{EDITION}_usfm")


def use_edition(edition):
    global EDITION, USFM_URL, USFM_DIR
    EDITION = edition
    USFM_URL = f"https://ebible.org/Scriptures/{edition}_usfm.zip"
    USFM_DIR = os.path.join(CACHE, f"{edition}_usfm")

# USFM file code -> book code used in this pipeline. Daniel and Esther come
# from the Greek editions (DAG, ESG), which contain the deuterocanonical
# parts the Lectionary reads; the Hebrew-only DAN/EST files are not used.
FILE_BOOKS = {"DAG": "DAN", "ESG": "EST"}
SKIP_FILES = {"DAN", "EST", "FRT", "GLO"}

_NOTE = re.compile(r"\\(f|x|fe)\s.*?\\\1\*", re.S)
_WORD = re.compile(r"\\\+?w\s+([^|\\]*?)(?:\|[^\\]*?)?\\\+?w\*")
_CHAR_MARK = re.compile(r"\\\+?[a-z]+[0-9]*\*?")


def ensure_download():
    if os.path.isdir(USFM_DIR) and os.listdir(USFM_DIR):
        return
    os.makedirs(CACHE, exist_ok=True)
    zpath = os.path.join(CACHE, f"{EDITION}_usfm.zip")
    if not os.path.exists(zpath):
        req = urllib.request.Request(USFM_URL, headers={"User-Agent": "curl/8.7.1"})
        with urllib.request.urlopen(req, timeout=120) as r:
            data = r.read()
        with open(zpath, "wb") as f:
            f.write(data)
    with zipfile.ZipFile(zpath) as z:
        z.extractall(USFM_DIR)


def clean(text):
    text = _NOTE.sub("", text)
    # word-level markup: \w word|strong="H123"\w*  ->  word
    prev = None
    while prev != text:
        prev = text
        text = _WORD.sub(r"\1", text)
    text = _CHAR_MARK.sub("", text)
    text = text.replace("~", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:!?’”)])", r"\1", text)
    text = re.sub(r"([“‘(])\s+", r"\1", text)
    return text


def load():
    """Return {book: {chapter: {verse: text}}}. Empty-string text means the
    verse number exists in the WEB but its text is omitted there."""
    ensure_download()
    bible = {}
    for name in sorted(os.listdir(USFM_DIR)):
        if not name.endswith(".usfm"):
            continue
        with open(os.path.join(USFM_DIR, name), encoding="utf-8") as f:
            raw = f.read()
        m = re.search(r"\\id\s+(\S+)", raw)
        code = m.group(1)
        if code in SKIP_FILES:
            continue
        book = FILE_BOOKS.get(code, code)
        chapters = bible.setdefault(book, {})
        ch = None
        cur = None  # (ch, [verses])
        buf = []

        def flush():
            if ch is not None and cur is not None:
                t = clean(" ".join(buf))
                for v in cur:
                    chapters.setdefault(ch, {})[v] = t if len(cur) == 1 else (t if v == cur[0] else "")

        # Tokenise by paragraph markers at line starts and inline \v / \c.
        tokens = re.split(r"(\\(?:c|v|d|s\d?|ms\d?|mt\d?|sp|cl|cp|h|toc\d|id|ide|is\d?|ip|ili|imt\d?|rem|mr|r|b|p|m|mi|nb|pi\d?|pc|li\d?|q\d?|qa|qc|qr)\b)", raw)
        i = 1
        heading_markers = {"\\s", "\\ms", "\\mt", "\\sp", "\\cl", "\\cp", "\\h", "\\toc", "\\id",
                           "\\ide", "\\is", "\\ip", "\\ili", "\\imt", "\\rem", "\\mr", "\\r"}
        while i < len(tokens):
            mark = tokens[i]
            body = tokens[i + 1] if i + 1 < len(tokens) else ""
            i += 2
            base = re.sub(r"\d+$", "", mark)
            if mark == "\\c":
                flush()
                cur, buf = None, []
                mm = re.match(r"\s*(\d+)", body)
                ch = int(mm.group(1))
                continue
            if mark == "\\v":
                flush()
                mm = re.match(r"\s*(\d+)(?:-(\d+))?\s?(.*)", body, re.S)
                a = int(mm.group(1))
                b = int(mm.group(2)) if mm.group(2) else a
                cur = list(range(a, b + 1))
                buf = [mm.group(3)]
                continue
            if mark == "\\d":
                flush()
                cur, buf = [0], [body]
                continue
            if base in heading_markers:
                # heading text is not verse text; a heading ends a \d title
                if cur == [0]:
                    flush()
                    cur, buf = None, []
                continue
            # paragraph / poetry markers: text continues the current verse
            if cur is not None:
                buf.append(body)
        flush()
    return bible


if __name__ == "__main__":
    b = load()
    print(len(b), "books")
    print(b["PHP"][4][8])
    print(b["PSA"][51][0])
    print(b["PSA"][3][1])
    print(b["EXO"][22][21])
