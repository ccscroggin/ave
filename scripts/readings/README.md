# Daily Mass readings pipeline

Writes `content/readings/YYYY-MM-DD.json`, one file per day, for the US
Roman Catholic calendar.

```
# build from the cpbjr dataset (cloned once into cache/, pinned to a commit)
python3 scripts/readings/build.py --from 2027-01-12 --to 2027-11-27 --source cpbjr

# check everything and write docs/readings-report.md
python3 scripts/readings/validate.py --from 2026-10-01 --to 2027-11-27

# tests for the versification mapping and citation parsing
python3 scripts/readings/test_versification.py
```

`--source` picks where titles and citations come from:

| `--source` | Used for | Notes |
|---|---|---|
| `prototype` | 2026-10-01 to 2027-01-11 | `prototype-readings.json` (taken from USCCB pages in the design session) |
| `cpbjr` | 2027-01-12 to 2027-11-27 | [cpbjr/catholic-readings-api](https://github.com/cpbjr/catholic-readings-api), MIT, commit `973e9864eb0f15accadfc48750f5b243a95b7a2c` (2026-08-29), pinned in `cpbjr.py`. No Alleluia citations, so those days have no Alleluia entry. Titles are the dataset's calendar names. |
| `usccb` (default) | not used for the committed files | USCCB pages; `--offline` builds only from cached pages and skips the rest |

**Hand overrides.** `overrides.json` maps a date to `title`, `readings`
(a list of `[label, citation]` in order; labels may repeat, as at the
Easter Vigil) and optional `alt`. `build.py` applies it after whatever
source it used, so an override wins on every rebuild. Current entries:
2027-03-27 (Easter Vigil, flattened in the dataset), 2027-05-06
(the dataset put the Ascension on Thursday), 2027-11-25 (the dataset gave
the Thanksgiving Mass). To change one, edit the file and rebuild that
date, e.g. `build.py --from 2027-03-27 --to 2027-03-27 --source cpbjr`.

Other flags: `--edition` (default `eng-web-c`), `--replace-companion-days`
(by default a rebuild leaves the readings for dates that have
`content/companion/` files unchanged when the new build differs, and parks
the new build in `cache/proposed/`). `build-log.json` is merged by date, so
ranges can be built in pieces.

**USCCB fetch, stopped 2026-10-02.** The site serves `curl` but answers
anything faster than about one request per 90 s, and often slower ones,
with its proof-of-work page. The fetcher never solves it; it backs off.
At about 6 minutes per page the year would have taken two days, so the
fetch was stopped with 6 pages cached and the cpbjr dataset used instead.
Its citations were first checked against the prototype and those 6 pages
(see the report: 345 of 349 agree; the 4 differences are Thanksgiving 2026
and one misspelling). `fetch.py` still works if the USCCB source is
wanted later.

## Files

| File | Role |
|---|---|
| `fetch.py` | Fetches every USCCB page in a range (main page plus same-date sub-pages such as Vigil, Night, Dawn, Day). Resumable. |
| `usccb.py` | Polite cached fetch; extracts the day title, lectionary number, labels and citations. Never parses the verse text. |
| `citations.py` | Cleans formatting slips in source citations (spacing, `&`, upper-case verse letters, a missing "Psalm", two misspelled book names; numbers never change) and parses Lectionary citations (`Psalm 27:7-8a, 8b-9abc, 13-14`, `Galatians 4:22-24, 26-27, 31–5:1`, `Esther C:12, 14-16`) into NABRE verse lists. |
| `versification.py` | Maps NABRE verse numbers to World English Bible numbers. |
| `web.py` | Loads the World English Bible USFM into plain text per verse. |
| `assemble.py` | Resolves one citation to WEB verses and records every mapping decision. |
| `cpbjr.py` | Reads titles and citations from the pinned cpbjr dataset. |
| `build.py` | Picks the Mass for each day, writes the JSON files and `build-log.json`. |
| `validate.py` | Checks coverage, resolution, regression against `prototype-readings.json` and fixed spot checks; writes `docs/readings-report.md`. |

## Output shape

```json
{"date": "2026-10-25", "title": "Thirtieth Sunday in Ordinary Time",
 "r": [{"l": "Reading 1", "c": "Exodus 22:20-26", "b": "EXO",
        "t": [[22, 21, "“You shall not wrong an alien...", "22:20"], ...]}, ...],
 "alt": ["..."]}
```

`c` is the Lectionary citation (NABRE numbering). `t` holds
`[chapter, verse, text, nabre]`: chapter and verse in **World English
Bible numbering** (companion chunk keys use these), and `nabre`, the
Lectionary number of the same verse as `"ch:v"` (for example
`"22:20"` on WEB Exodus 22:21, `"16:25"` on WEB Romans 14:24). When
several NABRE verses fall in one WEB verse the label is a range,
`"1:14-15"` (3 John) or `"51:1-2"` (a psalm superscription the NABRE
counts as two verses). Show `nabre` to readers so the numbers match the
heading; partial-verse letters are not included because the whole verse
is printed. A partial
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
| Baruch 3:35-38 | 3:34-37 | NABRE follows the Greek, which splits English 3:34 in two; `org.vrs` counts 38 verses and `eng.vrs` 37, with no mapping line |
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
