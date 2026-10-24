# History tab + CSV export acceptance (User Story 3/backup / Success #5)
Evidence: tests/e2e/run.mjs real browser + unit-layer buildCsv shape assertions in tests/test.mjs. Bullets marked [m] need a real user gesture (a file-picker chooser click cannot be synthesised without the browser's permission dialog) — verify by hand with Chrome, see tasks/test-deps.md.

- [x] Opening History shows one `.row` line per saved month newest-first with ruble totals matching chart money-mode sums for that month.
- [m] Chromium env: export button opens save-file picker (showSaveFilePicker); cancel is SILENT (no red banner); accepted filename matches `resourcepay-backup-YYYY-MM-DD.csv`, file content = BOM + wide table per SPEC layout incl '#cfg' seed lines at bottom, garbage money-only columns.
- [m] Non-Chromium env: export triggers anchor download w/ same filename and identical bytes; picker absent no error banner.
- [x] Negative Δ month exports raw negative in CSV Δ cell while UI showed warning (data preserved not clamped) — covered by the buildCsv unit assertions.
