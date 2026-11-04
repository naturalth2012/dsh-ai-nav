/**
 * Persistent state for the navigation page.
 *
 * The catalogue in `catalog.js` is a default, not the user's list. What people
 * accumulate here is:
 *
 * - **自定义站点** sites they added by hand or imported from a bookmarks file,
 * - **置顶** the handful of tiles they actually use, pinned to the top,
 * - **最近访问** a short recency list that makes the page open on the right
 *   thing without any configuration,
 * - **上次搜索** so the box and engine selection survive a reload.
 *
 * Writes go through a serial queue and land via temp-file + rename, so a crash
 * mid-write cannot truncate the file. A corrupt file is treated as "no data"
 * rather than as a startup failure: a navigation page must always open.
 *
 * @module dsh-ai-nav/store
 */

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const FILE_VERSION = 1
export const MAX_CUSTOM = 300
export const MAX_PINS = 24
export const MAX_RECENT = 12

const TEXT_LIMIT = 120

/** Only these characters are allowed at the start of a stored link. */
const SAFE_URL = /^https?:\/\/[^\s"'<>]+$/i

/**
 * Where user data lives, following the same lookup the other local plugins use:
 * explicit profile directory, then `DSH_HOME`, then `~/.dsh`.
 */
export function dataDirectory() {
  const profile = process.env.DSH_PROFILE_DIR
  if (profile && profile.trim()) return join(profile.trim(), 'ai-nav')
  const home = process.env.DSH_HOME
  if (home && home.trim()) return join(home.trim(), 'ai-nav')
  return join(homedir() || tmpdir(), '.dsh', 'ai-nav')
}

/**
 * Reject anything that is not a plain http(s) URL.
 *
 * This is the store's only real security boundary: every stored link is later
 * rendered as an `<a href>` on a page that can talk to the Host over same-origin
 * routes, so `javascript:` and `data:` must never reach the file. The check runs
 * on write *and* on read, because a hand-edited file is an input like any other.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
export function safeUrl(value) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (text.length === 0 || text.length > 2048) return null
  if (!SAFE_URL.test(text)) return null
  try {
    const parsed = new URL(text)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

function text(value, limit = TEXT_LIMIT) {
  return String(value === null || value === undefined ? '' : value).trim().slice(0, limit)
}

/**
 * Coerce one stored custom site into shape, or null when unusable.
 * @param {object} entry
 * @param {Set<string>} reserved ids the catalogue already owns
 */
export function normaliseSite(entry, reserved) {
  if (!entry || typeof entry !== 'object') return null
  const url = safeUrl(entry.url)
  if (!url) return null
  let id = text(entry.id, 48)
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(id)) id = ''
  if (id && reserved && reserved.has(id)) id = ''
  if (!id) id = 'u-' + Math.random().toString(36).slice(2, 9)
  const name = text(entry.name, 40) || (() => {
    try {
      return new URL(url).host.replace(/^www\./, '')
    } catch {
      return url
    }
  })()
  let host = ''
  try {
    host = new URL(url).host
  } catch {
    host = ''
  }
  const cat = text(entry.cat, 24)
  return {
    kind: 'custom',
    id,
    name,
    url,
    host,
    cat: cat || 'misc',
    desc: text(entry.desc, 160),
    tags: Array.isArray(entry.tags) ? entry.tags.map((t) => text(t, 20)).filter(Boolean).slice(0, 4) : [],
    region: entry.region === 'cn' ? 'cn' : 'global',
    aliases: [],
    hot: false,
    selfHost: false,
    q: null,
    pinned: false,
    createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now(),
    order: 1000 + (Number.isFinite(entry.order) ? entry.order : 0),
  }
}

function emptyState() {
  return {
    version: FILE_VERSION,
    sites: [],
    pins: [],
    recent: [],
    engine: 'metaso',
    lastQuery: '',
  }
}

/**
 * Open the store. Never rejects: a failed open degrades to an in-memory store so
 * the page still works, it just forgets between restarts.
 *
 * `isKnown` answers "does this id name a real entry?" — the shipped catalogue
 * plus the user's own sites. Pins are references, so a store that accepts an
 * unknown id ends up persisting dangling references that no render can resolve.
 * The check lives here rather than in the route because this is the last place
 * before the bytes reach the file.
 *
 * @param {{directory?: string, reserved?: Set<string>, isKnown?: (id: string) => boolean}} [options]
 */
