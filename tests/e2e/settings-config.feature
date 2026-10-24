# Settings tab acceptance (User Story 4)
Verified green in a real browser (tests/e2e/run.mjs); CSV-cell integrity for disabled/renamed meters is covered by the unit layer's wide-table assertions.
- [x] Renaming a meter on its row text input → Bills & Charts headers reflect new name after leaving Settings tab (re-render persists).
- [x] Unchecking the row checkbox disables that resource: Bills omits its field, History/CSV keep its columns with historical cells intact (deleted/disabled ≠ erased), re-enabling shows it again.
- [x] Given enabling a NEW meter without latest known reading seed: Then banner shows seed-required copy and no config entry added; filling seed input then adding succeeds → month form gets that row w prev=seed line, unit shown.
- [x] Price edits via cfgRow number inputs persist w/ save round trip (reload keeps edited price in Settings tab display).
