/**
 * API integration tests for Deal Desk AI
 * Requires the server to be running at localhost:3000
 * Run: node tests/api.test.js
 */

const BASE = 'http://localhost:3000';

const CONVERSATION = `We have 400 ops users, budget approved at $18k/month, \
need to close before Q2. No concerns after the demo.`;

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (!condition) {
    throw new Error(label);
  }
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL  ${name}`);
    console.log(`      → ${err.message}`);
    failed++;
  }
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

// ── Test 1: analyze returns valid schema ─────────────────────────────────────
await runTest('analyze returns valid schema', async () => {
  const { status, body } = await post('/api/analyze', {
    conversation: CONVERSATION,
    pricingModel: 'seat',
  });

  assert(status === 200, `expected status 200, got ${status}`);

  // company
  assert(body.company && typeof body.company === 'object', 'body.company missing');
  assert(typeof body.company.name === 'string', 'company.name missing');
  assert(typeof body.company.industry === 'string', 'company.industry missing');
  assert(typeof body.company.size === 'string', 'company.size missing');

  // signals
  assert(Array.isArray(body.signals), 'body.signals must be array');
  assert(body.signals.length > 0, 'body.signals must be non-empty');
  for (const s of body.signals) {
    assert(
      s.confidence === 'Explicit' || s.confidence === 'Implied',
      `signal confidence invalid: ${s.confidence}`,
    );
    assert(typeof s.content === 'string', 'signal.content must be string');
    assert(typeof s.type === 'string', 'signal.type must be string');
  }

  // recommendedProducts
  assert(Array.isArray(body.recommendedProducts), 'body.recommendedProducts must be array');
  assert(body.recommendedProducts.length > 0, 'body.recommendedProducts must be non-empty');
  for (const p of body.recommendedProducts) {
    assert(typeof p.name === 'string', `product.name missing`);
    assert(typeof p.pricingModel === 'string', `product.pricingModel missing`);
    assert(typeof p.quantity === 'number', `product.quantity must be number`);
    // mrr is computed client-side; server returns unitPrice + volumeDiscount
    // Accept either mrr or unitPrice as evidence the product block is valid
    const hasMrr = typeof p.mrr === 'number' || typeof p.unitPrice === 'number';
    assert(hasMrr, `product must have mrr or unitPrice`);
  }

  // discountRisk
  assert(body.discountRisk && typeof body.discountRisk === 'object', 'body.discountRisk missing');
  assert(
    ['green', 'amber', 'red'].includes(body.discountRisk.rating),
    `discountRisk.rating invalid: ${body.discountRisk.rating}`,
  );
  assert(typeof body.discountRisk.requestedDiscount === 'number', 'discountRisk.requestedDiscount must be number');
  assert(typeof body.discountRisk.policyMax === 'number', 'discountRisk.policyMax must be number');
  assert(typeof body.discountRisk.vpApprovalRequired === 'boolean', 'discountRisk.vpApprovalRequired must be boolean');
  assert(typeof body.discountRisk.explanation === 'string', 'discountRisk.explanation must be string');

  // approvalJustification
  assert(typeof body.approvalJustification === 'string', 'body.approvalJustification must be string');
  assert(body.approvalJustification.length > 50, 'approvalJustification too short');

  // totalMRR — computed server-side or client-side; accept if present
  // (schema doesn't mandate totalMRR at server level, but assert it's a number if present)
  if ('totalMRR' in body) {
    assert(typeof body.totalMRR === 'number', 'body.totalMRR must be number if present');
    assert(body.totalMRR > 0, 'body.totalMRR must be > 0');
  }
});

// ── Test 2: analyze handles consumption model ────────────────────────────────
await runTest('analyze handles consumption model', async () => {
  const { status, body } = await post('/api/analyze', {
    conversation: CONVERSATION,
    pricingModel: 'consumption',
  });

  assert(status === 200, `expected status 200, got ${status}`);
  assert(Array.isArray(body.recommendedProducts), 'body.recommendedProducts must be array');
  assert(body.recommendedProducts.length > 0, 'body.recommendedProducts must be non-empty');
  assert(
    body.recommendedProducts[0].pricingModel === 'consumption',
    `expected pricingModel "consumption", got "${body.recommendedProducts[0].pricingModel}"`,
  );
});

// ── Test 3: simulate returns questions ───────────────────────────────────────
await runTest('simulate returns questions', async () => {
  const { status, body } = await post('/api/simulate-review', {
    conversation: '400 ops users, $18k budget, Q2 deadline',
    justification: 'Customer confirmed 400 seats with approved budget.',
    discountRisk: {
      rating: 'green',
      requestedDiscount: 20,
      policyMax: 25,
      vpApprovalRequired: false,
    },
  });

  assert(status === 200, `expected status 200, got ${status}`);
  assert(body.questions && Array.isArray(body.questions), 'body.questions must be array');
  assert(body.questions.length >= 2, `expected >= 2 questions, got ${body.questions.length}`);
  for (const q of body.questions) {
    // Accept both old string format and new {question, action} format
    const questionText = typeof q === 'string' ? q : q.question;
    assert(typeof questionText === 'string', 'each question.question must be a string');
    assert(questionText.length > 20, `question too short: "${questionText}"`);
    if (typeof q === 'object') {
      assert(typeof q.action === 'string', 'question.action must be a string');
    }
  }
});

// ── Test 4: malformed input returns error gracefully ─────────────────────────
await runTest('malformed input returns error gracefully', async () => {
  const { status, body } = await post('/api/analyze', {
    conversation: 'hey',
    pricingModel: 'seat',
  });

  assert(
    status === 200 || status === 400,
    `expected 200 or 400, got ${status}`,
  );
  // body must be parseable JSON (fetch already parsed it) and not throw
  assert(typeof body === 'object' && body !== null, 'response must be a JSON object');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('');
console.log(`${passed}/${passed + failed} tests passed`);
if (failed > 0) process.exit(1);
