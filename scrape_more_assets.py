#!/usr/bin/env python3
"""Scrape A+ Derr assets specifically."""
import re, urllib.request, json
from pathlib import Path

ASSETS = Path(r"C:\Users\receg\evansville-booking-sites\assets")
ASSETS.mkdir(parents=True, exist_ok=True)

DOMAINS = [
    ("a-derr-heating-cooling", "aplusderr.com"),
    ("heads-construction", "headsconstruction.com"),
    ("roto-rooter-evansville", "rotorooter.com"),
    ("oxbow-electric-llc", "oxbowelectric.com"),
]

for slug, domain in DOMAINS:
    print(f"\n=== {slug} ({domain}) ===")
    url = 'https://' + domain
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        data = urllib.request.urlopen(req, timeout=15).read()
        html = data.decode('utf-8', errors='replace')
    except Exception as e:
        print(f"  Failed: {e}")
        continue
    
    # Find ALL images on the page
    imgs = re.findall(r'<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp))"[^>]*>', html, re.IGNORECASE)
    print(f"  Found {len(imgs)} images")
    
    # Find logo specifically
    logos = [m for m in imgs if any(x in m.lower() for x in ['logo', 'brand', 'header'])]
    # Find hero/large images (likely >50KB)
    heroes = [m for m in imgs if any(x in m.lower() for x in ['hero', 'banner', 'slide', 'bg', 'background', 'team', 'truck', 'fleet'])]
    
    # Download logo
    for logo_url in logos[:2]:
        if logo_url.startswith('/'):
            logo_url = 'https://' + domain + logo_url
        elif logo_url.startswith('./'):
            logo_url = 'https://' + domain + logo_url[1:]
        elif not logo_url.startswith('http'):
            logo_url = 'https://' + domain + '/' + logo_url
        
        if 'facebook' in logo_url or 'data:image' in logo_url:
            continue
        
        ext = logo_url.split('.')[-1].split('?')[0][:4]
        path = ASSETS / f"{slug}-logo.{ext}"
        try:
            img_data = urllib.request.urlopen(urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10).read()
            if len(img_data) > 1000:
                path.write_bytes(img_data)
                print(f"  Logo saved: {path} ({len(img_data)} bytes)")
                break
        except:
            continue
    
    # Download hero images
    for hero_url in heroes[:2]:
        if hero_url.startswith('/'):
            hero_url = 'https://' + domain + hero_url
        elif not hero_url.startswith('http'):
            hero_url = 'https://' + domain + '/' + hero_url
        
        if 'facebook' in hero_url or 'data:image' in hero_url or 'icon' in hero_url.lower():
            continue
        
        ext = hero_url.split('.')[-1].split('?')[0][:4]
        path = ASSETS / f"{slug}-hero-1.{ext}"
        try:
            img_data = urllib.request.urlopen(urllib.request.Request(hero_url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10).read()
            if len(img_data) > 5000:
                path.write_bytes(img_data)
                print(f"  Hero saved: {path} ({len(img_data)} bytes)")
                break
        except:
            continue
    
    # Extract brand colors
    colors = set(re.findall(r'#[0-9a-fA-F]{6}', html))
    brand_colors = [c for c in colors if c.lower() not in ('#ffffff', '#000000', '#f5f5f5', '#f8f8f8', '#e0e0e0', '#eaeaea', '#f0f0f0', '#f9f9f9', '#cccccc', '#333333', '#666666', '#999999')]
    print(f"  Brand colors: {brand_colors[:5]}")
