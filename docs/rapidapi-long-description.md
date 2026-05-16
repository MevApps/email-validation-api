Email Validation Pro delivers **10 validation signals** in a single API call.

Built for developers who need reliable email verification without enterprise pricing or complexity. One endpoint. One query parameter. Structured JSON response. Start validating in under 60 seconds.

---

## How It Works

Submit any email address and receive a comprehensive validation report split into two sections:

- **Assessment** — A computed deliverability score, a human-readable verdict, and an automatic typo suggestion when a misspelling is detected.
- **Facts** — Eight independent signals you can consume directly, enabling you to apply your own business rules without depending on our scoring logic.

This separation gives you full control: use our score for quick decisions, or build custom validation pipelines using the raw signals.

---

## Assessment Fields

| Field | Type | Description |
|:------|:-----|:------------|
| `score` | `integer` | Deliverability score ranging from 0 (invalid) to 100 (verified) |
| `verdict` | `string` | One of `valid`, `risky`, or `invalid` |
| `suggestion` | `string` or `null` | Suggested correction when a domain typo is detected |

**Scoring Breakdown**

| Signal | Impact |
|:-------|:-------|
| Invalid syntax | Score set to 0 |
| Disposable domain | Score set to 0 |
| No MX records found | −80 points |
| Blacklisted mail server | −50 points |
| Role-based address | −15 points |
| Free email provider | −5 points |
| Domain registered < 7 days | −40 points |
| Domain registered < 30 days | −25 points |
| Domain registered < 90 days | −10 points |

**Verdict Thresholds:** Score ≥ 80 → `valid` · Score 30–79 → `risky` · Score < 30 → `invalid`

---

## Facts Fields

| Field | Type | Description |
|:------|:-----|:------------|
| `syntax_valid` | `boolean` | Conforms to RFC 5321 email syntax rules |
| `mx_found` | `boolean` | Domain has at least one valid MX record |
| `mx_provider` | `string` or `null` | Identified mail provider (Google Workspace, Microsoft 365, Yahoo, Zoho, ProtonMail, iCloud, Yandex, Mail.ru) |
| `disposable` | `boolean` | Domain matched against a curated list of 72,000+ known disposable email providers |
| `role_based` | `boolean` | Local part is a role-based prefix such as `admin`, `info`, `support`, `noreply`, or `postmaster` |
| `free_provider` | `boolean` | Domain belongs to a free email service (Gmail, Yahoo, Outlook, ProtonMail, and 23 others) |
| `domain_age_days` | `integer` or `null` | Number of days since domain registration, retrieved via RDAP. Returns `null` when RDAP data is unavailable. |
| `blacklisted` | `boolean` | Domain's mail server IP appears on one or more DNS-based blacklists |

---

## Example Request

```
GET /validate?email=test@gmial.com
```

## Example Response

```json
{
  "email": "test@gmial.com",
  "assessment": {
    "score": 0,
    "verdict": "invalid",
    "suggestion": "test@gmail.com"
  },
  "facts": {
    "syntax_valid": true,
    "mx_found": false,
    "mx_provider": null,
    "disposable": true,
    "role_based": false,
    "free_provider": false,
    "domain_age_days": null,
    "blacklisted": false
  }
}
```

---

## Common Use Cases

**Signup and Registration Forms**
Validate emails at the point of entry. Block disposable addresses, catch typos before they reach your database, and reduce failed verification emails.

**Lead List Cleaning**
Score and segment imported email lists before syncing to your CRM. Identify low-quality leads (disposable, role-based) and prioritize high-scoring addresses for outreach.

**Fraud Detection**
Flag accounts using newly registered domains, disposable providers, or role-based addresses. Combine the deliverability score with your own risk models.

**Email Campaign Optimization**
Clean your mailing lists before sending. Remove invalid and risky addresses to improve deliverability rates, reduce bounces, and protect your sender reputation.

**SaaS User Quality**
Distinguish between real users and throwaway signups. Use the free provider and disposable flags to segment users by intent and engagement potential.

---

## Technical Specifications

| Specification | Detail |
|:--------------|:-------|
| Protocol | HTTPS (TLS 1.2+) |
| Method | `GET` |
| Endpoint | `/validate` |
| Parameter | `email` (required, string, max 254 characters) |
| Response Format | `application/json` |
| Average Latency | < 500ms |
| Infrastructure | Cloudflare Workers (300+ global edge locations) |
| Disposable Database | 72,000+ domains, updated regularly |
| Role-Based Prefixes | 39 standard prefixes |
| Free Providers | 27 recognized providers |
| MX Providers | 8 identified providers |
| Uptime | 99.9%+ (Cloudflare infrastructure) |

---

## Plans

| Plan | Price | Requests per Month | Rate Limit |
|:-----|:------|:-------------------|:-----------|
| Basic | Free | 100 | 10 per minute |
| Pro | $5 | 5,000 | 60 per minute |
| Ultra | $15 | 25,000 | 120 per minute |
| Mega | $35 | 100,000 | 300 per minute |

No credit card required for the free tier. Upgrade or downgrade at any time.
