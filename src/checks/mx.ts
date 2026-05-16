import dns from "node:dns"
import type { MxResult, DnsResolver } from "../types"

const defaultResolver: DnsResolver = dns.promises

export async function checkMx(
  domain: string,
  resolver: DnsResolver = defaultResolver
): Promise<MxResult> {
  try {
    const records = await resolver.resolveMx(domain)
    return {
      found: records.length > 0,
      records: records.map((r) => ({
        exchange: r.exchange.toLowerCase().replace(/\.$/, ""),
        priority: r.priority,
      })),
    }
  } catch {
    return { found: false, records: [] }
  }
}

export async function resolveMxIp(
  exchange: string,
  resolver: DnsResolver = defaultResolver
): Promise<string | null> {
  try {
    const ips = await resolver.resolve4(exchange)
    return ips[0] ?? null
  } catch {
    return null
  }
}
