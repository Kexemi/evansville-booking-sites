# End-to-End GoPro Quality Constitution

## Purpose

This constitution exists because a local mechanical browser PASS is not the same as visual infallibility, sales readiness, or live production parity. For Local Business visual/product QA, the workflow must not declare a stronger result than the gates actually exercised.

## No-throttled-output rule

If a later answer can name stronger unrun checks that would materially improve confidence, the initial workflow was underpowered. The first-turn constitution must include every feasible assurance layer for the claim being made, or the final label must be explicitly scoped/partial.

## Scoped PASS labels

| Label | Meaning | Required proof |
|---|---|---|
| `MECHANICAL_BROWSER_PASS` | Playwright/Chromium exercised the defined state matrix and all assertions passed. | JSON report, manifest, screenshots, shard results, receipt audit. |
| `SEMANTIC_VISUAL_PASS` | Screenshots/contact sheets were reviewed for visual infidelity: hierarchy, spacing, trust, obvious ugliness, brand mismatch, broken-looking states, and screenshot-level weirdness. | Contact-sheet manifest + semantic review JSON/MD with material blockers empty. |
| `LIVE_PARITY_PASS` | Public deployed GitHub Pages output matches the locally proven code path closely enough to use in buyer-facing claims. | Live URL checks after approved push/deploy; no stale Tailwind CDN/inline-handler drift if local removed it; live compare/tool checks pass. |
| `CROSS_ENV_PASS` | More than one browser or environment class was exercised. | Chromium plus another browser/device path or explicit browser availability blocker. |
| `SALES_READY_PASS` | The artifact is ready for real buyer outreach. | Mechanical + semantic + live parity + cross-env + adversarial critic + no unresolved sales blockers/capability gaps relevant to the target. |
| `LOCAL_E2E_PASS__LIVE_PARITY_BLOCKED_BY_NO_PUSH` | Local mechanical + semantic gates pass, but public deployment parity is blocked by the no-push/deploy hard gate. | All local gates pass; live parity gate status is `BLOCKED_BY_NO_PUSH`. |

## Required assurance stack for “whole thing end to end”

1. **Ground truth first:** `git status`, latest commit, local-vs-origin state, latest receipt existence, and live public URL smoke.
2. **Constitution before changes:** this file and the visual scenario constitution must be present before claiming any end-to-end verdict.
3. **Mechanical browser matrix:** full sharded local browser matrix must pass through `scripts/run_visual_scenario_shards.py`.
4. **Manifest and screenshot coverage:** report scenario count must equal expected count; manifest count must match; screenshot files must exist.
5. **Screenshot/taste review:** generate contact sheets over the final screenshot corpus and run semantic visual review. Mechanical geometry is not enough.
6. **Live/local parity:** if repo is ahead of origin or push/deploy is unapproved, mark live parity `BLOCKED_BY_NO_PUSH`, not PASS.
7. **Cross-env honesty:** if only Chromium/local file routing ran, mark cross-env as `NOT_RUN` or `BLOCKED`, not PASS.
8. **Adversarial critic:** a separate reviewer must try to break the result before a confident local verdict or commit.
9. **Secret and diff hygiene:** run secret scan, syntax/tests, `git diff --check`, and final `git status`.
10. **No overclaiming:** final wording must name exactly which labels passed and which are blocked/not run.

## Hard gates

Do not push, deploy, contact leads, spend money, use credentials, publish, delete, or start persistent services without explicit approval. End-to-end local proof may write local repo artifacts, ignored receipts, tests, and docs.

## Failure semantics

- A visual matrix PASS with semantic review missing is **not** end-to-end PASS.
- Local proof while repo is ahead of origin is **not** live parity PASS.
- Unregistered compare businesses are capability gaps, not passing compare scenarios.
- Risk counts are not failures by themselves, but unresolved risk counts must be visible in final reporting.
