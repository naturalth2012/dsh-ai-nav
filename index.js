/**
 * Host half of the AI 导航 plugin.
 *
 * The browser half is a page; this half owns everything the page and the agent
 * must agree on:
 *
 * 1. **The directory** — the shipped catalogue plus the user's own sites, in one
 *    payload, so the panel renders from a single fetch and never invents an entry.
 * 2. **Search and recommendation** — the same ranking code the panel's box uses,
 *    exposed as Tools so "帮我找个能做知识库工具" resolves to real URLs instead
 *    of a guess.
 * 3. **User data** — custom sites, pins, recents, engine choice (see `store.js`).
 * 4. **Favicons** — a bounded, cached proxy for the tiles' icons. The page cannot
 *    fetch a third-party icon itself without leaking a referrer and a CORS
 *    failure; the Host can, once per day per host.
 *
 * Nothing here calls a model or needs a key.
 *
 * @module dsh-ai-nav
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { get as httpGet } from 'node:http'
import { get as httpsGet } from 'node:https'

import { CATEGORIES, CATEGORY_BY_ID, ENGINES, ENGINE_BY_ID, SITES, SITE_BY_ID, RESERVED_IDS, findSite } from './catalog.js'
import { searchDirectory, resolveOpen, engineUrl, parseBookmarks, inferCategory, normalize } from './search.js'
import { recommend, SCENARIOS } from './recommend.js'
import { openStore, dataDirectory, safeUrl, MAX_CUSTOM } from './store.js'
import {
  isPrivateHost, iconCandidates, parseIconLinks, sniffImageType,
  createIconCache, createIconResolver, ICON_LIMIT, ICON_MISS_TTL, ICON_HIT_TTL, PAGE_HEAD_LIMIT,
} from './icon.js'

export const BASE = '/plugins/ai-nav'
export const DIRECTORY_PATH = BASE + '/directory'
export const SEARCH_PATH = BASE + '/search'
export const SITES_PATH = BASE + '/sites'
export const VISIT_PATH = BASE + '/visit'
export const PINS_PATH = BASE + '/pins'
export const SETTINGS_PATH = BASE + '/settings'
export const RECOMMEND_PATH = BASE + '/recommend'
export const IMPORT_PATH = BASE + '/import'
export const FAVICON_PATH = BASE + '/favicon'

const DEFAULTS = {
  engine: 'metaso',
  showSelfHost: true,
  favicons: true,
}

/* -------------------------------------------------------------------------- */
/* HTTP helpers                                                               */
/* -------------------------------------------------------------------------- */

function sendJson(res, status, body) {
  let payload
  try {
    payload = JSON.stringify(body)
  } catch (error) {
    payload = JSON.stringify({ error: '响应无法序列化：' + String(error) })
    status = 500
  }
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function sendEmpty(res, status) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end()
}

function readQuery(req, fallbackPath) {
  try {
    return new URL(req.url === undefined ? fallbackPath : req.url, 'http://localhost').searchParams
  } catch {
    return new URLSearchParams()
  }
}

