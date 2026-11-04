/**
 * Query handling for the navigation page: ranking, the "did you mean" fallback,
 * and importing a browser's exported bookmarks.
 *
 * Everything here is pure — no DOM, no network, no clock — so the Host tools and
 * the Client panel agree on results and the self-check can test it offline.
 *
 * The ranking is deliberately simple and explainable. A navigation page is
 * judged by whether the first row is the thing you meant, not by how clever the
 * scoring is; a token that hits the site's own name must never lose to a token
 * that hits three of its tags.
 *
 * @module dsh-ai-nav/search
 */

/** Sites whose names contain any of these are the ones people mean by "AI". */
const STOP_WORDS = new Set([
  'ai', 'aigc', '的', '了', '和', '与', '及', '我', '想', '要', '用', '在', '找', '个', '一个',
  'the', 'a', 'an', 'to', 'for', 'of', 'app', 'tool', 'tools', 'site', 'website', '网站', '工具', '平台', '助手',
])

/** Lowercase, strip punctuation that only exists in display text. */
export function normalize(text) {
  return String(text === null || text === undefined ? '' : text)
    .toLowerCase()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[，。！？、；：""''（）【】《》…—·.,!?;:"'()\[\]<>]/g, ' ')
    .trim()
}

/**
 * Split a query into matching tokens.
 * Single CJK characters are kept — "库" alone is a legitimate thing to type —
 * but single latin letters are dropped as noise.
 */
export function tokenize(query) {
  return normalize(query)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => token.length > 1 || /[\u4e00-\u9fa5]/.test(token))
}

/**
 * Score one entry against the tokens.
 *
 * Bands, from strongest to weakest: exact name, name prefix, name substring,
 * alias, host, tags, category, description. The number is only ever compared
 * against other entries for the same query, so the absolute scale does not
 * matter — the ordering does.
 *
 * @param {object} site a catalogue entry (or a user entry with the same shape)
 * @param {string[]} tokens
 * @returns {number} 0 when nothing matched.
 */
export function scoreSite(site, tokens) {
  if (!site || tokens.length === 0) return 0
  const name = normalize(site.name)
  const aliases = (site.aliases || []).map(normalize)
  const tags = (site.tags || []).map(normalize)
  const host = normalize(site.host || '')
  const desc = normalize(site.desc || '')
  const category = normalize(site.categoryName || '')

  let total = 0
  let hits = 0

  for (const token of tokens) {
    let best = 0
    if (name === token) best = 120
    else if (name.startsWith(token)) best = 80
    else if (name.includes(token)) best = 60
    if (best < 70 && aliases.some((alias) => alias === token)) best = 70
    if (best < 60 && aliases.some((alias) => alias.includes(token))) best = 50
    if (best < 50 && host.includes(token)) best = 45
    if (best < 45 && tags.some((tag) => tag.includes(token))) best = 32
    if (best < 32 && category.includes(token)) best = 26
    if (best < 26 && desc.includes(token)) best = 12
    // A substring hit inside the host is worth less than a real word hit but
    // still means the user typed part of a domain they remember.
    if (best === 0) continue
    total += best
    hits += 1
  }

  if (hits === 0) return 0
  // Every token must land somewhere, or "deepseek 视频" would rank a chat model
  // above the video tool just because "deepseek" scored high.
  if (hits < tokens.length) total = total * 0.45
  if (site.hot) total += 4
  return total
}

/**
 * Rank a directory against a query.
 *
 * @param {string} query
 * @param {object[]} sites
 * @param {{limit?: number, category?: string, region?: string}} [options]
 * @returns {{site: object, score: number}[]}
 */
export function searchDirectory(query, sites, options = {}) {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 30))
  let pool = Array.isArray(sites) ? sites : []
  if (options.category) pool = pool.filter((site) => site.cat === options.category)
  if (options.region) pool = pool.filter((site) => (site.region || 'global') === options.region)

  const scored = []
  for (const site of pool) {
    const score = scoreSite(site, tokens)
    if (score > 0) scored.push({ site, score })
  }
  scored.sort((a, b) => b.score - a.score || (a.site.order || 0) - (b.site.order || 0))
  return scored.slice(0, limit)
}

/** Fill `{q}` in an engine template. */
export function engineUrl(engine, query) {
  const text = String(query === null || query === undefined ? '' : query).trim()
  const template = engine && typeof engine.q === 'string' ? engine.q : ''
  return template.replace('{q}', encodeURIComponent(text))
}

/**
 * Build the URL a bookmark-bar tile opens, given what the user typed and which
 * engine they had selected.
 *
 * The order matters and mirrors how the page reads: a bare domain goes to that
 * domain; a name that matches the directory opens that site; anything else is a
 * web search. The caller can always override the second case by using the
 * "在站内搜" action, which is why this returns the reason too.
 *
 * @param {string} input
 * @param {object[]} sites
 * @param {object} engine
 * @returns {{kind:'site'|'url'|'search', url:string, site?:object, label:string}}
 */
