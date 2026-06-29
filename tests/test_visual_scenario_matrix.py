import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "visual_scenario_matrix.js"


def run_node(*args):
    return subprocess.run(
        ["node", str(SCRIPT), *args],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )


def test_visual_matrix_lists_required_user_states_and_viewports():
    result = run_node("--list", "--scope", "sample", "--json")
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    assert data["schema_version"] == "visual_scenario_matrix_v0.1"
    viewports = {v["name"] for v in data["viewports"]}
    assert {"phone-narrow", "phone-standard", "tablet", "laptop", "desktop"}.issubset(viewports)
    states = {s["state"] for s in data["scenarios"]}
    assert {
        "app-top",
        "app-booking-form",
        "app-booking-success",
        "app-admin-empty",
        "app-admin-with-booking",
        "app-admin-preview",
        "compare-desktop",
        "compare-mobile",
        "storefront",
        "ai-menu",
        "buyer-faq",
        "link-pack",
    }.issubset(states)
    assert all(s.get("assertions") for s in data["scenarios"])


def test_visual_matrix_enumerates_actual_admin_capabilities_not_fake_states():
    result = run_node("--list", "--scope", "sample", "--json")
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    matrix = {(s["slug"], s["state"], s["viewport"]) for s in data["scenarios"] if s.get("slug")}
    assert ("schiff-air-conditioning-heating-inc", "app-admin-empty", "desktop") in matrix
    assert ("schiff-air-conditioning-heating-inc", "app-admin-with-booking", "desktop") in matrix
    assert ("gary-s-plumbing-service-inc", "app-admin-preview", "desktop") in matrix
    assert ("completely-wired", "app-admin-preview", "desktop") in matrix
    assert ("gary-s-plumbing-service-inc", "app-admin-empty", "desktop") not in matrix
    assert ("completely-wired", "app-admin-with-booking", "desktop") not in matrix
    gaps = data.get("capability_gaps", [])
    assert any(g["slug"] == "gary-s-plumbing-service-inc" and g["capability"] == "interactive-admin" for g in gaps)
    assert any(g["slug"] == "completely-wired" and g["capability"] == "interactive-admin" for g in gaps)


def test_visual_matrix_all_scope_matches_every_booking_app_actual_states():
    app_files = sorted((ROOT / "apps").glob("*-booking.html"))
    assert len(app_files) >= 70
    result = run_node("--list", "--scope", "all", "--json")
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    app_states = [s for s in data["scenarios"] if s["state"].startswith("app-")]
    slugs = {p.name.replace("-booking.html", "") for p in app_files}
    matrix = {(s["slug"], s["state"], s["viewport"]) for s in app_states}
    for slug in slugs:
        for state in {"app-top", "app-booking-form", "app-booking-success"}:
            assert (slug, state, "phone-narrow") in matrix
            assert (slug, state, "desktop") in matrix
    interactive_admin = {p.name.replace("-booking.html", "") for p in app_files if 'id="admin-pass"' in p.read_text(encoding="utf-8", errors="ignore")}
    preview_admin = {p.name.replace("-booking.html", "") for p in app_files if 'id="admin-dashboard"' in p.read_text(encoding="utf-8", errors="ignore")}
    for slug in interactive_admin:
        assert (slug, "app-admin-empty", "desktop") in matrix
        assert (slug, "app-admin-with-booking", "desktop") in matrix
    for slug in preview_admin:
        assert (slug, "app-admin-preview", "desktop") in matrix


def test_compare_page_uses_local_css_and_single_device_runtime():
    html = (ROOT / "compare.html").read_text(encoding="utf-8", errors="ignore")
    assert "cdn.tailwindcss.com" not in html
    assert 'href="tailwind.css"' in html
    assert html.count("function setDevice") == 1
    assert " onload=" not in html
    assert " onclick=" not in html


def compare_biz_slugs():
    html = (ROOT / "compare.html").read_text(encoding="utf-8", errors="ignore")
    match = re.search(r"const BIZ = \{(?P<body>.*?)\n\};", html, re.S)
    assert match, "compare.html must expose const BIZ registry"
    return set(re.findall(r'"([^"]+)"\s*:\s*\{', match.group("body")))


