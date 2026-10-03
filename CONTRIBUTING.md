# Contributing to Ave

Thank you for helping. Ave exists to help people pray and to understand
what they hear at Mass. Most of the work that matters is not code.

## Ways to help

### Priests, deacons and catechists: review the guides

This is the most valuable help there is. Each month has about 15 short
texts (Sundays and holy days, in three editions). You read each one next to
the reading on your phone, fix wording in place, and approve it or send it
back with a note. Several reviewers share the work, and you can claim the
Sundays you want. Your phone calendar reminds you a week and a day before
each deadline.

- Try it first, with nothing saved: https://ave-daily.vercel.app/review?practice
- Then open a [“Volunteer to review” issue](../../issues/new?template=volunteer-reviewer.yml).
  You will get a personal review link. There is no password and no account.

### Anyone: report a problem in a guide or a reading

If something is wrong, unclear, or not faithful to the Church’s teaching,
open a [guide correction](../../issues/new?template=guide-correction.yml) or a
[readings error](../../issues/new?template=readings-error.yml). Say the date,
the edition, and what should change. You do not need a GitHub account skill
beyond filling in the form.

### Teachers, catechists and parents: tell us what works

Use the Kids and Family editions with real children and tell us what landed
and what did not, in [Discussions](../../discussions) or an
[idea](../../issues/new?template=idea.yml).

### Translators

A Spanish edition is the first goal. See the issues labeled `translation`.

### Developers and designers

Look for issues labeled `good first issue` or `help wanted`. The app is
plain HTML, CSS and JavaScript with no framework and no build step beyond
`node scripts/build.mjs`, so it is easy to read.

Working with an AI coding agent is welcome. Have it read
[AGENTS.md](AGENTS.md) first; it lists the rules that must not change and
the checks to run. You open the pull request and answer for it.

## Rules for guide text

These apply to every edit in `content/companion/`, by people or tools.

1. Faithful to the teaching of the Catholic Church and to how the Church
   reads the passage. When in doubt, follow the Catechism.
2. Restate the reading. Add nothing it does not say and leave out nothing
   important. Hard parts are said honestly; for children, gently.
3. Background only when it is widely accepted: who wrote it, roughly when,
   for whom. Never invent a quotation from a saint, pope or scholar.
4. Short sentences, everyday words, active voice. No exclamation marks.
5. Every change is reviewed. A pull request that edits guide text is
   checked by `scripts/check_companion.py`, and the review page treats an
   edited draft as needing a fresh approval before it reappears in the app.

## Working on the code

```bash
node scripts/build.mjs                                   # build site/data
python3 -m http.server 8080 --directory site             # open http://localhost:8080
node --import ./scripts/test/register.mjs scripts/test/review.test.mjs
python3 scripts/check_companion.py
```

- Keep pull requests small and say what you tested.
- The public build must never include unapproved guide text. Do not change
  that rule in `scripts/build.mjs` or `api/companion.js`.
- No ads, trackers or analytics that identify people.
- New dependencies need a good reason. The app has none in the browser.

## Code of conduct

Everyone here follows [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
