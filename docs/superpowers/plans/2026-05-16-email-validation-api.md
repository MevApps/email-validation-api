# Email Validation API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-cost email validation API on Cloudflare Workers, listed on RapidAPI with freemium pricing, targeting $100/month recurring revenue.

**Architecture:** Hono handles routing and JSON responses. Each validation check is an independent module in `src/checks/`. A central orchestrator runs sync checks immediately, async checks (MX, domain age) in parallel, then dependent checks (provider detection, blacklist) after MX resolves. Scoring combines all signals into a 0–100 score. Response follows Uncle Bob SRP: `assessment` (opinions) separated from `facts` (observations).

**Tech Stack:** Cloudflare Workers (free tier), Hono, TypeScript, `node:dns` via `nodejs_compat`, Vitest, Wrangler CLI

---

## File Structure

```
email-validation-api/
├── .gitignore                    # node_modules, dist, .wrangler
├── wrangler.toml                 # Workers config with nodejs_compat
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── scripts/
│   └── fetch-disposable-list.ts  # Downloads latest disposable domain list
├── src/
│   ├── index.ts                  # Hono app, GET /validate route (thin adapter)
│   ├── validate.ts               # Orchestrates checks, builds response
│   ├── checks/
│   │   ├── syntax.ts             # RFC email syntax validation
│   │   ├── mx.ts                 # MX record lookup via DNS
│   │   ├── mx-provider.ts        # Pure function: MX hostname → provider name
│   │   ├── disposable.ts         # Disposable domain detection via Set
│   │   ├── typo.ts               # Typo suggestion via Levenshtein distance
│   │   ├── domain-age.ts         # RDAP registration date lookup
│   │   └── blacklist.ts          # DNSBL reverse-IP lookup
│   ├── scoring.ts                # Weighted score: all signals → 0–100 + verdict
│   └── types.ts                  # All shared types: EmailFacts, EmailAssessment, SyntaxResult, etc.
├── data/
│   ├── disposable-domains.json   # ~72K domains from disposable/disposable repo
│   ├── role-prefixes.json        # ~60 role-based prefixes
│   ├── free-providers.json       # Gmail, Yahoo, Outlook, etc.
│   ├── mx-patterns.json          # Google, Microsoft, Yahoo, Zoho, ProtonMail, iCloud
│   └── common-domains.json       # Popular domains for typo detection
└── test/
    ├── checks/
    │   ├── syntax.test.ts
    │   ├── mx.test.ts
    │   ├── mx-provider.test.ts
    │   ├── disposable.test.ts
    │   ├── typo.test.ts
    │   ├── domain-age.test.ts
    │   └── blacklist.test.ts
    ├── scoring.test.ts
    └── integration.test.ts
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:
```
node_modules/
dist/
.wrangler/
.dev.vars
```

- [ ] **Step 2: Initialize project and install dependencies**

```bash
cd /Users/mevapps/StudioProjects/email-validation-api
npm init -y
npm install hono
npm install -D typescript vitest wrangler @cloudflare/workers-types
```

- [ ] **Step 3: Configure TypeScript**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "outDir": "dist",
    "rootDir": ".",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Configure Wrangler**

Create `wrangler.toml`:
```toml
name = "email-validation-api"
main = "src/index.ts"
compatibility_date = "2026-05-16"
compatibility_flags = ["nodejs_compat"]
```

- [ ] **Step 5: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
})
```

- [ ] **Step 6: Add scripts to package.json**

Update `package.json` scripts:
```json
{
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 7: Commit**

```bash
git init
git add .gitignore package.json tsconfig.json wrangler.toml vitest.config.ts package-lock.json
git commit -m "chore: scaffold email validation API project"
```

---

### Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Define types**

Create `src/types.ts` — all shared types live here, not scattered across modules:
```typescript
export interface SyntaxResult {
  valid: boolean
  local: string
  domain: string
}

export interface MxRecord {
  exchange: string
  priority: number
}

export interface MxResult {
  found: boolean
  records: MxRecord[]
}

export interface EmailFacts {
  syntax_valid: boolean
  mx_found: boolean
  mx_provider: string | null
  disposable: boolean
  role_based: boolean
  free_provider: boolean
  domain_age_days: number | null
  blacklisted: boolean
}

export interface EmailAssessment {
  score: number
  verdict: "valid" | "risky" | "invalid"
  suggestion: string | null
}

export interface ValidationResult {
  email: string
  assessment: EmailAssessment
  facts: EmailFacts
}

