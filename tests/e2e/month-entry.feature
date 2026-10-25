# Bills-entry tab acceptance (User Story 1)
Verified by tests/e2e/run.mjs in a real Chromium browser (see test-results/e2e-run.txt for the PASS lines).

- [x] Given the Bills tab: Then one row per ACTIVE meter, with its name/unit and an editable current-reading input; meters also carry an editable ₽/unit input defaulting to the configured price, while a fixed-cost (garbage) row's number IS its monthly ₽ amount — no multiplier control and no baseline line on it.
- [x] Then the month <select> offers the rolling 24-month window and the entry is sticky (leaving Settings or Charts keeps the chosen month).
- [x] Given a reading typed: Then the row shows "Previous reading: N" from the odometer baseline (last earlier saved row, else config seed) plus Δ/unit and ₽ in one preview line that updates without reloading.
- [x] Given a month already partially saved and re-entered: Then untouched fields keep their stored readings and re-saving replaces that month only (History keeps exactly one row per month).
- [x] Given a decreased reading (negative Δ): Then the inline warning copy ("new meter?") appears but saving still stores the raw negative diff; Charts flag its bar.
- [x] Given a fractional/NaN reading: Then save is refused with the STR.badNumber banner and no history row is created.
- [x] Given the garbage row: Then its entered amount is absolute monthly ₽ (its preview/month-total contribution equals that number even when Settings price says 2 ₽/unit), it varies per month, and it never prints an odometer baseline line (G5/G6). The same rule at data level is now unit-covered: `resolvePrev` skips fixed rows, so a garbage `curr` can never become another meter's prev baseline (`test.mjs` case "no meter row + seedless ⇒ no baseline").
