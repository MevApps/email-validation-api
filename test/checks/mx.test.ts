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
