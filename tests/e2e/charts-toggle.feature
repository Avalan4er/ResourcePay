# Charts tab acceptance (User Story 2 / Success #3)
All four verified green by tests/e2e/run.mjs in a real browser; volume-mode labels also carry the Δ sign of each month.
- [x] Given history w ≥2 months: opening Charts tab shows exactly one `.chart` card per ACTIVE configured resource; disabled meters absent from page.
- [x] Then tapping a switch knob flips EVERY chart card between volume mode and money mode on the SAME page (all cards flip together, not per-card).
- [x] Then the mode control reads as an iOS-style segmented switch: one radio element per mode inside its own pill track (`.card .swRow` holds the pair side by side), each track labelled by its own STR mode name, exactly one checked; tapping the checked knob changes nothing, tapping the other picks that mode. Batch-3 `Z2`/`tap-and-toast.feature` adds the iPhone-fidelity half (one row, no native radio paint, green dot on the lit state).
- [x] Given money mode: garbage fixed-cost card renders bars = monthly ₽ amounts w/ formatted labels; in volume mode garbage card is empty of bars (header only).
- [x] Then bar heights proportional: max-abs value month = full-height bar (~100%), smaller months visibly shorter; negative Δ month bar carries `.neg` red class & its label shows the minus sign.
