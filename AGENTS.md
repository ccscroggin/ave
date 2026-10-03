# Notes for AI coding agents

Ave welcomes contributions made with AI coding agents (Claude Code, Codex,
Cursor and others). Read this file first. A person still opens and stands
behind every pull request.

## What Ave is

A free web app: a guided rosary, the day's Mass readings, and printable
missalettes with plain-language guides (Plain, Kids, Family). See
[README.md](README.md) for the layout of the repo.

## Rules that must not change

1. **No guide text is published without a reviewer's approval.** The public
   build (`scripts/build.mjs`) and the live endpoint (`api/companion.js`)
   only serve approved editions. Do not weaken either, and do not add a
   path around them.
2. **Guides say how they were made.** Every guide shown to the public says
   it was written with AI help; drafts say they are not yet reviewed by a
   priest. Keep those labels.
3. **Ave handles no money.** No payments, donations, ads, affiliate links or
   trackers. People who want to give are sent to Catholic charities.
4. **Nothing identifies the people who use it.** No accounts, analytics or
   third-party scripts beyond Google Fonts.
5. **No secrets in the repo.** Review and owner links are secrets.

## Drafting guide text

Agents may draft guides in `content/companion/YYYY-MM-DD.json` with
`"review": {"status": "draft"}`. A draft never appears in the public app
until a reviewer approves it on `/review`. Follow the rules in
[CONTRIBUTING.md](CONTRIBUTING.md#rules-for-guide-text): faithful to Church
teaching, add nothing to the reading, never invent a quotation, short plain
sentences. Use the verse numbers in `content/readings/DATE.json` (World
English Bible numbering), and run:

```bash
python3 scripts/check_companion.py DATE
```

## Before you open a pull request

```bash
node scripts/build.mjs
node --import ./scripts/test/register.mjs scripts/test/review.test.mjs
python3 scripts/check_companion.py
python3 scripts/readings/validate.py --no-report
```

- Keep each pull request to one change, and say what you ran and saw.
- Plain HTML, CSS and JavaScript in the browser; no framework, no new
  browser dependencies.
- Readings data changes go through `scripts/readings/` and
  `scripts/readings/overrides.json`, not hand edits to `content/readings/`.

## Good places to start

Issues labeled `good first issue` or `help wanted`:
https://github.com/ccscroggin/ave/issues
