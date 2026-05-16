import dns from "node:dns"
import type { ValidationResult, EmailFacts, DnsResolver } from "./types"
import { checkSyntax } from "./checks/syntax"
import { checkMx, resolveMxIp } from "./checks/mx"
import { identifyMxProvider } from "./checks/mx-provider"
import { checkDisposable } from "./checks/disposable"
import { suggestTypo } from "./checks/typo"
import { checkDomainAge } from "./checks/domain-age"
import { checkBlacklist } from "./checks/blacklist"
import { calculateScore } from "./scoring"
import rolePrefixes from "../data/role-prefixes.json"
import freeProviders from "../data/free-providers.json"

const ROLE_SET = new Set(rolePrefixes)
const FREE_SET = new Set(freeProviders)

export async function validateEmail(
  raw: string,
  resolver: DnsResolver = dns.promises,
  fetcher: typeof fetch = fetch
): Promise<ValidationResult> {
  const syntax = checkSyntax(raw)
  const email = syntax.valid ? `${syntax.local}@${syntax.domain}` : raw.trim().toLowerCase()

  if (!syntax.valid) {
    const facts: EmailFacts = {
      syntax_valid: false, mx_found: false, mx_provider: null,
      disposable: false, role_based: false, free_provider: false,
      domain_age_days: null, blacklisted: false,
    }
    const { score, verdict } = calculateScore(facts)
    return { email, assessment: { score, verdict, suggestion: null }, facts }
  }

  const { local, domain } = syntax
  const typoSuggestion = suggestTypo(domain)
  const suggestion = typoSuggestion ? `${local}@${typoSuggestion}` : null
  const roleBased = ROLE_SET.has(local)
  const freeProvider = FREE_SET.has(domain)
  const disposable = checkDisposable(domain)

  if (disposable) {
    const facts: EmailFacts = {
      syntax_valid: true, mx_found: false, mx_provider: null,
      disposable: true, role_based: roleBased, free_provider: freeProvider,
      domain_age_days: null, blacklisted: false,
    }
    const { score, verdict } = calculateScore(facts)
    return { email, assessment: { score, verdict, suggestion }, facts }
  }

  const [mxResult, domainAgeDays] = await Promise.all([
    checkMx(domain, resolver),
    checkDomainAge(domain, fetcher),
  ])

  let mxProvider: string | null = null
  let blacklisted = false

  if (mxResult.found && mxResult.records.length > 0) {
    const primaryMx = mxResult.records.sort((a, b) => a.priority - b.priority)[0]
    mxProvider = identifyMxProvider(primaryMx.exchange)
    const mxIp = await resolveMxIp(primaryMx.exchange, resolver)
    blacklisted = await checkBlacklist(mxIp, resolver)
  }

  const facts: EmailFacts = {
    syntax_valid: true, mx_found: mxResult.found, mx_provider: mxProvider,
    disposable: false, role_based: roleBased, free_provider: freeProvider,
    domain_age_days: domainAgeDays, blacklisted,
  }

  const { score, verdict } = calculateScore(facts)
  return { email, assessment: { score, verdict, suggestion }, facts }
}