function readJsonBody(req, limit = 512 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('请求体过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

function readTextBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('文件过大，请只导入书签文件（上限 4 MB）'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/* -------------------------------------------------------------------------- */
/* Directory assembly                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The catalogue as the panel needs it: no aliases (client-side matching happens
 * on the Host), with the category's display name attached so a result row can
 * say "知识库" without a second lookup.
 */
function shippedSites(options) {
  return SITES
    .filter((site) => options.showSelfHost || !site.selfHost)
    .map((site) => ({
      kind: 'site',
      id: site.id,
      name: site.name,
      url: site.url,
      host: site.host,
      cat: site.cat,
      categoryName: CATEGORY_BY_ID[site.cat] ? CATEGORY_BY_ID[site.cat].name : site.cat,
      desc: site.desc,
      tags: site.tags,
      region: site.region,
      hot: site.hot,
      selfHost: site.selfHost,
      q: site.q || null,
      order: site.order,
    }))
}

/** Custom entries shaped like catalogue entries, so the panel needs one renderer. */
function customSites(store) {
  return store.sites().map((site) => ({
    ...site,
    categoryName: CATEGORY_BY_ID[site.cat] ? CATEGORY_BY_ID[site.cat].name : '自定义',
    order: site.order,
  }))
}

function merged(store, options) {
  return [...shippedSites(options), ...customSites(store)]
}

/** Category counts, used by the panel's left rail and the tools' summaries. */
function countByCategory(sites) {
  const counts = {}
  for (const site of sites) counts[site.cat] = (counts[site.cat] || 0) + 1
  return counts
}

function resolveEngine(store, options) {
  const chosen = store.settings().engine
  return ENGINE_BY_ID[chosen] || ENGINE_BY_ID[options.engine] || ENGINES[0]
}

/* -------------------------------------------------------------------------- */
/* Favicon proxy                                                              */
/* -------------------------------------------------------------------------- */


/**
 * Download one icon with hard limits: 4 s, one redirect follow, 96 KiB.
 *
 * Returns the bytes only when they really are an image, so a 200 that carries
 * the app shell is treated exactly like a 404.
 */
function fetchIcon(rawUrl, depth = 0) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    let parsed
    try {
      parsed = new URL(rawUrl)
    } catch {
      finish(null)
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      finish(null)
      return
    }
    if (isPrivateHost(parsed.hostname)) {
      finish(null)
      return
    }
    const client = parsed.protocol === 'https:' ? httpsGet : httpGet
    const request = client(parsed, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'image/avif,image/webp,image/svg+xml,image/png,image/x-icon,image/*;q=0.8,*/*;q=0.5',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 4000,
    }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location && depth < 2) {
        let next
        try {
          next = new URL(response.headers.location, parsed).toString()
        } catch {
          response.resume()
          finish(null)
          return
        }
        response.resume()
        fetchIcon(next, depth + 1).then(finish, () => finish(null))
        return
      }
      if (status !== 200) {
        response.resume()
        finish(null)
        return
      }
      const declared = String(response.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
      if (declared && declared !== 'application/octet-stream' && !declared.startsWith('image/') && !declared.startsWith('text/')) {
        response.resume()
        finish(null)
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > ICON_LIMIT) {
          request.destroy()
          finish(null)
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => {
        const buffer = Buffer.concat(chunks)
        const type = sniffImageType(buffer)
        finish(type ? { type, buffer } : null)
      })
      response.on('error', () => finish(null))
    })
    request.on('timeout', () => {
      request.destroy()
      finish(null)
    })
    request.on('error', () => finish(null))
  })
}


/**
 * Fetch a page's HTML to look for icon links, with the same envelope as icons:
 * 4 s, `PAGE_HEAD_LIMIT`, and only for http(s) hosts that are not private.
 */
function fetchPageHead(url) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    let parsed
    try {
      parsed = new URL(url)
    } catch {
      finish('')
      return
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      finish('')
      return
    }
    if (isPrivateHost(parsed.hostname)) {
      finish('')
      return
    }
    const client = parsed.protocol === 'https:' ? httpsGet : httpGet
    const request = client(parsed, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
      timeout: 4000,
    }, (response) => {
      const status = response.statusCode || 0
      if (status >= 300 && status < 400 && response.headers.location) {
        let next
        try {
          next = new URL(response.headers.location, parsed).toString()
        } catch {
          response.resume()
          finish('')
          return
        }
        response.resume()
        fetchPageHead(next).then(finish, () => finish(''))
        return
      }
      if (status !== 200) {
        response.resume()
        finish('')
        return
      }
      const chunks = []
      let size = 0
      response.on('data', (chunk) => {
        size += chunk.length
        if (size > PAGE_HEAD_LIMIT) {
          // Stop early instead of downloading the whole app shell.
          request.destroy()
          finish(Buffer.concat(chunks).toString('utf8'))
          return
        }
        chunks.push(chunk)
      })
      response.on('end', () => finish(Buffer.concat(chunks).toString('utf8')))
      response.on('error', () => finish(''))
    })
    request.on('timeout', () => {
      request.destroy()
      finish('')
    })
    request.on('error', () => finish(''))
  })
}


/* -------------------------------------------------------------------------- */
/* Plugin                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} config
 */
