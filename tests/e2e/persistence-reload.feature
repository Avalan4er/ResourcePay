# OPFS persistence acceptance (Success #1 storage half)
Env: Chromium-based browser on localhost/https (secure context for OPFS); Safari branch labeled separately w/o reload claim.
Verified green in Edge 155 (real browser, persistent profile): test-results/e2e-run.txt shows the boot-state diag non-empty on a re-run = data survived a fresh browser launch.

- [x] Given two months entered and saved: Then hard page reload keeps History rows, chart bars and edited config identical (banner must NOT show no-storage text in this env — if it does the run FAILS as storage-path evidence).
- [x] Then close tab & relaunch PWA from start_url → same persisted state survives within same browser origin session.
