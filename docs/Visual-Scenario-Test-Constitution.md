# Visual Scenario Test Constitution

## Purpose

The Local Business App Factory cannot be called sales-ready from source greps or one desktop screenshot. The visual harness must test the actual states a customer, buyer, or business owner will see: page load, mobile sticky CTA, booking form, booking success, admin dashboard, compare tool, and buyer-facing store pages across real viewport classes.

## Pass / Fail Criteria

A run is **PASS** only when all of these are true:

1. **Real browser path:** Uses Playwright/Chromium to load local `file:///` pages from the deploy repo; no source-only substitute for visual states.
2. **Viewport matrix:** Tests at least phone narrow (360×740), phone standard (390×844), tablet (768×1024), laptop (1366×900), and desktop (1440×1100).
3. **Customer states:** For each tested booking app, captures top/hero, booking form, and booking success after filling the form. If the page exposes password-gated admin controls, capture admin empty + admin with stored booking; if it exposes only a legacy owner-preview admin block, capture `app-admin-preview` and record an `interactive-admin` product capability gap instead of inventing a fake state.
4. **Sales states:** Captures compare tool desktop and mobile states only for businesses actually registered in `compare.html`'s `BIZ` data model; generated apps without a compare entry must be recorded as `compare-tool` product capability gaps, not counted as passing compare scenarios.
5. **Store states:** Captures buyer-facing public store pages when present: storefront, AI menu, buyer FAQ, link pack.
6. **Layout assertions:** Fails on horizontal overflow, blank/unstyled screenshots, missing CSS, Tailwind CDN, console errors, tiny body text, overlapping fixed/sticky elements, invisible CTAs, or missing expected user-facing text.
7. **Framework slop detection:** Reports CSS/framework risks separately from page assertions: remote CSS dependency, multiple runtime/form systems competing, inline style/script count, and old/unused app runtime drift.
8. **Artifacts:** Writes a JSON report, Markdown report, manifest, and screenshot paths under `artifacts/visual-scenarios/<run-id>/`.
9. **Modes:** Supports `--scope sample` for fast representative proof and `--scope all` for exhaustive all-app coverage.
10. **Honest verdict:** If semantic review is not run, the report says so; pixel/layout PASS is not human taste PASS.

## Hard Gates

The harness must not publish, push, contact leads, spend money, start persistent services, or mutate production content. It may write local repo artifacts and tests only.
