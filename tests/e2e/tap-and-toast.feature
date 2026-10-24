# On-screen fidelity on a phone (bug batch 2, G1–G3)
Verified by tests/e2e/run.mjs ("bug batch part C") in Edge at a 390×844 phone viewport; test-results/e2e-run.txt holds the PASS lines.

- [x] Given a save/Apply that succeeded: Then the toast carries an `ok` kind, paints the app's green (`--ok`) token rather than the warn colour, and sits above the page content (fixed positioning + z-index over the tab strip), while an error copy keeps the warn colour and stays painted until acted on.
- [x] Given the page scrolled to its end (Charts tab really overflows one phone screen): Then the toast is still inside the visible viewport — it belongs to the screen, not the top of the document. The toast also never swallows a tap (`pointer-events:none`), so Save stays tappable under it.
- [x] Given tapping an entry/settings field: Then nothing undersized invites iOS auto-fit zoom — the viewport meta declares `width=device-width` with shrink-to-fit switched off, and every visible control paints as a full tap target (≥ 40 CSS px). Manual-verify limit recorded in tasks/bugs-2.md G2: Safari's shrink-to-fit re-zoom cannot be reproduced from desktop Edge, so the iPhone tap itself is checked by hand.