export function apply(ctx, config) {
  const source = config !== null && typeof config === 'object' ? config : {}
  const options = {
    engine: typeof source.engine === 'string' && ENGINE_BY_ID[source.engine] ? source.engine : DEFAULTS.engine,
    showSelfHost: source.showSelfHost !== false,
    favicons: source.favicons !== false,
  }

  const icons = createIconCache(ICON_HIT_TTL)
  const iconMisses = new Map()
  const resolveIcon = createIconResolver(5)

  // Declared before the store so `isKnown` can consult the user's own sites; the
  // store's `load()` runs before `storeReady` resolves, but pins are only read
  // and written later, so `store` is always assigned by then.
  let store = null

  // A pin may name a shipped entry or one of the user's own. The store asks this
  // before persisting, so a dangling reference never reaches the file. It is an
  // exact id test, not a name search: a typo must fail, not silently pin
  // whichever site the typo happens to resemble.
  const isKnown = (id) => {
    const key = typeof id === 'string' ? id : ''
    if (!key) return false
    if (SITE_BY_ID[key]) return true
    return Boolean(store && store.get(key))
  }
  const storeReady = openStore({ directory: dataDirectory(), reserved: RESERVED_IDS, isKnown })
    .catch(() => openStore({ directory: join(tmpdir(), 'dsh-ai-nav-memory'), reserved: RESERVED_IDS, isKnown }))

  const withStore = async () => {
    if (!store) store = await storeReady
    return store
  }

  const directoryPayload = async () => {
    const ready = await withStore()
    const sites = merged(ready, options)
    return {
      categories: CATEGORIES,
      engines: ENGINES,
      engine: resolveEngine(ready, options).id,
      sites,
      counts: countByCategory(sites),
      pins: ready.pins(),
      recents: ready.recents(),
      settings: ready.settings(),
      meta: {
        total: sites.length,
        custom: ready.sites().length,
        maxCustom: MAX_CUSTOM,
        generatedAt: new Date().toISOString(),
        scenarios: SCENARIOS.map((scenario) => ({ id: scenario.id, label: scenario.label })),
      },
    }
  }

  /* ---- Tools ----------------------------------------------------------- */

  ctx.inject(['tools'], (toolCtx) => {
    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_search',
      description:
        '在 AI 导航目录里查找站点并返回真实可点击的网址。目录覆盖对话助手、AI 搜索、知识库、编程与 Agent、'
        + '图像音视频、办公文档、模型社区、学习资料八类，含用户自己添加和导入的站点。'
        + '用户问「XX 在哪」「有没有能做 YY 的网站」「给我几个 ZZ 的入口」时使用；'
        + '只要不确定某个网址是否真实存在，先查这里，不要凭记忆编造链接。',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '关键词：站点名、拼音缩写、别名、域名或用途，例如「知识库」「metaso」「秘塔」。' },
          category: {
            type: 'string',
            enum: CATEGORIES.map((category) => category.id),
            description: '可选，限定分类。',
          },
          region: {
            type: 'string',
            enum: ['cn', 'global', 'any'],
            description: '可选，cn 只要国内可直连的，global 只要海外的，默认不限制。',
          },
          limit: { type: 'number', description: '返回条数，默认 8，最多 30。' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            total: { type: 'number' },
            results: { type: 'array' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: searchText(value) }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        const query = args && typeof args.query === 'string' ? args.query : ''
        const limit = Math.min(30, Math.max(1, Number(args && args.limit) || 8))
        const region = args && (args.region === 'cn' || args.region === 'global') ? args.region : undefined
        const hits = searchDirectory(query, merged(ready, options), {
          limit,
          category: args && typeof args.category === 'string' ? args.category : undefined,
          region,
        })
        return {
          query,
          total: hits.length,
          results: hits.map(({ site }) => ({
            name: site.name,
            url: site.url,
            category: site.categoryName || site.cat,
            desc: site.desc,
            tags: site.tags,
            region: site.region,
            selfHost: Boolean(site.selfHost),
          })),
        }
      },
    }), 'ai-nav: search tool')

    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_recommend',
      description:
        '按一句话描述的「需求 / 场景」推荐一套互补的 AI 工具组合，并说明每个为什么合适。'
        + '适用于搭知识库、做调研、找论文、出图做视频、写代码做产品、写文档做 PPT 等场景；'
        + '用户说「我想做 X，该用什么」而没提具体产品名时优先用它，再配合 ai_nav_search 补充细节。',
      parameters: {
        type: 'object',
        properties: {
          need: { type: 'string', description: '用户的原话，例如「想给团队搭个内部文档问答的知识库」「要做短视频，不想露脸」。' },
          region: {
            type: 'string',
            enum: ['cn', 'global', 'any'],
            description: '可选，cn 表示只要国内可直接访问的，默认不限制。',
          },
          selfHost: { type: 'boolean', description: '可选，true 表示优先可自己部署的（数据不出内网）。' },
          budget: { type: 'string', enum: ['free', 'paid', 'any'], description: '可选，free 表示优先免费额度。' },
          limit: { type: 'number', description: '推荐条数，默认 4，最多 8。' },
        },
        required: ['need'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            need: { type: 'string' },
            scenarios: { type: 'array' },
            picks: { type: 'array' },
            note: { type: 'string' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: recommendText(value) }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        return recommend(args && args.need, merged(ready, options), {
          limit: args && args.limit,
          region: args && args.region,
          selfHost: args && args.selfHost === true,
          budget: args && args.budget,
        })
      },
    }), 'ai-nav: recommend tool')

    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_browse',
      description:
        '浏览 AI 导航目录的类目与条目，或读取某个类目的全部站点。用在用户想「看看都有什么」'
        + '而不是带着明确关键词找的时候；省略 category 返回各类目及其条目数。',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: CATEGORIES.map((category) => category.id),
            description: '可选，省略则只返回类目清单。',
          },
          limit: { type: 'number', description: '每个类目最多返回多少条，默认 40。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            categories: { type: 'array' },
            sites: { type: 'array' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: browseText(value) }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        const all = merged(ready, options)
        const wanted = args && typeof args.category === 'string' ? args.category : ''
        const limit = Math.min(200, Math.max(1, Number(args && args.limit) || 40))
        const categories = CATEGORIES.map((category) => ({
          id: category.id,
          name: category.name,
          blurb: category.blurb,
          count: all.filter((site) => site.cat === category.id).length,
        }))
        const sites = wanted
          ? all.filter((site) => site.cat === wanted).slice(0, limit).map((site) => ({
            name: site.name, url: site.url, desc: site.desc, tags: site.tags, region: site.region,
          }))
          : []
        return { categories, sites, category: wanted || null }
      },
    }), 'ai-nav: browse tool')

    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_sites',
      description:
        '管理 AI 导航页里用户自己的站点与置顶。action=list 列出全部自定义站点与置顶；'
        + 'action=add 按名称和网址新增（重复网址会更新）；action=remove 按 id 或网址删除；'
        + 'action=pin 置顶 / 取消置顶。用户说「把 X 加到导航」「以后打开 Y 方便点」时使用。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'add', 'remove', 'pin'], description: '默认 list。' },
          name: { type: 'string', description: 'add 时：显示名称，例如「公司 Wiki」。' },
          url: { type: 'string', description: 'add / remove 时：完整网址，例如 https://wiki.example.com。' },
          desc: { type: 'string', description: 'add 时：一句话备注。' },
          category: {
            type: 'string',
            enum: [...CATEGORIES.map((category) => category.id), 'misc'],
            description: 'add 时：归入哪个类目，默认 misc（未分类）。',
          },
          id: { type: 'string', description: 'remove / pin 时的条目 id。' },
          pinned: { type: 'boolean', description: 'pin 时：true 置顶，false 取消，默认 true。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            sites: { type: 'array' },
            pins: { type: 'array' },
            changed: { type: 'object' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: sitesText(value) }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        const action = args && typeof args.action === 'string' ? args.action : 'list'

        if (action === 'add') {
          const url = safeUrl(args && args.url)
          if (!url) throw new Error('需要一个完整的 http(s) 网址，例如 https://wiki.example.com')
          const saved = await ready.addSite({
            name: args && args.name,
            url,
            desc: args && args.desc,
            cat: args && typeof args.category === 'string' ? args.category : 'misc',
          })
          if (!saved) throw new Error('这个网址无法保存')
          return { sites: ready.sites(), pins: ready.pins(), changed: { kind: 'added', id: saved.id, name: saved.name } }
        }

        if (action === 'remove') {
          const target = findCustom(ready, args && args.id, args && args.url)
          if (!target) throw new Error('没有找到这条自定义站点')
          await ready.removeSite(target.id)
          return { sites: ready.sites(), pins: ready.pins(), changed: { kind: 'removed', id: target.id, name: target.name } }
        }

        if (action === 'pin') {
          const wanted = args && typeof args.pinned === 'boolean' ? args.pinned : true
          const own = findCustom(ready, args && args.id, args && args.url)
          const catalogEntry = !own && args && typeof args.id === 'string' ? findSite(args.id) : null
          const id = own ? own.id : catalogEntry ? catalogEntry.id : ''
          if (!id) throw new Error('pin 需要目录里的条目 id 或自定义站点的 id / 网址')
          const pins = await ready.setPin(id, wanted)
          return {
            sites: ready.sites(),
            pins,
            changed: { kind: wanted ? 'pinned' : 'unpinned', id, name: own ? own.name : catalogEntry.name },
          }
        }

        return { sites: ready.sites(), pins: ready.pins() }
      },
    }), 'ai-nav: sites tool')

    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_import',
      description:
        '把浏览器导出的书签文件（Netscape 书签 HTML）导入 AI 导航页，作为自定义站点。'
        + '可以给 text（文件内容）或 file（本机文件路径）。导入会按域名归类，已知站点会自动放进对应类目。'
        + '用户说「把我的书签导进来」时使用。',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '书签 HTML 的内容（与 file 二选一）。' },
          file: { type: 'string', description: '书签 HTML 的本机路径（与 text 二选一）。' },
          limit: { type: 'number', description: '本次最多导入多少条，默认 100，最多 300。' },
        },
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            parsed: { type: 'number' },
            imported: { type: 'number' },
            skipped: { type: 'number' },
            samples: { type: 'array' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: importText(value) }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        const limit = Math.min(MAX_CUSTOM, Math.max(1, Number(args && args.limit) || 100))
        let html = typeof (args && args.text) === 'string' ? args.text : ''
        if (!html && args && typeof args.file === 'string' && args.file.trim()) {
          try {
            html = await readFile(args.file.trim(), 'utf8')
          } catch (error) {
            throw new Error('读不到这个文件：' + (error instanceof Error ? error.message : String(error)))
          }
        }
        if (!html.trim()) throw new Error('需要 text 或 file 其中之一')
        const parsed = parseBookmarks(html)
        if (parsed.length === 0) throw new Error('没解析出书签，确认这是浏览器导出的书签 HTML')

        const all = merged(ready, options)
        const imported = []
        let skipped = 0
        for (const bookmark of parsed.slice(0, limit)) {
          const guess = inferCategory(bookmark.url, bookmark.title, all)
          const saved = await ready.addSite({
            name: bookmark.title,
            url: bookmark.url,
            desc: guess.desc || bookmark.folder || '',
            cat: guess.cat || 'misc',
            tags: guess.tags,
            createdAt: bookmark.addedAt || Date.now(),
          })
          if (saved) imported.push(saved.name)
          else skipped += 1
        }
        return {
          parsed: parsed.length,
          imported: imported.length,
          skipped,
          samples: imported.slice(0, 10),
          totalCustom: ready.sites().length,
        }
      },
    }), 'ai-nav: import tool')

    toolCtx.effect(() => toolCtx.tools.register({
      name: 'ai_nav_open',
      description:
        '把用户的一句话解析成该打开的地址：像是网址就打开它，命中目录里的站点就打开那个站点，'
        + '否则用选定的搜索引擎去搜。返回最终 URL 和判定理由。'
        + '用户说「打开 X」「搜一下 Y」但没说清是站内还是全网时使用。',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string', description: '要打开或搜索的内容。' },
          engine: {
            type: 'string',
            enum: ENGINES.map((engine) => engine.id),
            description: '可选，搜索时用哪个引擎，默认沿用页面当前选择。',
          },
        },
        required: ['input'],
        additionalProperties: false,
      },
      output: {
        schema: {
          type: 'object',
          properties: {
            kind: { type: 'string' },
            url: { type: 'string' },
            label: { type: 'string' },
            reason: { type: 'string' },
          },
          additionalProperties: true,
        },
        render(args, value) {
          return [{ type: 'text', text: '→ ' + value.url + '（' + (value.reason || value.kind) + '）' }]
        },
      },
      async execute(args) {
        const ready = await withStore()
        const input = args && typeof args.input === 'string' ? args.input : ''
        const engine = (args && args.engine && ENGINE_BY_ID[args.engine]) || resolveEngine(ready, options)
        const resolved = resolveOpen(input, merged(ready, options), engine)
        const reason = resolved.kind === 'url' ? '看起来是一个网址'
          : resolved.kind === 'site' ? '命中目录中的「' + resolved.site.name + '」'
            : '目录里没有对应站点，改用「' + engine.name + '」搜索'
        return { ...resolved, engine: engine.id, reason }
      },
    }), 'ai-nav: open tool')
  })

  /* ---- Routes ---------------------------------------------------------- */

  ctx.inject(['webServer'], (webCtx) => {
    // The whole directory in one document: the panel paints from this and does
    // its filtering locally, so typing in the box never waits for the network.
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: DIRECTORY_PATH,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        try {
          const body = await directoryPayload()
          if (req.method === 'HEAD') {
            sendEmpty(res, 200)
            return
          }
          sendJson(res, 200, body)
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: directory route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: SEARCH_PATH,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        try {
          const ready = await withStore()
          const params = readQuery(req, SEARCH_PATH)
          const query = (params.get('q') || '').slice(0, 120)
          const category = params.get('cat') || ''
          const region = params.get('region') || ''
          const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 20))
          const hits = searchDirectory(query, merged(ready, options), {
            limit,
            category: category || undefined,
            region: region === 'cn' || region === 'global' ? region : undefined,
          })
          if (req.method === 'HEAD') {
            sendEmpty(res, 200)
            return
          }
          sendJson(res, 200, {
            query,
            total: hits.length,
            results: hits.map(({ site, score }) => ({ ...site, score: Math.round(score) })),
          })
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: search route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: RECOMMEND_PATH,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        try {
          const ready = await withStore()
          const params = readQuery(req, RECOMMEND_PATH)
          const need = (params.get('need') || '').slice(0, 300)
          const body = recommend(need, merged(ready, options), {
            limit: Math.min(8, Math.max(1, Number(params.get('limit')) || 4)),
            region: params.get('region') || 'any',
            selfHost: params.get('selfHost') === '1',
            budget: params.get('budget') || 'any',
          })
          if (req.method === 'HEAD') {
            sendEmpty(res, 200)
            return
          }
          sendJson(res, 200, body)
        } catch (error) {
          sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: recommend route')

    // Custom sites: list / add / remove in one place, because the panel's editor
    // is one form and the Import action lands in the same list.
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: SITES_PATH,
      handler: async (req, res) => {
        try {
          const ready = await withStore()
          const params = readQuery(req, SITES_PATH)

          if (req.method === 'GET' || req.method === 'HEAD') {
            if (req.method === 'HEAD') {
              sendEmpty(res, 200)
              return
            }
            sendJson(res, 200, {
              sites: customSites(ready),
              pins: ready.pins(),
              limit: MAX_CUSTOM,
            })
            return
          }

          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            const saved = await ready.addSite({
              name: body && body.name,
              url: body && body.url,
              desc: body && body.desc,
              cat: body && body.cat,
              tags: body && body.tags,
            })
            if (!saved) {
              sendJson(res, 400, { error: '需要一个完整的 http(s) 网址' })
              return
            }
            sendJson(res, 200, { site: saved, sites: customSites(ready), pins: ready.pins() })
            return
          }

          if (req.method === 'DELETE') {
            const id = params.get('id') || ''
            const target = findCustom(ready, id, '')
            if (!target) {
              sendJson(res, 404, { error: '没有这条自定义站点' })
              return
            }
            await ready.removeSite(target.id)
            sendJson(res, 200, { removed: true, sites: customSites(ready), pins: ready.pins() })
            return
          }

          sendJson(res, 405, { error: 'method not allowed' })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: sites route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: PINS_PATH,
      handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const ready = await withStore()
          const body = await readJsonBody(req)
          if (!body || typeof body.id !== 'string' || !body.id) {
            sendJson(res, 400, { error: '需要 id' })
            return
          }
          // A pin is a reference to a real entry, so it is resolved by exact id
          // only. Accepting an unknown id would store a dangling pin that no
          // render can resolve; fuzzy name matching would let a typo pin the
          // wrong site, which is worse than refusing.
          const known = SITE_BY_ID[body.id] || ready.get(body.id)
          if (!known) {
            sendJson(res, 404, { error: '目录里没有这个条目：' + body.id })
            return
          }
          const pins = await ready.setPin(known.id, body.pinned !== false)
          sendJson(res, 200, { pins })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: pins route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: VISIT_PATH,
      handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const ready = await withStore()
          const body = await readJsonBody(req)
          const recents = await ready.recordVisit(body || {})
          sendJson(res, 200, { recents })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: visit route')

    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: SETTINGS_PATH,
      handler: async (req, res) => {
        try {
          const ready = await withStore()
          if (req.method === 'GET' || req.method === 'HEAD') {
            if (req.method === 'HEAD') {
              sendEmpty(res, 200)
              return
            }
            sendJson(res, 200, { ...ready.settings(), engines: ENGINES })
            return
          }
          if (req.method === 'POST') {
            const body = await readJsonBody(req)
            if (body && typeof body.engine === 'string' && !ENGINE_BY_ID[body.engine]) {
              sendJson(res, 400, { error: '没有这个搜索引擎' })
              return
            }
            sendJson(res, 200, await ready.setSettings(body || {}))
            return
          }
          sendJson(res, 405, { error: 'method not allowed' })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: settings route')

    // Bookmark import over plain text so the page can read a dropped file itself
    // and post its contents, instead of asking the Host to read a path.
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: IMPORT_PATH,
      handler: async (req, res) => {
        try {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'method not allowed' })
            return
          }
          const ready = await withStore()
          const html = await readTextBody(req)
          const parsed = parseBookmarks(html)
          if (parsed.length === 0) {
            sendJson(res, 400, { error: '没解析出书签，确认这是浏览器导出的书签 HTML' })
            return
          }
          const all = merged(ready, options)
          const imported = []
          let skipped = 0
          for (const bookmark of parsed.slice(0, MAX_CUSTOM)) {
            const guess = inferCategory(bookmark.url, bookmark.title, all)
            const saved = await ready.addSite({
              name: bookmark.title,
              url: bookmark.url,
              desc: guess.desc || bookmark.folder || '',
              cat: guess.cat || 'misc',
              tags: guess.tags,
              createdAt: bookmark.addedAt || Date.now(),
            })
            if (saved) imported.push(saved.name)
            else skipped += 1
          }
          sendJson(res, 200, {
            parsed: parsed.length,
            imported: imported.length,
            skipped,
            samples: imported.slice(0, 10),
            sites: customSites(ready),
            pins: ready.pins(),
          })
        } catch (error) {
          sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'ai-nav: import route')

    // Icon proxy. The response is cached for a day either way, so a page full of
    // tiles costs a handful of requests on first paint and none afterwards.
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: FAVICON_PATH,
      handler: async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { error: 'method not allowed' })
          return
        }
        if (!options.favicons) {
          sendJson(res, 404, { error: 'favicons disabled' })
          return
        }
        const params = readQuery(req, FAVICON_PATH)
        const target = safeUrl(params.get('url') || '')
        if (!target) {
          sendJson(res, 400, { error: 'bad url' })
          return
        }
        let host = ''
        try {
          host = new URL(target).host
        } catch {
          sendJson(res, 400, { error: 'bad url' })
          return
        }
        // A host with no icon is not retried for a while; otherwise every render
        // of the page hammers the same four dead addresses per tile. The window
        // is short enough that a transient network failure heals itself while
        // the tab is open, and `retry=1` skips it entirely.
        const missed = iconMisses.get(host)
        const force = params.get('retry') === '1'
        if (missed && !force && Date.now() - missed < ICON_MISS_TTL) {
          sendJson(res, 404, { error: 'no icon' })
          return
        }
        if (force) iconMisses.delete(host)
        try {
          let hit = icons.get(host)
          if (!hit) {
            hit = await resolveIcon(host, async () => {
              // Re-check inside the single-flight slot: another request for the
              // same host may have just filled the cache while this one waited.
              const cached = icons.get(host)
              if (cached) return cached
              // 1. The conventional addresses at the site itself (and its root
              //    domain). Cheap, and enough for most sites.
              for (const candidate of iconCandidates(target)) {
                const icon = await fetchIcon(candidate)
                if (icon) {
                  icons.set(host, icon)
                  return icon
                }
              }
              // 2. The page's own declaration. App shells that answer every path
              //    with their HTML still point at a CDN copy of their logo, and
              //    that is the only way to get a real icon for them.
              const head = await fetchPageHead(target)
              for (const declared of parseIconLinks(head, target)) {
                const icon = await fetchIcon(declared)
                if (icon) {
                  icons.set(host, icon)
                  return icon
                }
              }
              return null
            })
          }
          if (!hit) {
            iconMisses.set(host, Date.now())
            sendJson(res, 404, { error: 'no icon' })
            return
          }
          if (req.method === 'HEAD') {
            res.writeHead(200, { 'content-type': hit.type, 'cache-control': 'public, max-age=86400' })
            res.end()
            return
          }
          res.writeHead(200, {
            'content-type': hit.type,
            'content-length': hit.buffer.length,
            'cache-control': 'public, max-age=86400',
          })
          res.end(hit.buffer)
        } catch {
          iconMisses.set(host, Date.now())
          sendJson(res, 404, { error: 'no icon' })
        }
      },
    }), 'ai-nav: favicon route')
  })
}

