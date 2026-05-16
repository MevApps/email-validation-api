import { describe, it, expect } from "vitest"
import { calculateScore } from "../src/scoring"
import type { EmailFacts } from "../src/types"

function makeFacts(overrides: Partial<EmailFacts> = {}): EmailFacts {
  return {
    syntax_valid: true, mx_found: true, mx_provider: "Google Workspace",
    disposable: false, role_based: false, free_provider: false,
    domain_age_days: 5000, blacklisted: false, ...overrides,
  }
}

describe("calculateScore", () => {
  it("returns 100 and 'valid' for perfect email", () => {
    const r = calculateScore(makeFacts())
    expect(r.score).toBe(100); expect(r.verdict).toBe("valid")
  })
  it("returns 0 and 'invalid' for bad syntax", () => {
    const r = calculateScore(makeFacts({ syntax_valid: false }))
    expect(r.score).toBe(0); expect(r.verdict).toBe("invalid")
  })
  it("returns 0 and 'invalid' for disposable domain", () => {
    const r = calculateScore(makeFacts({ disposable: true }))
    expect(r.score).toBe(0); expect(r.verdict).toBe("invalid")
  })
  it("heavily penalizes missing MX", () => {
    const r = calculateScore(makeFacts({ mx_found: false, mx_provider: null }))
    expect(r.score).toBeLessThan(30); expect(r.verdict).toBe("invalid")
  })
  it("penalizes blacklisted domain", () => {
    const r = calculateScore(makeFacts({ blacklisted: true }))
    expect(r.score).toBeLessThan(60); expect(r.verdict).toBe("risky")
  })
  it("slightly penalizes role-based address", () => {
    const r = calculateScore(makeFacts({ role_based: true }))
    expect(r.score).toBeGreaterThan(60); expect(r.score).toBeLessThan(100)
  })
  it("slightly penalizes free provider", () => {
    const r = calculateScore(makeFacts({ free_provider: true }))
    expect(r.score).toBeGreaterThan(70); expect(r.score).toBeLessThan(100)
  })
  it("penalizes very new domain (< 30 days)", () => {
    const r = calculateScore(makeFacts({ domain_age_days: 5 }))
    expect(r.score).toBeLessThan(80)
  })
  it("does not penalize null domain age (RDAP unavailable)", () => {
    const r = calculateScore(makeFacts({ domain_age_days: null }))
    expect(r.score).toBeGreaterThan(80)
  })
  it("verdict is 'risky' for score between 30-79", () => {
    const r = calculateScore(makeFacts({ blacklisted: true }))
    expect(r.verdict).toBe("risky")
  })
})
