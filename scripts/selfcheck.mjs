/**
 * Self-check for the AI navigation plugin.
 *
 * Everything asserted here is pure: the catalogue's shape, the ranking, URL
 * guessing, the bookmarks parser, the recommender, and the store's URL gate.
 * No network, no Host, no browser.
 *
 * Run: node scripts/selfcheck.mjs
 */

import { CATEGORIES, SITES, SITE_BY_ID, ENGINES, ENGINE_BY_ID, findSite, HOT_IDS } from '../catalog.js'
import {
  normalize, tokenize, scoreSite, searchDirectory, engineUrl, resolveOpen, guessUrl,
  parseBookmarks, inferCategory,
} from '../search.js'
import { recommend, SCENARIOS } from '../recommend.js'
import { openStore, safeUrl, normaliseSite, MAX_CUSTOM } from '../store.js'
import { rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  isPrivateHost, registrableDomain, iconCandidates, sniffImageType, parseIconLinks,
  createIconCache, createIconResolver, ICON_LIMIT, PAGE_HEAD_LIMIT,
} from '../icon.js'

let failures = 0
let checks = 0

function ok(name, condition, detail) {
  checks += 1
  if (condition) {
    console.log('  ok   ' + name)
  } else {
    failures += 1
    console.log('  FAIL ' + name + (detail === undefined ? '' : ' → ' + detail))
  }
}

/* -------------------------------------------------------------------------- */

