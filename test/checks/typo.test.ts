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
