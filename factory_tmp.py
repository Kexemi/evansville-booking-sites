#!/usr/bin/env python3
"""App Factory v3 — Phase 2"""
import re, json, os, sys
from pathlib import Path

try:
    from brands import BRAND_DATA
except ImportError:
    BRAND_DATA = {}

ASSET_MANIFEST = {}
try:
    import json as _json
    am_path = Path(r"C:\Users\receg\evansville-booking-sites\assets\asset-manifest.json")
    if am_path.exists():
        ASSET_MANIFEST = _json.loads(am_path.read_text(encoding='utf-8'))
except:
    pass

VAULT_ROOT = Path(r"C:\Users\receg\OneDrive\Documents\Obsidian Vault")
CLIENT_LIST = VAULT_ROOT / "Projects" / "Local-Business" / "Phase1-Client-Lists.md"
GENERATED_DIR = VAULT_ROOT / "Projects" / "Local-Business" / "App-Factory" / "Generated-Apps"
DEPLOY_DIR = Path(r"C:\Users\receg\evansville-booking-sites") / "apps"
ROOT_DIR = Path(r"C:\Users\receg\evansville-booking-sites")

CATEGORY_MAP = {
    "hvac": "HVAC", "plumbing": "Plumbing", "lawn care": "Lawn Care",
    "landscaping": "Landscaping", "electrical": "Electrical",
    "roofing": "Roofing", "painting": "Painting", "pest control": "Pest Control",
}

def parse():
    text = CLIENT_LIST.read_text(encoding="utf-8")
    lines = text.splitlines()
    businesses, current_section = [], None
    for line in lines:
        s = line.strip()
        if s.startswith("## "):
            sec = s[3:].lower()
            current_section = None
            for k, v in CATEGORY_MAP.items():
                if k in sec: current_section = v; break
        if current_section and s.startswith("- "):
            bl = s[2:]; name = bl.split(" - ")[0].strip()
            if not name or name.startswith("Additional") or len(name) < 4 or len(name) > 60: continue
            phone = "N/A"; website = ""; address = "N/A"; notes = "N/A"
            if "Phone: " in bl: phone = bl.split("Phone: ")[1].split(" |")[0].strip()
            if "Website: " in bl: website = bl.split("Website: ")[1].split(" |")[0].strip()
            if "Address: " in bl: address = bl.split("Address: ")[1].split(" |")[0].strip()
            if "Notes: " in bl: notes = bl.split("Notes: ")[1].strip()
            slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
            businesses.append({"name": name, "category": current_section, "phone": phone,
                "website": website, "address": address, "notes": notes, "slug": slug, "line": bl})
    seen = set()
    deduped = []
    for b in businesses:
        if b["name"] not in seen: seen.add(b["name"]); deduped.append(b)
    return deduped

CATEGORY_CONFIG = {
    "HVAC": {"primary": "#1e40af", "emergency": True, "emoji": "\u2744\ufe0f", "cta_emergency": "24/7 Emergency Service", "cta_schedule": "Schedule Tune-Up"},
    "Plumbing": {"primary": "#0891b2", "emergency": True, "emoji": "\U0001f527", "cta_emergency": "Emergency? Call Now", "cta_schedule": "Book a Repair"},
    "Lawn Care": {"primary": "#16a34a", "emergency": False, "emoji": "\U0001f33f", "cta_schedule": "Get Your Free Quote"},
    "Landscaping": {"primary": "#059669", "emergency": False, "emoji": "\U0001f333", "cta_schedule": "Request a Consultation"},
    "Electrical": {"primary": "#ca8a04", "emergency": True, "emoji": "\u26a1", "cta_emergency": "24/7 Emergency Electrician", "cta_schedule": "Book an Electrician"},
    "Roofing": {"primary": "#b91c1c", "emergency": True, "emoji": "\U0001f3e0", "cta_emergency": "Storm Damage? Call Now", "cta_schedule": "Get a Free Roof Inspection"},
    "Painting": {"primary": "#7c3aed", "emergency": False, "emoji": "\U0001f3a8", "cta_schedule": "Book a Color Consultation"},
    "Pest Control": {"primary": "#d97706", "emergency": True, "emoji": "\U0001f41c", "cta_emergency": "Emergency Pest Issue?", "cta_schedule": "Schedule Treatment"},
}
