#!/usr/bin/env python3
"""Audit the end-to-end GoPro quality gate for Local Business visual QA.

This audit intentionally distinguishes local proof from live sales readiness. If the repo
is ahead of origin, live parity is blocked by the push/deploy hard gate rather than
silently counted as PASS.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, help="visual-scenario-report.json")
    parser.add_argument("--contact-sheet-manifest", required=True)
    parser.add_argument("--semantic-review")
    parser.add_argument("--live-status", default="auto", choices=["auto", "PASS", "BLOCKED_BY_NO_PUSH", "NOT_RUN", "FAIL"])
    parser.add_argument("--cross-env-status", default="NOT_RUN", choices=["PASS", "NOT_RUN", "BLOCKED", "FAIL"])
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def resolve(path_value: str | None, base: Path = ROOT) -> Path | None:
    if not path_value:
        return None
    p = Path(path_value)
    if p.is_absolute():
        return p
    cwd_candidate = Path.cwd() / p
    if cwd_candidate.exists():
        return cwd_candidate
    return base / p


def load_json(path_value: str | None, label: str, errors: list[str]) -> tuple[Path | None, dict[str, Any] | None]:
    p = resolve(path_value)
    if p is None or not p.exists():
        errors.append(f"{label}_MISSING: {path_value}")
        return p, None
    try:
        return p, json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{label}_BAD_JSON: {exc}")
        return p, None


def detect_live_status() -> tuple[str, str]:
    try:
        proc = subprocess.run(
            ["git", "rev-list", "--count", "origin/main..HEAD"],
            cwd=ROOT,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if proc.returncode == 0:
            ahead = int((proc.stdout or "0").strip() or "0")
            if ahead > 0:
                return "BLOCKED_BY_NO_PUSH", f"repo is ahead of origin/main by {ahead} commit(s); public live parity cannot be claimed without push/deploy approval"
            return "PASS", "repo is not ahead of origin/main; live parity still needs URL-specific smoke outside fixture mode"
        return "NOT_RUN", f"git rev-list failed: {proc.stderr.strip()}"
    except Exception as exc:
        return "NOT_RUN", f"live-status auto detection failed: {exc}"


def gate(status: str, detail: str, **extra: Any) -> dict[str, Any]:
    out = {"status": status, "detail": detail}
    out.update(extra)
    return out


def main() -> int:
    args = parse_args()
    errors: list[str] = []
    report_path, report = load_json(args.report, "REPORT", errors)
    contact_path, contact = load_json(args.contact_sheet_manifest, "CONTACT_SHEET_MANIFEST", errors)

    gates: dict[str, dict[str, Any]] = {}

    if report:
        mechanical_errors = []
        if report.get("verdict") != "VISUAL_SCENARIO_PASS":
            mechanical_errors.append(f"verdict={report.get('verdict')}")
        if report.get("scenario_count") != report.get("expected_scenario_count"):
            mechanical_errors.append("scenario_count != expected_scenario_count")
        if report.get("passed_count") != report.get("scenario_count"):
            mechanical_errors.append("passed_count != scenario_count")
        if report.get("failed_count") != 0:
            mechanical_errors.append(f"failed_count={report.get('failed_count')}")
        manifest_path = resolve((report.get("artifacts") or {}).get("manifest"))
        if not manifest_path or not manifest_path.exists():
            mechanical_errors.append("manifest missing")
        else:
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                if manifest.get("scenario_count") != report.get("scenario_count"):
                    mechanical_errors.append("manifest count mismatch")
                if len(manifest.get("scenarios", [])) != report.get("scenario_count"):
                    mechanical_errors.append("manifest scenario row mismatch")
            except Exception as exc:
                mechanical_errors.append(f"manifest bad json: {exc}")
        gates["mechanical_browser"] = gate(
            "PASS" if not mechanical_errors else "FAIL",
            "; ".join(mechanical_errors) if mechanical_errors else "visual scenario report, manifest, and counts are internally consistent",
            scenario_count=report.get("scenario_count"),
            passed_count=report.get("passed_count"),
            failed_count=report.get("failed_count"),
            report=str(report_path),
        )
    else:
        gates["mechanical_browser"] = gate("FAIL", "report missing or unreadable")

    if contact:
        contact_errors = []
        if contact.get("schema_version") != "visual_contact_sheet_manifest_v0.1":
            contact_errors.append("bad contact manifest schema")
        if report and contact.get("scenario_count") != report.get("scenario_count"):
            contact_errors.append("contact scenario count mismatch")
        if contact.get("missing_screenshot_count") != 0:
            contact_errors.append(f"missing screenshots={contact.get('missing_screenshot_count')}")
        if contact.get("sheet_count", 0) < 1:
            contact_errors.append("no contact sheets")
        for sheet in contact.get("sheets", []):
            if not resolve(sheet.get("path"), contact_path.parent if contact_path else ROOT).exists():
                contact_errors.append(f"sheet missing: {sheet.get('path')}")
                break
        gates["contact_sheets"] = gate(
            "PASS" if not contact_errors else "FAIL",
            "; ".join(contact_errors) if contact_errors else "contact sheets cover the screenshot corpus",
            manifest=str(contact_path),
            sheet_count=contact.get("sheet_count"),
            screenshot_count=contact.get("screenshot_count"),
        )
    else:
        gates["contact_sheets"] = gate("FAIL", "contact-sheet manifest missing or unreadable")

    semantic_path = resolve(args.semantic_review) if args.semantic_review else None
    if semantic_path is None or not semantic_path.exists():
        errors.append(f"SEMANTIC_REVIEW_MISSING: {args.semantic_review}")
        gates["semantic_visual"] = gate("FAIL", "semantic visual/taste review artifact is missing")
    else:
        try:
            semantic = json.loads(semantic_path.read_text(encoding="utf-8"))
            blockers = semantic.get("material_blockers") or []
            verdict = semantic.get("verdict")
            if verdict == "SEMANTIC_VISUAL_PASS" and not blockers:
                status = "PASS"
            elif isinstance(verdict, str) and verdict.startswith("SEMANTIC_VISUAL_BLOCKED"):
                status = "BLOCKED"
            else:
                status = "FAIL"
            gates["semantic_visual"] = gate(
                status,
                "semantic review passed" if status == "PASS" else f"verdict={verdict}; blockers={blockers}",
                review=str(semantic_path),
                blocker_count=len(blockers),
            )
        except Exception as exc:
            errors.append(f"SEMANTIC_REVIEW_BAD_JSON: {exc}")
            gates["semantic_visual"] = gate("FAIL", f"semantic review unreadable: {exc}")

    if args.live_status == "auto":
        live_status, live_detail = detect_live_status()
    else:
        live_status, live_detail = args.live_status, f"live status supplied as {args.live_status}"
    gates["live_parity"] = gate(live_status, live_detail)

    gates["cross_env"] = gate(args.cross_env_status, f"cross-env status supplied as {args.cross_env_status}")

    hard_fail = any(g["status"] == "FAIL" for g in gates.values())
    hard_blocked = any(g["status"] == "BLOCKED" for g in gates.values())
    local_pass = (
        gates["mechanical_browser"]["status"] == "PASS"
        and gates["contact_sheets"]["status"] == "PASS"
        and gates["semantic_visual"]["status"] == "PASS"
    )
    if hard_fail:
        verdict = "E2E_GOPRO_FAIL"
        sales_ready = False
    elif hard_blocked:
        verdict = "E2E_GOPRO_BLOCKED"
        sales_ready = False
    elif local_pass and gates["live_parity"]["status"] == "BLOCKED_BY_NO_PUSH":
        verdict = "LOCAL_E2E_PASS__LIVE_PARITY_BLOCKED_BY_NO_PUSH"
        sales_ready = False
    elif local_pass and gates["live_parity"]["status"] == "PASS" and gates["cross_env"]["status"] == "PASS":
        verdict = "SALES_READY_PASS"
        sales_ready = True
    elif local_pass:
        verdict = "LOCAL_E2E_PARTIAL_PASS"
        sales_ready = False
    else:
        verdict = "E2E_GOPRO_FAIL"
        sales_ready = False

    result = {
        "schema_version": "end_to_end_gopro_quality_audit_v0.1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "repo": str(ROOT),
        "verdict": verdict,
        "sales_ready": sales_ready,
        "gates": gates,
        "errors": errors,
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"{verdict}: sales_ready={sales_ready}")
        for name, g in gates.items():
            print(f"- {name}: {g['status']} — {g['detail']}")
        if errors:
            print("Errors:")
            for err in errors:
                print(f"  {err}")
    return 0 if not hard_fail and not hard_blocked and not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
