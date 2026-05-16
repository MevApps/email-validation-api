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