export function resolveOpen(input, sites, engine) {
  const text = String(input === null || input === undefined ? '' : input).trim()
  if (!text) {
    return { kind: 'search', url: 'about:blank', label: '' }
  }

  // 1. A URL, or something that looks like one.
  const asUrl = guessUrl(text)
  if (asUrl) return { kind: 'url', url: asUrl, label: text }

  // 2. Exactly one directory entry — not a fuzzy match, or "kimi 视频" would
  //    silently open Kimi instead of searching for the phrase.
  const matches = searchDirectory(text, sites, { limit: 3 })
  const top = matches[0]
  if (top && top.score >= 60) {
    return { kind: 'site', url: top.site.url, site: top.site, label: top.site.name }
  }

  // 3. Search.
  return { kind: 'search', url: engineUrl(engine, text), label: text }
}

/** Turn "example.com", "https://a.b/c", "localhost:3000" into a URL, else null. */
export function guessUrl(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  if (/^https?:\/\/\S+$/i.test(raw)) return raw
  // localhost and IP:port forms, which people type constantly when testing.
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/\S*)?$/i.test(raw)) return 'http://' + raw
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/\S*)?$/.test(raw)) return 'http://' + raw
  // A domain needs a dotted TLD and no spaces; this deliberately refuses
  // "deepseek com" and "1.5" so a search is not stolen by a bad guess.
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(raw)
    && /\.(com|cn|net|org|io|ai|dev|app|co|me|xyz|info|top|cc|tv|so|site|online|edu|gov)(:\d+)?(\/|$)/i.test(raw)) {
    return 'https://' + raw
  }
  return null
}

/**
 * Rough category for an imported bookmark.
 *
 * Import is the one place where the page guesses, because a bookmarks file has
 * no categories of its own. The list only covers hosts we actually know; the
 * default is `null`, which the panel shows as "未分类" and lets the user fix.
 *
 * @param {string} url
 * @param {string} title
 * @param {object[]} sites
 * @returns {{cat: string|null, desc: string, tags: string[]}}
 */
export function inferCategory(url, title, sites) {
  let host = ''
  try {
    host = new URL(url).host.replace(/^www\./, '')
  } catch {
    return { cat: null, desc: '', tags: [] }
  }
  const known = (sites || []).find((site) =>
    site.host === host || site.host === 'www.' + host || host.endsWith('.' + site.host))
  if (known) return { cat: known.cat, desc: known.desc, tags: known.tags.slice(0, 2) }

  const table = [
    [/(^|\.)(openai\.com|anthropic\.com|google\.com|microsoft\.com|meta\.ai|mistral\.ai)$/, 'chat'],
    [/(^|\.)(github\.com|gitlab\.com|stackoverflow\.com|npmjs\.com)$/, 'dev'],
    [/(^|\.)(arxiv\.org|nature\.com|science\.org|ieee\.org|acm\.org|springer\.com)$/, 'learn'],
    [/(^|\.)(notion\.so|yuque\.com|feishu\.cn|confluence\..+|wiki\..+)$/, 'kb'],
    [/(^|\.)(behance\.net|dribbble\.com|artstation\.com)$/, 'hub'],
  ]
  for (const [pattern, cat] of table) {
    if (pattern.test(host)) return { cat, desc: '', tags: [] }
  }
  return { cat: null, desc: String(title || '').slice(0, 60), tags: [] }
}

/**
 * Parse a Netscape bookmark file — what Chrome, Edge, Firefox and Safari export.
 *
 * The format is old, quirky and not XML: `<DT>` elements are rarely closed, and
 * folder titles live in `<H3>` while their children follow in a `<DL>`. A real
 * DOM parser is not available on both sides of this plugin, so this walks the
 * tags by hand, which also makes it tolerant of the truncated files people
 * paste into a text box.
 *
 * @param {string} html
 * @returns {{title:string, url:string, folder:string, addedAt:number|null}[]}
 */
export function parseBookmarks(html) {
  const text = String(html || '')
  const out = []
  const folderStack = []
  const tagRe = /<(\/?)(dl|h3|a)\b([^>]*)>/gi
  let match
  let pendingTitle = ''
  while ((match = tagRe.exec(text)) !== null) {
    const closing = match[1] === '/'
    const tag = match[2].toLowerCase()
    const attrs = match[3] || ''

    if (tag === 'dl') {
      if (!closing) folderStack.push('')
      else if (folderStack.length > 1) folderStack.pop()
      continue
    }

    if (tag === 'h3') {
      if (closing) continue
      // The folder name is the text up to the next tag.
      const rest = text.slice(tagRe.lastIndex)
      const end = rest.search(/<\/h3>/i)
      pendingTitle = cleanText(end >= 0 ? rest.slice(0, end) : rest.slice(0, 120))
      if (folderStack.length > 0) folderStack[folderStack.length - 1] = pendingTitle
      continue
    }

    if (tag === 'a') {
      if (closing) continue
      const href = /href\s*=\s*"([^"]*)"/i.exec(attrs) || /href\s*=\s*'([^']*)'/i.exec(attrs)
      if (!href) continue
      const rest = text.slice(tagRe.lastIndex)
      const end = rest.search(/<\/a>/i)
      const label = cleanText(end >= 0 ? rest.slice(0, end) : '')
      const addDate = /add_date\s*=\s*"(\d+)"/i.exec(attrs)
      const url = decodeEntities(href[1])
      if (!/^https?:\/\//i.test(url)) continue
      out.push({
        title: label || url,
        url,
        folder: folderStack.filter(Boolean).join(' / '),
        addedAt: addDate ? Number(addDate[1]) * 1000 : null,
      })
      if (out.length >= 500) break
    }
  }
  return out
}

function cleanText(value) {
  return decodeEntities(String(value || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}
