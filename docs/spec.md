# Ave: spec

Owner: Clark Scroggin. Started 2026-10-02 from the claude.ai prototype
(https://claude.ai/artifact/XGaGnLyN36rJK22XuAbNuH). Decisions below were
made by the owner in the design session on 2026-10-01 and 2026-10-02.

## What it is

A free phone-first web app for Catholics: a guided rosary, the daily Mass
readings, and printable missalettes. Missalettes pair the readings with a
guide in plain words, in three companion editions (Plain, Kids, Family),
plus a readings-only booklet for every day. Paid printed booklets come
later, through print on demand.

## Decisions

| Topic | Decision |
|---|---|
| Delivery | Free print-at-home booklets every week; paid printed copies later |
| Bible text | World English Bible (public domain) now; apply to the USCCB for NABRE |
| Editions | Plain, Kids, Family companions; Readings only |
| Authorship | Claude drafts companion text in Claude Code sessions; a human reviewer approves |
| Review rule | A companion text is shown to the public only when `review.status == "approved"` |
| Days | Companion: Sundays and US holy days of obligation. Readings only: every day |
| Layouts | Pocket (5.5 x 8.5 folded), Side by side (letter), Facing (5.5 x 8.5 folded) |
| Paid units | Monthly subscription (one bound booklet a month) and season bundles |
| Printing | Lulu Print API, one copy per order, shipped to the buyer |
| Order cutoff | 10 days before the first Sunday the booklet covers |
| Hosting | Vercel, static site plus serverless functions; Stripe for payment |
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
- `api/`: Vercel functions. Stripe checkout and webhook, and a cron that
  sends orders to Lulu at each cutoff. Inactive until keys exist.

## Phases

1. Readings pipeline through the end of liturgical year B (2027-11-27).
2. Public app: rosary, Mass, booklets (readings only until a reviewer
   approves companion text), print at home. Deploy to Vercel.
3. Companion drafts for each month, ready for review six weeks ahead.
4. Review page for the reviewer.
5. Stripe and Lulu, behind the owner's keys.

## Needs from the owner

1. A reviewer's name and email.
2. Stripe keys (phase 5).
3. A Lulu developer account and keys (phase 5).
4. Approval to send the NABRE license request, drafted for him.
