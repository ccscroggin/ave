"""Fetch (or confirm cached) USCCB readings pages for a date range.

Fetches the main page for each date and every other readings page that
the main page links to for the same date (vigil, night, dawn, day Masses
and similar). Resumes from cache; safe to interrupt and rerun.

    python3 scripts/readings/fetch.py --from 2026-10-01 --to 2027-11-27
"""
import argparse
import datetime
import sys

import usccb


def pages_for(date, offline=False, quiet=False):
    """Return [(name, parsed)] for the date's main page and its same-date
    sub-pages, in the order found."""
    main = usccb.page_name(date)
    prefix = main[:-4]
    seen, out, queue = set(), [], [main]
    while queue:
        name = queue.pop(0)
        if name in seen:
            continue
        seen.add(name)
        try:
            html = usccb.fetch(name, offline=offline)
        except usccb.FetchError as e:
            if not quiet:
                print(f"  {e}", file=sys.stderr)
            continue
        p = usccb.parse(html)
        out.append((name, p))
        for link in p["links"]:
            if link.startswith(prefix + "-") and link not in seen:
                queue.append(link)
    return out


def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += datetime.timedelta(days=1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="start", required=True)
    ap.add_argument("--to", dest="end", required=True)
    a = ap.parse_args()
    start = datetime.date.fromisoformat(a.start)
    end = datetime.date.fromisoformat(a.end)
    for d in daterange(start, end):
        pages = pages_for(d)
        names = [n for n, _ in pages]
        print(d.isoformat(), len(pages), " ".join(names[1:]), flush=True)


if __name__ == "__main__":
    main()
