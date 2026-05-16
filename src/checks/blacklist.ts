import dns from "node:dns"

const DNSBL_ZONES = [
  "bl.spamcop.net",
  "dnsbl-1.uceprotect.net",
  "cbl.abuseat.org",
]

interface DnsA {
  resolve4(hostname: string): Promise<string[]>
}

const defaultResolver: DnsA = dns.promises

function reverseIp(ip: string): string {
  return ip.split(".").reverse().join(".")
}

export async function checkBlacklist(
  ip: string | null,
  resolver: DnsA = defaultResolver
): Promise<boolean> {
  if (!ip) return false

  const reversed = reverseIp(ip)

  const checks = DNSBL_ZONES.map(async (zone) => {
    try {
      const ips = await resolver.resolve4(`${reversed}.${zone}`)
      return ips.some((ip) => ip.startsWith("127."))
    } catch {
      return false
    }
  })

  const results = await Promise.all(checks)
  return results.some(Boolean)
}