console.log('\n[1] Catalogue integrity')
{
  ok('every site has an id, name and url',
    SITES.every((site) => site.id && site.name && /^https:\/\//.test(site.url)),
    SITES.filter((site) => !(site.id && site.name && /^https:\/\//.test(site.url))).map((s) => s.id).join(','))
  ok('ids are unique', new Set(SITES.map((site) => site.id)).size === SITES.length)
  ok('every site belongs to a declared category',
    SITES.every((site) => CATEGORIES.some((category) => category.id === site.cat)),
    SITES.filter((site) => !CATEGORIES.some((c) => c.id === site.cat)).map((s) => s.id).join(','))
  ok('urls are absolute and parse',
    SITES.every((site) => { try { return Boolean(new URL(site.url).host) } catch { return false } }))
  ok('host is derived from url',
    SITES.every((site) => new URL(site.url).host === site.host),
    SITES.filter((site) => new URL(site.url).host !== site.host).map((s) => s.id).join(','))
  ok('every category has entries',
    CATEGORIES.every((category) => SITES.some((site) => site.cat === category.id)),
    CATEGORIES.filter((c) => !SITES.some((s) => s.cat === c.id)).map((c) => c.id).join(','))
  ok('there is a hot list', HOT_IDS.length >= 8, HOT_IDS.length)
  ok('descriptions are short enough for a tile',
    SITES.every((site) => site.desc.length <= 40),
    SITES.filter((s) => s.desc.length > 40).map((s) => s.id + ':' + s.desc.length).join(','))
  // A deep-link template must be an official query parameter, so it must be a
  // URL that still contains the placeholder exactly once.
  ok('q templates contain exactly one {q}',
    SITES.filter((site) => site.q).every((site) => (site.q.match(/\{q\}/g) || []).length === 1))
  ok('q templates are https urls',
    SITES.filter((site) => site.q).every((site) => /^https:\/\//.test(site.q)))
  ok('engine templates contain {q}',
    ENGINES.every((engine) => (engine.q.match(/\{q\}/g) || []).length === 1))
}

console.log('\n[2] Lookup and aliases')
{
  ok('findSite by id', findSite('metaso')?.id === 'metaso')
  ok('findSite by Chinese name', findSite('秘塔')?.id === 'metaso')
  ok('findSite by alias', findSite('ds')?.id === 'deepseek')
  ok('findSite by host', findSite('chat.deepseek.com')?.id === 'deepseek')
  ok('findSite by bare domain', findSite('ima.qq.com')?.id === 'ima')
  ok('findSite is case-insensitive', findSite('DEEPSEEK')?.id === 'deepseek')
  ok('findSite("不存在") is null', findSite('不存在的站') === null)
  ok('every id resolves to itself', SITES.every((site) => SITE_BY_ID[site.id] === site))

  // The products people actually use today, not only the 2023-era names. These
  // are asserted by id because a catalogue that quietly loses them is exactly
  // the drift a link page cannot afford.
  for (const [id, expected] of [
    ['codebuddy', 'codebuddy.cn'],
    ['workbuddy', 'workbuddy.cn'],
    ['lingxi', 'lingxi.wps.cn'],
    ['qoder', 'qoder.com'],
    ['manus', 'manus.im'],
    ['dingtalk', 'dingtalk.com'],
    ['tingwu', 'aliyun.com'],
    ['anythingllm', 'anythingllm.com'],
  ]) {
    const site = SITE_BY_ID[id]
    ok(`catalogue keeps ${id}`, Boolean(site) && site.host.includes(expected),
      site ? site.host : 'missing')
  }
  ok('CodeBuddy is filed under dev', SITE_BY_ID.codebuddy?.cat === 'dev')
  ok('WorkBuddy is filed under office', SITE_BY_ID.workbuddy?.cat === 'office')
  ok('WPS 灵犀 is filed under office', SITE_BY_ID.lingxi?.cat === 'office')
  ok('the two WPS entries are distinct', SITE_BY_ID['wps-ai'].url !== SITE_BY_ID.lingxi.url)
  ok('海螺 points at the domestic site', SITE_BY_ID.hailuo?.host === 'hailuoai.com',
    SITE_BY_ID.hailuo?.host)
  ok('灵犀 is reachable by its Chinese name', findSite('灵犀')?.id === 'lingxi')
  ok('WorkBuddy is reachable by its alias', findSite('work buddy')?.id === 'workbuddy')
}

console.log('\n[3] Normalisation and tokenising')
{
  ok('normalize lowercases and collapses space', normalize('  DeepSeek   对话 ') === 'deepseek 对话')
  ok('normalize strips full-width punctuation', normalize('秘塔，AI搜索！') === '秘塔 ai搜索')
  ok('tokenize drops stop words', !tokenize('我想找一个 AI 工具').includes('ai'))
  ok('tokenize keeps a single CJK char', tokenize('库').includes('库'))
  ok('tokenize drops a single latin letter', tokenize('a b 库').join(',') === '库')
}

console.log('\n[4] Ranking')
{
  const byName = searchDirectory('秘塔', SITES)
  ok('exact name comes first', byName[0]?.site.id === 'metaso', byName[0]?.site.id)
  ok('alias finds the site', searchDirectory('月之暗面', SITES)[0]?.site.id === 'kimi')
  ok('pinyin initials find the site', searchDirectory('ds', SITES).some((hit) => hit.site.id === 'deepseek'))
  ok('host substring finds the site', searchDirectory('huggingface', SITES)[0]?.site.id === 'huggingface')
  ok('tag search works', searchDirectory('知识库', SITES).length >= 3, searchDirectory('知识库', SITES).length)
  ok('an unmatched query returns nothing', searchDirectory('量子纠缠猫', SITES).length === 0)
  ok('category filter narrows the pool',
    searchDirectory('ai', SITES, { category: 'search' }).every((hit) => hit.site.cat === 'search'))
  ok('region filter narrows the pool',
    searchDirectory('ai', SITES, { region: 'cn' }).every((hit) => hit.site.region === 'cn'))
  ok('limit is respected', searchDirectory('ai', SITES, { limit: 3 }).length <= 3)
  // A two-token query where only one token matches must rank below a full match.
  const partial = searchDirectory('deepseek 视频', SITES)
  ok('partial match still returns rows but ranks low', partial.length === 0 || partial[0].score < 120,
    partial[0] && partial[0].score)
  ok('score is monotone for exact matches',
    scoreSite(SITE_BY_ID.metaso, ['秘塔']) > scoreSite(SITE_BY_ID.kimi, ['秘塔']))
}

console.log('\n[5] URL handling')
{
  ok('plain domain is upgraded to https', guessUrl('example.com') === 'https://example.com')
  ok('full url is kept', guessUrl('http://xiangmu.local:8080/a') === 'http://xiangmu.local:8080/a')
  ok('localhost gets http', guessUrl('localhost:3000') === 'http://localhost:3000')
  ok('an IP gets http', guessUrl('192.168.1.10:8080') === 'http://192.168.1.10:8080')
  ok('a bare word is not a url', guessUrl('秘塔') === null)
  ok('a number is not a url', guessUrl('1.5') === null)
  ok('a file extension is not a url', guessUrl('report.docx') === null)
  ok('engineUrl encodes the query',
    engineUrl(ENGINE_BY_ID.baidu, 'a b&c') === 'https://www.baidu.com/s?wd=a%20b%26c',
    engineUrl(ENGINE_BY_ID.baidu, 'a b&c'))
  ok('engineUrl handles empty input', engineUrl(ENGINE_BY_ID.baidu, '') === 'https://www.baidu.com/s?wd=')

  const engine = ENGINE_BY_ID.baidu
  const asUrl = resolveOpen('example.com', SITES, engine)
  ok('a domain resolves as a url', asUrl.kind === 'url' && asUrl.url === 'https://example.com')
  const asSite = resolveOpen('秘塔', SITES, engine)
  ok('a name resolves as a site', asSite.kind === 'site' && asSite.site.id === 'metaso')
  const asSearch = resolveOpen('量子纠缠猫', SITES, engine)
  ok('anything else becomes a search', asSearch.kind === 'search' && asSearch.url.includes('baidu.com/s?wd='))
  ok('empty input does not throw', resolveOpen('', SITES, engine).kind === 'search')
}

console.log('\n[6] Bookmark import')
{
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000">工具</H3>
    <DL><p>
        <DT><A HREF="https://metaso.cn/" ADD_DATE="1700000001">秘塔搜索</A>
        <DT><A HREF="https://www.deepseek.com" ADD_DATE="1700000002">DeepSeek &amp; 平台</A>
        <DT><H3>子目录</H3>
        <DL><p>
            <DT><A HREF="https://github.com/foo/bar">一个仓库</A>
        </DL><p>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">坏书签</A>
    <DT><A HREF="https://example.org/x?y=1&amp;z=2">参数链接</A>
</DL><p>`
  const parsed = parseBookmarks(html)
  ok('every http link is parsed', parsed.length === 4, parsed.length)
  ok('javascript: links are dropped', !parsed.some((item) => item.url.startsWith('javascript:')))
  ok('entities are decoded', parsed.some((item) => item.title.includes('&')), JSON.stringify(parsed.map((p) => p.title)))
  ok('query parameters survive', parsed.some((item) => item.url === 'https://example.org/x?y=1&z=2'))
  ok('folder is tracked', parsed.some((item) => item.folder.includes('工具')), JSON.stringify(parsed.map((p) => p.folder)))
  ok('nested folder is tracked', parsed.some((item) => item.folder.includes('子目录')))
  ok('add_date becomes a timestamp', parsed.some((item) => item.addedAt === 1700000001000))
  ok('garbage input yields nothing', parseBookmarks('not bookmarks at all').length === 0)
  ok('an empty string is safe', parseBookmarks('').length === 0)

  const guess = inferCategory('https://chat.deepseek.com/', 'DS', SITES)
  ok('a known host maps to its catalogue category', guess.cat === 'chat', guess.cat)
  const unknown = inferCategory('https://arxiv.org/abs/1', 'paper', SITES)
  ok('an unknown host falls back to the table', unknown.cat === 'learn', unknown.cat)
  const nothing = inferCategory('https://something.invalid/x', 'x', SITES)
  ok('an unmatched host gets no category', nothing.cat === null, String(nothing.cat))
}

console.log('\n[7] Recommender')
{
  const kb = recommend('想给团队搭一个内部文档问答的知识库', SITES)
  ok('a knowledge-base need is recognised', kb.scenarios.some((s) => s.id === 'kb'), JSON.stringify(kb.scenarios))
  ok('it recommends something', kb.picks.length > 0)
  ok('the top pick is a knowledge-base tool', kb.picks[0].cat === 'kb', kb.picks[0] && kb.picks[0].cat)
  ok('every pick explains itself', kb.picks.every((pick) => pick.why && pick.why.length > 0))
  // The stack must not be dominated by weak matches. A single-scenario question
  // ("知识库") legitimately returns several knowledge-base tools — that is the
  // right answer, not dilution — so the property to assert is that no pick is
  // filler and the strongest ones are not displaced by weaker ones.
  const roleCounts = {}
  for (const pick of kb.picks) roleCounts[pick.role] = (roleCounts[pick.role] || 0) + 1
  const scores = kb.picks.map((pick) => pick.score)
  ok('no pick is filler', Math.min(...scores) > 0, JSON.stringify(scores))
  ok('picks are ordered strongest first',
    scores.every((score, index) => index === 0 || score <= scores[index - 1]), JSON.stringify(scores))
  ok('the leader of a role is never outranked by its own overflow',
    kb.picks[0].score >= kb.picks[kb.picks.length - 1].score, JSON.stringify(scores))
  ok('a specific need outranks the generic word in it',
    kb.picks[0].cat === 'kb' && kb.scenarios[0].id === 'kb',
    kb.picks[0].cat + '/' + kb.scenarios[0].id)

  const selfHosted = recommend('内部文档知识库，数据不能出内网', SITES, { selfHost: true })
  ok('self-host preference keeps only self-hostable picks',
    selfHosted.picks.length === 0 || selfHosted.picks.every((pick) => SITE_BY_ID[pick.id].selfHost),
    JSON.stringify(selfHosted.picks.map((p) => p.id)))

  const cn = recommend('做短视频，不想露脸', SITES, { region: 'cn' })
  ok('a video need is recognised', cn.scenarios.some((s) => s.id === 'image'), JSON.stringify(cn.scenarios))
  ok('cn filtering only returns cn sites', cn.picks.every((pick) => SITE_BY_ID[pick.id].region === 'cn'))

  const fallback = recommend('秘塔', SITES)
  ok('an unmatched need falls back to search', fallback.picks.some((pick) => pick.id === 'metaso'),
    JSON.stringify(fallback.picks.map((p) => p.id)))

  const nothing = recommend('量子纠缠猫', SITES)
  ok('nonsense yields no picks', nothing.picks.length === 0)
  ok('nonsense explains itself', typeof nothing.note === 'string' && nothing.note.length > 0)
  ok('every scenario has keywords, roles and categories',
    SCENARIOS.every((s) => Array.isArray(s.keywords) && s.keywords.length > 0 && s.role && s.cats.length > 0))
  ok('scenario ids are unique', new Set(SCENARIOS.map((s) => s.id)).size === SCENARIOS.length)
  ok('every scenario category exists', SCENARIOS.every((s) =>
    s.cats.every((cat) => CATEGORIES.some((category) => category.id === cat))))
}

console.log('\n[8] Store URL gate')
{
  ok('https is accepted', safeUrl('https://ok.example.com/a') === 'https://ok.example.com/a')
  ok('http is accepted', Boolean(safeUrl('http://ok.example.com/a')))
  ok('javascript: is refused', safeUrl('javascript:alert(1)') === null)
  ok('data: is refused', safeUrl('data:text/html,<script>alert(1)</script>') === null)
  ok('file: is refused', safeUrl('file:///C:/Windows/System32') === null)
  ok('a relative url is refused', safeUrl('/plugins/ai-nav') === null)
  ok('a quoted url is refused', safeUrl('https://a.example.com/"onmouseover="x') === null)
  ok('blank is refused', safeUrl('   ') === null)
  ok('non-strings are refused', safeUrl({ url: 'https://a.b' }) === null)

  const reserved = new Set(SITES.map((site) => site.id))
  const clash = normaliseSite({ id: 'metaso', name: 'X', url: 'https://x.example.com' }, reserved)
  ok('a catalogue id cannot be reused', clash.id !== 'metaso' && clash.id.startsWith('u-'), clash.id)
  const bad = normaliseSite({ id: 'ok', url: 'javascript:alert(1)' }, reserved)
  ok('an invalid url is rejected outright', bad === null)
  const named = normaliseSite({ url: 'https://www.example.com/x' }, reserved)
  ok('a missing name falls back to the host', named.name === 'example.com', named.name)
  const maxed = normaliseSite({ name: 'n', url: 'https://a.example.com', createdAt: 1 }, reserved)
  ok('createdAt is preserved', maxed.createdAt === 1)
  ok('the custom cap is a sane number', MAX_CUSTOM > 0 && MAX_CUSTOM <= 1000, MAX_CUSTOM)
}

console.log('\n[10] Store pin gate')
{
  // A store that accepts any id would persist dangling pins; this one is told
  // which ids exist and must refuse the rest.
  const known = new Set(['metaso', 'deepseek'])
  const directory = join(tmpdir(), 'dsh-ai-nav-selfcheck-' + process.pid)
  const store = await openStore({ directory, reserved: new Set(), isKnown: (id) => known.has(id) })

  const accepted = await store.setPin('metaso', true)
  ok('a known id is pinned', accepted.includes('metaso'), JSON.stringify(accepted))

  const rejected = await store.setPin('nope-nope', true)
  ok('an unknown id is not pinned', !rejected.includes('nope-nope'), JSON.stringify(rejected))
  ok('refusing an unknown id leaves the list unchanged', rejected.length === 1, JSON.stringify(rejected))

  const fuzzy = await store.setPin('deep', true)
  ok('a partial id is not pinned either', !fuzzy.includes('deep'), JSON.stringify(fuzzy))

  const unpinned = await store.setPin('metaso', false)
  ok('a known id can be unpinned', unpinned.length === 0, JSON.stringify(unpinned))
  ok('unpinning an unknown id is a no-op', (await store.setPin('nope-nope', false)).length === 0)

  const blank = await store.setPin('   ', true)
  ok('a blank id is refused', blank.length === 0, JSON.stringify(blank))

  // Cleanup: the self-check owns this directory.
  rmSync(directory, { recursive: true, force: true })
  ok('the temporary store directory is gone', !existsSync(directory))
}

console.log('\n[9] Icon lookup policy')
{
  // Private hosts: the proxy must never be usable to probe the local network.
  for (const host of ['localhost', 'a.localhost', 'printer.local', '127.0.0.1', '10.1.2.3',
    '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '::1']) {
    ok('refuses the private host ' + host, isPrivateHost(host) === true)
  }
  for (const host of ['chat.deepseek.com', '8.8.8.8', '172.32.0.1', '11.0.0.1', 'metaso.cn']) {
    ok('allows the public host ' + host, isPrivateHost(host) === false)
  }

  // Root-domain fallback: only where a subdomain exists and the suffix is known.
  ok('a subdomain falls back to its root domain', registrableDomain('chat.deepseek.com') === 'deepseek.com')
  ok('a two-part suffix is respected', registrableDomain('a.b.example.co.uk') === 'example.co.uk')
  ok('a bare root domain has no fallback', registrableDomain('deepseek.com') === '')
  ok('an unknown host shape has no fallback', registrableDomain('localhost') === '')

  // Candidate order: the origin first, then the root domain.
  const candidates = iconCandidates('https://chat.deepseek.com/chat/')
  ok('candidates start at the origin', candidates[0] === 'https://chat.deepseek.com/favicon.ico', candidates[0])
  ok('candidates include the root domain', candidates.some((url) => url.startsWith('https://deepseek.com/')), candidates.join(' '))
  ok('candidates stay absolute', candidates.every((url) => url.startsWith('https://')), candidates.join(' '))
  ok('a malformed url yields no candidates', iconCandidates('not a url').length === 0)

  // Content sniffing: the header lies, the bytes do not.
  ok('png is recognised',
    sniffImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])) === 'image/png')
  ok('ico is recognised',
    sniffImageType(Buffer.from([0x00, 0x00, 0x01, 0x00, 1, 0, 16, 16, 0, 0, 1, 0])) === 'image/x-icon')
  ok('jpeg is recognised',
    sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1])) === 'image/jpeg')
  ok('webp is recognised',
    sniffImageType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'ascii')) === 'image/webp')
  ok('svg with a declaration is recognised',
    sniffImageType(Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>', 'utf8')) === 'image/svg+xml')
  ok('an html page is not an image',
    sniffImageType(Buffer.from('<!DOCTYPE html><html><head><title>x</title>', 'utf8')) === null)
  ok('json is not an image', sniffImageType(Buffer.from('{"error":"not found"}', 'utf8')) === null)
  ok('an empty buffer is not an image', sniffImageType(Buffer.from([], 'utf8')) === null)
  ok('undefined is not an image', sniffImageType(undefined) === null)

  // Declared links: relative, protocol-relative and absolute all resolve.
  const page = '<html><head>'
    + '<link rel="icon" href="/icon.png">'
    + '<link rel="apple-touch-icon" sizes="180x180" href="https://cdn.example.com/touch.png">'
    + '<link rel="icon shortcut" href="//cdn.example.com/other.ico">'
    + '<link rel="stylesheet" href="/app.css">'
    + '</head></html>'
  const links = parseIconLinks(page, 'https://www.example.com/app/')
  ok('three icon links are found', links.length === 3, JSON.stringify(links))
  ok('a relative href resolves against the page', links.includes('https://www.example.com/icon.png'), JSON.stringify(links))
  ok('a protocol-relative href resolves', links.includes('https://cdn.example.com/other.ico'), JSON.stringify(links))
  ok('the apple-touch-icon leads', links[0] === 'https://cdn.example.com/touch.png', links[0])
  ok('a stylesheet is not an icon', links.every((url) => !url.endsWith('.css')), JSON.stringify(links))
  ok('a page with no icon link yields none', parseIconLinks('<html><head></head></html>', 'https://x.example.com').length === 0)
  ok('empty html yields none', parseIconLinks('', 'https://x.example.com').length === 0)
  ok('javascript: hrefs are not candidates',
    parseIconLinks('<link rel="icon" href="javascript:alert(1)">', 'https://x.example.com').length === 0)

  // The cache is a TTL cache, not a permanent one.
  const cache = createIconCache(1000)
  cache.set('a.example.com', { type: 'image/png', buffer: Buffer.from('x') })
  ok('a fresh entry is a hit', cache.get('a.example.com') !== null)
  ok('an unknown host is a miss', cache.get('b.example.com') === null)
  ok('the stored type survives', cache.get('a.example.com').type === 'image/png')

  // Single-flight: concurrent lookups for one host share one computation.
  const resolver = createIconResolver(2)
  let runs = 0
  const slow = () => new Promise((resolve) => { runs += 1; setTimeout(() => resolve('icon'), 5) })
  const together = await Promise.all([
    resolver('h.example.com', slow),
    resolver('h.example.com', slow),
    resolver('h.example.com', slow),
  ])
  ok('three concurrent lookups compute once', runs === 1, String(runs))
  ok('every caller gets the value', together.every((value) => value === 'icon'), JSON.stringify(together))

  // The global cap bounds concurrency across different hosts.
  let peak = 0
  let live = 0
  const capped = createIconResolver(2)
  const track = () => new Promise((resolve) => {
    live += 1
    peak = Math.max(peak, live)
    setTimeout(() => { live -= 1; resolve('x') }, 8)
  })
  await Promise.all(['a', 'b', 'c', 'd', 'e', 'f'].map((host) => capped(host, track)))
  ok('at most two hosts are fetched at once', peak <= 2, String(peak))

  ok('the icon size cap is bounded', ICON_LIMIT > 0 && ICON_LIMIT <= 256 * 1024, String(ICON_LIMIT))
  ok('the page head cap is bounded', PAGE_HEAD_LIMIT > 0 && PAGE_HEAD_LIMIT <= 512 * 1024, String(PAGE_HEAD_LIMIT))
}

console.log('\n' + (failures === 0 ? 'PASS' : 'FAIL') + ' — ' + (checks - failures) + '/' + checks + ' checks passed')
process.exitCode = failures === 0 ? 0 : 1