/** Locate a custom site by id, or by URL when only a link was given. */
function findCustom(store, id, url) {
  const byId = typeof id === 'string' && id ? store.get(id) : null
  if (byId) return byId
  const wanted = safeUrl(url)
  if (!wanted) return null
  return store.sites().find((site) => site.url === wanted) || null
}

/* -------------------------------------------------------------------------- */
/* Tool text rendering                                                        */
/* -------------------------------------------------------------------------- */

function searchText(value) {
  if (!value || !Array.isArray(value.results)) return JSON.stringify(value)
  if (value.results.length === 0) {
    return '目录里没有「' + (value.query || '') + '」相关条目。可以换个说法，或用 ai_nav_recommend 描述需求。'
  }
  const lines = ['「' + (value.query || '') + '」找到 ' + value.results.length + ' 条：']
  for (const item of value.results) {
    const bits = [item.category]
    if (item.region === 'cn') bits.push('国内')
    if (item.selfHost) bits.push('可自部署')
    lines.push('· ' + item.name + '（' + bits.join('，') + '）' + item.url)
    if (item.desc) lines.push('    ' + item.desc)
  }
  return lines.join('\n')
}

function recommendText(value) {
  if (!value) return '（无推荐）'
  const lines = []
  if (Array.isArray(value.scenarios) && value.scenarios.length > 0) {
    lines.push('场景：' + value.scenarios.map((scenario) => scenario.label + '（' + scenario.hint + '）').join('；'))
  }
  for (const pick of value.picks || []) {
    lines.push('· [' + pick.role + '] ' + pick.name + ' — ' + pick.url)
    if (pick.why) lines.push('    为什么：' + pick.why)
  }
  if (value.note) lines.push(value.note)
  return lines.join('\n')
}

