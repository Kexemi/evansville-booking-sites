(function attachQuietSystemsEngine(root) {
  'use strict';

  const round1 = (value) => Math.round(value * 10) / 10;

  const brainDocs = [
    {
      title: 'After-hours emergency booking policy',
      citation: 'Demo Brain > Intake Policy > Emergency Routing',
      keywords: ['after', 'hours', 'emergency', 'booking', 'urgent', 'triage'],
      answer: 'After-hours emergency booking should capture customer name, phone, service type, address, urgency, photos, and consent for next-step contact. The owner receives a clean triage summary instead of a vague voicemail.'
    },
    {
      title: 'AI-ready service intake schema',
      citation: 'Demo Brain > Data Schema > Service Request v1',
      keywords: ['intake', 'schema', 'service', 'capture', 'form', 'data'],
      answer: 'The first layer is structured capture: request type, location, customer constraints, photos, preferred window, and follow-up permission. This makes later chat/search/automation possible without overpromising autonomy.'
    },
    {
      title: 'Workflow automation approval gate',
      citation: 'Demo Brain > Governance > Human Approval Gate',
      keywords: ['workflow', 'automation', 'agent', 'approval', 'governance', 'quote'],
      answer: 'Workflow automation drafts follow-ups, quote summaries, scheduling options, and weekly reports. Anything that changes price, sends externally, spends money, or commits scope stays behind a human approval gate.'
    },
    {
      title: 'Website AI assistant boundaries',
      citation: 'Demo Brain > Assistant FAQ > Safe Answers',
      keywords: ['chat', 'assistant', 'faq', 'website', 'answer', 'handoff'],
      answer: 'The website assistant answers from approved service, hours, policy, and FAQ content. If confidence is low or the request is sensitive, it hands off to intake instead of inventing an answer.'
    },
    {
      title: 'Weekly impact report',
      citation: 'Demo Brain > Measurement > Time Returned',
      keywords: ['measurement', 'report', 'impact', 'time', 'metrics', 'roi'],
      answer: 'Impact is tracked with visible assumptions: requests captured, manual follow-ups avoided, minutes saved, unresolved cases, and what to improve next. Savings are estimates, not guarantees.'
    }
  ];

  const packages = {
    intake: {
      name: 'Intake + AI-ready data layer',
      level: 'Level 1 bridge',
      buyerFit: 'Companies using AI casually but still losing leads and details in calls, texts, and inboxes.',
      outcome: 'A clean capture surface, owner dashboard/export, and data structure ready for later AI.',
      caveat: 'Low-risk first wedge; no autonomous external actions.'
    },
    assistant: {
      name: 'Website AI assistant + FAQ brain',
      level: 'Level 2 assistant',
      buyerFit: 'Companies with repeated customer questions, service area confusion, or buried policy details.',
      outcome: 'A controlled assistant that answers from approved business content and hands off leads.',
      caveat: 'Answers stay source-grounded and escalation-first.'
    },
    brain: {
      name: 'Searchable business brain + acclimation pipeline',
      level: 'Level 2→3 operating layer',
      buyerFit: 'Companies with SOPs, service docs, scattered notes, and owner knowledge trapped in heads.',
      outcome: 'A searchable source library, update workflow, weekly insight report, and automation-ready data.',
      caveat: 'This prepares real workflow AI; it is not a magic agent switch.'
    },
    ops: {
      name: 'Workflow automation / agentic ops',
      level: 'Level 3 gated teammates',
      buyerFit: 'Companies with repeatable follow-up, quoting, reporting, scheduling, or admin loops.',
      outcome: 'Bounded agents draft and route work with human approval gates for external commitments.',
      caveat: 'Autonomy expands only after measured reliability.'
    }
  };

  function clampNumber(value, fallback, min, max) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function calculateImpact({ wastedHoursPerWeek, captureRate, hourlyValue }) {
    const wasted = clampNumber(wastedHoursPerWeek, 8, 0, 80);
    const capture = clampNumber(captureRate, 0.35, 0, 1);
    const hourly = clampNumber(hourlyValue, 75, 0, 1000);
    const weekly = round1(wasted * capture);
    const monthly = round1(weekly * 4.3333333333);
    const yearly = Math.round(weekly * 52 * hourly);
    return {
      weeklyHoursReturned: weekly,
      monthlyHoursReturned: monthly,
      yearlyDollarEquivalent: yearly,
      assumptions: { wastedHoursPerWeek: wasted, captureRate: capture, hourlyValue: hourly },
      disclaimer: 'This is an estimate, not a guarantee. It shows the value of reducing visible repeated friction.'
    };
  }

  function scoreReadiness(input) {
    const aiUse = clampNumber(input.aiUse, 1, 1, 5);
    const dataClarity = clampNumber(input.dataClarity, 1, 1, 5);
    const workflowRepeatability = clampNumber(input.workflowRepeatability, 1, 1, 5);
    const governance = clampNumber(input.governance, 1, 1, 5);
    const urgency = clampNumber(input.urgency, 3, 1, 5);
    const base = aiUse + dataClarity + workflowRepeatability + governance;
    let level;
    let stageTitle;
    let recommendedPackage;
    let nextStep;
    let packageKey;

    if (base <= 7) {
      level = 1;
      stageTitle = 'AI as scattered thought partner';
      packageKey = 'intake';
      recommendedPackage = packages[packageKey].name;
      nextStep = 'Start with structured capture: intake, service request data, owner export, and a visible proof that repeated information stops leaking.';
    } else if (base <= 11) {
      level = 2;
      stageTitle = 'AI as controlled assistant';
      packageKey = 'assistant';
      recommendedPackage = packages[packageKey].name;
      nextStep = 'Add a controlled assistant and FAQ brain trained on approved content, then review transcripts before widening scope.';
    } else if (base <= 15) {
      level = 3;
      stageTitle = 'AI as workflow teammate';
      packageKey = 'brain';
      recommendedPackage = packages[packageKey].name;
      nextStep = 'Build the searchable business brain, acclimate the data, then automate one repeatable workflow behind approval gates.';
    } else {
      level = 4;
      stageTitle = 'AI as gated operating system';
      packageKey = 'ops';
      recommendedPackage = packages[packageKey].name;
      nextStep = 'Pilot bounded workflow automation with measured reliability, rollback, and human approval for external commitments.';
    }

    const urgencyNote = urgency >= 4 ? 'Urgency is high, so choose a narrow proof slice that can go live safely before deep automation.' : 'Urgency is moderate, so use the first month to harden data quality before expanding automation.';
    return { level, stageTitle, score: base, urgency, recommendedPackage, packageKey, nextStep, urgencyNote };
  }

  function searchBrain(query) {
    const terms = String(query || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const scored = brainDocs.map((doc) => {
      const haystack = [doc.title, doc.answer, doc.citation, doc.keywords.join(' ')].join(' ').toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { ...doc, score };
    }).filter((doc) => doc.score > 0);
    const ranked = (scored.length ? scored : brainDocs.slice(0, 2).map((doc) => ({ ...doc, score: 0 })))
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return ranked.slice(0, 3).map(({ title, citation, answer, score }) => ({ title, citation, answer, score }));
  }

  function formatMoney(value) {
    return '$' + Number(value || 0).toLocaleString('en-US');
  }

  function buildProspectBrief({ companyName, readiness, impact }) {
    const company = String(companyName || 'Your company').trim() || 'Your company';
    const weekly = Number(impact.weeklyHoursReturned).toFixed(1);
    const monthly = Number(impact.monthlyHoursReturned).toFixed(1);
    const yearly = formatMoney(impact.yearlyDollarEquivalent);
    return [
      `${company}: AI Adoption Bridge snapshot`,
      `Current diagnosis: Level ${readiness.level} — ${readiness.stageTitle}.`,
      `Recommended start: ${readiness.recommendedPackage}.`,
      `Why: ${readiness.nextStep}`,
      `Estimated time returned: ${weekly} hours/week, ${monthly} hours/month, ${yearly}/year equivalent from stated assumptions.`,
      'Boundary: estimate, not a guarantee. External sends, pricing commitments, and deeper autonomy stay gated until the proof layer works.'
    ].join('\n');
  }

  const api = { calculateImpact, scoreReadiness, searchBrain, buildProspectBrief, packages, brainDocs };

  root.QuietSystemsEngine = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