export async function openStore(options = {}) {
  const directory = options.directory || dataDirectory()
  const reserved = options.reserved instanceof Set ? options.reserved : new Set()
  const isKnown = typeof options.isKnown === 'function' ? options.isKnown : () => true
  const file = join(directory, 'data.json')
  let state = emptyState()
  let queue = Promise.resolve()

  const load = (parsed) => {
    if (!parsed || typeof parsed !== 'object') return
    const sites = Array.isArray(parsed.sites) ? parsed.sites : []
    const seen = new Set()
    state.sites = sites
      .map((entry) => normaliseSite(entry, reserved))
      .filter((entry) => {
        if (!entry) return false
        if (seen.has(entry.id)) return false
        seen.add(entry.id)
        return true
      })
      .slice(0, MAX_CUSTOM)
    state.pins = Array.isArray(parsed.pins)
      ? parsed.pins.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()).slice(0, MAX_PINS)
      : []
    state.recent = Array.isArray(parsed.recent)
      ? parsed.recent
        .filter((item) => item && typeof item.id === 'string')
        .map((item) => ({
          id: item.id,
          at: Number.isFinite(item.at) ? item.at : Date.now(),
          name: text(item.name, 40),
          url: safeUrl(item.url) || '',
        }))
        .filter((item) => item.url)
        .slice(0, MAX_RECENT)
      : []
    state.engine = typeof parsed.engine === 'string' ? parsed.engine.slice(0, 24) : 'metaso'
    state.lastQuery = text(parsed.lastQuery, 200)
  }

  try {
    await mkdir(directory, { recursive: true })
    load(JSON.parse(await readFile(file, 'utf8')))
  } catch {
    /* first run, or an unreadable file: start empty */
  }

  const persist = () => {
    const snapshot = JSON.stringify(state, null, 2)
    queue = queue.then(async () => {
      const temp = file + '.' + process.pid + '.tmp'
      try {
        await writeFile(temp, snapshot, 'utf8')
        await rename(temp, file)
      } catch {
        /* disk trouble must not take the page down */
      }
    })
    return queue
  }

  const find = (id) => state.sites.find((entry) => entry.id === id) || null

  return {
    /** Every custom site, newest first. */
    sites() {
      return state.sites.map((entry) => ({ ...entry, tags: entry.tags.slice() }))
    },
    get(id) {
      const found = find(id)
      return found ? { ...found, tags: found.tags.slice() } : null
    },

    /**
     * Add or update a custom site.
     *
     * Identity is the normalised URL, not the name: re-adding the same link
     * after renaming it must update the entry instead of stacking duplicates.
     *
     * @param {object} entry
     * @returns {Promise<object|null>} the stored entry, or null when invalid.
     */
    async addSite(entry) {
      const shaped = normaliseSite(entry, reserved)
      if (!shaped) return null
      const existing = state.sites.findIndex((item) => item.url === shaped.url || item.id === shaped.id)
      if (existing >= 0) {
        const previous = state.sites[existing]
        state.sites[existing] = {
          ...shaped,
          id: previous.id,
          createdAt: previous.createdAt,
          pinned: previous.pinned,
        }
        await persist()
        return { ...state.sites[existing] }
      }
      if (state.sites.length >= MAX_CUSTOM) {
        throw new Error('自定义站点最多 ' + MAX_CUSTOM + ' 个，请先删掉一些')
      }
      state.sites.push(shaped)
      await persist()
      return { ...shaped }
    },

    /** Remove a custom site by id and drop it from pins and recents. */
    async removeSite(id) {
      const before = state.sites.length
      state.sites = state.sites.filter((entry) => entry.id !== id)
      state.pins = state.pins.filter((pin) => pin !== id)
      state.recent = state.recent.filter((item) => item.id !== id)
      const removed = state.sites.length < before
      if (removed) await persist()
      return removed
    },

    /* ---- pins ----------------------------------------------------------- */

    pins() {
      return state.pins.slice()
    },

    /**
     * Pin or unpin one entry. Pins are the page's only ordering the user
     * controls directly, so they stay a plain ordered list of ids.
     *
     * An id that names nothing is refused rather than stored: a dangling pin
     * renders as an empty gap on the board, which looks like a bug in the page.
     */
    async setPin(id, pinned) {
      const key = text(id, 48)
      if (!key) return state.pins.slice()
      if (!isKnown(key)) return state.pins.slice()
      const has = state.pins.includes(key)
      if (pinned && !has) {
        state.pins = [key, ...state.pins].slice(0, MAX_PINS)
      } else if (!pinned && has) {
        state.pins = state.pins.filter((pin) => pin !== key)
      }
      if (pinned !== has) await persist()
      return state.pins.slice()
    },

    /* ---- recents -------------------------------------------------------- */

    recents() {
      return state.recent.map((item) => ({ ...item }))
    },

    /**
     * Record one visit. Recents are a set of ids with a timestamp, so clicking
     * the same tile ten times leaves one row at the top rather than ten.
     */
    async recordVisit(entry) {
      const url = safeUrl(entry && entry.url)
      const id = text(entry && entry.id, 48)
      if (!url || !id) return state.recent.map((item) => ({ ...item }))
      state.recent = [
        { id, at: Date.now(), name: text(entry.name, 40), url },
        ...state.recent.filter((item) => item.id !== id),
      ].slice(0, MAX_RECENT)
      await persist()
      return state.recent.map((item) => ({ ...item }))
    },

    async clearRecents() {
      state.recent = []
      await persist()
      return []
    },

    /* ---- settings ------------------------------------------------------- */

    settings() {
      return { engine: state.engine, lastQuery: state.lastQuery }
    },

    async setSettings(patch) {
      if (patch && typeof patch.engine === 'string' && patch.engine.trim()) {
        state.engine = text(patch.engine, 24)
      }
      if (patch && typeof patch.lastQuery === 'string') {
        state.lastQuery = text(patch.lastQuery, 200)
      }
      await persist()
      return { engine: state.engine, lastQuery: state.lastQuery }
    },

    snapshot() {
      return JSON.parse(JSON.stringify(state))
    },
  }
}
