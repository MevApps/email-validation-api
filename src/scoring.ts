import type { EmailFacts, EmailAssessment } from "./types"

export function calculateScore(
  facts: EmailFacts
): Pick<EmailAssessment, "score" | "verdict"> {
  if (!facts.syntax_valid) return { score: 0, verdict: "invalid" }
  if (facts.disposable) return { score: 0, verdict: "invalid" }

  let score = 100

  if (!facts.mx_found) score -= 80
  if (facts.blacklisted) score -= 50
  if (facts.role_based) score -= 15
  if (facts.free_provider) score -= 5

  if (facts.domain_age_days !== null) {
    if (facts.domain_age_days < 7) score -= 40
    else if (facts.domain_age_days < 30) score -= 25
    else if (facts.domain_age_days < 90) score -= 10
  }

  score = Math.max(0, Math.min(100, score))

  const verdict: EmailAssessment["verdict"] =
    score >= 80 ? "valid" : score >= 30 ? "risky" : "invalid"

  return { score, verdict }
}
