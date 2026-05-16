const RDAP_BASE = "https://rdap.org/domain"
const TIMEOUT_MS = 3000

export async function checkDomainAge(
  domain: string,
  fetcher: typeof fetch = fetch
): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetcher(`${RDAP_BASE}/${domain}`, {
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
