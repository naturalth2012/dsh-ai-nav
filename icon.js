/**
 * Icon lookup policy for the AI 导航 plugin.
 *
 * Everything in this module is pure: given a URL or a chunk of HTML it decides
 * what to fetch next. The network lives in `index.js`, which keeps this half
 * testable without a Host, a socket, or a browser.
 *
 * The three questions answered here:
 *
 * 1. **Where might a site keep its icon?** Most sites still answer `/favicon.ico`
 *    at the origin; the rest moved it, or serve the app's HTML at every path.
 * 2. **Is what came back actually an image?** A 200 with `text/html` is a very
 *    common answer for a missing icon, and caching it would be a bug.
 * 3. **What did the page say about itself?** When no conventional path works, the
 *    page's own `<link rel="icon">` is the only remaining clue.
 *
 * @module @/icon
 */

/**
 * Two-label public suffixes worth knowing; the root-domain fallback needs them.
 *
 * Not a full Public Suffix List — only the endings common enough among the
 * catalogue's own hosts that guessing `co.uk` as a domain would be wrong.
 */
export const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'co.jp', 'co.kr', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'edu.cn',
  'com.hk', 'com.tw', 'com.sg', 'com.au', 'co.nz', 'co.in', 'com.br',
])

/**
 * How much of a page to read while looking for its icon link.
 *
 * 64 KiB was too tight for the app shells that inline their whole bundle above
 * the `<link rel="icon">` tag; 192 KiB still bounds the request to one cheap
 * prefix fetch per host per day while covering those documents.
 */
export const PAGE_HEAD_LIMIT = 192 * 1024

/** A single icon is never worth more than this; anything larger is a mistake. */
export const ICON_LIMIT = 96 * 1024

/** How long a host with no reachable icon is remembered before retrying. */
export const ICON_MISS_TTL = 20 * 60 * 1000

/** How long a downloaded icon is kept. */
export const ICON_HIT_TTL = 24 * 3600 * 1000

/** RFC1918 / loopback / link-local: never fetch these on a user's behalf. */
export function isPrivateHost(hostname) {
  const host = String(hostname || '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
  if (host === '::1' || host === '[::1]') return true
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (!v4) return false
  const [a, b] = [Number(v4[1]), Number(v4[2])]
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

/**
 * The registrable domain of a host, best effort.
 *
 * Only used to widen the icon search: a product at `chat.deepseek.com` usually
 * keeps its icon at `deepseek.com`, and the subdomain itself is often an app
 * shell that answers every path with its own HTML.
 */
export function registrableDomain(hostname) {
  const labels = String(hostname || '').toLowerCase().split('.').filter(Boolean)
  if (labels.length < 3) return ''
  const lastTwo = labels.slice(-2).join('.')
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.length >= 4 ? labels.slice(-3).join('.') : ''
  }
  return lastTwo
}

/**
 * Where to look for a site's icon, most specific first.
 *
 * `/favicon.ico` at the origin is the one address every site has had since 1999,
 * and the two modern targets cover the sites that moved it. The registrable
 * domain is tried last: it is the only candidate left for an app subdomain that
 * answers every path with its own HTML page.
 *
 * @param {string} url
 * @returns {string[]} absolute candidate URLs, in the order worth trying
 */
export function iconCandidates(url) {
  try {
    const parsed = new URL(url)
    const roots = [parsed.origin]
    // A path-based product (https://x.com/app) usually still serves the icon at
    // the origin, but a sub-path deployment may not; try the first segment too.
    const first = parsed.pathname.split('/').filter(Boolean)[0]
    if (first) roots.push(parsed.origin + '/' + first + '/')
    const root = registrableDomain(parsed.host)
    if (root && root !== parsed.host) roots.push(parsed.protocol + '//' + root)
    return roots.flatMap((base) => [
      base + '/favicon.ico',
      base + '/apple-touch-icon.png',
      base + '/favicon.png',
    ])
  } catch {
    return []
  }
}

/**
 * Identify an image by its first bytes.
 *
 * @param {Buffer} buffer
 * @returns {string | null} a usable image mime type, or null when it is not one.
 */
export function sniffImageType(buffer) {
  if (!buffer || buffer.length < 12) return null
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif'
  // ICO and CUR share a header shape; only ICO is worth serving.
  if (buffer[0] === 0x00 && buffer[1] === 0x00 && (buffer[2] === 0x01 || buffer[2] === 0x02) && buffer[3] === 0x00) {
    return 'image/x-icon'
  }
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  // SVG may start with an XML declaration, a comment, or the root element.
  const head = buffer.toString('utf8', 0, Math.min(512, buffer.length)).trimStart()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) {
    return 'image/svg+xml'
  }
  return null
}

