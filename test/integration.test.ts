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
