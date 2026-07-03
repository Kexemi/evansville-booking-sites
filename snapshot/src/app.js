(function bootQuietSystemsDemo() {
  'use strict';

  const Engine = window.QuietSystemsEngine;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  const state = {
    companyName: 'Example local service company',
    selectedPackage: 'intake'
  };

  function readReadinessInputs() {
    return {
      aiUse: Number($('#aiUse').value),
      dataClarity: Number($('#dataClarity').value),
      workflowRepeatability: Number($('#workflowRepeatability').value),
      governance: Number($('#governance').value),
      urgency: Number($('#urgency').value)
    };
  }

  function readImpactInputs() {
    return {
      wastedHoursPerWeek: Number($('#wastedHours').value),
      captureRate: Number($('#captureRate').value) / 100,
      hourlyValue: Number($('#hourlyValue').value)
    };
  }

  function setRangeLabels() {
    $$('.control input[type="range"]').forEach((input) => {
      const out = document.querySelector(`[data-output="${input.id}"]`);
      if (out) out.textContent = input.id === 'captureRate' ? `${input.value}%` : input.value;
    });
  }

  function renderSearchResults(query) {
    const target = $('#searchResults');
    const hits = Engine.searchBrain(query || $('#brainQuery').value);
    target.innerHTML = hits.map((hit) => `
      <article class="search-hit">
        <strong>${hit.title}</strong>
        <p>${hit.answer}</p>
        <small>${hit.citation}</small>
      </article>
    `).join('');
  }

  function renderPackage(key) {
    state.selectedPackage = key;
    localStorage.setItem('quietSystemsSelectedPackage', key);
    $$('.package-card').forEach((card) => card.classList.toggle('selected', card.dataset.package === key));
    const pkg = Engine.packages[key];
    $('#selectedPackageName').textContent = pkg.name;
    $('#selectedPackageDetail').textContent = `${pkg.level}: ${pkg.outcome} Boundary: ${pkg.caveat}`;
  }

  function renderRecommendation() {
    setRangeLabels();
    state.companyName = $('#companyName').value || 'Your company';
    localStorage.setItem('quietSystemsCompanyName', state.companyName);

    const readiness = Engine.scoreReadiness(readReadinessInputs());
    const impact = Engine.calculateImpact(readImpactInputs());

    $('#diagnosisLevel').textContent = `Level ${readiness.level}`;
    $('#diagnosisTitle').textContent = readiness.stageTitle;
    $('#diagnosisScore').textContent = `${readiness.score}/20 readiness score`;
    $('#recommendedPackage').textContent = readiness.recommendedPackage;
    $('#nextStep').textContent = readiness.nextStep;
    $('#urgencyNote').textContent = readiness.urgencyNote;
    $('#weeklyHours').textContent = `${impact.weeklyHoursReturned.toFixed(1)}h`;
    $('#monthlyHours').textContent = `${impact.monthlyHoursReturned.toFixed(1)}h`;
    $('#yearlyValue').textContent = `$${impact.yearlyDollarEquivalent.toLocaleString()}`;
    $('#impactDisclaimer').textContent = impact.disclaimer;
    $('#prospectBrief').value = Engine.buildProspectBrief({ companyName: state.companyName, readiness, impact });

    renderPackage(readiness.packageKey);
  }

  async function copyBrief() {
    const text = $('#prospectBrief').value;
    const status = $('#copyStatus');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied prospect brief to clipboard.';
      } else {
        $('#prospectBrief').select();
        document.execCommand('copy');
        status.textContent = 'Selected/copied prospect brief with fallback.';
      }
    } catch (error) {
      $('#prospectBrief').select();
      status.textContent = 'Clipboard blocked here; brief is selected so you can copy it manually.';
    }
  }

  function hydrate() {
    const savedCompany = localStorage.getItem('quietSystemsCompanyName');
    const savedPackage = localStorage.getItem('quietSystemsSelectedPackage');
    if (savedCompany) $('#companyName').value = savedCompany;
    if (savedPackage && Engine.packages[savedPackage]) state.selectedPackage = savedPackage;
    $$('.control input').forEach((input) => input.addEventListener('input', renderRecommendation));
    $('#companyName').addEventListener('input', renderRecommendation);
    $('#brainQuery').addEventListener('input', () => renderSearchResults());
    $('#searchButton').addEventListener('click', () => renderSearchResults());
    $('#copyBrief').addEventListener('click', copyBrief);
    $$('.package-btn').forEach((button) => button.addEventListener('click', () => renderPackage(button.closest('.package-card').dataset.package)));
    renderSearchResults('after hours emergency booking');
    renderRecommendation();
    renderPackage(state.selectedPackage);
  }

  document.addEventListener('DOMContentLoaded', hydrate);
  window.renderRecommendation = renderRecommendation;
})();
