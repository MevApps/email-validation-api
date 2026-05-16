import domains from "../../data/disposable-domains.json"

const DISPOSABLE_SET: Set<string> = new Set(domains)

export function checkDisposable(domain: string): boolean {
  return DISPOSABLE_SET.has(domain)
}
