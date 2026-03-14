/* ── Example Conversations ─────────────────────────────────────────────── */
const EXAMPLES = {
  1: `Hi Sarah, following up on our call. We have about 400 ops team members who would use this daily. Budget is approved at $18k/month, we just need to move before end of Q2. No concerns on the product side after the demo.`,

  2: `Look, we love the product but our CFO is pushing back hard. We've got a competing offer at 40% below your list price. I know that's aggressive but we genuinely can't go to the board without showing we negotiated. We're talking about 600 seats across the analytics and workflow tools.`,

  3: `Honestly we don't know how many people will use it. We're a fast-growing team, could be 50 users next month or 500 by December. We're also not sure if we want to pay per seat or per use — can you model both? Timeline is flexible, no hard deadline.`,
};

/* ── State ─────────────────────────────────────────────────────────────── */
let currentResult = null;
let stepTimers = [];
let pricingModel = 'seat';

/* ── Pricing Model Toggle ───────────────────────────────────────────────── */
function setPricingModel(model) {
  pricingModel = model;
  document.querySelectorAll('.pricing-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('onclick') === `setPricingModel('${model}')`);
  });
}

/* ── Mobile Tab Navigation ─────────────────────────────────────────────── */
document.querySelectorAll('.app-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.app-tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.app-col').forEach((col) => col.classList.remove('tab-visible'));
    const map = { input: '[data-col="input"]', analysis: '[data-col="analysis"]', right: '[data-col="right"]' };
    document.querySelector(map[tab])?.classList.add('tab-visible');
  });
});

/* ── Load Example ──────────────────────────────────────────────────────── */
function loadExample(n) {
  const ta = document.getElementById('conversationInput');
  ta.value = EXAMPLES[n];
  ta.focus();
  clearInlineValidation();
}

/* ── Inline validation ──────────────────────────────────────────────────── */
function showInlineValidation(msg) {
  let el = document.getElementById('convValidation');
  if (!el) {
    el = document.createElement('p');
    el.id = 'convValidation';
    el.style.cssText = 'font-size:13px;font-weight:300;color:var(--red);margin-top:8px;line-height:1.5;';
    document.getElementById('analyzeBtn')?.insertAdjacentElement('afterend', el);
  }
  el.textContent = msg;
}

function clearInlineValidation() {
  const el = document.getElementById('convValidation');
  if (el) el.textContent = '';
}

/* ── Loading Steps ─────────────────────────────────────────────────────── */
function startLoadingSteps() {
  ['step1', 'step2', 'step3'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active', 'done');
  });

  const activate = (id, delay) => setTimeout(() => document.getElementById(id)?.classList.add('active'), delay);
  const done = (id, delay) =>
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('active');
      el.classList.add('done');
    }, delay);

  stepTimers.push(activate('step1', 0));
  stepTimers.push(done('step1', 1100));
  stepTimers.push(activate('step2', 1100));
  stepTimers.push(done('step2', 2300));
  stepTimers.push(activate('step3', 2300));
}

function clearStepTimers() {
  stepTimers.forEach(clearTimeout);
  stepTimers = [];
}

/* ── Panel Visibility Helpers ──────────────────────────────────────────── */
function showLoading() {
  const loadingPanel = document.getElementById('loadingPanel');
  const emptyAnalysis = document.getElementById('emptyAnalysis');
  const analysisResults = document.getElementById('analysisResults');
  const rightEmpty = document.getElementById('rightEmpty');
  const rightResults = document.getElementById('rightResults');

  if (loadingPanel) loadingPanel.classList.add('visible');
  if (emptyAnalysis) emptyAnalysis.style.display = 'none';
  if (analysisResults) analysisResults.style.display = 'none';
  if (rightEmpty) rightEmpty.style.display = 'flex';
  if (rightResults) rightResults.style.display = 'none';

  // Hide simulate button and clear deal desk prep on every new analysis
  const simBtn = document.getElementById('simulateBtn');
  if (simBtn) simBtn.style.display = 'none';
  const prep = document.getElementById('dealDeskPrep');
  if (prep) prep.classList.remove('visible');

  // Clear verdict line
  const verdictLine = document.getElementById('verdictLine');
  if (verdictLine) verdictLine.style.display = 'none';

  // On mobile, switch to analysis tab
  if (window.innerWidth <= 860) {
    document.querySelector('[data-tab="analysis"]')?.click();
  }
}

