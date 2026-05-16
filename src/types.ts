export interface SyntaxResult {
  valid: boolean
  local: string
  domain: string
}

export interface MxRecord {
  exchange: string
  priority: number
}

export interface MxResult {
  found: boolean
  records: MxRecord[]
}

export interface EmailFacts {
  syntax_valid: boolean
  mx_found: boolean
  mx_provider: string | null
  disposable: boolean
  role_based: boolean
  free_provider: boolean
  domain_age_days: number | null
  blacklisted: boolean
}

export interface EmailAssessment {
  score: number
  verdict: "valid" | "risky" | "invalid"
  suggestion: string | null
}

export interface ValidationResult {
  email: string
  assessment: EmailAssessment
  facts: EmailFacts
}

export interface DnsResolver {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>
  resolve4(hostname: string): Promise<string[]>
}
