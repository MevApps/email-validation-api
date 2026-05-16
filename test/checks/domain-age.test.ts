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