def test_compare_matrix_only_enumerates_loadable_compare_businesses():
    biz_slugs = compare_biz_slugs()
    assert len(biz_slugs) >= 10
    app_slugs = {p.name.replace("-booking.html", "") for p in (ROOT / "apps").glob("*-booking.html")}
    result = run_node("--list", "--scope", "all", "--json")
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    compare_scenarios = [s for s in data["scenarios"] if s.get("type") == "compare-tool"]
    compare_slugs = {s["slug"] for s in compare_scenarios}
    assert compare_slugs == (biz_slugs & app_slugs)
    assert len(compare_scenarios) == len(compare_slugs) * 2
    assert all("compare-loaded-business" in s["assertions"] for s in compare_scenarios)
    assert all("compare-our-frame-matches-slug" in s["assertions"] for s in compare_scenarios)
    assert all("compare-our-frame-loaded" in s["assertions"] for s in compare_scenarios)
    assert "ourCompareFrameLoaded" in SCRIPT.read_text(encoding="utf-8", errors="ignore")
    compare_gap_slugs = {g["slug"] for g in data.get("capability_gaps", []) if g.get("capability") == "compare-tool"}
    assert compare_gap_slugs == app_slugs - biz_slugs
    assert "1st-patriot-painting-llc" in compare_gap_slugs


def test_visual_matrix_dry_run_supports_offsets_for_full_capture_shards(tmp_path):
    first = run_node("--scope", "sample", "--dry-run", "--run-id", "pytest-offset-first", "--limit", "2", "--json")
    second = run_node("--scope", "sample", "--dry-run", "--run-id", "pytest-offset-second", "--offset", "2", "--limit", "2", "--json")
    assert first.returncode == 0, first.stderr or first.stdout
    assert second.returncode == 0, second.stderr or second.stdout
    first_report = json.loads((ROOT / "artifacts" / "visual-scenarios" / "pytest-offset-first" / "visual-scenario-report.json").read_text())
    second_report = json.loads((ROOT / "artifacts" / "visual-scenarios" / "pytest-offset-second" / "visual-scenario-report.json").read_text())
    assert first_report["scenario_count"] == 2
    assert second_report["scenario_count"] == 2
    assert [s["state"] for s in first_report["scenarios"]] == ["app-top", "app-booking-form"]
    assert [s["state"] for s in second_report["scenarios"]] == ["app-booking-success", "app-top"]
    assert [s["viewport"] for s in second_report["scenarios"]] == ["phone-narrow", "phone-standard"]


def test_visual_matrix_dry_run_writes_report_without_browser():
    out_dir = ROOT / "artifacts" / "visual-scenarios" / "test-dry-run"
    if out_dir.exists():
        for child in sorted(out_dir.rglob("*"), reverse=True):
            if child.is_file():
                child.unlink()
            elif child.is_dir():
                child.rmdir()
        out_dir.rmdir()
    result = run_node("--scope", "sample", "--dry-run", "--run-id", "test-dry-run", "--json")
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    assert data["verdict"] == "DRY_RUN_PASS"
    report = ROOT / data["artifacts"]["json_report"]
    md = ROOT / data["artifacts"]["markdown_report"]
    manifest = ROOT / data["artifacts"]["manifest"]
    assert report.exists()
    assert md.exists()
    assert manifest.exists()
    report_data = json.loads(report.read_text(encoding="utf-8"))
    manifest_data = json.loads(manifest.read_text(encoding="utf-8"))
    assert report_data["scenario_count"] == data["scenario_count"]
    assert report_data["artifacts"]["manifest"] == data["artifacts"]["manifest"]
    assert manifest_data["scenario_count"] == data["scenario_count"]
    assert len(manifest_data["scenarios"]) == data["scenario_count"]
    assert "semantic_review_note" in report_data


def test_sharded_visual_runner_writes_aggregate_manifest():
    result = subprocess.run(
        [
            "python",
            str(ROOT / "scripts" / "run_visual_scenario_shards.py"),
            "--scope",
            "sample",
            "--dry-run",
            "--batch-size",
            "40",
            "--max-workers",
            "2",
            "--run-id",
            "pytest-sharded-dry",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    assert data["verdict"] == "DRY_RUN_PASS"
    assert data["scenario_count"] == 91
    assert data["passed_count"] == 91
    assert data["failed_count"] == 0
    assert data["shard_count"] == 3
    report = ROOT / data["artifacts"]["json_report"]
    manifest = ROOT / data["artifacts"]["manifest"]
    assert report.exists()
    assert manifest.exists()
    manifest_data = json.loads(manifest.read_text(encoding="utf-8"))
    assert manifest_data["schema_version"] == "visual_scenario_manifest_v0.1"
    assert manifest_data["scenario_count"] == 91
    assert len(manifest_data["scenarios"]) == 91