/**
 * Read the icon links a page declares in its own `<head>`.
 *
 * This is the difference between a wall of letter tiles and a wall of logos:
 * the app shell at `chat.deepseek.com` has no icon of its own at any fixed path,
 * but its HTML points at the CDN copy. Regex rather than a parser on purpose —
 * the input is one unattributed third-party document, and all this needs is the
 * `href` of any `rel` containing "icon".
 *
 * @param {string} html
 * @param {string} baseUrl
 * @returns {string[]} absolute URLs, most preferred first
 */
export function parseIconLinks(html, baseUrl) {
  const text = String(html || '')
  if (!text) return []
  const found = []
  const linkRe = /<link\b[^>]*>/gi
  let match
  while ((match = linkRe.exec(text)) !== null && found.length < 6) {
    const tag = match[0]
    const rel = /\brel\s*=\s*["']?([^"'>]*)/i.exec(tag)
    if (!rel || !/icon/i.test(rel[1])) continue
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)
    if (!href) continue
    try {
      const absolute = new URL(href[1], baseUrl).toString()
      if (!/^https?:/i.test(absolute)) continue
      if (found.some((entry) => entry.url === absolute)) continue
      found.push({ url: absolute, apple: /apple-touch-icon/i.test(rel[1]) })
    } catch {
      /* a malformed href is simply not a candidate */
    }
  }
  // A 180×180 apple-touch-icon is the most legible at tile size, so it leads.
  // The preference lives in `rel`, not in the URL, so it is decided here and not
  // by inspecting the href afterwards.
  return found
    .sort((a, b) => Number(b.apple) - Number(a.apple))
    .map((entry) => entry.url)
}

/**
 * A tiny TTL cache, keyed by host.
 *
 * Icons change once in a blue moon; a page that opens after a restart should not
 * re-download twenty of them.
 *
 * @param {number} ttlMs
 * @param {number} [capacity]
 */
export function createIconCache(ttlMs, capacity = 400) {
  const entries = new Map()
  return {
    get(host) {
      const hit = entries.get(host)
      if (!hit) return null
      if (Date.now() - hit.at > ttlMs) {
        entries.delete(host)
        return null
      }
      return hit
    },
    set(host, value) {
      if (entries.size > capacity) entries.clear()
      entries.set(host, { ...value, at: Date.now() })
    },
    size() {
      return entries.size
    },
  }
}

/**
 * Resolve one icon at a time per host, and at most `limit` hosts at once.
 *
 * Both limits earn their place. A board of eighty tiles paints immediately, and
 * without single-flight every tile that shares a host, plus every re-render,
 * starts its own four-request walk; without the global cap, eighty near-
 * simultaneous lookups make the slowest ones miss their deadline and turn a
 * perfectly good icon into a letter tile for the next half hour.
 *
 * @param {number} limit
 * @returns {(host: string, compute: () => Promise<unknown>) => Promise<unknown>}
 */
export function createIconResolver(limit) {
  const inflight = new Map()
  let active = 0
  const waiting = []

  const release = () => {
    active -= 1
    const next = waiting.shift()
    if (next) next()
  }

  const acquire = () => new Promise((resolve) => {
    if (active < limit) {
      active += 1
      resolve()
      return
    }
    waiting.push(() => {
      active += 1
      resolve()
    })
  })

  return function resolve(host, compute) {
    const running = inflight.get(host)
    if (running) return running
    const promise = (async () => {
      await acquire()
      try {
        return await compute()
      } finally {
        release()
        inflight.delete(host)
      }
    })()
    inflight.set(host, promise)
    return promise
  }
}
