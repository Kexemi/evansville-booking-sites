#!/usr/bin/env python3
"""Run the Playwright visual scenario matrix in bounded shards.

This wrapper is the canonical way to exercise every scenario when one monolithic
`node scripts/visual_scenario_matrix.js --scope all` run would exceed terminal
or browser stability limits. It writes an aggregate report plus a dedicated
manifest artifact.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
NODE_SCRIPT = ROOT / "scripts" / "visual_scenario_matrix.js"


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def run_node(args: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["node", str(NODE_SCRIPT), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=timeout,
    )


def load_matrix(scope: str) -> dict[str, Any]:
    proc = run_node(["--list", "--scope", scope, "--json"], timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr or proc.stdout or "matrix listing failed")
    return json.loads(proc.stdout)


def run_shard(job: dict[str, Any], *, scope: str, dry_run: bool, timeout: int) -> dict[str, Any]:
    shard_args = [
        "--scope",
        scope,
        "--offset",
        str(job["offset"]),
        "--limit",
        str(job["limit"]),
        "--run-id",
        job["run_id"],
        "--json",
    ]
    if dry_run:
        shard_args.insert(2, "--dry-run")
    started = time.time()
    proc = run_node(shard_args, timeout=timeout)
    report_path = ROOT / "artifacts" / "visual-scenarios" / job["run_id"] / "visual-scenario-report.json"
    report = None
    if report_path.exists():
        report = json.loads(report_path.read_text(encoding="utf-8"))
    return {
        **job,
        "returncode": proc.returncode,
        "seconds": round(time.time() - started, 1),
        "stdout_tail": proc.stdout[-1200:],
        "stderr_tail": proc.stderr[-1200:],
        "report_path": rel(report_path) if report_path.exists() else str(report_path),
        "report": report,
    }


def merge_reports(*, run_id: str, scope: str, matrix: dict[str, Any], results: list[dict[str, Any]], batch_size: int, max_workers: int, dry_run: bool) -> dict[str, Any]:
    scenarios: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    risk_counts: dict[str, int] = {}
    capability_gaps: dict[tuple[str | None, str | None], dict[str, Any]] = {}

    for result in results:
        report = result.get("report") or {}
        scenarios.extend(report.get("scenarios", []))
        failures.extend(report.get("failures", []))
        for key, value in report.get("risk_counts", {}).items():
            risk_counts[key] = risk_counts.get(key, 0) + int(value)
        for gap in report.get("capability_gaps", []):
            capability_gaps[(gap.get("slug"), gap.get("capability"))] = gap

    if dry_run:
        passed_count = len(scenarios)
        failed_count = 0
        verdict = "DRY_RUN_PASS"
    else:
        passed_count = sum(1 for scenario in scenarios if scenario.get("status") == "PASS")
        failed_count = len(scenarios) - passed_count
        verdict = "VISUAL_SCENARIO_PASS" if failed_count == 0 else "VISUAL_SCENARIO_FAIL"

    out_dir = ROOT / "artifacts" / "visual-scenarios" / run_id
    return {
        "schema_version": "visual_scenario_sharded_report_v0.2",
        "source_matrix_schema": matrix.get("schema_version"),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "repo": str(ROOT),
        "scope": scope,
        "run_id": run_id,
        "verdict": verdict,
        "dry_run": dry_run,
        "scenario_count": len(scenarios),
        "expected_scenario_count": matrix.get("scenario_count"),
        "passed_count": passed_count,
        "failed_count": failed_count,
        "shard_count": len(results),
        "batch_size": batch_size,
        "max_workers": max_workers,
        "app_count": matrix.get("app_count"),
        "viewports": [viewport["name"] for viewport in matrix.get("viewports", [])],
        "capability_gap_count": len(capability_gaps),
        "capability_gaps": list(capability_gaps.values()),
        "risk_counts": risk_counts,
        "failures": failures[:500],
        "shards": [
            {
                "idx": result["idx"],
                "offset": result["offset"],
                "limit": result["limit"],
                "run_id": result["run_id"],
                "returncode": result["returncode"],
                "seconds": result["seconds"],
                "report_path": result["report_path"],
                "verdict": (result.get("report") or {}).get("verdict"),
                "passed_count": (result.get("report") or {}).get("passed_count"),
                "failed_count": (result.get("report") or {}).get("failed_count"),
            }
            for result in results
        ],
        "scenarios": scenarios,
        "artifacts": {
            "json_report": rel(out_dir / "visual-scenario-report.json"),
            "markdown_report": rel(out_dir / "visual-scenario-report.md"),
            "manifest": rel(out_dir / "visual-scenario-manifest.json"),
            "shard_run_results": rel(out_dir / "shard-run-results.json"),
        },
    }


def render_manifest(report: dict[str, Any]) -> dict[str, Any]:
    return {
        "schema_version": "visual_scenario_manifest_v0.1",
        "run_id": report["run_id"],
        "scope": report["scope"],
        "generated_at": report["generated_at"],
        "verdict": report["verdict"],
        "dry_run": report.get("dry_run", False),
        "scenario_count": report["scenario_count"],
        "passed_count": report["passed_count"],
        "failed_count": report["failed_count"],
        "shard_count": report["shard_count"],
        "capability_gap_count": report["capability_gap_count"],
        "capability_gaps": report.get("capability_gaps", []),
        "artifacts": report["artifacts"],
        "scenarios": [
            {
                "slug": scenario.get("slug"),
                "page": scenario.get("page"),
                "type": scenario.get("type"),
                "state": scenario.get("state"),
                "viewport": scenario.get("viewport"),
                "label": scenario.get("label"),
                "status": scenario.get("status"),
                "screenshot": scenario.get("screenshot"),
                "assertions": scenario.get("assertions", []),
                "risk_types": [risk.get("type") for risk in scenario.get("risks", [])],
                "failed_checks": scenario.get("failed_checks", []),
            }
            for scenario in report.get("scenarios", [])
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    lines = [
        f"# Sharded Visual Scenario Report — {report['run_id']}",
        "",
        f"**Verdict:** {report['verdict']}",
        f"**Scope:** {report['scope']}",
        f"**Dry run:** {report.get('dry_run', False)}",
        f"**Scenarios:** {report['passed_count']} / {report['scenario_count']} passed",
        f"**Shards:** {report['shard_count']} @ batch_size={report['batch_size']}, max_workers={report['max_workers']}",
        f"**Capability gaps:** {report['capability_gap_count']}",
        "",
        "## Artifacts",
        "",
    ]
    for key, value in report["artifacts"].items():
        lines.append(f"- {key}: `{value}`")
    lines.extend(["", "## Risk Counts", ""])
    if report.get("risk_counts"):
        for key, value in report["risk_counts"].items():
            lines.append(f"- {key}: {value}")
    else:
        lines.append("- None.")
    lines.extend(["", "## Failures", ""])
    if report.get("failures"):
        for failure in report["failures"][:120]:
            lines.append(f"- **{failure.get('scenario')}** — {failure.get('screenshot', '')}")
            for check in failure.get("failed_checks", []):
                lines.append(f"  - {check.get('name')}: {json.dumps(check.get('detail'))}")
    else:
        lines.append("- None.")
    lines.extend(["", "## Capability Gaps", ""])
    gaps = report.get("capability_gaps", [])
    if gaps:
        for gap in gaps[:120]:
            lines.append(f"- **{gap.get('slug')}** — {gap.get('capability')}: {gap.get('detail')}")
    else:
        lines.append("- None.")
    return "\n".join(lines)


def write_aggregate(report: dict[str, Any], results: list[dict[str, Any]]) -> None:
    out_dir = ROOT / "artifacts" / "visual-scenarios" / report["run_id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "visual-scenario-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (out_dir / "visual-scenario-report.md").write_text(render_markdown(report), encoding="utf-8")
    (out_dir / "visual-scenario-manifest.json").write_text(json.dumps(render_manifest(report), indent=2), encoding="utf-8")
    slim_results = [{key: value for key, value in result.items() if key != "report"} for result in results]
    (out_dir / "shard-run-results.json").write_text(json.dumps(slim_results, indent=2), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run visual scenario matrix in shards and aggregate receipts.")
    parser.add_argument("--scope", choices=["sample", "all"], default="all")
    parser.add_argument("--run-id", default=f"visual-sharded-{int(time.time())}")
    parser.add_argument("--batch-size", type=int, default=80)
    parser.add_argument("--max-workers", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--shard-timeout", type=int, default=240)
    args = parser.parse_args(argv)

    if args.batch_size < 1:
        parser.error("--batch-size must be >= 1")
    if args.max_workers < 1:
        parser.error("--max-workers must be >= 1")

    matrix = load_matrix(args.scope)
    total = int(matrix["scenario_count"])
    jobs = [
        {"idx": idx + 1, "offset": offset, "limit": min(args.batch_size, total - offset), "run_id": f"{args.run_id}-shard-{idx + 1:02d}"}
        for idx, offset in enumerate(range(0, total, args.batch_size))
    ]

    results: list[dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.max_workers) as executor:
        futures = [executor.submit(run_shard, job, scope=args.scope, dry_run=args.dry_run, timeout=args.shard_timeout) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            report = result.get("report") or {}
            if not args.json:
                print(
                    json.dumps(
                        {
                            "shard": result["idx"],
                            "returncode": result["returncode"],
                            "seconds": result["seconds"],
                            "verdict": report.get("verdict"),
                            "passed": report.get("passed_count"),
                            "failed": report.get("failed_count"),
                        }
                    ),
                    flush=True,
                )
    results.sort(key=lambda item: item["idx"])

    missing_reports = [result["idx"] for result in results if not result.get("report")]
    report = merge_reports(
        run_id=args.run_id,
        scope=args.scope,
        matrix=matrix,
        results=results,
        batch_size=args.batch_size,
        max_workers=args.max_workers,
        dry_run=args.dry_run,
    )
    write_aggregate(report, results)

    summary = {
        "verdict": report["verdict"],
        "scenario_count": report["scenario_count"],
        "expected_scenario_count": report["expected_scenario_count"],
        "passed_count": report["passed_count"],
        "failed_count": report["failed_count"],
        "shard_count": report["shard_count"],
        "capability_gap_count": report["capability_gap_count"],
        "risk_counts": report["risk_counts"],
        "artifacts": report["artifacts"],
    }
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(json.dumps(summary, indent=2))

    if missing_reports:
        print(f"Missing shard reports: {missing_reports}", file=sys.stderr)
        return 2
    if report["scenario_count"] != report["expected_scenario_count"]:
        return 1
    return 0 if report["failed_count"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
