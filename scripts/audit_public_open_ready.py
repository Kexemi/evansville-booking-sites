#!/usr/bin/env python3
"""Public-open audit for Quiet Systems Store-Ready Sprint.

This must PASS only after an approved GitHub Pages deploy/push has made the store public.
Local STORE_READY is not enough for public opening or sending backup links.
"""
from __future__ import annotations
import json
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE = "https://kexemi.github.io/evansville-booking-sites"
CHECKS = {
    "root": BASE + "/",
    "ai_menu": BASE + "/ai-integration-menu.html",
    "faq": BASE + "/buyer-faq.html",
    "robots": BASE + "/robots.txt",
    "sitemap": BASE + "/sitemap.xml",
    "gary_demo": BASE + "/apps/gary-s-plumbing-service-inc-booking.html",
    "completely_demo": BASE + "/apps/completely-wired-booking.html",
    "schiff_demo": BASE + "/apps/schiff-air-conditioning-heating-inc-booking.html",
    "schiff_compare": BASE + "/compare.html?biz=schiff-air-conditioning-heating-inc",
}


def fetch(url: str) -> dict:
    try:
        with urlopen(Request(url, headers={"User-Agent": "HermesPublicOpenAudit/1.0"}), timeout=20) as r:
            body = r.read().decode("utf-8", "ignore")
            return {"status": r.status, "bytes": len(body), "body": body[:500000]}
    except HTTPError as e:
        try:
            body = e.read().decode("utf-8", "ignore")
        except Exception:
            body = ""
        return {"status": e.code, "bytes": len(body), "body": body[:500000], "error": str(e)}
    except Exception as e:
        return {"status": "ERR", "bytes": 0, "body": "", "error": type(e).__name__ + ": " + str(e)[:200]}

results=[]
for name,url in CHECKS.items():
    got=fetch(url)
    body=got.pop("body")
    rec={"name": name, "url": url, **got}
    if name in {"root", "ai_menu", "faq"}:
        rec["pass"] = (got["status"] == 200 and "Quiet Systems" in body and "AI" in body and "owner approval" not in body and "public deploy/push" not in body and "Copy-safe outreach links" not in body and "sales-scripts.html" not in body and "link-pack.html" not in body and "draft founding" not in body)
        rec["detail"] = "requires buyer-facing Quiet Systems copy without internal owner-approval footer"
    elif name == "robots":
        rec["pass"] = (got["status"] == 200 and "Disallow: /scripts/" in body and "Sitemap:" in body)
        rec["detail"] = "requires robots.txt to hide internal ops/surfaces"
    elif name == "sitemap":
        rec["pass"] = (got["status"] == 200 and "ai-integration-menu.html" in body and "sales-scripts.html" not in body)
        rec["detail"] = "requires public-page sitemap without internal sales scripts"
    elif name in {"gary_demo", "completely_demo", "schiff_demo"}:
        rec["pass"] = (got["status"] == 200 and '<div class="val">None</div><div class="lbl">Reviews</div>' not in body and "Demo mode: requests are saved locally" in body and "formsubmit.co" not in body and "evansvillebookings@gmail.com" not in body)
        rec["detail"] = "requires HTTP 200, no None Reviews hero blocker, visible demo-mode delivery copy, and no hidden FormSubmit endpoint"
    else:
        rec["pass"] = got["status"] == 200
        rec["detail"] = "requires HTTP 200"
    results.append(rec)
failed=[r for r in results if not r["pass"]]
print(json.dumps({
    "schema_version":"public_open_audit_v0.1",
    "verdict":"PASS_PUBLIC_OPEN_AUDIT" if not failed else "FAIL_PUBLIC_OPEN_AUDIT",
    "failed": failed,
    "checks": results,
    "note":"Run only after approved deploy/push. Failing result blocks public store opening and backup demo links."
}, indent=2))
raise SystemExit(0 if not failed else 1)
