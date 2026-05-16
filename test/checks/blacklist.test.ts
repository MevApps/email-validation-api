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