function browseText(value) {
  if (!value) return '（无数据）'
  const lines = []
  const categories = Array.isArray(value.categories) ? value.categories : []
  if (Array.isArray(value.sites) && value.sites.length > 0) {
    const name = categories.find((category) => category.id === value.category)
    lines.push('「' + (name ? name.name : value.category) + '」共 ' + value.sites.length + ' 条：')
    for (const site of value.sites) {
      lines.push('· ' + site.name + ' — ' + site.url + (site.desc ? '｜' + site.desc : ''))
    }
    return lines.join('\n')
  }
  lines.push('目录共 ' + categories.length + ' 个类目：')
  for (const category of categories) {
    lines.push('· ' + category.name + '（' + category.id + '，' + category.count + ' 条）— ' + category.blurb)
  }
  lines.push('要看某一类，用 ai_nav_browse 带上 category。')
  return lines.join('\n')
}

function sitesText(value) {
  if (!value) return '（无数据）'
  const lines = []
  if (value.changed) {
    const verb = value.changed.kind === 'added' ? '已添加'
      : value.changed.kind === 'removed' ? '已删除'
        : value.changed.kind === 'pinned' ? '已置顶' : '已取消置顶'
    lines.push(verb + '：' + (value.changed.name || value.changed.id))
  }
  const sites = Array.isArray(value.sites) ? value.sites : []
  if (sites.length === 0) {
    lines.push('还没有自定义站点。可以 add 一条，或把浏览器书签导入进来。')
  } else {
    lines.push('自定义站点（' + sites.length + ' 条）：')
    for (const site of sites) {
      lines.push('· ' + site.name + '（' + site.id + '）' + site.url)
    }
  }
  const pins = Array.isArray(value.pins) ? value.pins : []
  if (pins.length > 0) lines.push('置顶：' + pins.join('、'))
  return lines.join('\n')
}

function importText(value) {
  if (!value) return '（无结果）'
  const lines = ['解析到 ' + value.parsed + ' 条书签，导入 ' + value.imported + ' 条'
    + (value.skipped ? '，跳过 ' + value.skipped + ' 条' : '') + '。']
  if (Array.isArray(value.samples) && value.samples.length > 0) {
    lines.push('例如：' + value.samples.slice(0, 6).join('、'))
  }
  if (typeof value.totalCustom === 'number') lines.push('当前自定义站点共 ' + value.totalCustom + ' 条。')
  return lines.join('\n')
}

/** Exported for the self-check and for tests that need the same normalisation. */
export { normalize, engineUrl }

