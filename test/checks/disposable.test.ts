import { describe, it, expect } from "vitest"
import { checkDisposable } from "../../src/checks/disposable"

describe("checkDisposable", () => {
  it("detects known disposable domain (mailinator.com)", () => {
    expect(checkDisposable("mailinator.com")).toBe(true)
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
})
