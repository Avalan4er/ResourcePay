# ResourcePay

Monthly bills tracker PWA (bills / history+CSV backup / charts / settings tabs), static single-page app for GitHub Pages, data persisted in OPFS via `navigator.storage.getDirectory()` (+ Web Worker sync handle; works on iPhone Safari — no IndexedDB, no service worker). Source under `src/`, tests under `tests/`. Mobile-first iPhone UI, rubles with comma decimals, all UI strings only via the `STR` English dictionary (hand-translated to Russian later).

**SPEC.md is the source of truth — read it before doing anything.**

Workflow reminders:
- use skills @using-agent-skills for development flow (prefer spec-driven-development)
- use skill @control-ui for ui development
- use skill @thermo-nuclear-code-quality-review for code review after each phase
- prefer using tools instead of using commands
- remember of ponytail skill
- Keep every month's calculations and CSV rows self-contained; don't add dependencies or a build step.