export interface DnsResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>
  resolve4(hostname: string): Promise<string[]>
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: define validation result types"
```

---

### Task 3: Data Files

**Files:**
- Create: `data/role-prefixes.json`
- Create: `data/free-providers.json`
- Create: `data/mx-patterns.json`
- Create: `data/common-domains.json`
- Create: `scripts/fetch-disposable-list.ts`
- Create: `data/disposable-domains.json`

- [ ] **Step 1: Create role-based prefixes**

Create `data/role-prefixes.json`:
```json
[
  "abuse", "admin", "billing", "compliance", "devnull",
  "dns", "ftp", "hostmaster", "info", "inoc",
  "ispfeedback", "ispsupport", "list", "list-request", "maildaemon",
  "marketing", "noc", "no-reply", "noreply", "null",
  "office", "phish", "phishing", "postmaster", "privacy",
  "registrar", "root", "sales", "security", "spam",
  "support", "sysadmin", "tech", "undisclosed-recipients", "unsubscribe",
  "usenet", "uucp", "webmaster", "www"
]
```

- [ ] **Step 2: Create free providers list**

Create `data/free-providers.json`:
```json
[
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "yahoo.co.in", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "mail.com", "zoho.com", "yandex.com", "protonmail.com",
  "proton.me", "tutanota.com", "tuta.io", "gmx.com",
  "gmx.net", "fastmail.com", "hey.com", "mail.ru",
  "inbox.com", "rediffmail.com"
]
```

- [ ] **Step 3: Create MX provider patterns**

Create `data/mx-patterns.json`:
```json
{
  "Google Workspace": [".google.com", ".googlemail.com"],
  "Microsoft 365": [".mail.protection.outlook.com"],
  "Yahoo": [".yahoodns.net"],
  "Zoho": [".zoho.com", ".zoho.eu"],
  "ProtonMail": [".protonmail.ch"],
  "iCloud": [".icloud.com", ".apple.com"],
  "Yandex": [".yandex.net"],
  "Mail.ru": [".mail.ru"]
}
```

- [ ] **Step 4: Create common domains for typo detection**

Create `data/common-domains.json`:
```json
[
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk",
  "yahoo.co.in", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "mail.com", "zoho.com", "yandex.com", "protonmail.com",
  "proton.me", "fastmail.com", "hey.com", "gmx.com",
  "gmx.net", "tutanota.com", "tuta.io", "mail.ru",
  "comcast.net", "verizon.net", "att.net", "cox.net",
  "sbcglobal.net", "charter.net", "earthlink.net"
]
```

- [ ] **Step 5: Create disposable domain fetch script**

Create `scripts/fetch-disposable-list.ts`:
```typescript
const DOMAINS_URL = "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.json"

async function fetchDisposableDomains(): Promise<void> {
  const response = await fetch(DOMAINS_URL)
  if (!response.ok) {
    console.error(`Failed to fetch disposable domains: ${response.status}`)
    process.exit(1)
  }

  const domains: string[] = await response.json()
  const sorted = [...new Set(domains)].sort()
  const outPath = new globalThis.URL("../data/disposable-domains.json", import.meta.url)
  const { writeFileSync } = await import("node:fs")
  writeFileSync(outPath, JSON.stringify(sorted, null, 0))
  console.log(`Wrote ${sorted.length} disposable domains`)
}

fetchDisposableDomains()
```

- [ ] **Step 6: Run the fetch script**

```bash
npx tsx scripts/fetch-disposable-list.ts
```

Expected: `Wrote ~72000 disposable domains` and `data/disposable-domains.json` created.

- [ ] **Step 7: Commit**

```bash
git add data/ scripts/
git commit -m "feat: add validation data files and disposable domain fetcher"
```

---

### Task 4: Syntax Check (TDD)

**Files:**
- Create: `src/checks/syntax.ts`
- Create: `test/checks/syntax.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/checks/syntax.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { checkSyntax } from "../../src/checks/syntax"

