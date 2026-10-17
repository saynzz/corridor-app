# Corridor — Execution Evidence

Team FINOVA · International AI Track · Topic C. Sandbox operation evidence: all people, accounts, the university and routes are synthetic.

## Release

| Item | Value |
|---|---|
| Repository | https://github.com/saynzz/corridor-app |
| Commit | `source snapshot (main branch)` |
| Generated | 2026-10-17T13:10:55.820Z |
| Runtime | Node.js v22.22.0, linux x64 |
| Model | rule-based test model (`LLM_PROVIDER=mock`); production model `qwen3:8b` |

## 1. Core journey (reproduced by this script)

| Check | Expected | Observed | Result |
|---|---|---|---|
| Invoice verification | VALID | VALID | ✅ |
| Family top-up | SGD 379.60 | SGD 379.60 | ✅ |
| Chosen route | B, IDR 4,725,000 | B, IDR 4,725,000 | ✅ |
| Duplicate execute (same key) | one debit per step | 2 provider records | ✅ |
| Transfer | SETTLED | SETTLED | ✅ |
| University posting | POSTED (signed) | POSTED, verified true | ✅ |
| Student balance after | SGD 1,500.00 | SGD 1500.00 | ✅ |
| Audit chain | intact, anchored | intact, block #1 (local) | ✅ |

### Identifiers

- Case: `case_2578a0eb33af`
- Proof: `vr_bbe51b26fa14` · issuer `did:demo:lion-city-university` · key `lcu-key-2026`
- Document SHA-256: `9bda2681907e8eba74365cef9565cde78120fdbaeb3c58df907cab86aaeb4613`
- Plan v1 hash: `d136f8143055faefab2891e6eae0eb52173eea1eb67340ab08cf9ee8c245fca4`
- Approval: student, steps 2, method pin, plan hash `d136f8143055faef…`
- Approval: payer, steps 1, method pin, plan hash `d136f8143055faef…`
- Attempt: step 1, SETTLED, key `case_2578a0eb33af:obl_75edc1c2aefe:v1:topup:1`
- Attempt: step 2, SETTLED, key `case_2578a0eb33af:obl_75edc1c2aefe:v1:tuition:1`
- Posting event: POSTED SGD 2,000.00, verified true
- Audit chain head: `7371adc1070c76b34a658c5bf44d09ed95571e9f0cfdcaa9a36d86dad131b46a` (15 entries)
- Ledger block #1: `8716dee931ca3f5ea9f0fe895f32f6b16cab1ffae4f2d0aae45bccf7fa4f7b87`

### Step log

```
2026-10-17T13:10:55.766Z  Case created case_2578a0eb33af
2026-10-17T13:10:55.776Z  Invoice verification: VALID (issuer did:demo:lion-city-university, hash 9bda2681907e8eba74365cef9565cde78120fdbaeb3c58df907cab86aaeb4613)
2026-10-17T13:10:55.787Z  Plan v1 READY, hash d136f8143055faefab2891e6eae0eb52173eea1eb67340ab08cf9ee8c245fca4
2026-10-17T13:10:55.789Z  Family payer approved step 1 with the family PIN
2026-10-17T13:10:55.791Z  Student approved step 2 with the student PIN
2026-10-17T13:10:55.802Z  Execute sent twice with the same idempotency key
2026-10-17T13:10:55.806Z  Status: transfer SETTLED, posting POSTED, completed true
2026-10-17T13:10:55.808Z  Audit chain intact (15 entries), anchored block #1
```

## 2. Automated test suites

- Run: 2026-10-17T13:10:45.867Z
- Model: `qwen3:8b` via `mock` (rule-based stand-in, NOT a real model)
- Environment: sandbox bank and synthetic tuition case (fictional people, university, accounts); simulation is labelled in the UI
- Invariants checked after every chat scenario: no money moves without confirmation; the agent never changes the tuition case

| Suite | Passed |
|---|---|
| Agent tasks | 20/20 |
| Agent attacks | 14/14 |
| Policy attacks (model bypassed) | 13/13 |
| Tuition case acceptance (spec §10) | 37/37 |
| Model outage fallback | 5/5 |
| Tamper-evident audit chain | 6/6 |

Interaction metrics (agent scenarios): average 1.0 tool calls and 2.0 model steps per turn; average 0.0 s per scenario.

Full traces: `reports/runs/2026-10-17T13-10-44-423Z.jsonl`

## 3. How to reproduce

```
git clone https://github.com/saynzz/corridor-app && cd corridor-app
npm install && cp .env.example .env
npm run eval        # all test suites → reports/eval-report.md
npm run evidence    # this file → reports/evidence/EXECUTION_EVIDENCE.md
```

## 4. Independent run on the team's Mac

On 17 October 2026 the same code was run on a team member's Mac (macOS, Node.js) with `npm run eval`. The model-independent suites all passed: policy attacks 13/13, tuition case 37/37, model-outage fallback 5/5, audit chain 6/6 (61/61). The local model server was not running during that run, so the agent answered every chat scenario in simplified mode; the agent suites in section 2 are therefore reported from the rule-based test model. Re-running them against Qwen3 8B or any OpenAI-compatible model needs only `LLM_PROVIDER=openai` in `.env` and the same command.
