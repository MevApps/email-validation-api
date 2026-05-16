const DOMAINS_URL = "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.json"

async function fetchDisposableDomains(): Promise<void> {
  const response = await fetch(DOMAINS_URL)
  if (!response.ok) {
    console.error(`Failed to fetch disposable domains: ${response.status}`)
    process.exit(1)
  }

  const domains: string[] = await response.json()
  const sorted = [...new Set(domains)].sort()
  const outPath = new globalThis.URL("../data/disposable-domains.json", import.meta.url)
  const { writeFileSync } = await import("node:fs")
  writeFileSync(outPath, JSON.stringify(sorted, null, 0))
  console.log(`Wrote ${sorted.length} disposable domains`)
}

fetchDisposableDomains()
