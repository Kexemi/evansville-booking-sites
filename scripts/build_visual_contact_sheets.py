#!/usr/bin/env python3
"""Build visual contact sheets from a visual scenario report.

The sheets are a review surface for semantic/taste QA: every screenshot in the
mechanical report is represented as a labeled thumbnail, grouped into bounded
PNG grids so a visual critic can inspect the corpus without opening 1,000+
files one-by-one.
"""
from __future__ import annotations

import argparse
import json
import math
import textwrap
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", required=True, help="Path to visual-scenario-report.json")
    parser.add_argument("--output-dir", required=True, help="Directory for contact sheets and manifest")
    parser.add_argument("--max-images-per-sheet", type=int, default=48)
    parser.add_argument("--thumb-width", type=int, default=260)
    parser.add_argument("--thumb-height", type=int, default=190)
    parser.add_argument("--json", action="store_true")
    return parser.parse_args()


def resolve_path(path_value: str | None, base: Path) -> Path | None:
    if not path_value:
        return None
    p = Path(path_value)
    if p.is_absolute():
        return p
    candidate = base / p
    if candidate.exists():
        return candidate
    return ROOT / p


def load_report(path_value: str) -> tuple[Path, dict[str, Any]]:
    report_path = resolve_path(path_value, Path.cwd())
    if report_path is None or not report_path.exists():
        raise SystemExit(f"Report not found: {path_value}")
    return report_path, json.loads(report_path.read_text(encoding="utf-8"))


def scenario_key(s: dict[str, Any]) -> str:
    return " | ".join(str(s.get(k, "")) for k in ["type", "slug", "state", "viewport"])


def caption_for(index: int, s: dict[str, Any]) -> str:
    return f"{index:04d} {s.get('type')} / {s.get('slug')} / {s.get('state')} / {s.get('viewport')}"


def draw_multiline(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font: ImageFont.ImageFont, fill: str, max_chars: int) -> None:
    lines = []
    for part in text.split("\n"):
        lines.extend(textwrap.wrap(part, width=max_chars) or [""])
    x, y = xy
    for line in lines[:3]:
        draw.text((x, y), line, fill=fill, font=font)
        y += 12


def load_thumbnail(path: Path, size: tuple[int, int]) -> Image.Image:
    try:
        with Image.open(path) as img:
            img = img.convert("RGB")
            img.thumbnail(size, Image.Resampling.LANCZOS)
            canvas = Image.new("RGB", size, "white")
            x = (size[0] - img.width) // 2
            y = (size[1] - img.height) // 2
            canvas.paste(img, (x, y))
            return canvas
    except Exception:
        canvas = Image.new("RGB", size, "#fee2e2")
        d = ImageDraw.Draw(canvas)
        d.text((10, 10), "MISSING/BAD IMAGE", fill="#991b1b")
        d.text((10, 28), str(path)[:60], fill="#991b1b")
        return canvas


def build_sheet(items: list[tuple[int, dict[str, Any], Path]], sheet_path: Path, thumb_size: tuple[int, int]) -> dict[str, Any]:
    cols = min(4, max(1, math.ceil(math.sqrt(len(items)))))
    rows = math.ceil(len(items) / cols)
    pad = 14
    caption_h = 48
    cell_w = thumb_size[0] + pad * 2
    cell_h = thumb_size[1] + caption_h + pad * 2
    header_h = 34
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h + header_h), "#111827")
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((pad, 10), f"Visual Scenario Contact Sheet — {len(items)} screenshots", fill="white", font=font)
    entries = []
    for pos, (index, scenario, image_path) in enumerate(items):
        row, col = divmod(pos, cols)
        x = col * cell_w + pad
        y = row * cell_h + header_h + pad
        thumb = load_thumbnail(image_path, thumb_size)
        sheet.paste(thumb, (x, y))
        caption = caption_for(index, scenario)
        draw_multiline(draw, (x, y + thumb_size[1] + 6), caption, font, "white", max_chars=max(28, thumb_size[0] // 7))
        entries.append({
            "index": index,
            "type": scenario.get("type"),
            "slug": scenario.get("slug"),
            "state": scenario.get("state"),
            "viewport": scenario.get("viewport"),
            "screenshot": str(image_path),
        })
    sheet_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(sheet_path)
    return {"path": str(sheet_path), "image_count": len(items), "entries": entries}


def main() -> int:
    args = parse_args()
    if args.max_images_per_sheet < 1:
        raise SystemExit("--max-images-per-sheet must be positive")
    report_path, report = load_report(args.report)
    base = report_path.parent.parent.parent if report_path.parts[-3:-2] == ("visual-scenarios",) else ROOT
    scenarios = list(report.get("scenarios") or [])
    selected = []
    missing = []
    for index, scenario in enumerate(scenarios, start=1):
        screenshot = resolve_path(scenario.get("screenshot"), ROOT)
        if screenshot is None or not screenshot.exists():
            missing.append({"index": index, "screenshot": scenario.get("screenshot"), "scenario": scenario_key(scenario)})
        else:
            selected.append((index, scenario, screenshot))
    output_dir = resolve_path(args.output_dir, Path.cwd()) or Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    sheets = []
    for sheet_num, start in enumerate(range(0, len(selected), args.max_images_per_sheet), start=1):
        chunk = selected[start:start + args.max_images_per_sheet]
        sheet_path = output_dir / f"contact-sheet-{sheet_num:03d}.png"
        sheets.append(build_sheet(chunk, sheet_path, (args.thumb_width, args.thumb_height)))
    manifest = {
        "schema_version": "visual_contact_sheet_manifest_v0.1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_report": str(report_path),
        "run_id": report.get("run_id"),
        "scenario_count": len(scenarios),
        "screenshot_count": len(selected),
        "missing_screenshot_count": len(missing),
        "missing_screenshots": missing,
        "sheet_count": len(sheets),
        "max_images_per_sheet": args.max_images_per_sheet,
        "thumb_size": {"width": args.thumb_width, "height": args.thumb_height},
        "sheets": sheets,
    }
    manifest_path = output_dir / "visual-contact-sheet-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    result = {
        "verdict": "CONTACT_SHEETS_PASS" if not missing else "CONTACT_SHEETS_FAIL",
        "manifest": str(manifest_path),
        "scenario_count": len(scenarios),
        "screenshot_count": len(selected),
        "missing_screenshot_count": len(missing),
        "sheet_count": len(sheets),
    }
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"{result['verdict']}: {result['screenshot_count']}/{result['scenario_count']} screenshots -> {manifest_path}")
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
