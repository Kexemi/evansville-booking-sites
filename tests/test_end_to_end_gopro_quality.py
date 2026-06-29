import json
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONSTITUTION = ROOT / "docs" / "End-to-End-GoPro-Quality-Constitution.md"
CONTACT_SHEETS = ROOT / "scripts" / "build_visual_contact_sheets.py"
AUDIT = ROOT / "scripts" / "audit_end_to_end_gopro_quality.py"


def make_fixture_report(tmp_path):
    screenshot_dir = tmp_path / "screenshots"
    screenshot_dir.mkdir()
    scenarios = []
    for idx, color in enumerate(["red", "green", "blue"]):
        img = screenshot_dir / f"scenario-{idx}.png"
        Image.new("RGB", (160, 100), color=color).save(img)
        scenarios.append(
            {
                "type": "booking-app" if idx < 2 else "compare-tool",
                "slug": f"fixture-{idx}",
                "state": "app-top" if idx == 0 else "compare-desktop",
                "viewport": "desktop" if idx != 1 else "phone-narrow",
                "status": "PASS",
                "screenshot": str(img),
            }
        )
    report = {
        "schema_version": "visual_scenario_report_v0.1",
        "verdict": "VISUAL_SCENARIO_PASS",
        "scope": "all",
        "run_id": "fixture-run",
        "scenario_count": len(scenarios),
        "expected_scenario_count": len(scenarios),
        "passed_count": len(scenarios),
        "failed_count": 0,
        "shard_count": 1,
        "capability_gap_count": 0,
        "artifacts": {"manifest": str(tmp_path / "visual-scenario-manifest.json")},
        "scenarios": scenarios,
    }
    report_path = tmp_path / "visual-scenario-report.json"
    report_path.write_text(json.dumps(report), encoding="utf-8")
    (tmp_path / "visual-scenario-manifest.json").write_text(
        json.dumps({"schema_version": "visual_scenario_manifest_v0.1", "scenario_count": len(scenarios), "scenarios": scenarios}),
        encoding="utf-8",
    )
    return report_path


def test_end_to_end_constitution_names_all_required_assurance_layers():
    text = CONSTITUTION.read_text(encoding="utf-8")
    for required in [
        "MECHANICAL_BROWSER_PASS",
        "SEMANTIC_VISUAL_PASS",
        "LIVE_PARITY_PASS",
        "CROSS_ENV_PASS",
        "SALES_READY_PASS",
        "LOCAL_E2E_PASS__LIVE_PARITY_BLOCKED_BY_NO_PUSH",
        "No-throttled-output rule",
    ]:
        assert required in text


def test_contact_sheet_builder_creates_manifest_from_visual_report(tmp_path):
    report_path = make_fixture_report(tmp_path)
    output_dir = tmp_path / "contact-sheets"
    result = subprocess.run(
        [
            sys.executable,
            str(CONTACT_SHEETS),
            "--report",
            str(report_path),
            "--output-dir",
            str(output_dir),
            "--max-images-per-sheet",
            "2",
            "--thumb-width",
            "80",
            "--thumb-height",
            "60",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    manifest = Path(data["manifest"])
    assert manifest.exists()
    manifest_data = json.loads(manifest.read_text(encoding="utf-8"))
    assert manifest_data["schema_version"] == "visual_contact_sheet_manifest_v0.1"
    assert manifest_data["scenario_count"] == 3
    assert manifest_data["sheet_count"] == 2
    assert all(Path(sheet["path"]).exists() for sheet in manifest_data["sheets"])


def test_end_to_end_audit_requires_semantic_review_and_scopes_live_block(tmp_path):
    report_path = make_fixture_report(tmp_path)
    output_dir = tmp_path / "contact-sheets"
    contact = subprocess.run(
        [sys.executable, str(CONTACT_SHEETS), "--report", str(report_path), "--output-dir", str(output_dir), "--json"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert contact.returncode == 0, contact.stderr or contact.stdout
    manifest = json.loads(contact.stdout)["manifest"]

    missing_review = subprocess.run(
        [
            sys.executable,
            str(AUDIT),
            "--report",
            str(report_path),
            "--contact-sheet-manifest",
            manifest,
            "--live-status",
            "BLOCKED_BY_NO_PUSH",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert missing_review.returncode != 0
    assert "SEMANTIC_REVIEW_MISSING" in (missing_review.stdout + missing_review.stderr)

    semantic_review = tmp_path / "semantic-visual-review.json"
    semantic_review.write_text(
        json.dumps(
            {
                "schema_version": "semantic_visual_review_v0.1",
                "verdict": "SEMANTIC_VISUAL_PASS",
                "reviewed_sheet_count": 2,
                "material_blockers": [],
            }
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            sys.executable,
            str(AUDIT),
            "--report",
            str(report_path),
            "--contact-sheet-manifest",
            manifest,
            "--semantic-review",
            str(semantic_review),
            "--live-status",
            "BLOCKED_BY_NO_PUSH",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    data = json.loads(result.stdout)
    assert data["verdict"] == "LOCAL_E2E_PASS__LIVE_PARITY_BLOCKED_BY_NO_PUSH"
    assert data["sales_ready"] is False
    assert data["gates"]["semantic_visual"]["status"] == "PASS"
    assert data["gates"]["live_parity"]["status"] == "BLOCKED_BY_NO_PUSH"


def test_end_to_end_audit_reports_blocked_when_semantic_review_backend_is_unavailable(tmp_path):
    report_path = make_fixture_report(tmp_path)
    output_dir = tmp_path / "contact-sheets"
    contact = subprocess.run(
        [sys.executable, str(CONTACT_SHEETS), "--report", str(report_path), "--output-dir", str(output_dir), "--json"],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert contact.returncode == 0, contact.stderr or contact.stdout
    manifest = json.loads(contact.stdout)["manifest"]

    semantic_review = tmp_path / "semantic-visual-review.json"
    semantic_review.write_text(
        json.dumps(
            {
                "schema_version": "semantic_visual_review_v0.1",
                "verdict": "SEMANTIC_VISUAL_BLOCKED_BY_MODEL_NO_VISION",
                "reviewed_sheet_count": 0,
                "material_blockers": [
                    {"type": "semantic_review_unavailable", "severity": "gate-blocker"}
                ],
            }
        ),
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            sys.executable,
            str(AUDIT),
            "--report",
            str(report_path),
            "--contact-sheet-manifest",
            manifest,
            "--semantic-review",
            str(semantic_review),
            "--live-status",
            "BLOCKED_BY_NO_PUSH",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=60,
    )
    assert result.returncode != 0
    data = json.loads(result.stdout)
    assert data["verdict"] == "E2E_GOPRO_BLOCKED"
    assert data["sales_ready"] is False
    assert data["gates"]["semantic_visual"]["status"] == "BLOCKED"