function hideLoading() {
  const loadingPanel = document.getElementById('loadingPanel');
  if (loadingPanel) loadingPanel.classList.remove('visible');
}

function showResults() {
  const emptyAnalysis = document.getElementById('emptyAnalysis');
  const analysisResults = document.getElementById('analysisResults');
  const rightEmpty = document.getElementById('rightEmpty');
  const rightResults = document.getElementById('rightResults');

  if (emptyAnalysis) emptyAnalysis.style.display = 'none';
  if (analysisResults) analysisResults.style.display = '';
  if (rightEmpty) rightEmpty.style.display = 'none';
  if (rightResults) rightResults.style.display = '';

  // Show simulate button only after successful analysis
  const simBtn = document.getElementById('simulateBtn');
  if (simBtn) simBtn.style.display = '';
}

function showAnalysisError(message) {
  hideLoading();
  const emptyAnalysis = document.getElementById('emptyAnalysis');
  if (!emptyAnalysis) return;
  emptyAnalysis.style.display = 'flex';
  emptyAnalysis.innerHTML = `
    <p style="font-size:14px;font-weight:300;color:var(--red);max-width:200px;text-align:center;line-height:1.6;">
      ${esc(message)}
    </p>`;
}

/* ── Main Analyze Function ──────────────────────────────────────────────── */
async function analyzeConversation() {
  const conversation = document.getElementById('conversationInput')?.value?.trim();

  // Short conversation guard
  if (!conversation || conversation.length < 50) {
    showInlineValidation('Please paste a fuller conversation — at least a few sentences work best.');
    return;
  }
  clearInlineValidation();

  const btn = document.getElementById('analyzeBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="14" height="14" class="spinning" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Analyzing…`;
  }

  showLoading();
  startLoadingSteps();

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation, pricingModel }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Analysis failed.');

    currentResult = data;
    clearStepTimers();
    hideLoading();
    renderResults(data);
    showResults();

    // Update nav company display
    if (data.company?.name && data.company.name !== 'Unknown') {
      const name = document.getElementById('navCompanyName');
      if (name) { name.textContent = data.company.name; name.style.display = ''; }
    }

    // On mobile, mark analysis status
    const status = document.getElementById('analysisStatus');
    if (status) { status.textContent = 'Complete'; status.style.display = ''; }

  } catch (err) {
    clearStepTimers();
    showAnalysisError(
      err.message?.includes('JSON') || err.message?.includes('parse')
        ? 'Something went wrong analyzing this conversation. Try again or use a different example.'
        : (err.message || 'Something went wrong analyzing this conversation. Try again or use a different example.')
    );
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
        </svg>
        Analyze Conversation`;
    }
  }
}

/* ── Render All Results ─────────────────────────────────────────────────── */
function renderResults(data) {
  renderCompany(data.company);
  renderSignals(data.signals);
  renderQuote(data.recommendedProducts, data.pricingModelFlag);
  renderRisk(data.discountRisk);
  renderJustification(data.approvalJustification);
}

/* ── Company Header ─────────────────────────────────────────────────────── */
function renderCompany(company) {
  const header = document.getElementById('companyHeader');
  if (!company?.name || company.name === 'Unknown') {
    if (header) header.style.display = 'none';
    return;
  }
  const initial = document.getElementById('companyInitial');
  const name = document.getElementById('companyName');
  const meta = document.getElementById('companyMeta');
  if (initial) initial.textContent = company.name.charAt(0).toUpperCase();
  if (name) name.textContent = company.name;
  const parts = [company.size, company.industry].filter(Boolean);
  if (meta) meta.textContent = parts.join(' · ') || '—';
  if (header) header.style.display = '';
}

/* ── Signals ────────────────────────────────────────────────────────────── */
function renderSignals(signals) {
  const container = document.getElementById('signalsList');
  if (!container) return;

  if (!signals?.length) {
    container.innerHTML = '<p style="font-size:13px;font-weight:300;color:var(--ink-light);">No signals extracted.</p>';
    return;
  }

  container.innerHTML = signals
    .map((sig) => {
      const confidence = sig.confidence === 'Explicit' ? 'Explicit' : 'Implied';
      const tagClass = confidence === 'Explicit' ? 'tag-green' : 'tag-amber';
      return `
        <div class="signal-item">
          <div class="signal-type-label">${esc(sig.type || '')}</div>
          <div class="signal-row">
            <span class="tag ${tagClass}" style="font-size:10px;flex-shrink:0;">${confidence}</span>
            <div class="signal-content-text">${esc(sig.content || '')}</div>
          </div>
        </div>`;
    })
    .join('');
}

/* ── Consumption unit label ─────────────────────────────────────────────── */
const CONSUMPTION_UNITS = {
  WorkflowCore:  '/workflow-run',
  AnalyticsPlus: '/report',
  AIAgentSuite:  '/agent-action',
};

/* ── Quote Table ─────────────────────────────────────────────────────────── */
function renderQuote(products, pricingModelFlag) {
  const flagEl = document.getElementById('pricingFlag');
  if (flagEl) {
    flagEl.innerHTML = pricingModelFlag
      ? `<div class="pricing-flag">
           <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="flex-shrink:0;margin-top:1px;">
             <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
           </svg>
           <span><strong>Flag:</strong> ${esc(pricingModelFlag)}</span>
         </div>`
      : '';
  }

  const tbody = document.getElementById('quoteTableBody');
  const tfoot = document.getElementById('quoteTfoot');
  if (!tbody || !tfoot) return;

  if (!products?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--ink-light);font-size:12px;padding:16px;">No products recommended.</td></tr>';
    tfoot.innerHTML = '';
    return;
  }

  const isConsumption = pricingModel === 'consumption';
  let totalMRR = 0;

  tbody.innerHTML = products
    .map((p) => {
      const qty = p.quantity || 0;
      const unit = p.unitPrice || 0;
      const disc = p.volumeDiscount || 0;
      const mrr = qty * unit * (1 - disc / 100);
      totalMRR += mrr;
      const model = p.pricingModel || 'seat';
      const isUsage = model === 'consumption' || isConsumption;

      // Unit price display: consumption shows per-unit cost with label
      const unitSuffix = isUsage ? (CONSUMPTION_UNITS[p.name] || '/unit') : '/seat';
      const unitDisplay = `$${fmtUnit(unit)}${unitSuffix}`;

      // Qty label: consumption shows estimated units, seat shows seats
      const qtyDisplay = isUsage ? qty.toLocaleString() : qty.toLocaleString();

      return `
        <tr>
          <td>
            <div class="product-name-cell">${esc(p.name || '')}</div>
            <div class="product-reasoning-cell">${esc(p.reasoning || '')}</div>
          </td>
          <td><span class="tag">${isUsage ? 'Usage' : 'Seat'}</span></td>
          <td style="text-align:right;">${qtyDisplay}</td>
          <td style="text-align:right;font-size:11px;">${esc(unitDisplay)}</td>
          <td style="text-align:right;">${disc > 0 ? `<span style="color:var(--green);font-weight:500;">${disc}%</span>` : '—'}</td>
          <td style="text-align:right;font-weight:500;">$${fmt(mrr)}</td>
        </tr>`;
    })
    .join('');

  const totalLabel = isConsumption ? 'Est. monthly cost' : 'Total MRR';
  tfoot.innerHTML = `
    <tr class="total-row">
      <td colspan="5" style="text-align:right;font-size:10px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-light);">
        ${totalLabel}
      </td>
      <td style="text-align:right;font-family:'DM Serif Display',serif;font-size:18px;">$${fmt(totalMRR)}</td>
    </tr>`;
}

/* ── Risk Card ──────────────────────────────────────────────────────────── */
function renderRisk(risk) {
  const card = document.getElementById('riskCard');
  if (!card || !risk) return;

  const rating = (risk.rating || 'green').toLowerCase();
  const labels = { green: 'Low Risk', amber: 'Moderate Risk', red: 'High Risk' };
  const label = labels[rating] || 'Unknown';

  // Dynamic verdict line in column 3 header
  const verdictLine = document.getElementById('verdictLine');
  if (verdictLine) {
    const verdicts = {
      green: { text: '✓ Ready to submit',                   color: 'var(--green)' },
      amber: { text: '⚠ Address issue before submitting',   color: 'var(--amber)' },
      red:   { text: 'Escalate to VP before submitting',     color: 'var(--red)'   },
    };
    const v = verdicts[rating] || verdicts.green;
    verdictLine.textContent = v.text;
    verdictLine.className = 'verdict-line';
    verdictLine.style.color = v.color;
    verdictLine.style.display = '';
  }

  const vpHtml = risk.vpApprovalRequired
    ? `<div class="vp-flag">
         <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
         VP Approval Required
       </div>`
    : '';

  card.innerHTML = `
    <div class="risk-card ${rating}">
      <div class="risk-header">
        <div>
          <div class="risk-title">${label}</div>
          <div class="risk-subtitle">Discount assessment</div>
        </div>
        <span class="tag ${rating === 'green' ? 'tag-green' : rating === 'amber' ? 'tag-amber' : 'tag-red'}">${rating.toUpperCase()}</span>
      </div>
      <div class="risk-nums">
        <div class="risk-num-cell">
          <div class="risk-num-label">Requested</div>
          <div class="risk-num-value">${risk.requestedDiscount || 0}%</div>
        </div>
        <div class="risk-num-cell">
          <div class="risk-num-label">Policy Max</div>
          <div class="risk-num-value">${risk.policyMax || 0}%</div>
        </div>
      </div>
      <div class="risk-explanation">${esc(risk.explanation || '')}</div>
      ${vpHtml}
    </div>`;
}

/* ── Justification ──────────────────────────────────────────────────────── */
function renderJustification(text) {
  const el = document.getElementById('justificationText');
  if (el) el.textContent = text || '';

  const simText = document.getElementById('simulateBtnText');
  const prep = document.getElementById('dealDeskPrep');
  if (simText) simText.textContent = 'Simulate Deal Desk Review';
  if (prep) prep.classList.remove('visible');

  // Reset copy button
  const copyBtn = document.getElementById('copyBtn');
  if (copyBtn) {
    copyBtn.classList.remove('copied');
    copyBtn.innerHTML = `
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
      </svg>
      Copy`;
  }
}

/* ── Copy Justification ─────────────────────────────────────────────────── */
function copyJustification() {
  const text = document.getElementById('justificationText')?.textContent;
  if (!text) return;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('copyBtn');
    if (!btn) return;
    btn.classList.add('copied');
    btn.innerHTML = `
      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
      </svg>
      Copied`;
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
        Copy`;
    }, 2000);
  });
}

