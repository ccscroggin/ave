# Daily Mass readings pipeline

Writes `content/readings/YYYY-MM-DD.json`, one file per day, for the US
Roman Catholic calendar.

```
# 1. fetch USCCB pages (slow: the site allows about one page per 90 s; resumable)
python3 scripts/readings/fetch.py --from 2026-10-01 --to 2027-11-27

# 2. build any range from the cached pages only; dates not cached yet are skipped and listed
python3 scripts/readings/build.py --from 2026-10-01 --to 2027-11-27 --offline

# 3. check it and write docs/readings-report.md
python3 scripts/readings/validate.py --from 2026-10-01 --to 2027-11-27

# tests for the versification mapping
python3 scripts/readings/test_versification.py
```

`build.py` without `--offline` fetches any page it is missing, at the same
slow pace. `--source prototype` takes titles and citations from
`prototype-readings.json` instead of USCCB pages (used for 2026-10-01 to
2027-01-11 while the fetch runs). Builds can be run in pieces:
`build-log.json` is merged by date across runs, and a later USCCB build of
a date replaces its prototype build.

Status 2026-10-02: 2026-10-01 to 2027-01-11 is built from the prototype
citations. The rest of the year waits on the fetch; when it finishes,
run step 2 and 3 over the full range.

Python 3 standard library only. The USCCB pages are fetched with the
system `curl` binary (see below); nothing else is installed. No AI or LLM
calls. Everything downloaded is cached under `scripts/readings/cache/`
(gitignored), so a rerun is offline once the cache is warm
(`build.py --offline` refuses to touch the network).

## Files

| File | Role |
|---|---|
| `fetch.py` | Fetches every USCCB page in a range (main page plus same-date sub-pages such as Vigil, Night, Dawn, Day). Resumable. |
| `usccb.py` | Polite cached fetch; extracts the day title, lectionary number, labels and citations. Never parses the verse text. |
| `citations.py` | Parses Lectionary citations (`Psalm 27:7-8a, 8b-9abc, 13-14`, `Galatians 4:22-24, 26-27, 31–5:1`, `Esther C:12, 14-16`) into NABRE verse lists. |
| `versification.py` | Maps NABRE verse numbers to World English Bible numbers. |
| `web.py` | Loads the World English Bible USFM into plain text per verse. |
| `assemble.py` | Resolves one citation to WEB verses and records every mapping decision. |
| `build.py` | Picks the Mass for each day, writes the JSON files and `build-log.json`. |
| `validate.py` | Checks coverage, resolution, regression against `prototype-readings.json` and fixed spot checks; writes `docs/readings-report.md`. |

## Output shape

```json
{"date": "2026-10-25", "title": "Thirtieth Sunday in Ordinary Time",
 "r": [{"l": "Reading 1", "c": "Exodus 22:20-26", "b": "EXO",
        "t": [[22, 21, "“You shall not wrong an alien..."], ...]}, ...],
 "alt": ["..."]}
```

`c` is the citation as printed by the USCCB (NABRE numbering). `t` holds
`[chapter, verse, text]` in **World English Bible numbering**, so `c`
and `t` can disagree on numbers by design (the example above). A partial
verse (`8a`, `9abc`) is printed whole. `alt` is present only when the day
has other Masses or optional readings that were not chosen.

## Sources

1. **Titles and citations:** `https://bible.usccb.org/bible/readings/MMDDYY.cfm`.
   Only the title and the label/citation pairs are read. The NABRE text on
   those pages is copyrighted; it is cached as raw HTML only so reruns do
   not hit the site, and is never parsed or written anywhere.
   - One request at a time, at least 1.5 s apart.
   - The site answers Python's `urllib` with a 403 challenge page even with
     a curl User-Agent, and answers browser and descriptive User-Agents
     the same way, while it serves the `curl` binary with UA `curl/8.7.1`.
     So `usccb.py` shells out to `curl`. When the site still returns its
     "Checking connection" proof-of-work page, the fetcher does not try to
     solve it: it backs off (60 s, doubling to 10 min) and retries, and
     never caches a challenge page.
