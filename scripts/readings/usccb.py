"""USCCB daily readings pages: polite cached fetch and fact extraction.

Only the day title, the lectionary number, the reading labels and the
citations are extracted. The NABRE verse text on these pages is
copyrighted and is never parsed into, or written to, any output. Raw HTML
is cached under scripts/readings/cache/usccb/ (gitignored) so reruns do
not hit the site again.
"""
import html as htmllib
import os
import re
import sys
import subprocess
import time

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "cache", "usccb")
BASE = "https://bible.usccb.org/bible/readings/"
# The site refuses browser and descriptive User-Agents with 403 but serves
# a plain curl UA (measured 2026-10-02).
USER_AGENT = "curl/8.7.1"
DELAY = 1.5
CHALLENGE_MARK = "Checking connection"

_last_request = [0.0]
_delay = [DELAY]
CHALLENGE_BACKOFF = 92


class FetchError(Exception):
    pass


def _curl(url):
    """GET with the system curl binary. Python's urllib is refused by the
    site's edge (403 challenge page) even with an identical User-Agent,
    while curl is served; curl ships with macOS and needs no install."""
    try:
        p = subprocess.run(
            ["curl", "-sS", "-A", USER_AGENT, "-w", "\n%{http_code}", "--max-time", "60", url],
            capture_output=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, ""
    out = p.stdout.decode("utf-8", "replace")
    body, _, code = out.rpartition("\n")
    try:
        return int(code), body
    except ValueError:
        return None, ""


def page_name(date, suffix=""):
    return date.strftime("%m%d%y") + (("-" + suffix) if suffix else "") + ".cfm"


def cache_path(name):
    return os.path.join(CACHE_DIR, name.replace("/", "_") + ".html")


def fetch(name, offline=False, log=sys.stderr):
    """Return HTML for a readings page name like '100426.cfm', from cache
    when present. Challenge pages and errors are never cached."""
    path = cache_path(name)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return f.read()
    if offline:
        raise FetchError(f"{name}: not cached and --offline given")
    os.makedirs(CACHE_DIR, exist_ok=True)
    url = BASE + name
    backoff = CHALLENGE_BACKOFF
    for attempt in range(8):
        wait = _delay[0] - (time.time() - _last_request[0])
        if wait > 0:
            time.sleep(wait)
        _last_request[0] = time.time()
        status, body = _curl(url)
        if status == 404:
            raise FetchError(f"{name}: 404")
        if status == 200 and CHALLENGE_MARK not in body:
            with open(path, "w", encoding="utf-8") as f:
                f.write(body)
            # Once the site has challenged us, keep the slower pace: in
            # measurement (2026-10-02) requests 81 s apart were challenged
            # and requests 90 s apart were served.
            return body
        why = "challenge page" if CHALLENGE_MARK in body else f"HTTP {status}"
        print(f"  {name}: {why}; waiting {backoff}s (attempt {attempt + 1})", file=log, flush=True)
        # The site's edge answers with its proof-of-work page when requests
        # come too close together; we do not solve it, we slow down.
        _delay[0] = max(_delay[0], float(CHALLENGE_BACKOFF))
        time.sleep(backoff)
        backoff = min(backoff * 2, 900)
    raise FetchError(f"{name}: gave up after repeated refusals")


def _text(fragment):
    t = re.sub(r"<br\s*/?>", " ", fragment)
    t = re.sub(r"<[^>]+>", "", t)
    t = htmllib.unescape(t)
    t = t.replace("\xa0", " ")
    return re.sub(r"\s+", " ", t).strip()


def parse(html):
    """Extract facts from a readings page.

    Returns {"title", "lectionary", "readings": [{"l", "c", "slugs"}],
    "links": [other readings page names on the same date]}.
    The content-body (NABRE text) is skipped entirely."""
    out = {"title": None, "lectionary": None, "readings": [], "links": []}
    m = re.search(r'<div class="wr-block b-lectionary[^"]*">(.*?)</div>\s*</div>\s*</div>\s*</div>', html, re.S)
    if m:
        block = m.group(1)
        h = re.search(r"<h2>(.*?)</h2>", block, re.S)
        if h:
            out["title"] = _text(h.group(1))
        lec = re.search(r"<p>\s*Lectionary:\s*([^<]*)</p>", block)
        if lec:
            out["lectionary"] = _text(lec.group(1))
    if not out["title"]:
        t = re.search(r"<title>(.*?)\s*\|\s*USCCB</title>", html, re.S)
        if t:
            out["title"] = _text(t.group(1))
    for hm in re.finditer(r'<div class="content-header">(.*?)</div>\s*</div>', html, re.S):
        hdr = hm.group(1)
        name = re.search(r'<h3 class="name">(.*?)</h3>', hdr, re.S)
        addr = re.search(r'<div class="address">(.*)', hdr, re.S)
        if not name:
            continue
        label = _text(name.group(1))
        cit = _text(addr.group(1)) if addr else ""
        slugs = re.findall(r'href="https?://bible\.usccb\.org/bible/([a-z0-9-]+)/', addr.group(1) if addr else "")
        out["readings"].append({"l": label, "c": cit, "slugs": slugs})
    for lm in re.finditer(r'href="(?:https?://bible\.usccb\.org)?/bible/readings/([0-9]{6}[^"#?]*\.cfm)"', html):
        if lm.group(1) not in out["links"]:
            out["links"].append(lm.group(1))
    return out


if __name__ == "__main__":
    import datetime
    d = datetime.date.fromisoformat(sys.argv[1])
    p = parse(fetch(page_name(d)))
    import json
    print(json.dumps(p, indent=1, ensure_ascii=False))