/* ── Simulate Deal Desk Review ─────────────────────────────────────────── */
async function simulateDealDesk() {
  if (!currentResult) return;

  const btn = document.getElementById('simulateBtn');
  const btnText = document.getElementById('simulateBtnText');

  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Running simulation…';

  try {
    const response = await fetch('/api/simulate-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        justification: currentResult.approvalJustification,
        signals: currentResult.signals,
        discountRisk: currentResult.discountRisk,
        company: currentResult.company,
        recommendedProducts: currentResult.recommendedProducts,
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Simulation failed.');

    renderPushbackQuestions(data.questions);
  } catch (err) {
    alert('Simulation failed: ' + (err.message || 'Please try again.'));
  } finally {
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = 'Run Again';
  }
}

/* ── Render Pushback Questions ─────────────────────────────────────────── */
function renderPushbackQuestions(questions) {
  if (!Array.isArray(questions) || !questions.length) return;

  const prep = document.getElementById('dealDeskPrep');
  const list = document.getElementById('pushbackList');
  if (!prep || !list) return;

  list.innerHTML = questions
    .map((q, i) => {
      // Handle both legacy string format and new {question, action} format
      const questionText = typeof q === 'string' ? q : (q.question || '');
      const actionText   = typeof q === 'object' && q.action ? q.action : '';
      return `
        <div class="pushback-item">
          <span class="pushback-num">${i + 1}</span>
          <div class="pushback-body">
            <span class="pushback-text">${esc(questionText)}</span>
            ${actionText ? `<span class="pushback-action">→ Add to justification: ${esc(actionText)}</span>` : ''}
          </div>
        </div>`;
    })
    .join('');

  prep.classList.add('visible');

  if (window.innerWidth <= 860) {
    document.querySelector('[data-tab="right"]')?.click();
    setTimeout(() => prep.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
  }
}

/* ── Utilities ──────────────────────────────────────────────────────────── */
function esc(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function fmt(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return n >= 1000
    ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : n.toFixed(2).replace(/\.00$/, '');
}

// For small per-unit prices (e.g. $0.08) — always show enough decimal places
function fmtUnit(n) {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  if (n < 1) return n.toFixed(2);
  return fmt(n);
}

/* ── Simulate button: hidden until first successful analysis ───────────── */
document.getElementById('simulateBtn').style.display = 'none';

/* ── Spinner keyframe (injected) ────────────────────────────────────────── */
const s = document.createElement('style');
s.textContent = `.spinning { animation: spin 0.7s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(s);
