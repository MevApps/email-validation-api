import type { SyntaxResult } from "../types"

const INVALID: SyntaxResult = { valid: false, local: "", domain: "" }

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export function checkSyntax(raw: string): SyntaxResult {
  const email = raw.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return INVALID

  const atIndex = email.indexOf("@")
  const local = email.slice(0, atIndex)
  const domain = email.slice(atIndex + 1)

  if (local.length > 64) return INVALID
  if (!domain.includes(".")) return INVALID

  return { valid: true, local, domain }
}
