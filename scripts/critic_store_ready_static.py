#!/usr/bin/env python3
"""Adversarial static critic for the Store Ready Sprint.

This critic intentionally checks for false-ready claims and public/live mismatch.
It does not bless outreach; it decides whether the local store can be called stocked
and whether the public store may be opened/sent.
"""
from __future__ import annotations
import json
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://kexemi.github.io/evansville-booking-sites'
LOCAL_REQUIRED = [
    ROOT/'index.html', ROOT/'ai-integration-menu.html', ROOT/'buyer-faq.html',
    ROOT/'pricing-offer-sheet.html', ROOT/'sales-scripts.html', ROOT/'link-pack.html',
    ROOT/'apps/schiff-air-conditioning-heating-inc-booking.html', ROOT/'apps/gary-s-plumbing-service-inc-booking.html', ROOT/'apps/completely-wired-booking.html'
]
PUBLIC_CHECKS = {
    'ai_menu': f'{BASE}/ai-integration-menu.html',
    'schiff': f'{BASE}/apps/schiff-air-conditioning-heating-inc-booking.html',
    'gary': f'{BASE}/apps/gary-s-plumbing-service-inc-booking.html',
    'completely': f'{BASE}/apps/completely-wired-booking.html',
}
issues=[]
minor=[]
for p in LOCAL_REQUIRED:
    if not p.exists(): issues.append(f'missing local required file: {p.name}')
combined='\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in LOCAL_REQUIRED if p.exists())
for phrase in ['No guaranteed leads','No guaranteed Google rankings','owner approval required','AI-ready intake','Website AI Chat','AI-Searchable Business Brain','Data Collection + AI Acclimation','Workflow Automation']:
    if phrase.lower() not in combined.lower(): issues.append(f'missing truth/tier phrase: {phrase}')
for demo in ['schiff-air-conditioning-heating-inc-booking.html','gary-s-plumbing-service-inc-booking.html','completely-wired-booking.html']:
    text=(ROOT/'apps'/demo).read_text(encoding='utf-8', errors='ignore')
    if '<div class="val">None</div><div class="lbl">Reviews</div>' in text:
        issues.append(f'local {demo} still has None Reviews')
    if 'Admin Dashboard' not in text:
        issues.append(f'local {demo} lacks Admin Dashboard preview')
    if 'Demo mode: requests are saved locally' not in text:
        issues.append(f'local {demo} lacks demo-mode delivery banner')
    if 'formsubmit.co' in text or 'evansvillebookings@gmail.com' in text:
        issues.append(f'local {demo} still contains hidden external FormSubmit endpoint')
public=[]
for name,url in PUBLIC_CHECKS.items():
    try:
        with urlopen(Request(url, headers={'User-Agent':'HermesStoreCritic/1.0'}), timeout=20) as r:
            body=r.read().decode('utf-8','ignore')
            public.append({'name':name,'url':url,'status':r.status,'none_reviews':'<div class="val">None</div><div class="lbl">Reviews</div>' in body,'quiet_systems':'Quiet Systems' in body,'demo_banner':'Demo mode: requests are saved locally' in body,'formsubmit':'formsubmit.co' in body or 'evansvillebookings@gmail.com' in body})
    except HTTPError as e:
        public.append({'name':name,'url':url,'status':e.code,'error':str(e)})
    except Exception as e:
        public.append({'name':name,'url':url,'status':'ERR','error':type(e).__name__+': '+str(e)[:100]})
# Public GO is deliberately stricter than local store-ready.
public_blockers=[]
for p in public:
    if p['name']=='ai_menu' and p.get('status') != 200: public_blockers.append('public AI menu is not deployed')
    if p['name'] in ('schiff','gary','completely') and p.get('none_reviews'): public_blockers.append(f"public {p['name']} still has None Reviews")
    if p['name'] in ('schiff','gary','completely') and not p.get('demo_banner'): public_blockers.append(f"public {p['name']} lacks demo-mode delivery banner")
    if p['name'] in ('schiff','gary','completely') and p.get('formsubmit'): public_blockers.append(f"public {p['name']} still contains hidden FormSubmit endpoint")
verdict = 'PASS_LOCAL_STORE_READY__NO_GO_PUBLIC_OPEN' if not issues and public_blockers else 'FAIL_LOCAL_STORE_READY'
report={
  'schema_version':'store_ready_static_critic_v0.1',
  'verdict':verdict,
  'local_critical_issues':issues,
  'minor_issues':minor,
  'public_blockers':public_blockers,
  'public_checks':public,
  'external_contact_recommendation':'DO_NOT_CONTACT until either only Schiff link is used or deploy/push updates public store and patches are verified.',
  'deploy_recommendation':'Ask owner for exact commit/push approval; do not push under generic tool-use approval.'
}
print(json.dumps(report, indent=2))
raise SystemExit(0 if not issues else 1)
