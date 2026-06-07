#!/usr/bin/env python3
"""Scrape real brand assets (logos, hero images) from business websites."""
import re, json, os, urllib.request, urllib.error
from pathlib import Path

ASSETS_DIR = Path(r"C:\Users\receg\evansville-booking-sites\assets")
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

# Top 10 best targets — businesses with weak existing sites
TARGETS = [
    ("schiff-air-conditioning-heating-inc", "schiffair.com", "Schiff Air Conditioning"),
    ("hf-refrigeration-inc", "hfrefrigeration.com", "HF Refrigeration"),
    ("e-l-walters-air-conditioning-and-heating-inc", "elwalters.com", "E.L. Walters"),
    ("evansville-heating-and-air-conditioning", "evansvilleheatingandair.com", "Evansville H&A"),
    ("gary-s-plumbing-service-inc", "garysplumbingservice.com", "Gary's Plumbing"),
    ("bill-s-plumbing-service", "bills-plumbing.com", "Bill's Plumbing"),
    ("completely-wired", "completelywiredinc.com", "Completely Wired"),
    ("boyd-electric-llc", "boydelectric.net", "Boyd Electric"),
    ("heads-construction", "headsconstruction.com", "Heads Construction"),
    ("mcmahon-exterminating", "mcmahoncan.com", "McMahon Exterminating"),
    ("kraft-nursery-landscaping", "kraftnursery.net", "Kraft Nursery"),
    ("nellis-lawn-landscape", "nellislandscaping.com", "Nellis Lawn"),
]

def fetch(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
        return urllib.request.urlopen(req, timeout=timeout).read()
    except Exception as e:
        return None

def extract_logo_url(html, domain):
    """Find logo image URL in HTML."""
    # Common logo patterns
    patterns = [
        r'src="([^"]*logo[^"]*)"',
        r'src="([^"]*Logo[^"]*)"',
        r'src="([^"]*brand[^"]*)"',
        r'src="([^"]*header-logo[^"]*)"',
        r'class="[^"]*logo[^"]*"[^>]*src="([^"]*)"',
        r'id="[^"]*logo[^"]*"[^>]*src="([^"]*)"',
        r'alt="[^"]*logo[^"]*"[^>]*src="([^"]*)"',
    ]
    for pat in patterns:
        matches = re.findall(pat, html, re.IGNORECASE)
        for m in matches:
            if m.startswith('http'):
                return m
            if m.startswith('/') or m.startswith('./'):
                return 'https://' + domain + m
            if not m.startswith('data:'):
                return 'https://' + domain + '/' + m
    return None

def extract_hero_images(html, domain):
    """Find hero/background image URLs."""
    images = []
    patterns = [
        r'src="([^"]*hero[^"]*\.(jpg|jpeg|png|webp))"',
        r'background-image[^:]*:\s*url\([\'"]?([^\'"]+)[\'"]?\)',
        r'src="([^"]*slide[^"]*\.(jpg|jpeg|png|webp))"',
        r'src="([^"]*banner[^"]*\.(jpg|jpeg|png|webp))"',
        r'class="[^"]*hero[^"]*"[^>]*src="([^"]*\.(jpg|jpeg|png|webp))"',
    ]
    for pat in patterns:
        matches = re.findall(pat, html, re.IGNORECASE)
        for m in matches:
            url = m[0] if isinstance(m, tuple) else m
            if url.startswith('http') and not any(skip in url for skip in ['facebook', 'twitter', 'linkedin', 'data:image']):
                images.append(url)
            elif url.startswith('/') or url.startswith('./'):
                images.append('https://' + domain + url)
    return images[:3]  # top 3

def download_image(url, filename):
    """Download an image to assets directory."""
    ext = url.split('.')[-1].split('?')[0][:4]
    if ext not in ('jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'):
        ext = 'jpg'
    path = ASSETS_DIR / filename
    if path.exists():
        return path
    try:
        data = fetch(url)
        if data and len(data) > 1000:
            path.write_bytes(data)
            return path
    except:
        pass
    return None

results = {}
for slug, domain, name in TARGETS:
    print(f"\n--- {name} ({domain}) ---")
    url = 'https://' + domain
    html_data = fetch(url)
    if not html_data:
        print(f"  Could not reach {url}")
        continue
    
    html = html_data.decode('utf-8', errors='replace')
    
    # Extract logo
    logo_url = extract_logo_url(html, domain)
    logo_path = None
    if logo_url:
        print(f"  Logo URL: {logo_url[:100]}")
        logo_path = download_image(logo_url, f"{slug}-logo.{logo_url.split('.')[-1].split('?')[0][:4]}")
        if logo_path:
            print(f"  Logo saved: {logo_path} ({logo_path.stat().st_size} bytes)")
        else:
            print(f"  Logo download failed")
    else:
        print(f"  No logo found")
    
    # Extract hero images
    hero_urls = extract_hero_images(html, domain)
    hero_paths = []
    for i, hu in enumerate(hero_urls[:2]):
        print(f"  Hero image {i+1}: {hu[:100]}")
        hp = download_image(hu, f"{slug}-hero-{i+1}.{hu.split('.')[-1].split('?')[0][:4]}")
        if hp:
            hero_paths.append(str(hp))
            print(f"    Saved: {hp} ({hp.stat().st_size} bytes)")
    
    # Extract brand colors from inline styles
    colors = set(re.findall(r'#[0-9a-fA-F]{6}', html))
    # Filter to common brand colors
    brand_colors = [c for c in colors if c.lower() not in ('#ffffff', '#000000', '#00000', '#fff', '#ccc', '#333', '#666', '#999', '#f5f5f5', '#f8f8f8', '#e0e0e0', '#eaeaea', '#f0f0f0', '#f9f9f9')]
    print(f"  Brand colors found: {brand_colors[:5]}")
    
    results[slug] = {
        'business': name,
        'domain': domain,
        'logo_url': logo_url,
        'logo_local': str(logo_path) if logo_path else '',
        'hero_images': hero_paths[:2] if hero_paths else [],
        'hero_urls': hero_urls[:2] if hero_urls else [],
        'colors': brand_colors[:5],
    }

# Write asset manifest
manifest = {}
for slug, data in results.items():
    manifest[slug] = {
        'logo': data['logo_local'] if data['logo_local'] else (data['logo_url'] or ''),
        'hero_images': data['hero_images'] if data['hero_images'] else data['hero_urls'],
        'colors': data['colors'] or [],
    }

manifest_path = ASSETS_DIR / 'asset-manifest.json'
manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(f"\n\nManifest written: {manifest_path}")
print(f"Assets scraped for {len([r for r in results.values() if r['logo_url'] or r['hero_images']])} businesses with assets")
