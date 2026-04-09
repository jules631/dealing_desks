# Deal Desk AI

**Turn any sales conversation into an approvable quote — in seconds.**

Live app: [dealing-desks.vercel.app](https://dealing-desks.vercel.app)

---

## What it does

AEs paste raw call notes, emails, or Slack threads. The AI reads the conversation and returns:

- **Extracted deal signals** — labeled Explicit or Implied, grounded in what was actually said
- **Configured quote** — product, pricing model, quantity, and applicable volume discounts
- **Discount risk rating** — green / amber / red against policy, with VP approval flags
- **Approval justification** — drafted in the AE's voice, ready to submit
- **Deal desk simulation** — optional stress-test that surfaces the questions approvers will ask before you submit

No form-filling. No re-encoding. The conversation is the source of truth.

---

## Stack

| Layer | Technology |
|---|---|
| AI | Claude (`claude-sonnet-4-20250514`) via Anthropic SDK |
| Backend | Node.js + Express |
| Frontend | Vanilla HTML/CSS/JS |
| Deployment | Vercel |

---

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Set your Anthropic API key
export ANTHROPIC_API_KEY=sk-...

# 3. Start the server
npm start
# → http://localhost:3000
```

---

## Project structure

```
server.js          — Express API + Claude prompt logic
public/
  index.html       — Marketing landing page
  app.html         — Main app UI
  rationale.html   — PM rationale doc
  style.css        — All styles
tests/
  api.test.js      — API integration tests
vercel.json        — Vercel deployment config
```

---

## API

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/analyze` | POST | Analyze a conversation → signals, quote, risk, justification |
| `/api/simulate-review` | POST | Simulate deal desk pushback questions |

---

Built with [Claude](https://anthropic.com).
