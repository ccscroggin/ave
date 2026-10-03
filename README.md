# Ave

Pray the rosary, read the day’s Mass readings, and print a small missalette
with a guide in plain words. Free, with no ads and no tracking. Ave takes
no money: people print booklets themselves, and anyone who wants to give is
pointed to Catholic charities.

**Use it:** https://ave-daily.vercel.app
**Help with it:** see [CONTRIBUTING.md](CONTRIBUTING.md). Priests, deacons,
catechists, teachers, parents and developers are all welcome, and so are
pull requests made with AI coding agents; point your agent at
[AGENTS.md](AGENTS.md) first.

## What it does

- **Rosary.** A guided rosary, bead by bead, that works offline once installed.
- **Mass.** Each day’s readings, and what happens at Mass that day (Gloria,
  Creed, postures).
- **Booklets.** A printable missalette for any day. Fold one sheet of paper
  and it fits in a pocket. For Sundays and holy days there are three guide
  editions:
  - **Plain** restates each reading in everyday English, like No Fear
    Shakespeare does for plays.
  - **Kids** is for ages 6 to 11.
  - **Family** gives parents questions to talk through before Mass.

## How the guides are made

Guides are drafted with the help of an AI system. **No guide appears in the
app until a person approves it** on the review page (`/review`). Approval is
per edition, every decision is kept, and if a draft changes after approval,
the approval lapses until someone looks again. Reviewers are priests,
deacons and catechists who volunteer their time. You can try the review page
in practice mode at https://ave-daily.vercel.app/review?practice.

## How it works

| Part | Where |
|---|---|
| The app (static HTML, CSS, JS, installable, offline) | `site/` |
| Daily readings, one JSON file per day | `content/readings/` |
| Guide drafts, one JSON file per Sunday or holy day | `content/companion/` |
| Readings pipeline (citations plus World English Bible text, with NABRE-to-English verse mapping) | `scripts/readings/` |
| Site build | `scripts/build.mjs` |
| Review service (Vercel functions, private Blob store) | `api/` |
| Print kit (headless Chrome to PDF) | `scripts/kit/` |
| Spec and decisions | `docs/` |

Run it locally:

```bash
node scripts/build.mjs
python3 -m http.server 8080 --directory site
```

Run the tests:

```bash
node --import ./scripts/test/register.mjs scripts/test/review.test.mjs
python3 scripts/check_companion.py
python3 scripts/readings/validate.py --no-report
```

The review service needs a Vercel Blob store; without one the app falls back
to approved guides in `site/data/companion.json`.

## Licenses

- **Code:** MIT. See [LICENSE](LICENSE).
- **Guide text** (`content/companion/`): Creative Commons Attribution-ShareAlike
  4.0. Parishes and schools may copy and adapt it with credit. See
  [content/LICENSE.md](content/LICENSE.md).
- **Bible text:** World English Bible, public domain.
- **Reading citations:** from [cpbjr/catholic-readings-api](https://github.com/cpbjr/catholic-readings-api)
  (MIT), with hand corrections in `scripts/readings/overrides.json`.
- **Fonts:** EB Garamond and Alegreya Sans, SIL Open Font License, served by
  Google Fonts.

Ave is not affiliated with the United States Conference of Catholic Bishops
and does not speak for the Church. The official readings are at
https://bible.usccb.org.
