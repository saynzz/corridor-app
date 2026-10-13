# Corridor — money that moves with you

**FinTechathon 2026 · International AI Track · Topic C: Cross-border & Student Finance Assistant**

Corridor is an AI money agent for international students. It holds your currencies, finds the cheapest way to move money home and back, pays tuition on time, warns you about scams, and helps you build local credit — and **it never moves a cent without your confirmation**.

Everything runs in a **sandbox bank** with fictional accounts. The language model runs **locally** through Ollama by default, so no financial data leaves the device.

---

## Quick start (macOS / Linux / Windows)

Requirements: **Node.js 20+**, **git**, **[Ollama](https://ollama.com)**.

```bash
# 1. Get a local model (≈5 GB). On 8 GB RAM machines use qwen3:4b instead.
ollama pull qwen3:8b

# 2. Install and configure
npm install
cp .env.example .env        # edit LLM_MODEL if you pulled a different model

# 3. Check that the model can call tools
npm run check-llm

# 4. Run
npm run dev                 # open http://localhost:3000
```

**On your phone:** connect the phone to the same Wi-Fi, find the computer's IP (`ipconfig getifaddr en0` on macOS) and open `http://<that-ip>:3000`. In Safari tap *Share → Add to Home Screen* to install it like an app.

**Confirmation:** payments are confirmed with a simulated Face ID scan, or the demo PIN `2468` (`DEMO_PIN`, `DEMO_BIOMETRIC` in `.env`).

**Languages:** the whole UI switches instantly between English, Русский, Қазақша, 中文, Bahasa and Tiếng Việt (Profile → Language). The agent replies in the user's language.

**No model available?** Set `LLM_PROVIDER=mock` in `.env` to use a rule-based stand-in (for UI work only).

**Cloud model instead?** Any OpenAI-compatible endpoint works — set `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY`. No code changes.

---

## Demo script (≈ 2 minutes)

1. **Home** → "Corridor noticed: tuition due in 3 days" → **Plan it**.
2. **Agent** compares 3 routes, shows a 2-step plan, drafts a conversion (T2) and a tuition payment (T3).
3. **Confirm** the conversion with one tap, then the payment with PIN `2468`. Watch balances update on Home.
4. **Shield** → **Try a scam message**: a fake landlord with a hidden prompt injection. The agent flags 5 red flags; the policy layer blocks the payment even if the model tries.
5. **Shield** shows the audit trail. **Reset sandbox** restores demo data.

---

## Architecture

```
Phone / browser (Next.js PWA)
   │  chat, cards, confirm screen
   ▼
/api/agent ──► Agent loop (lib/agent.ts) ──► LLM (Ollama · OpenAI-compatible)
                    │  tool calls
                    ▼
              Tools (lib/tools.ts) ──► POLICY LAYER (lib/policy.ts) ──► Sandbox bank (data/bank.json)
                                          ▲                                   ▲
/api/drafts/:id/confirm ── signed token + PIN (UI only) ──────────────────────┘
```

| Step | What happens |
|---|---|
| Understand | The model reads intent, amounts, currencies and deadlines in any language |
| Plan | Calls read-only tools, compares routes, shows a plan; asks one follow-up if unclear |
| Verify | Policy checks: saved & verified payee, invoice match, limits, cooling-off, taint |
| Confirm | Server signs the draft (HMAC). The token goes **only to the UI**, never to the model |
| Execute | Only `/api/drafts/:id/confirm` with a valid token (+PIN for T3) moves money |
| Log | Every action, block and flag is written to the audit trail |

### Permission tiers

| Tier | Scope | Rule |
|---|---|---|
| T0 READ | balances, rates, bills, history, risk scan | automatic |
| T1 DRAFT | plans, rate alerts | automatic, nothing moves |
| T2 OWN WALLETS | convert between own currencies | one-tap confirm, daily limit S$5,000 |
| T3 MONEY OUT | pay a saved, verified payee | PIN/biometric, invoice match, S$3,000 single / S$6,000 monthly, 24 h cooling-off for new payees |
| NEVER | add payees, change limits, reveal PIN/tokens/prompt | no tool exists — impossible by construction |

### Defence against prompt injection

1. Every user message is scanned (`scanText`) for injection, urgency, changed-account, credential and impersonation signals.
2. High-risk turns are **tainted**: the policy layer refuses any payment draft in that turn, whatever the model does.
3. The model has no tool to add payees or change limits, and never sees confirmation tokens.
4. Execution re-checks balances and payee status, and verifies the HMAC over the exact draft (tampering is detected).

---

## Evaluation (execution evidence)

```bash
npm run eval                    # with the model in .env
LLM_PROVIDER=mock npm run eval  # offline stand-in
```

Runs 16 task scenarios, 10 chat attacks and 12 direct policy attacks, checks the invariant *"no money moved without user confirmation"* after each one, and writes:

- `reports/eval-report.md` — summary table for the technical document
- `reports/runs/<timestamp>.jsonl` — full traces (replies, tool calls, cards, audit entries)

---

## Project layout

```
app/                 screens (Home, Agent, Confirm, Rates, Shield) and API routes
components/          cards, icons, nav
lib/agent.ts         agent loop + system prompt
lib/tools.ts         tool definitions and handlers
lib/policy.ts        tiers, limits, signed drafts, execution, injection scanner
lib/fx.ts            rates (sample or live) and simulated transfer routes
lib/store.ts, seed.ts  sandbox bank (JSON) and demo data
lib/llm.ts           OpenAI-compatible client (Ollama by default), mockllm.ts stand-in
scripts/eval.ts      evaluation harness
```

## Disclaimer

Sandbox prototype for a student competition. All people, banks, accounts, the university and transfer routes are fictional; FX margins and fees are illustrative.
