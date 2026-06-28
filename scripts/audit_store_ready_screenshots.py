#!/usr/bin/env python3
"""Pixel-level screenshot sanity audit for Store Ready screenshots.

This is not semantic vision. It proves screenshots are real, nonblank, large enough,
and visually non-uniform; semantic visual review is blocked when the current model
lane has no image-input support.
"""
from __future__ import annotations
import json
from pathlib import Path
from PIL import Image, ImageStat

ROOT = Path(__file__).resolve().parents[1]
SCREEN_DIR = ROOT / 'artifacts' / 'store-ready-20260628' / 'screenshots'
REQUIRED = ['storefront.png','ai-menu.png','pricing.png','faq.png','scripts.png','link-pack.png','schiff-demo.png','gary-demo.png','completely-demo.png']
checks=[]
def check(name, ok, detail): checks.append({'name':name,'pass':bool(ok),'detail':detail})
for fname in REQUIRED:
    p=SCREEN_DIR/fname
    check(f'exists_{fname}', p.exists(), str(p))
    if not p.exists():
        continue
    im=Image.open(p).convert('RGB')
    w,h=im.size
    stat=ImageStat.Stat(im)
    extrema=im.getextrema()
    mean=sum(stat.mean)/3
    std=sum(stat.stddev)/3
    # Sample top fold only as well.
    top=im.crop((0,0,w,min(h,900)))
    topstat=ImageStat.Stat(top)
    topstd=sum(topstat.stddev)/3
    check(f'size_{fname}', w>=1000 and h>=700, f'{w}x{h}')
    check(f'not_blank_{fname}', std>18 and topstd>18, f'std={std:.1f}, topstd={topstd:.1f}, mean={mean:.1f}, extrema={extrema[:2]}')
    check(f'not_too_white_{fname}', mean<245, f'mean={mean:.1f}')
failed=[c for c in checks if not c['pass']]
report={'schema_version':'store_ready_pixel_audit_v0.1','verdict':'PASS_STORE_READY_PIXEL_AUDIT' if not failed else 'FAIL_STORE_READY_PIXEL_AUDIT','failed':failed,'checks':checks,'semantic_vision_note':'vision_analyze failed because current model lane rejected image inputs; this audit is pixel/proof-only, not semantic review.'}
print(json.dumps(report, indent=2))
raise SystemExit(0 if not failed else 1)
