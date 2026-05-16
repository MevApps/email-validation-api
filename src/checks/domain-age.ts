const TIMEOUT_MS = 5000

const RDAP_SERVERS: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain",
  net: "https://rdap.verisign.com/net/v1/domain",
  org: "https://rdap.org/domain",
  io: "https://rdap.nic.io/domain",
  dev: "https://rdap.nic.google/domain",
  app: "https://rdap.nic.google/domain",
  me: "https://rdap.nic.me/domain",
}

function getRdapUrl(domain: string): string | null {
  const tld = domain.split(".").pop()?.toLowerCase()
  if (!tld) return null
  const server = RDAP_SERVERS[tld]
  if (!server) return null
  return `${server}/${domain}`
}

export async function checkDomainAge(
  domain: string,
  fetcher: typeof fetch = fetch
): Promise<number | null> {
  const url = getRdapUrl(domain)
  if (!url) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetcher(url, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) return null

    const data = await response.json() as {
      events?: Array<{ eventAction: string; eventDate: string }>
    }

    const registration = data.events?.find(
      (e) => e.eventAction === "registration"
    )
    if (!registration) return null

    const created = new Date(registration.eventDate).getTime()
    const now = Date.now()
    return Math.floor((now - created) / (1000 * 60 * 60 * 24))
  } catch {
    return null
  }
}
