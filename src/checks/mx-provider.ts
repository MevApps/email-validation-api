import mxPatterns from "../../data/mx-patterns.json"

export function identifyMxProvider(exchange: string): string | null {
  const host = exchange.toLowerCase().replace(/\.$/, "")
  for (const [provider, suffixes] of Object.entries(mxPatterns)) {
    for (const suffix of suffixes) {
      if (host.endsWith(suffix)) return provider
    }
  }
  return null
}
