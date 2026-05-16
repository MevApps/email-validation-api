import { describe, it, expect } from "vitest"
import { checkSyntax } from "../../src/checks/syntax"

describe("checkSyntax", () => {
  it("accepts valid email", () => {
    expect(checkSyntax("user@example.com")).toEqual({ valid: true, local: "user", domain: "example.com" })
  })
  it("accepts email with dots in local part", () => {
    expect(checkSyntax("first.last@example.com")).toEqual({ valid: true, local: "first.last", domain: "example.com" })
  })
  it("accepts email with plus tag", () => {
    expect(checkSyntax("user+tag@example.com")).toEqual({ valid: true, local: "user+tag", domain: "example.com" })
  })
  it("rejects empty string", () => {
    expect(checkSyntax("")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects missing @", () => {
    expect(checkSyntax("userexample.com")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects multiple @", () => {
    expect(checkSyntax("user@@example.com")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects missing local part", () => {
    expect(checkSyntax("@example.com")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects missing domain", () => {
    expect(checkSyntax("user@")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects domain without TLD", () => {
    expect(checkSyntax("user@localhost")).toEqual({ valid: false, local: "", domain: "" })
  })
  it("rejects local part over 64 chars", () => {
    const long = "a".repeat(65)
    expect(checkSyntax(`${long}@example.com`)).toEqual({ valid: false, local: "", domain: "" })
  })
  it("trims and lowercases input", () => {
    expect(checkSyntax("  User@Example.COM  ")).toEqual({ valid: true, local: "user", domain: "example.com" })
  })
})
