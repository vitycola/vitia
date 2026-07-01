---
name: review-loop
description: "Triage manual review feedback after a verify pass. Trigger: user reports something is wrong or wants a change after testing the app themselves (in preview, browser, or the running app), following an sdd-verify or automated check that already passed."
metadata:
  author: victor-valero
  version: "1.0"
---

## When to use

An automated `verify` step passing does not mean the work is done — it means the work matches the spec it was checked against. A human review in the running app can surface things automated verification cannot: a spec that was wrong, a flow that feels off, a requirement that only becomes obvious once it's seen working.

Load this skill whenever the user reports a problem with something that already passed verification, or asks to change behavior after trying it themselves.

## Classify before touching code

Do not jump straight to a fix. First decide which of these the feedback is:

| Signal | Category |
|---|---|
| Wrong color, spacing, copy, a state not clearing, an off-by-one — the spec was right, the code missed it | **Mechanical fix** |
| The built behavior matches what was specified, but the spec itself was wrong or incomplete — the user only realized this by seeing it work | **Spec gap** |

Ask yourself: if I re-read the spec/tasks artifact right now, does it still describe what the user actually wants? If yes → mechanical fix. If no → spec gap.

## Re-entry point

Re-run only the phases that changed. Never repeat a phase whose artifact didn't need correcting.

**Mechanical fix:**
```
apply (fix) → verify (fresh context)
```

**Spec gap:**
```
spec (correct it) → tasks (only if the affected task drifted) → apply (fix) → verify (fresh context)
```

## Hard rules

- Never patch a spec-gap issue as if it were a mechanical fix — the spec/tasks artifact will silently drift from what was actually built, and the next verify will validate against a description that's no longer true.
- Always re-verify with a fresh-context check after any fix, mechanical or not. The agent that just wrote the fix is not a reliable judge of whether it worked.
- If a spec correction reveals the original proposal's scope was wrong (not just underspecified), stop and flag it — that's a decision for the user, not something to route through silently.