describe("checkSyntax", () => {
  it("accepts valid email", () => {
    expect(checkSyntax("user@example.com")).toEqual({
      valid: true,
      local: "user",
      domain: "example.com",
    })
  })

  it("accepts email with dots in local part", () => {
    expect(checkSyntax("first.last@example.com")).toEqual({
      valid: true,
      local: "first.last",
      domain: "example.com",
    })
  })

  it("accepts email with plus tag", () => {
    expect(checkSyntax("user+tag@example.com")).toEqual({
      valid: true,
      local: "user+tag",
      domain: "example.com",
    })
  })

  it("rejects empty string", () => {
    expect(checkSyntax("")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects missing @", () => {
    expect(checkSyntax("userexample.com")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects multiple @", () => {
    expect(checkSyntax("user@@example.com")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects missing local part", () => {
    expect(checkSyntax("@example.com")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects missing domain", () => {
    expect(checkSyntax("user@")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects domain without TLD", () => {
    expect(checkSyntax("user@localhost")).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("rejects local part over 64 chars", () => {
    const long = "a".repeat(65)
    expect(checkSyntax(`${long}@example.com`)).toEqual({
      valid: false,
      local: "",
      domain: "",
    })
  })

  it("trims and lowercases input", () => {
    expect(checkSyntax("  User@Example.COM  ")).toEqual({
      valid: true,
      local: "user",
      domain: "example.com",
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/syntax.test.ts
```

Expected: all tests FAIL — `checkSyntax` not found.

- [ ] **Step 3: Implement syntax check**

Create `src/checks/syntax.ts`:
```typescript
import type { SyntaxResult } from "../types"

const INVALID: SyntaxResult = { valid: false, local: "", domain: "" }

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function checkSyntax(raw: string): SyntaxResult {
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return INVALID

  const atIndex = email.indexOf("@")
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (local.length > 64) return INVALID
  if (!domain.includes(".")) return INVALID

  return { valid: true, local, domain }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/syntax.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/checks/syntax.ts test/checks/syntax.test.ts
git commit -m "feat: add email syntax validation with tests"
```

---

### Task 5: Disposable Domain Check (TDD)

**Files:**
- Create: `src/checks/disposable.ts`
- Create: `test/checks/disposable.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/checks/disposable.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { checkDisposable } from "../../src/checks/disposable"

describe("checkDisposable", () => {
  it("detects known disposable domain", () => {
    expect(checkDisposable("tempmail.com")).toBe(true)
  })

  it("detects guerrillamail", () => {
    expect(checkDisposable("guerrillamail.com")).toBe(true)
  })

  it("returns false for gmail.com", () => {
    expect(checkDisposable("gmail.com")).toBe(false)
  })

  it("returns false for custom domain", () => {
    expect(checkDisposable("mycorp.com")).toBe(false)
  })

  it("handles case insensitivity (domains come in lowercased)", () => {
    expect(checkDisposable("tempmail.com")).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/disposable.test.ts
```

Expected: FAIL — `checkDisposable` not found.

- [ ] **Step 3: Implement disposable check**

Create `src/checks/disposable.ts`:
```typescript
import domains from "../../data/disposable-domains.json"

const DISPOSABLE_SET: Set<string> = new Set(domains)

export function checkDisposable(domain: string): boolean {
  return DISPOSABLE_SET.has(domain)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/disposable.test.ts
```

Expected: all tests PASS. If `tempmail.com` is not in the downloaded list, adjust the test to use a domain that is (check `data/disposable-domains.json` for actual entries like `mailinator.com` or `guerrillamail.com`).

- [ ] **Step 5: Commit**

```bash
git add src/checks/disposable.ts test/checks/disposable.test.ts
git commit -m "feat: add disposable email domain detection"
```

---

### Task 6: Typo Suggestion (TDD)

**Files:**
- Create: `src/checks/typo.ts`
- Create: `test/checks/typo.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/checks/typo.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { suggestTypo } from "../../src/checks/typo"

describe("suggestTypo", () => {
  it("suggests gmail.com for gmial.com", () => {
    expect(suggestTypo("gmial.com")).toBe("gmail.com")
  })

  it("suggests gmail.com for gmal.com", () => {
    expect(suggestTypo("gmal.com")).toBe("gmail.com")
  })

  it("suggests yahoo.com for yaho.com", () => {
    expect(suggestTypo("yaho.com")).toBe("yahoo.com")
  })

  it("suggests hotmail.com for hotmial.com", () => {
    expect(suggestTypo("hotmial.com")).toBe("hotmail.com")
  })

  it("suggests outlook.com for outlok.com", () => {
    expect(suggestTypo("outlok.com")).toBe("outlook.com")
  })

  it("returns null for exact match gmail.com", () => {
    expect(suggestTypo("gmail.com")).toBeNull()
  })

  it("returns null for unknown domain", () => {
    expect(suggestTypo("mycorporation.com")).toBeNull()
  })

  it("returns null when distance is too large", () => {
    expect(suggestTypo("xyzabc123.com")).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/typo.test.ts
```

Expected: FAIL — `suggestTypo` not found.

- [ ] **Step 3: Implement typo suggestion**

Create `src/checks/typo.ts`:
```typescript
import commonDomains from "../../data/common-domains.json"

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

const MAX_DISTANCE = 2

export function suggestTypo(domain: string): string | null {
  let bestMatch: string | null = null
  let bestDistance = MAX_DISTANCE + 1

  for (const known of commonDomains) {
    if (domain === known) return null
    const dist = levenshtein(domain, known)
    if (dist > 0 && dist < bestDistance) {
      bestDistance = dist
      bestMatch = known
    }
  }

  return bestMatch
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/typo.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/checks/typo.ts test/checks/typo.test.ts
git commit -m "feat: add typo suggestion with Levenshtein distance"
```

---

### Task 7a: MX Provider Detection — Pure Function (TDD)

**Files:**
- Create: `src/checks/mx-provider.ts`
- Create: `test/checks/mx-provider.test.ts`

This is a pure function — no I/O, no DNS, no mocking needed. Separated from MX lookup per SRP: pattern matching has a different reason to change than DNS resolution.

- [ ] **Step 1: Write failing tests**

Create `test/checks/mx-provider.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { identifyMxProvider } from "../../src/checks/mx-provider"

describe("identifyMxProvider", () => {
  it("identifies Google Workspace", () => {
    expect(identifyMxProvider("aspmx.l.google.com")).toBe("Google Workspace")
  })

  it("identifies Microsoft 365", () => {
    expect(identifyMxProvider("example-com.mail.protection.outlook.com")).toBe("Microsoft 365")
  })

  it("identifies Yahoo", () => {
    expect(identifyMxProvider("mx-biz.mail.am0.yahoodns.net")).toBe("Yahoo")
  })

  it("identifies Zoho", () => {
    expect(identifyMxProvider("mx.zoho.com")).toBe("Zoho")
  })

  it("identifies ProtonMail", () => {
    expect(identifyMxProvider("mail.protonmail.ch")).toBe("ProtonMail")
  })

  it("identifies iCloud", () => {
    expect(identifyMxProvider("mx01.mail.icloud.com")).toBe("iCloud")
  })

  it("returns null for unknown provider", () => {
    expect(identifyMxProvider("mail.mycorp.com")).toBeNull()
  })

  it("handles trailing dot in hostname", () => {
    expect(identifyMxProvider("aspmx.l.google.com.")).toBe("Google Workspace")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/mx-provider.test.ts
```

Expected: FAIL — `identifyMxProvider` not found.

- [ ] **Step 3: Implement MX provider detection**

Create `src/checks/mx-provider.ts`:
```typescript
import mxPatterns from "../../data/mx-patterns.json"

export function identifyMxProvider(exchange: string): string | null {
  const host = exchange.toLowerCase().replace(/\.$/, "")
  for (const [provider, suffixes] of Object.entries(mxPatterns)) {
    for (const suffix of suffixes) {
      if (host.endsWith(suffix)) return provider
    }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/mx-provider.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/checks/mx-provider.ts test/checks/mx-provider.test.ts
git commit -m "feat: add MX provider identification (pure function)"
```

---

### Task 7b: MX Lookup + IP Resolution — DNS I/O (TDD)

**Files:**
- Create: `src/checks/mx.ts`
- Create: `test/checks/mx.test.ts`

DNS dependency is injected via default parameter — tests pass a fake resolver directly, no `vi.mock` needed.

- [ ] **Step 1: Write failing tests**

Create `test/checks/mx.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { checkMx, resolveMxIp } from "../../src/checks/mx"

const fakeResolver = {
  resolveMx: async (_domain: string) => [
    { exchange: "aspmx.l.google.com", priority: 1 },
  ],
  resolve4: async (_hostname: string) => ["142.250.80.5"],
}

const failingResolver = {
  resolveMx: async () => { throw new Error("ENOTFOUND") },
  resolve4: async () => { throw new Error("ENOTFOUND") },
}

describe("checkMx", () => {
  it("returns records when MX exists", async () => {
    const result = await checkMx("gmail.com", fakeResolver)
    expect(result).toEqual({
      found: true,
      records: [{ exchange: "aspmx.l.google.com", priority: 1 }],
    })
  })

  it("returns empty when MX does not exist", async () => {
    const result = await checkMx("nonexistent.com", failingResolver)
    expect(result).toEqual({ found: false, records: [] })
  })
})

describe("resolveMxIp", () => {
  it("returns first IP for hostname", async () => {
    const result = await resolveMxIp("aspmx.l.google.com", fakeResolver)
    expect(result).toBe("142.250.80.5")
  })

  it("returns null on failure", async () => {
    const result = await resolveMxIp("bad.host", failingResolver)
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/mx.test.ts
```

Expected: FAIL — `checkMx` and `resolveMxIp` not found.

- [ ] **Step 3: Implement MX lookup with injected resolver**

Create `src/checks/mx.ts`:
```typescript
import dns from "node:dns"
import type { MxResult, DnsResolver } from "../types"

const defaultResolver: DnsResolver = dns.promises

export async function checkMx(
  domain: string,
  resolver: DnsResolver = defaultResolver
): Promise<MxResult> {
  try {
    const records = await resolver.resolveMx(domain)
    return {
      found: records.length > 0,
      records: records.map((r) => ({
        exchange: r.exchange.toLowerCase().replace(/\.$/, ""),
        priority: r.priority,
      })),
    }
  } catch {
    return { found: false, records: [] }
  }
}

export async function resolveMxIp(
  exchange: string,
  resolver: DnsResolver = defaultResolver
): Promise<string | null> {
  try {
    const ips = await resolver.resolve4(exchange)
    return ips[0] ?? null
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/mx.test.ts
```

Expected: all tests PASS. No `vi.mock` — clean dependency injection.

- [ ] **Step 5: Commit**

```bash
git add src/checks/mx.ts test/checks/mx.test.ts
git commit -m "feat: add MX lookup and IP resolution with injected resolver"
```

---

### Task 8: Domain Age via RDAP (TDD)

**Files:**
- Create: `src/checks/domain-age.ts`
- Create: `test/checks/domain-age.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/checks/domain-age.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { checkDomainAge } from "../../src/checks/domain-age"

function fakeFetch(response: { ok: boolean; json?: () => Promise<unknown> }): typeof fetch {
  return async () => response as Response
}

function failingFetch(): typeof fetch {
  return async () => { throw new Error("timeout") }
}

describe("checkDomainAge", () => {
  it("returns age in days for valid RDAP response", async () => {
    const fetcher = fakeFetch({
      ok: true,
      json: async () => ({
        events: [
          { eventAction: "registration", eventDate: "2020-01-01T00:00:00Z" },
          { eventAction: "last changed", eventDate: "2024-06-01T00:00:00Z" },
        ],
      }),
    })

    const result = await checkDomainAge("example.com", fetcher)
    expect(result).toBeGreaterThan(1900)
  })

  it("returns null when RDAP returns 404", async () => {
    const fetcher = fakeFetch({ ok: false })

    const result = await checkDomainAge("unknown.xyz", fetcher)
    expect(result).toBeNull()
  })

  it("returns null when no registration event found", async () => {
    const fetcher = fakeFetch({
      ok: true,
      json: async () => ({
        events: [{ eventAction: "last changed", eventDate: "2024-01-01T00:00:00Z" }],
      }),
    })

    const result = await checkDomainAge("example.com", fetcher)
    expect(result).toBeNull()
  })

  it("returns null when fetch throws (timeout/network error)", async () => {
    const result = await checkDomainAge("slow-rdap.com", failingFetch())
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/domain-age.test.ts
```

Expected: FAIL — `checkDomainAge` not found.

- [ ] **Step 3: Implement domain age check**

Create `src/checks/domain-age.ts` — fetch is injected via default parameter, no global mocking needed:
```typescript
const RDAP_BASE = "https://rdap.org/domain"
const TIMEOUT_MS = 3000

export async function checkDomainAge(
  domain: string,
  fetcher: typeof fetch = fetch
): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetcher(`${RDAP_BASE}/${domain}`, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) return null

    const data = await response.json() as {
      events?: Array<{ eventAction: string; eventDate: string }>
    }

    const registration = data.events?.find(
      (e) => e.eventAction === "registration"
    )
    if (!registration) return null

    const created = new Date(registration.eventDate).getTime()
    const now = Date.now()
    return Math.floor((now - created) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/domain-age.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/checks/domain-age.ts test/checks/domain-age.test.ts
git commit -m "feat: add domain age check via RDAP with injected fetcher"
```

---

### Task 9: DNSBL Blacklist Check (TDD)

**Files:**
- Create: `src/checks/blacklist.ts`
- Create: `test/checks/blacklist.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/checks/blacklist.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { checkBlacklist } from "../../src/checks/blacklist"

const listedResolver = {
  resolve4: async () => ["127.0.0.2"],
}

const cleanResolver = {
  resolve4: async () => { throw new Error("ENOTFOUND") },
}

describe("checkBlacklist", () => {
  it("returns true when IP is listed on any DNSBL", async () => {
    const result = await checkBlacklist("1.2.3.4", listedResolver)
    expect(result).toBe(true)
  })

  it("returns false when IP is not listed (NXDOMAIN)", async () => {
    const result = await checkBlacklist("8.8.8.8", cleanResolver)
    expect(result).toBe(false)
  })

  it("returns false when IP is null", async () => {
    const result = await checkBlacklist(null, cleanResolver)
    expect(result).toBe(false)
  })

  it("correctly reverses IP for DNSBL query (1.2.3.4 → queries 4.3.2.1.zone)", async () => {
    let queriedHostname = ""
    const spyResolver = {
      resolve4: async (hostname: string) => {
        queriedHostname = hostname
        throw new Error("ENOTFOUND")
      },
    }
    await checkBlacklist("1.2.3.4", spyResolver)
    expect(queriedHostname).toMatch(/^4\.3\.2\.1\./)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/checks/blacklist.test.ts
```

Expected: FAIL — `checkBlacklist` and `reverseIp` not found.

- [ ] **Step 3: Implement blacklist check**

Create `src/checks/blacklist.ts` — DNS resolver injected, `reverseIp` kept private:
```typescript
import dns from "node:dns"

const DNSBL_ZONES = [
  "bl.spamcop.net",
  "dnsbl-1.uceprotect.net",
  "cbl.abuseat.org",
]

interface DnsA {
  resolve4(hostname: string): Promise<string[]>
}

const defaultResolver: DnsA = dns.promises

function reverseIp(ip: string): string {
  return ip.split(".").reverse().join(".")
}

export async function checkBlacklist(
  ip: string | null,
  resolver: DnsA = defaultResolver
): Promise<boolean> {
  if (!ip) return false

  const reversed = reverseIp(ip)

  const checks = DNSBL_ZONES.map(async (zone) => {
    try {
      await resolver.resolve4(`${reversed}.${zone}`)
      return true
    } catch {
      return false
    }
  })

  const results = await Promise.all(checks)
  return results.some(Boolean)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/checks/blacklist.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/checks/blacklist.ts test/checks/blacklist.test.ts
git commit -m "feat: add DNSBL blacklist check with injected resolver"
```

---

### Task 10: Scoring Engine (TDD)

**Files:**
- Create: `src/scoring.ts`
- Create: `test/scoring.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/scoring.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { calculateScore } from "../src/scoring"
import type { EmailFacts } from "../src/types"

function makeFacts(overrides: Partial<EmailFacts> = {}): EmailFacts {
  return {
    syntax_valid: true,
    mx_found: true,
    mx_provider: "Google Workspace",
    disposable: false,
    role_based: false,
    free_provider: false,
    domain_age_days: 5000,
    blacklisted: false,
    ...overrides,
  }
}

describe("calculateScore", () => {
  it("returns 100 and 'valid' for perfect email", () => {
    const result = calculateScore(makeFacts())
    expect(result.score).toBe(100)
    expect(result.verdict).toBe("valid")
  })

  it("returns 0 and 'invalid' for bad syntax", () => {
    const result = calculateScore(makeFacts({ syntax_valid: false }))
    expect(result.score).toBe(0)
    expect(result.verdict).toBe("invalid")
  })

  it("returns 0 and 'invalid' for disposable domain", () => {
    const result = calculateScore(makeFacts({ disposable: true }))
    expect(result.score).toBe(0)
    expect(result.verdict).toBe("invalid")
  })

  it("heavily penalizes missing MX", () => {
    const result = calculateScore(makeFacts({ mx_found: false, mx_provider: null }))
    expect(result.score).toBeLessThan(30)
    expect(result.verdict).toBe("invalid")
  })

  it("penalizes blacklisted domain", () => {
    const result = calculateScore(makeFacts({ blacklisted: true }))
    expect(result.score).toBeLessThan(60)
    expect(result.verdict).toBe("risky")
  })

  it("slightly penalizes role-based address", () => {
    const result = calculateScore(makeFacts({ role_based: true }))
    expect(result.score).toBeGreaterThan(60)
    expect(result.score).toBeLessThan(100)
  })

  it("slightly penalizes free provider", () => {
    const result = calculateScore(makeFacts({ free_provider: true }))
    expect(result.score).toBeGreaterThan(70)
    expect(result.score).toBeLessThan(100)
  })

  it("penalizes very new domain (< 30 days)", () => {
    const result = calculateScore(makeFacts({ domain_age_days: 5 }))
    expect(result.score).toBeLessThan(80)
  })

  it("does not penalize null domain age (RDAP unavailable)", () => {
    const result = calculateScore(makeFacts({ domain_age_days: null }))
    expect(result.score).toBeGreaterThan(80)
  })

  it("verdict is 'risky' for score between 30-79", () => {
    const result = calculateScore(makeFacts({ blacklisted: true }))
    expect(result.verdict).toBe("risky")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/scoring.test.ts
```

Expected: FAIL — `calculateScore` not found.

- [ ] **Step 3: Implement scoring engine**

Create `src/scoring.ts`:
```typescript
import type { EmailFacts, EmailAssessment } from "./types"

export function calculateScore(
  facts: EmailFacts
): Pick<EmailAssessment, "score" | "verdict"> {
  if (!facts.syntax_valid) return { score: 0, verdict: "invalid" }
  if (facts.disposable) return { score: 0, verdict: "invalid" }

  let score = 100

  if (!facts.mx_found) score -= 80
  if (facts.blacklisted) score -= 50
  if (facts.role_based) score -= 15
  if (facts.free_provider) score -= 5

  if (facts.domain_age_days !== null) {
    if (facts.domain_age_days < 7) score -= 40
    else if (facts.domain_age_days < 30) score -= 25
    else if (facts.domain_age_days < 90) score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  const verdict: EmailAssessment["verdict"] =
    score >= 80 ? "valid" : score >= 30 ? "risky" : "invalid"

  return { score, verdict }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/scoring.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scoring.ts test/scoring.test.ts
git commit -m "feat: add weighted deliverability scoring engine"
```

---

### Task 11: Validation Orchestrator (TDD)

**Files:**
- Create: `src/validate.ts`
- Create: `test/integration.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/integration.test.ts` — no global mocks, uses dependency injection:
```typescript
import { describe, it, expect } from "vitest"
import { validateEmail } from "../src/validate"

const fakeResolver = {
  resolveMx: async () => [{ exchange: "aspmx.l.google.com", priority: 1 }],
  resolve4: async () => { throw new Error("ENOTFOUND") },
}

const fakeFetcher = (async () => ({
  ok: true,
  json: async () => ({
    events: [{ eventAction: "registration", eventDate: "2004-08-10T00:00:00Z" }],
  }),
})) as unknown as typeof fetch

describe("validateEmail", () => {
  it("returns full validation result for valid email", async () => {
    const result = await validateEmail("test@gmail.com", fakeResolver, fakeFetcher)

    expect(result.email).toBe("test@gmail.com")
    expect(result.facts.syntax_valid).toBe(true)
    expect(result.facts.mx_found).toBe(true)
    expect(result.facts.mx_provider).toBe("Google Workspace")
    expect(result.facts.disposable).toBe(false)
    expect(result.facts.free_provider).toBe(true)
    expect(result.facts.role_based).toBe(false)
    expect(result.assessment.score).toBeGreaterThan(0)
    expect(result.assessment.verdict).toBeDefined()
    expect(result.assessment.suggestion).toBeNull()
  })

  it("returns suggestion for typo domain", async () => {
    const result = await validateEmail("test@gmial.com", fakeResolver, fakeFetcher)
    expect(result.assessment.suggestion).toBe("test@gmail.com")
  })

  it("returns invalid for bad syntax", async () => {
    const result = await validateEmail("not-an-email", fakeResolver, fakeFetcher)
    expect(result.facts.syntax_valid).toBe(false)
    expect(result.assessment.score).toBe(0)
    expect(result.assessment.verdict).toBe("invalid")
  })

  it("detects role-based address", async () => {
    const result = await validateEmail("admin@gmail.com", fakeResolver, fakeFetcher)
    expect(result.facts.role_based).toBe(true)
  })

  it("short-circuits for disposable — no DNS or RDAP calls made", async () => {
    let dnsCalled = false
    let fetchCalled = false
    const spyResolver = {
      resolveMx: async () => { dnsCalled = true; return [] },
      resolve4: async () => { dnsCalled = true; return [] },
    }
    const spyFetcher = (async () => { fetchCalled = true; return new Response() }) as unknown as typeof fetch

    const result = await validateEmail("test@mailinator.com", spyResolver, spyFetcher)
    expect(result.facts.disposable).toBe(true)
    expect(result.assessment.score).toBe(0)
    expect(result.assessment.verdict).toBe("invalid")
    expect(dnsCalled).toBe(false)
    expect(fetchCalled).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run test/integration.test.ts
```

Expected: FAIL — `validateEmail` not found.

- [ ] **Step 3: Implement orchestrator**

Create `src/validate.ts` — dependencies injected, disposable short-circuits:
```typescript
import dns from "node:dns"
import type { ValidationResult, EmailFacts, DnsResolver } from "./types"
import { checkSyntax } from "./checks/syntax"
import { checkMx, resolveMxIp } from "./checks/mx"
import { identifyMxProvider } from "./checks/mx-provider"
import { checkDisposable } from "./checks/disposable"
import { suggestTypo } from "./checks/typo"
import { checkDomainAge } from "./checks/domain-age"
import { checkBlacklist } from "./checks/blacklist"
import { calculateScore } from "./scoring"
import rolePrefixes from "../data/role-prefixes.json"
import freeProviders from "../data/free-providers.json"

const ROLE_SET = new Set(rolePrefixes)
const FREE_SET = new Set(freeProviders)

export async function validateEmail(
  raw: string,
  resolver: DnsResolver = dns.promises,
  fetcher: typeof fetch = fetch
): Promise<ValidationResult> {
  const syntax = checkSyntax(raw)
  const email = syntax.valid ? `${syntax.local}@${syntax.domain}` : raw.trim().toLowerCase()

  if (!syntax.valid) {
    const facts: EmailFacts = {
      syntax_valid: false,
      mx_found: false,
      mx_provider: null,
      disposable: false,
      role_based: false,
      free_provider: false,
      domain_age_days: null,
      blacklisted: false,
    }
    const { score, verdict } = calculateScore(facts)
    return { email, assessment: { score, verdict, suggestion: null }, facts }
  }

  const { local, domain } = syntax
  const typoSuggestion = suggestTypo(domain)
  const suggestion = typoSuggestion ? `${local}@${typoSuggestion}` : null
  const roleBased = ROLE_SET.has(local)
  const freeProvider = FREE_SET.has(domain)
  const disposable = checkDisposable(domain)

  if (disposable) {
    const facts: EmailFacts = {
      syntax_valid: true,
      mx_found: false,
      mx_provider: null,
      disposable: true,
      role_based: roleBased,
      free_provider: freeProvider,
      domain_age_days: null,
      blacklisted: false,
    }
    const { score, verdict } = calculateScore(facts)
    return { email, assessment: { score, verdict, suggestion }, facts }
  }

  const [mxResult, domainAgeDays] = await Promise.all([
    checkMx(domain, resolver),
    checkDomainAge(domain, fetcher),
  ])

  let mxProvider: string | null = null
  let blacklisted = false

  if (mxResult.found && mxResult.records.length > 0) {
    const primaryMx = mxResult.records.sort((a, b) => a.priority - b.priority)[0]
    mxProvider = identifyMxProvider(primaryMx.exchange)

    const mxIp = await resolveMxIp(primaryMx.exchange, resolver)
    blacklisted = await checkBlacklist(mxIp, resolver)
  }

  const facts: EmailFacts = {
    syntax_valid: true,
    mx_found: mxResult.found,
    mx_provider: mxProvider,
    disposable: false,
    role_based: roleBased,
    free_provider: freeProvider,
    domain_age_days: domainAgeDays,
    blacklisted,
  }

  const { score, verdict } = calculateScore(facts)
  return { email, assessment: { score, verdict, suggestion }, facts }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run test/integration.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/validate.ts test/integration.test.ts
git commit -m "feat: add validation orchestrator with short-circuit and DI"
```

---

### Task 12: Hono API Route

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Implement Hono app**

Create `src/index.ts` — thin adapter with boundary validation (RFC 5321: 254 char max):
```typescript
import { Hono } from "hono"
import { cors } from "hono/cors"
import { validateEmail } from "./validate"

const MAX_EMAIL_LENGTH = 254

const app = new Hono()

app.use("*", cors())

app.get("/validate", async (c) => {
  const email = c.req.query("email")
  if (!email || email.length > MAX_EMAIL_LENGTH) {
    return c.json({ error: "Missing or invalid 'email' query parameter (max 254 chars)" }, 400)
  }

  const result = await validateEmail(email)
  return c.json(result)
})

app.get("/health", (c) => c.json({ status: "ok" }))

app.all("*", (c) => c.json({ error: "Not found" }, 404))

export default app
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests across all files PASS.

- [ ] **Step 3: Test locally with wrangler**

```bash
npx wrangler dev
```

Then in another terminal:
```bash
curl "http://localhost:8787/validate?email=test@gmail.com" | jq .
curl "http://localhost:8787/validate?email=test@gmial.com" | jq .
curl "http://localhost:8787/validate?email=invalid" | jq .
curl "http://localhost:8787/validate?email=test@mailinator.com" | jq .
curl "http://localhost:8787/validate?email=admin@yahoo.com" | jq .
```

Verify each response matches the expected format:
```json
{
  "email": "...",
  "assessment": { "score": ..., "verdict": "...", "suggestion": ... },
  "facts": { "syntax_valid": ..., "mx_found": ..., ... }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Hono API route with /validate endpoint"
```

---

### Task 13: Deploy to Cloudflare Workers

- [ ] **Step 1: Create Cloudflare account (if needed)**

Go to https://dash.cloudflare.com/sign-up — free account, no credit card.

- [ ] **Step 2: Login via wrangler**

```bash
npx wrangler login
```

This opens a browser for OAuth. Approve the authorization.

- [ ] **Step 3: Deploy**

```bash
npx wrangler deploy
```

Expected output includes a URL like: `https://email-validation-api.<your-subdomain>.workers.dev`

- [ ] **Step 4: Test the live endpoint**

```bash
curl "https://email-validation-api.<your-subdomain>.workers.dev/validate?email=test@gmail.com" | jq .
curl "https://email-validation-api.<your-subdomain>.workers.dev/health" | jq .
```

Verify live responses match local responses.

- [ ] **Step 5: Commit deployment config (if wrangler updated anything)**

```bash
git add -A
git commit -m "chore: deploy to Cloudflare Workers"
```

---

### Task 14: Publish on RapidAPI

- [ ] **Step 1: Create RapidAPI provider account**

Go to https://rapidapi.com/auth/sign-up — free, no credit card.

- [ ] **Step 2: Add your API**

1. Go to https://rapidapi.com/studio
2. Click "Add New API"
3. Name: `Email Validation Pro`
4. Category: `Email`
5. Description:

```
Fast, accurate email validation API. Checks syntax, MX records, disposable domains (72K+ list), role-based addresses, free provider detection, typo suggestions, domain age, blacklist status, and MX provider identification. Returns a 0-100 deliverability score.

10 validation signals in one call. No signup friction — start with 100 free requests/month.
```

- [ ] **Step 3: Configure the base URL**

Set the base URL to your Workers URL: `https://email-validation-api.<your-subdomain>.workers.dev`

- [ ] **Step 4: Add the endpoint**

Add endpoint:
- Method: `GET`
- Path: `/validate`
- Query parameter: `email` (required, string)

Add example responses in the documentation.

- [ ] **Step 5: Set pricing plans**

| Plan | Price | Requests/month | Rate limit |
|---|---|---|---|
| Free | $0 | 100 | 10/minute |
| Basic | $5/mo | 5,000 | 60/minute |
| Pro | $15/mo | 25,000 | 120/minute |
| Ultra | $35/mo | 100,000 | 300/minute |

- [ ] **Step 6: Publish and verify**

Click "Make API Public." Test the API through RapidAPI's built-in test console to confirm it works end-to-end.

---

## Summary

| Task | Estimated time |
|---|---|
| Task 1: Scaffolding (+ .gitignore) | 10 min |
| Task 2: Types (all types centralized) | 5 min |
| Task 3: Data files | 15 min |
| Task 4: Syntax check | 15 min |
| Task 5: Disposable check | 10 min |
| Task 6: Typo suggestion | 15 min |
| Task 7a: MX provider detection (pure) | 10 min |
| Task 7b: MX lookup + IP resolution (DI) | 15 min |
| Task 8: Domain age (injected fetch) | 15 min |
| Task 9: Blacklist check (injected resolver) | 10 min |
| Task 10: Scoring engine (dead code removed) | 15 min |
| Task 11: Orchestrator (short-circuit + DI) | 15 min |
| Task 12: Hono API route (boundary validation) | 15 min |
| Task 13: Deploy | 10 min |
| Task 14: RapidAPI listing | 20 min |
| **Total** | **~3.5 hours** |