2. **Bible text:** World English Bible (Catholic), `eng-web-c` USFM from
   `https://ebible.org/Scriptures/eng-web-c_usfm.zip`: American spelling,
   Catholic canon, and "the LORD" where `eng-web` prints "Yahweh" (Catholic
   liturgy does not print the divine name; owner decision 2026-10-02).
   `build.py --edition <id>` selects another ebible.org edition; the
   prototype was built from `eng-webbe` (British spelling), which is why
   the regression check reports spelling differences as edition wording. Footnotes, cross references and
   Strong's markup are removed; curly quotes are kept. Psalm
   superscriptions (`\d`) are kept as verse 0, matching English
   numbering. Daniel and Esther are taken from the Greek editions in the
   download (`DAG`, `ESG`), which contain the parts the Lectionary reads;
   they are written with book codes `DAN` and `EST`.
3. **Versification data:** Paratext `org.vrs` and `eng.vrs` from
   `https://github.com/ubsicap/versification_json` (`examples/`).

## Versification

NABRE numbering is treated as Paratext *original* numbering (Hebrew for
the Old Testament, Greek for the New). The WEB uses Paratext *English*
numbering. `eng.vrs` lists its mappings as `ENGLISH = ORIGINAL`; the
pipeline inverts them, so a cited NABRE verse is looked up at its English
number. This covers, among others:

- Exodus 21:37 / 22:1-30 → 22:1 / 22:2-31 (so Exodus 22:20-26 → WEB 22:21-27)
- Psalm superscriptions counted as verses (Psalm 51:3-4 → 51:1-2, Psalm 80:9 → 80:8)
- Malachi 3:19-24 → 4:1-6; Joel 3:1-5 → 2:28-32, Joel 4 → 3
- 1 Kings 5:1-14 → 4:21-34, 5:15-32 → 5:1-18; Hosea 2, 12, 14; Nehemiah 3:33-38 / 4 / 10;
  Jonah 2; Micah 4:14 / 5; Zechariah 2:1-17; Song of Songs 7; Isaiah 8:23 / 9 and 64;
  Jeremiah 8:23; Job 40-41; Daniel 4 and 6; Nahum 2; and the rest of `eng.vrs`.

Explicit overrides (in `versification.py`, `OVERRIDES`), for places where
NABRE is not *original* numbering, where `eng.vrs` has no rule, or where
the WEB files depart from `eng.vrs`:

| NABRE | WEB | Why |
|---|---|---|
| Daniel 3:1-97 | DAG 3:1-97 | NABRE and the WEB's Greek Daniel both number the Greek prayer as 3:24-90 and the Hebrew 3:24-30 as 3:91-97 |
| Daniel 3:98-100 | DAG 4:1-3 | Hebrew 3:31-33; the WEB puts them at 4:1-3 |
| Daniel 13, 14 | DAG 13, 14 | Susanna, Bel and the Dragon: same numbering |
| Esther C:1-30 | ESG 4:18-47 | the WEB appends Addition C after 4:17 |
| Isaiah 63:19b | 64:1 | Hebrew 63:19 is split across English 63:19 / 64:1; `eng.vrs` leaves the half verse implicit |
| Romans 16:25-27 | 14:24-26 | the WEB prints the doxology at the end of chapter 14 and leaves 16:25-27 empty |
| 2 Corinthians 13:12 / 13:13 | 13:12-13 / 13:14 | English splits NABRE 13:12 |
| 3 John 15 | 14 | English joins NABRE 14-15 |
| Revelation 12:18 | 13:1 | English joins NABRE 12:18 to 13:1 |

Verses that the NABRE prints as a number without text (later
manuscript additions such as Luke 17:36, Mark 9:44, 46, John 5:4) are
skipped when they fall inside a cited range, because the WEB prints them.
The list is `NABRE_OMITTED` in `assemble.py`.

Known limits, reported rather than papered over:

- **Tobit.** The NABRE translates the long (Sinaiticus) Greek text; the
  WEB translates the short one. Verse numbers mostly line up, but the
  content of a verse can differ, so partial-verse citations in Tobit
  (`8:4-9a`) may print a WEB verse whose wording covers a little more or
  less than the Lectionary's half verse.
- **Sirach** has a few places where the WEB's verse division differs from
  `eng.vrs` (chapters 23, 33, 41). None is cited in the current range;
  `validate.py` reports any cited verse that cannot be found.
- Partial verses are printed whole, as the spec asks.

## Choosing the Mass

- Days with several Masses (Christmas, Easter, vigils of solemnities,
  All Souls): the Mass during the Day when the USCCB offers one; the others
  are listed in `alt` with their citations.
- "or" in a citation: the first option is used, the rest go to `alt`.
- A label repeated on one page (an optional memorial's proper readings, a
  second Gospel): the first is used, the rest go to `alt`.
