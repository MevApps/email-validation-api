# Email Validation Pro

A zero-cost email validation API built on Cloudflare Workers. Returns 10 validation signals in a single call with a 0–100 deliverability score.

**Live:** [email-validation-api.mevapps.workers.dev](https://email-validation-api.mevapps.workers.dev)
**RapidAPI:** [Email Validation Pro on RapidAPI Hub](https://rapidapi.com/MevApps/api/email-validation-pro)

---

## Quick Start

```bash
curl "https://email-validation-api.mevapps.workers.dev/validate?email=test@gmail.com"
```

```json
{
  "email": "test@gmail.com",
  "assessment": {
    "score": 95,
    "verdict": "valid",
    "suggestion": null
  },
  "facts": {
    "syntax_valid": true,
    "mx_found": true,
    "mx_provider": "Google Workspace",
    "disposable": false,
    "role_based": false,
    "free_provider": true,
    "domain_age_days": null,
    "blacklisted": false
  }
}
```

## Validation Signals

| # | Signal | Description |
|:--|:-------|:------------|
| 1 | Syntax validation | RFC 5321 compliant email format check |
| 2 | MX record lookup | Verifies the domain accepts email |
| 3 | MX provider identification | Google Workspace, Microsoft 365, Yahoo, Zoho, ProtonMail, iCloud |
| 4 | Disposable domain detection | 72,000+ known disposable providers |
| 5 | Role-based address detection | `admin@`, `info@`, `support@`, `noreply@`, etc. |
| 6 | Free provider tagging | Gmail, Yahoo, Outlook, ProtonMail, and 23 others |
| 7 | Typo suggestion | Levenshtein distance against 31 common domains |
| 8 | Domain age | Registration date via RDAP |
| 9 | DNSBL blacklist check | Reverse-IP lookup against spam blacklists |
| 10 | Deliverability score | Weighted 0–100 score combining all signals |

## Scoring

| Signal | Impact |
|:-------|:-------|
| Invalid syntax | Score = 0 |
| Disposable domain | Score = 0 |
| No MX records | −80 |
| Blacklisted | −50 |
| Role-based address | −15 |
| Free provider | −5 |
| Domain age < 7 days | −40 |
| Domain age < 30 days | −25 |
| Domain age < 90 days | −10 |

**Verdicts:** ≥ 80 → `valid` · 30–79 → `risky` · < 30 → `invalid`

## Architecture

```
src/
├── index.ts           Hono API route (thin adapter)
├── validate.ts        Orchestrator with short-circuit and DI
├── scoring.ts         Weighted scoring engine
├── types.ts           All shared types
└── checks/
    ├── syntax.ts      RFC syntax validation
    ├── mx.ts          MX lookup with injected resolver
    ├── mx-provider.ts Pure function: MX hostname → provider
    ├── disposable.ts  72K domain Set lookup
    ├── typo.ts        Levenshtein distance matching
    ├── domain-age.ts  RDAP lookup with injected fetch
    └── blacklist.ts   DNSBL reverse-IP lookup
```

**Design principles:**
- Dependencies injected via default parameters — no global mocking in tests
- Assessment (opinions) separated from facts (observations) in the response
- Disposable emails short-circuit before any network calls
- Pure functions separated from I/O modules

## Tech Stack

| Layer | Choice | Cost |
|:------|:-------|:-----|
| Runtime | Cloudflare Workers | Free (100K req/day) |
| Framework | Hono | — |
| Language | TypeScript | — |
| DNS | `node:dns` via `nodejs_compat` | — |
| Testing | Vitest | — |
| Deployment | Wrangler CLI | — |
| Marketplace | RapidAPI | Free to list |

## Development

```bash
npm install
npm test
npm run dev
```

**Run tests:**
```bash
npm test           # single run
npm run test:watch # watch mode
```

**Deploy:**
```bash
npx wrangler login
npm run deploy
```

**Update disposable domain list:**
```bash
npx tsx scripts/fetch-disposable-list.ts
```

## API Endpoints

| Method | Path | Description |
|:-------|:-----|:------------|
| `GET` | `/validate?email=user@example.com` | Validate an email address |
| `GET` | `/health` | Health check (returns `{"status": "ok"}`) |

## License

MIT
