# Ave: spec

Owner: Clark Scroggin. Started 2026-10-02 from the claude.ai prototype
(https://claude.ai/artifact/XGaGnLyN36rJK22XuAbNuH). Decisions below were
made by the owner in the design session on 2026-10-01 and 2026-10-02.

## What it is

A free phone-first web app for Catholics: a guided rosary, the daily Mass
readings, and printable missalettes. Ave handles no money. Missalettes pair the readings with a
guide in plain words, in three companion editions (Plain, Kids, Family),
plus a readings-only booklet for every day. Anyone may print them at home
or through a print shop or online printer of their choosing, paying the
printer directly.

## Decisions

| Topic | Decision |
|---|---|
| Delivery | Free print-at-home booklets; print-ready PDFs for any print shop or online printer (2026-10-03: no paid printing by Ave) |
| Bible text | World English Bible (public domain) now; apply to the USCCB for NABRE |
| Editions | Plain, Kids, Family companions; Readings only |
| Authorship | Claude drafts companion text in Claude Code sessions; a priest approves. Every guide says it was written with AI help, and drafts say they are not yet reviewed by a priest |
| Review rule | A companion text is shown to the public only when `review.status == "approved"` |
| Days | Companion: Sundays and US holy days of obligation. Readings only: every day |
| Layouts | Pocket (5.5 x 8.5 folded), Side by side (letter), Facing (5.5 x 8.5 folded) |
| Money | Ave takes no money. People who want to give are pointed to Catholic charities (CRS, Catholic Charities USA, St. Vincent de Paul, their parish) |
| Printing | People print themselves or upload the PDF to a printer such as Lulu; Ave has no deal with any printer |
| Hosting | Vercel, static site plus serverless functions |
| Paid API | No Anthropic API calls anywhere in the app or its jobs (owner rule) |

## Architecture

- `content/readings/YYYY-MM-DD.json`: one file per day. Title, and each
  reading's label, citation, book code and World English Bible verses.
  Built by `scripts/readings/` from USCCB citations (facts only, no NABRE
  text) and World English Bible text, with NABRE-to-English versification
  mapping.
- `content/companion/YYYY-MM-DD.json`: companion text per Sunday or holy
  day, plus `review` (`status`, `by`, `at`).
- `scripts/build.mjs`: writes `site/data/` month files from `content/`.
  Unapproved companion text never reaches `site/`.
- `site/`: the app. Static HTML, CSS, JS. Installable (manifest, service
  worker). Print uses the browser's print dialog on imposed sheets.
- `api/`: Vercel functions for the review service: queue and decisions,
  team admin, calendar feed, and the public list of approved guides.

## Phases

1. Readings pipeline through the end of liturgical year B (2027-11-27).
2. Public app: rosary, Mass, booklets (readings only until a reviewer
   approves companion text), print at home. Deploy to Vercel.
3. Companion drafts for each month, ready for review six weeks ahead.
4. Review page for the reviewer (done 2026-10-02).
5. Open source (done 2026-10-03, github.com/ccscroggin/ave).

## Needs from the owner

1. Reviewers (he invites them from his owner link).
2. Approval to send the NABRE license request, drafted for him.
3. A domain name, if he wants one.
