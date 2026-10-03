# Print kit

Sample printed materials for meeting a priest about reviewing the guides:
a cover letter, a reviewer sheet with a sign-off form, and booklets made
by the app's own engine.

## Booklets from the app

The app has a print view. Open it in a browser or print it to PDF:

    /?print=DATE,EDITION,LAYOUT                 trim-size pages in reading order (what a print service takes)
    /?print=DATE,EDITION,LAYOUT&order=fold      letter sheets imposed for home printing (double-sided, flip on short edge, fold)
    /?print=DATE|DATE|...,EDITION,LAYOUT&title=Advent%202026   one bound booklet with a contents page

EDITION is plain, kids, family or readings. LAYOUT is pocket, side or facing.
Draft guides only appear in a preview build (`AVE_INCLUDE_DRAFTS=1 node scripts/build.mjs`).

## Making the PDFs

1. `AVE_INCLUDE_DRAFTS=1 node scripts/build.mjs` and serve `site/` on port 8792.
2. Write a jobs file: `[{"url": "...", "out": "/abs/path.pdf"}]`. `letter.html` and
   `review.html` print from `file://` URLs.
3. `node scripts/kit/print.mjs jobs.json` drives Playwright's headless Chrome shell
   over the DevTools protocol. Pages signal readiness by setting `document.title`
   to start with `READY`.

Rebuild the public site afterwards without `AVE_INCLUDE_DRAFTS` before any deploy
from this machine.
