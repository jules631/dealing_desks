const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const path = require('path');

const app = express();
const client = new Anthropic();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Product Catalog Context ───────────────────────────────────────────────
const PRODUCT_CATALOG = `
PRODUCT CATALOG:
1. WorkflowCore
   - Seat pricing: $45/seat/month
   - Consumption pricing: $0.08/workflow-run
   - Volume discounts (seat): 0% (<100 seats), 10% (100-499), 15% (500-999), 20% (1000+)
   - Max approvable discount: 25%
   - Best for: companies describing process automation pain

2. AnalyticsPlus
   - Seat pricing: $30/seat/month
   - Consumption pricing: $0.12/report-generated
   - Volume discounts (seat): 0% (<50 seats), 8% (50-249), 12% (250+)
   - Max approvable discount: 20%
   - Best for: companies describing reporting or data visibility pain

3. AIAgentSuite
   - Seat pricing: $120/seat/month
   - Consumption pricing: $0.45/agent-action
   - No volume discount. Max approvable discount: 15%
   - IMPORTANT: Above 10% requires VP approval flag
   - Best for: companies describing AI automation or headcount reduction goals

PRICING MODEL GUIDANCE:
- Recommend consumption if prospect mentioned variable usage, seasonal spikes, or uncertainty about seat count
- Recommend seat-based if prospect mentioned predictable headcount or budget certainty
- Flag "mixed transition deal" if prospect is moving from seat to consumption — requires revenue ops review
`;

// ─── Analysis System Prompt ────────────────────────────────────────────────
const ANALYSIS_SYSTEM_PROMPT = `You are a senior revenue operations advisor who has seen thousands of enterprise software deals. Your role is to analyze raw sales conversation notes and extract structured deal intelligence.

${PRODUCT_CATALOG}

INSTRUCTIONS:
- Extract signals precisely, distinguishing explicit statements from implied signals (label each)
- Be opinionated about product configuration — say why, not just what
- Ground every discount risk flag in a specific quote from the conversation
- Write approval justifications in the voice of an experienced AE — confident, specific, business-justified, not generic
- NEVER invent signals that weren't in the conversation
- For quantity estimates: use stated headcount/seat counts directly; if not stated, estimate conservatively from company size signals
- Calculate volume discounts based on estimated quantity and the product's discount tiers
- requestedDiscount: extract from conversation (explicit ask or implied competitive pressure); if no discount mentioned, set to 0
- discountRisk rating: green (0-10% off max), amber (within policy but notable), red (exceeds policy max)

Return ONLY valid JSON — no markdown fences, no explanation text, just the raw JSON object matching this exact structure:
{
  "company": { "name": string, "size": string, "industry": string },
  "signals": [{ "type": string, "content": string, "confidence": "Explicit" | "Implied" }],
  "recommendedProducts": [{
    "name": string,
    "pricingModel": "seat" | "consumption" | "mixed",
    "quantity": number,
    "unitPrice": number,
    "volumeDiscount": number,
    "reasoning": string
  }],
  "discountRisk": {
    "rating": "green" | "amber" | "red",
    "requestedDiscount": number,
    "policyMax": number,
    "vpApprovalRequired": boolean,
    "explanation": string
  },
  "approvalJustification": string,
  "pricingModelFlag": string | null
}`;

// ─── Deal Desk Simulation System Prompt ───────────────────────────────────
const DEAL_DESK_SYSTEM_PROMPT = `You are a skeptical deal desk analyst reviewing a deal justification submitted by an Account Executive. Your job is to stress-test the justification before it goes to approval. You've seen hundreds of AEs oversell and under-substantiate. Be constructive but probing — identify gaps, missing evidence, unverified assumptions, or weak points that approvers will question.

Return ONLY a valid JSON array of 2-3 objects. Each object has exactly two fields:
- "question": the probing question an approver would ask (specific to this deal, not generic)
- "action": a one-line prompt (10–15 words) telling the AE exactly what to add to their justification to address it

No markdown, no explanation, just the raw JSON array. Example shape:
[{"question": "What evidence do you have that budget is truly approved?", "action": "Add the name and title of who confirmed budget approval."}]`;

// ─── Routes ────────────────────────────────────────────────────────────────

// Clean URL for the app page
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.post('/api/analyze', async (req, res) => {
  const { conversation, pricingModel = 'seat' } = req.body;
  if (!conversation || !conversation.trim()) {
    return res.status(400).json({ error: 'Conversation text is required.' });
  }

  const pricingNote = pricingModel === 'consumption'
    ? 'The AE has pre-selected consumption-based pricing for this deal. Prioritize consumption model recommendations and use consumption unit prices in your output.'
    : 'The AE has pre-selected seat-based pricing for this deal. Prioritize seat-based model recommendations and use seat unit prices in your output.';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Analyze this sales conversation and extract deal intelligence:\n\n---\n${conversation}\n---\n\nPRICING CONTEXT: ${pricingNote}`,
        },
      ],
    });

    const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let data;
    try {
      data = JSON.parse(cleaned);
    } catch {
      // Try to extract JSON from response if there's any wrapping text
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        data = JSON.parse(match[0]);
      } else {
        throw new Error('AI returned invalid JSON. Please try again.');
      }
    }

    res.json(data);
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ error: err.message || 'Analysis failed. Please try again.' });
  }
});

app.post('/api/simulate-review', async (req, res) => {
  const { justification, signals, discountRisk, company, recommendedProducts } = req.body;
  if (!justification) {
    return res.status(400).json({ error: 'Justification is required.' });
  }

  const contextPayload = JSON.stringify(
    { company, signals, discountRisk, recommendedProducts },
    null,
    2
  );

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: DEAL_DESK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Review this deal justification and return 2-3 pushback questions:\n\nJUSTIFICATION:\n${justification}\n\nDEAL CONTEXT:\n${contextPayload}`,
        },
      ],
    });

    const rawText = response.content.find((b) => b.type === 'text')?.text ?? '';
    const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let questions;
    try {
      questions = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (match) {
        questions = JSON.parse(match[0]);
      } else {
        throw new Error('AI returned invalid JSON for review questions.');
      }
    }

    res.json({ questions });
  } catch (err) {
    console.error('Simulation error:', err);
    res.status(500).json({ error: err.message || 'Simulation failed. Please try again.' });
  }
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Deal Desk Assistant running at http://localhost:${PORT}`);
});
