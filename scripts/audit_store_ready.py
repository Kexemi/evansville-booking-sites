#!/usr/bin/env python3
"""Deterministic STORE_READY audit for Quiet Systems / Evansville Booking Sites.

This is intentionally local-only. It checks that the storefront is stocked before
buyer contact without authorizing deploy/push/contact.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOP_DEMOS = {
    "schiff": ROOT / "apps" / "schiff-air-conditioning-heating-inc-booking.html",
    "gary": ROOT / "apps" / "gary-s-plumbing-service-inc-booking.html",
    "completely": ROOT / "apps" / "completely-wired-booking.html",
}
STORE_PAGES = {
    "index": ROOT / "index.html",
    "menu": ROOT / "ai-integration-menu.html",
    "faq": ROOT / "buyer-faq.html",
    "pricing": ROOT / "pricing-offer-sheet.html",
    "scripts": ROOT / "sales-scripts.html",
    "links": ROOT / "link-pack.html",
}
SHORT_LINKS = {
    "schiff": ROOT / "go" / "schiff.html",
    "gary": ROOT / "go" / "gary.html",
    "menu": ROOT / "go" / "menu.html",
}
REQUIRED_TIER_PHRASES = [
    "AI-ready intake",
    "Website AI Chat",
    "AI-Searchable Business Brain",
    "Data Collection + AI Acclimation",
    "Workflow Automation",
]
REQUIRED_TRUTH_PHRASES = [
    "No guaranteed leads",
    "No guaranteed Google rankings",
    "approval gates",
    "owner approval required",
]
REQUIRED_STORE_PHRASES = [
    "Quiet Systems",
    "Evansville Booking Sites",
    "practical AI integration",
    "backed by real demos",
    "Schiff Air Conditioning",
    "Gary's Plumbing",
]
SECRET_PATTERNS = [
    r"\b(?:sk_live|sk_test|rk_live|pk_live)_[A-Za-z0-9]{10,}",
    r"\bgh[pousr]_[A-Za-z0-9_]{20,}",
    r"\bAIza[0-9A-Za-z\-_]{35}\b",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----",
    r"\bxox[baprs]-[A-Za-z0-9-]{20,}",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def check(results: list[dict], name: str, ok: bool, detail: str) -> None:
    results.append({"name": name, "pass": bool(ok), "detail": detail})


def main() -> int:
    results: list[dict] = []
    for group, paths in (("page", STORE_PAGES), ("short", SHORT_LINKS), ("demo", TOP_DEMOS)):
        for name, path in paths.items():
            check(results, f"exists_{group}_{name}", path.exists(), str(path.relative_to(ROOT) if path.exists() else path))

    page_text = ""
    for name, path in STORE_PAGES.items():
        if path.exists():
            text = read(path)
            page_text += "\n" + text
            check(results, f"store_page_has_title_{name}", "<title" in text.lower(), name)
            check(results, f"store_page_no_tailwind_cdn_{name}", "cdn.tailwindcss.com" not in text, name)
            check(results, f"store_page_no_todo_{name}", not re.search(r"TODO|TKTK|<placeholder>|lorem ipsum", text, re.I), name)

    for phrase in REQUIRED_STORE_PHRASES:
        check(results, "store_phrase_" + re.sub(r"\W+", "_", phrase).strip("_"), phrase.lower() in page_text.lower(), phrase)
    for phrase in REQUIRED_TIER_PHRASES:
        check(results, "tier_phrase_" + re.sub(r"\W+", "_", phrase).strip("_"), phrase.lower() in page_text.lower(), phrase)
    for phrase in REQUIRED_TRUTH_PHRASES:
        check(results, "truth_phrase_" + re.sub(r"\W+", "_", phrase).strip("_"), phrase.lower() in page_text.lower(), phrase)

    # Link pack / copy-safe URL presence.
    for slug in ["schiff-air-conditioning-heating-inc", "gary-s-plumbing-service-inc", "completely-wired"]:
        check(results, f"copy_safe_url_{slug}", slug in page_text and "https://kexemi.github.io/evansville-booking-sites" in page_text, slug)

    # Short links must be static redirects or JS redirects, not server-only config.
    for name, path in SHORT_LINKS.items():
        if path.exists():
            text = read(path).lower()
            check(results, f"short_link_redirect_{name}", "http-equiv=\"refresh\"" in text or "location.href" in text, name)

    # Demo blockers.
    none_blocker = re.compile(r'<div class="val">\s*None\s*</div>\s*<div class="lbl">\s*Reviews\s*</div>', re.I)
    patched_backups = 0
    for name, path in TOP_DEMOS.items():
        if path.exists():
            text = read(path)
            no_none = not none_blocker.search(text)
            check(results, f"demo_no_none_reviews_{name}", no_none, str(path.relative_to(ROOT)))
            if name != "schiff" and no_none:
                patched_backups += 1
            check(results, f"demo_has_booking_{name}", "id=\"booking" in text or "Book Online" in text, name)
            check(results, f"demo_has_admin_{name}", "Admin Dashboard" in text, name)
    check(results, "two_backup_demos_sendable", patched_backups >= 2, f"patched_backups={patched_backups}")

    combo = page_text
    for path in list(STORE_PAGES.values()) + list(SHORT_LINKS.values()) + list(TOP_DEMOS.values()):
        if path.exists():
            combo += "\n" + read(path)
    secret_hits = []
    for pat in SECRET_PATTERNS:
        for match in re.finditer(pat, combo):
            secret_hits.append({"pattern": pat, "prefix": match.group(0)[:16]})
    check(results, "credential_secret_scan", not secret_hits, json.dumps(secret_hits))



    for internal_name in ["pricing", "scripts", "links"]:
        it = read(STORE_PAGES[internal_name])
        check(results, f"internal_noindex_{internal_name}", 'content="noindex, nofollow"' in it, internal_name)

    robots = ROOT / "robots.txt"
    sitemap = ROOT / "sitemap.xml"
    check(results, "exists_robots", robots.exists(), "robots.txt")
    check(results, "exists_sitemap", sitemap.exists(), "sitemap.xml")
    if robots.exists():
        rt = read(robots)
        check(results, "robots_disallows_internal_ops", "Disallow: /scripts/" in rt and "Disallow: /sales-scripts.html" in rt and "Disallow: /link-pack.html" in rt, "robots.txt")
    if sitemap.exists():
        sm = read(sitemap)
        check(results, "sitemap_public_only", "ai-integration-menu.html" in sm and "sales-scripts.html" not in sm and "link-pack.html" not in sm, "sitemap.xml")
    public_pages = [STORE_PAGES["index"], STORE_PAGES["menu"], STORE_PAGES["faq"]]
    for pp in public_pages:
        pt = read(pp)
        check(results, f"public_nav_no_internal_{pp.name}", "sales-scripts.html" not in pt.split("</nav>")[0] and "link-pack.html" not in pt.split("</nav>")[0] and "pricing-offer-sheet.html" not in pt.split("</nav>")[0], pp.name)


    for pp in public_pages:
        pt = read(pp)
        check(results, f"public_pages_no_internal_gate_copy_{pp.name}", all(bad not in pt for bad in ["owner approval", "public deploy/push", "Copy-safe outreach links", "sales-scripts.html", "link-pack.html", "draft founding"]), pp.name)

    failed = [r for r in results if not r["pass"]]
    report = {
        "schema_version": "store_ready_audit_v0.1",
        "repo": str(ROOT),
        "verdict": "PASS_LOCAL_STORE_READY_AUDIT" if not failed else "FAIL_LOCAL_STORE_READY_AUDIT",
        "failed": failed,
        "checks": results,
        "external_contact_sent": False,
        "public_deploy_or_push_performed": False,
    }
    print(json.dumps(report, indent=2))
    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
