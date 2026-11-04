/**
 * AI 导航 — Client half.
 *
 * A `sidebar.panellist` row opens a `main` panel shaped like the old portal
 * directories: one search box at the top, one board of small tiles grouped by
 * category below it. Everything the page shows comes from the Host's
 * `/plugins/ai-nav/directory` payload; nothing is fetched from a third party at
 * render time except the favicons through the Host's icon proxy.
 *
 * The page is dense on purpose. A navigation page that needs scrolling to see
 * twenty links is a page you stop using, so the tiles are small, the type is
 * compact, and the sections are ordered by how often people leave for them.
 */

window.__ModuleLoader__.load({
  id: 'dsh-ai-nav',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'ai-nav'
    const PANEL_ID = 'ai-nav'
    const BASE = '/plugins/ai-nav'
    const DIRECTORY_PATH = BASE + '/directory'
    const SEARCH_PATH = BASE + '/search'
    const SITES_PATH = BASE + '/sites'
    const VISIT_PATH = BASE + '/visit'
    const PINS_PATH = BASE + '/pins'
    const SETTINGS_PATH = BASE + '/settings'
    const RECOMMEND_PATH = BASE + '/recommend'
    const IMPORT_PATH = BASE + '/import'
    const FAVICON_PATH = BASE + '/favicon'

    /* ------------------------------------------------------------------ *
     * Copy
     * ------------------------------------------------------------------ */

    const ZH = {
      nav: 'AI 导航',
      title: 'AI 导航',
      subtitle: '一个页面收齐常用的 AI 站点与知识库：搜一句就能到，点一下就记下来',
      searchPlaceholder: '搜站点名、别名，或直接输入网址；回车用「{engine}」搜全网',
      search: '搜索',
      clear: '清空',
      loading: '正在读取目录…',
      errorTitle: '目录读取失败',
      errorHint: '检查后台是否正常后重试；页面上的链接仍可直接打开',
      retry: '重试',
      searchHere: '用 {engine} 搜索「{q}」',
      openSite: '打开 {name}',
      siteSearch: '站内搜',
      noMatch: '目录里没有匹配的站点，回车会用搜索引擎去查',
      hot: '热门',
      selfHost: '可自部署',
      cn: '国内',
      overseas: '海外',
      pinned: '置顶',
      recent: '最近访问',
      all: '全部',
      add: '添加站点',
      addTitle: '添加一个自己的站点',
      name: '名称',
      namePlaceholder: '例如「公司 Wiki」',
      url: '网址',
      urlPlaceholder: 'https://wiki.example.com',
      desc: '备注',
      descPlaceholder: '一句话说明它用来干什么（可留空）',
      category: '类目',
      uncategorized: '未分类',
      save: '保存',
      saving: '保存中…',
      cancel: '取消',
      remove: '删除',
      removeConfirm: '删除「{name}」？',
      mine: '我的站点',
      mineEmpty: '还没有自定义站点。可以手动添加，也可以把浏览器书签一次导进来。',
      importTitle: '导入浏览器书签',
      importHint: '在浏览器里「导出书签」得到 HTML 文件，选它或直接拖进来；已知站点会自动归类。',
      importPick: '选择文件',
      importRunning: '导入中…',
      importDone: '已导入 {n} 条（解析到 {total} 条）',
      importFailed: '导入失败',
      recommendTitle: '我不知道该用哪个',
      recommendHint: '用自己的话说需求，例如「给团队搭个内部文档问答的知识库」「做短视频不想露脸」',
      recommendPlaceholder: '我想要……',
      recommend: '推荐',
      recommending: '分析中…',
      region: '地区',
      anyRegion: '不限',
      onlyCn: '国内可直连',
      onlyGlobal: '海外服务',
      preferSelfHost: '优先可自部署',
      preferFree: '优先免费',
      why: '为什么',
      role: '用途',
      recommendEmpty: '没有匹配的场景，换个说法再试。',
      engine: '搜索引擎',
      total: '共 {n} 个入口',
      custom: '自定义 {n} 个',
      pinnedCount: '{n} 个',
      recentCount: '{n} 个',
      sources: '目录里的链接都是可直接打开的官方入口',
      pin: '置顶',
      unpin: '取消置顶',
      back: '返回对话',
      updated: '更新于',
      kit: '推荐组合',
    }

    const EN = {
      nav: 'AI Nav',
      title: 'AI Nav',
      subtitle: 'One page for the AI sites and knowledge bases you actually use',
      searchPlaceholder: 'Site name, alias, or a URL; Enter searches the web with {engine}',
      search: 'Search',
      clear: 'Clear',
      loading: 'Loading the directory…',
      errorTitle: 'Could not load the directory',
      errorHint: 'Check the Host and retry; the links shown still open normally',
      retry: 'Retry',
      searchHere: 'Search “{q}” with {engine}',
      openSite: 'Open {name}',
      siteSearch: 'On-site',
      noMatch: 'No matching site; Enter runs a web search',
      hot: 'Popular',
      selfHost: 'Self-host',
      cn: 'China',
      overseas: 'Global',
      pinned: 'Pinned',
      recent: 'Recent',
      all: 'All',
      add: 'Add site',
      addTitle: 'Add your own site',
      name: 'Name',
      namePlaceholder: 'e.g. Company wiki',
      url: 'URL',
      urlPlaceholder: 'https://wiki.example.com',
      desc: 'Note',
      descPlaceholder: 'One line on what it is for (optional)',
      category: 'Category',
      uncategorized: 'Uncategorised',
      save: 'Save',
      saving: 'Saving…',
      cancel: 'Cancel',
      remove: 'Delete',
      removeConfirm: 'Delete “{name}”?',
      mine: 'My sites',
      mineEmpty: 'No custom sites yet. Add one by hand, or import your bookmarks.',
      importTitle: 'Import browser bookmarks',
      importHint: 'Export bookmarks from your browser to an HTML file, then pick it or drop it here.',
      importPick: 'Choose file',
      importRunning: 'Importing…',
      importDone: 'Imported {n} of {total} parsed',
      importFailed: 'Import failed',
      recommendTitle: 'Not sure which to use',
      recommendHint: 'Describe the need in your own words, e.g. “a team knowledge base over internal docs”',
      recommendPlaceholder: 'I want to…',
      recommend: 'Recommend',
      recommending: 'Thinking…',
      region: 'Region',
      anyRegion: 'Any',
      onlyCn: 'China direct',
      onlyGlobal: 'Global',
      preferSelfHost: 'Prefer self-hosted',
      preferFree: 'Prefer free',
      why: 'Why',
      role: 'Role',
      recommendEmpty: 'No matching scenario; try rephrasing.',
      engine: 'Search engine',
      total: '{n} entries',
      custom: '{n} custom',
      sources: 'Every link here is a working official entry point',
      pin: 'Pin',
      unpin: 'Unpin',
      back: 'Back to chat',
      updated: 'Updated',
      kit: 'Suggested stack',
    }

    /* ------------------------------------------------------------------ *
     * Helpers
     * ------------------------------------------------------------------ */

    function isEnglish(locale) {
      try {
        const language = locale && typeof locale.language === 'string' ? locale.language : ''
        return /^en/i.test(language)
      } catch {
        return false
      }
    }

    function translateWith(locale, fallback, key) {
      try {
        const value = locale && typeof locale.translate === 'function' ? locale.translate(NS, key) : null
        if (typeof value === 'string' && value) return value
      } catch {
        /* fall through */
      }
      return fallback[key] !== undefined ? fallback[key] : key
    }

    function fill(template, vars) {
      let out = String(template || '')
      for (const key of Object.keys(vars || {})) {
        out = out.split('{' + key + '}').join(String(vars[key]))
      }
      return out
    }

    function relativeMinutes(fromMs) {
      const diff = Date.now() - fromMs
      if (!Number.isFinite(diff) || diff < 0) return 0
      return Math.round(diff / 60000)
    }

    /** Normalised text used for the local (instant) tile filter. */
    function fold(text) {
      return String(text === null || text === undefined ? '' : text).toLowerCase()
    }

    function matchesLocal(site, tokens) {
      if (tokens.length === 0) return true
      const haystack = fold([site.name, site.desc, site.host, (site.tags || []).join(' '), site.categoryName].join(' '))
      return tokens.every((token) => haystack.includes(token))
    }

    const CATEGORY_COLORS = {
      chat: '#3d6fd6',
      search: '#0f8a7e',
      kb: '#8a5cd6',
      dev: '#c2603a',
      create: '#c23b74',
      office: '#7a7f28',
      hub: '#2f7d4f',
      learn: '#4b5fa8',
      misc: '#7a8391',
    }

    /** Deterministic accent for a tile's lettered fallback, so it is not random. */
    function hashColor(seed) {
      let hash = 0
      const text = String(seed || '')
      for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) % 360
      return 'hsl(' + hash + ' 42% 46%)'
    }

    /* ------------------------------------------------------------------ *
     * Styles
     * ------------------------------------------------------------------ */

    const CSS = [
      '.ainav-root { display: flex; flex-direction: column; height: 100%; min-height: 0;',
      '  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);',
      '  font-size: 13px; line-height: 20px; }',
      '.ainav-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }',
      '.ainav-inner { width: 100%; max-width: 1180px; margin: 0 auto; padding: 16px 24px 40px;',
      '  box-sizing: border-box; display: flex; flex-direction: column; gap: 14px; }',
      '.ainav-head { display: flex; flex-direction: column; gap: 2px; }',
      '.ainav-title { margin: 0; font-size: 17px; line-height: 24px; font-weight: 600; letter-spacing: 0.2px; }',
      '.ainav-sub { color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }',
      '.ainav-btn { appearance: none; margin: 0; padding: 3px 12px; cursor: pointer; font: inherit;',
      '  border: 1px solid var(--dsw-alias-border-l1); border-radius: 999px; font-size: 12px; line-height: 18px;',
      '  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); }',
      '.ainav-btn:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }',
      '.ainav-btn:disabled { opacity: 0.5; cursor: default; }',
      '.ainav-btn-primary { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);',
      '  color: var(--dsw-alias-bg-base); }',
      '.ainav-btn-primary:hover { color: var(--dsw-alias-bg-base); opacity: 0.92; }',
      '.ainav-btn-sm { padding: 1px 9px; font-size: 11px; line-height: 17px; }',
      '.ainav-btn:focus-visible, .ainav-input:focus-visible, .ainav-chip:focus-visible, .ainav-tile:focus-visible {',
      '  outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }',
      '.ainav-card { border: 1px solid var(--dsw-alias-border-l1); border-radius: 12px;',
      '  background: var(--dsw-alias-bg-layer-1); padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }',
      '.ainav-card-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }',
      '.ainav-card-title { font-size: 12.5px; font-weight: 600; }',
      '.ainav-card-hint { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }',

      /* search */
      '.ainav-search { position: relative; display: flex; flex-direction: column; gap: 8px; }',
      '.ainav-search-row { display: flex; gap: 7px; align-items: center; }',
      '.ainav-search-box { position: relative; flex: 1 1 auto; display: flex; align-items: center; }',
      '.ainav-search-icon { position: absolute; left: 11px; display: flex; color: var(--dsw-alias-label-secondary); pointer-events: none; }',
      '.ainav-input { appearance: none; width: 100%; font: inherit; font-size: 13px; line-height: 20px;',
      '  padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;',
      '  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); box-sizing: border-box; }',
      '.ainav-input-search { padding-left: 34px; padding-right: 12px; }',
      '.ainav-input::placeholder { color: var(--dsw-alias-label-secondary); }',
      '.ainav-suggest { position: absolute; z-index: 30; top: calc(100% + 4px); left: 0; right: 0;',
      '  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1)); border: 1px solid var(--dsw-alias-border-l1);',
      '  border-radius: 10px; box-shadow: 0 10px 26px rgba(0,0,0,0.16); overflow: hidden; }',
      '.ainav-suggest-item { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left;',
      '  padding: 7px 11px; border: none; background: none; cursor: pointer; font: inherit; font-size: 12.5px;',
      '  color: var(--dsw-alias-label-primary); }',
      '.ainav-suggest-item[data-active="true"], .ainav-suggest-item:hover { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12)); }',
      '.ainav-suggest-primary { font-weight: 600; }',
      '.ainav-suggest-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; }',
      '.ainav-suggest-tail { margin-left: auto; display: flex; gap: 6px; align-items: center; }',
      '.ainav-suggest-back { color: var(--dsw-alias-label-secondary); font-size: 11px; padding: 0 4px; }',
      '.ainav-engines { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }',
      '.ainav-engines-label { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-right: 2px; }',
      '.ainav-chip { appearance: none; cursor: pointer; font: inherit; font-size: 11px; line-height: 17px;',
      '  padding: 1px 9px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);',
      '  background: transparent; color: var(--dsw-alias-label-secondary); }',
      '.ainav-chip[data-on="true"] { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary);',
      '  color: var(--dsw-alias-bg-base); }',
      '.ainav-chip:hover[data-on="false"] { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }',

      /* rows and board */
      '.ainav-row { display: flex; flex-direction: column; gap: 7px; }',
      '.ainav-row-head { display: flex; align-items: baseline; gap: 8px; }',
      '.ainav-row-title { font-size: 12.5px; font-weight: 600; }',
      '.ainav-row-note { color: var(--dsw-alias-label-secondary); font-size: 11px; }',
      '.ainav-tiles { display: grid; gap: 7px; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); }',
      '.ainav-tiles-dense { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }',
      '.ainav-tile { position: relative; display: flex; align-items: center; gap: 9px; min-width: 0;',
      '  padding: 8px 9px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;',
      '  background: var(--dsw-alias-bg-layer-1); color: inherit; text-decoration: none; cursor: pointer;',
      '  transition: border-color 120ms ease, transform 120ms ease, background 120ms ease; }',
      '.ainav-tile:hover { border-color: var(--dsw-alias-border-l2); transform: translateY(-1px);',
      '  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-layer-1)); }',
      '.ainav-tile-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }',
      '.ainav-tile-name { font-size: 12.5px; font-weight: 600; line-height: 17px; white-space: nowrap;',
      '  overflow: hidden; text-overflow: ellipsis; }',
      '.ainav-tile-desc { font-size: 10.5px; line-height: 15px; color: var(--dsw-alias-label-secondary);',
      '  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
      '.ainav-tile-badge { position: absolute; top: 4px; right: 5px; font-size: 9px; line-height: 13px;',
      '  color: var(--dsw-alias-label-secondary); }',
      '.ainav-pin { appearance: none; border: none; background: none; cursor: pointer; padding: 0 2px;',
      '  color: var(--dsw-alias-label-secondary); opacity: 0; transition: opacity 120ms ease; font: inherit; }',
      '.ainav-tile:hover .ainav-pin, .ainav-pin[data-on="true"] { opacity: 1; }',
      '.ainav-pin[data-on="true"] { color: var(--dsw-alias-brand-primary); }',
      '.ainav-icon { flex: none; width: 24px; height: 24px; border-radius: 6px; overflow: hidden;',
      '  display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600;',
      '  color: #fff; letter-spacing: 0.2px; }',
      '.ainav-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }',

      /* sections */
      '.ainav-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center;',
      '  border-bottom: 1px solid var(--dsw-alias-border-l1); padding-bottom: 9px; }',
      '.ainav-tab { appearance: none; border: 1px solid transparent; background: none; cursor: pointer;',
      '  font: inherit; font-size: 12px; line-height: 18px; padding: 2px 10px; border-radius: 8px;',
      '  color: var(--dsw-alias-label-secondary); }',
      '.ainav-tab[data-on="true"] { background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.12));',
      '  border-color: var(--dsw-alias-border-l1); color: var(--dsw-alias-label-primary); font-weight: 600; }',
      '.ainav-tab:hover { color: var(--dsw-alias-label-primary); }',
      '.ainav-tab-count { font-size: 10px; color: var(--dsw-alias-label-secondary); margin-left: 3px; }',
      '.ainav-section { display: flex; flex-direction: column; gap: 7px; }',
      '.ainav-section-head { display: flex; align-items: baseline; gap: 8px; }',
      '.ainav-section-bar { width: 3px; height: 13px; border-radius: 2px; transform: translateY(2px); }',
      '.ainav-section-name { font-size: 12.5px; font-weight: 600; }',
      '.ainav-section-blurb { color: var(--dsw-alias-label-secondary); font-size: 11px; }',

      /* recommend */
      '.ainav-rec-form { display: flex; gap: 7px; flex-wrap: wrap; align-items: center; }',
      '.ainav-rec-input { flex: 1 1 260px; min-width: 180px; }',
      '.ainav-rec-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center;',
      '  color: var(--dsw-alias-label-secondary); font-size: 11px; }',
      '.ainav-rec-list { display: flex; flex-direction: column; gap: 6px; }',
      '.ainav-rec { display: flex; gap: 9px; align-items: flex-start; padding: 7px 9px;',
      '  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; }',
      '.ainav-rec-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 auto; }',
      '.ainav-rec-head { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }',
      '.ainav-rec-name { font-weight: 600; font-size: 12.5px; }',
      '.ainav-rec-role { font-size: 10px; line-height: 15px; padding: 0 6px; border-radius: 4px;',
      '  border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); }',
      '.ainav-rec-why { font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary); }',
      '.ainav-rec-note { font-size: 11.5px; line-height: 17px; color: var(--dsw-alias-label-secondary);',
      '  background: var(--dsw-alias-bg-layer-2, rgba(127,127,127,0.07)); border-radius: 7px; padding: 6px 9px; }',
      '.ainav-rec-scenarios { display: flex; gap: 6px; flex-wrap: wrap; }',

      /* mine / forms */
      '.ainav-form { display: grid; gap: 7px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }',
      '.ainav-field { display: flex; flex-direction: column; gap: 3px; min-width: 0; }',
      '.ainav-field-wide { grid-column: 1 / -1; }',
      '.ainav-field-label { font-size: 10.5px; color: var(--dsw-alias-label-secondary); }',
      '.ainav-form-actions { display: flex; gap: 7px; align-items: center; grid-column: 1 / -1; }',
      '.ainav-list { display: flex; flex-direction: column; gap: 5px; }',
      '.ainav-item { display: flex; align-items: center; gap: 8px; padding: 6px 9px;',
      '  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; }',
      '.ainav-item-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1 1 auto; }',
      '.ainav-item-name { font-size: 12px; font-weight: 600; }',
      '.ainav-item-url { font-size: 10.5px; color: var(--dsw-alias-label-secondary); white-space: nowrap;',
      '  overflow: hidden; text-overflow: ellipsis; }',
      '.ainav-btn-danger:hover { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }',
      '.ainav-drop { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; padding: 9px 11px;',
      '  border: 1px dashed var(--dsw-alias-border-l2); border-radius: 9px;',
      '  color: var(--dsw-alias-label-secondary); font-size: 11.5px; }',
      '.ainav-drop[data-over="true"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); }',

      /* states */
      '.ainav-state { display: flex; flex-direction: column; gap: 4px; padding: 16px 2px; }',
      '.ainav-state-title { font-size: 13px; font-weight: 600; }',
      '.ainav-state-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }',
      '.ainav-foot { color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 17px;',
      '  display: flex; gap: 10px; flex-wrap: wrap; align-items: baseline; }',
      '.ainav-error { color: var(--dsw-alias-state-error-primary); font-size: 11.5px; }',
      '.ainav-ok { color: var(--dsw-alias-state-success-primary); font-size: 11.5px; }',
      '@media (max-width: 720px) { .ainav-inner { padding: 12px 12px 30px; } }',
    ].join('\n')

    const STYLE_ID = 'ai-nav'

    function installStyleSheet() {
      const existing = document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]')
      if (existing) return () => {}
      const tag = document.createElement('style')
      tag.dataset.plugin = 'ai-nav'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => {
        if (tag && tag.parentNode) tag.parentNode.removeChild(tag)
      }
    }

    /* ------------------------------------------------------------------ *
     * Small pieces
     * ------------------------------------------------------------------ */

    function Icon(props) {
      const site = props.site
      const [broken, setBroken] = React.useState(false)
      const letter = (site.name || '?').trim().slice(0, 1).toUpperCase()
      if (broken || !props.enabled) {
        return h('span', {
          className: 'ainav-icon',
          style: { background: hashColor(site.host || site.name) },
          'aria-hidden': 'true',
        }, letter)
      }
      return h('span', { className: 'ainav-icon' },
        h('img', {
          src: FAVICON_PATH + '?url=' + encodeURIComponent(site.url),
          alt: '',
          loading: 'lazy',
          decoding: 'async',
          referrerPolicy: 'no-referrer',
          onError: () => setBroken(true),
        }))
    }

    function SiteRow(props) {
      const { site, t } = props
      const pinned = Boolean(props.pinned)
      // A tile always opens the site's own landing page. Searching *inside* a
      // site is a different intent and lives on the search box's suggestion row,
      // where the query being searched for is visible next to it.
      return h('a', {
        className: 'ainav-tile',
        href: site.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: site.desc || site.url,
        onClick: () => props.onOpen(site),
      },
      h(Icon, { site, enabled: props.favicons }),
      h('span', { className: 'ainav-tile-main' },
        h('span', { className: 'ainav-tile-name' }, site.name),
        h('span', { className: 'ainav-tile-desc' }, site.desc || site.host)),
      // The star is the pin toggle. It has to stop both the navigation and the
      // click handler, or pinning a tile would also open the site.
      props.onPin
        ? h('button', {
          type: 'button',
          className: 'ainav-pin',
          'data-on': pinned ? 'true' : 'false',
          title: pinned ? t('unpin') : t('pin'),
          'aria-label': pinned ? t('unpin') : t('pin'),
          'aria-pressed': pinned ? 'true' : 'false',
          onClick: (event) => {
            event.preventDefault()
            event.stopPropagation()
            props.onPin(site, !pinned)
          },
        }, pinned ? '★' : '☆')
        : (site.hot ? h('span', { className: 'ainav-tile-badge', title: t('hot') }, '★') : null))
    }

    function EngineChips(props) {
      const { engines, value, onChange, t } = props
      return h('div', { className: 'ainav-engines' },
        h('span', { className: 'ainav-engines-label' }, t('engine')),
        engines.map((engine) => h('button', {
          key: engine.id,
          type: 'button',
          className: 'ainav-chip',
          'data-on': engine.id === value ? 'true' : 'false',
          'aria-pressed': engine.id === value,
          onClick: () => onChange(engine.id),
        }, engine.name)))
    }

    /**
     * Search box with a local suggestion list.
     *
     * The list never waits on the network: the whole directory is already in
     * memory, so each keystroke re-ranks a few dozen objects. Only the "search
     * the web" row leaves the page.
     */
    function SearchBox(props) {
      const { data, t, onOpenSearch, onOpenSite } = props
      const [value, setValue] = React.useState(data.settings ? data.settings.lastQuery : '')
      const [active, setActive] = React.useState(0)
      const [open, setOpen] = React.useState(false)
      const inputRef = React.useRef(null)

      const engine = data.engines.find((item) => item.id === data.engine) || data.engines[0] || { name: '', q: '' }
      const tokens = fold(value).split(/\s+/).filter(Boolean)
      const matches = tokens.length === 0 ? [] : data.sites
        .filter((site) => matchesLocal(site, tokens))
        .slice(0, 7)

      // One row for the web search, then one per matching site.
      const rows = React.useMemo(() => {
        if (tokens.length === 0) return []
        const list = [{ kind: 'search', key: 'search' }]
        for (const site of matches) list.push({ kind: 'site', key: site.id, site })
        return list
      }, [value, data.sites.length])

      React.useEffect(() => { setActive(0) }, [value])

      const submit = (row) => {
        const choice = row || rows[active] || rows[0]
        if (!choice) return
        if (choice.kind === 'search') {
          onOpenSearch(value, engine)
        } else {
          onOpenSite(choice.site)
        }
        setOpen(false)
      }

      const onKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setOpen(true)
          setActive((index) => Math.min(rows.length - 1, index + 1))
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          setActive((index) => Math.max(0, index - 1))
        } else if (event.key === 'Enter') {
          event.preventDefault()
          submit(rows[active])
        } else if (event.key === 'Escape') {
          setOpen(false)
        }
      }

      return h('div', { className: 'ainav-search' },
        h('div', { className: 'ainav-search-row' },
          h('div', { className: 'ainav-search-box' },
            h('span', { className: 'ainav-search-icon', 'aria-hidden': 'true' },
              h('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none' },
                h('circle', { cx: 11, cy: 11, r: 7, stroke: 'currentColor', strokeWidth: 1.8 }),
                h('path', { d: 'm16.5 16.5 4 4', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }))),
            h('input', {
              ref: inputRef,
              className: 'ainav-input ainav-input-search',
              type: 'text',
              value,
              placeholder: fill(t('searchPlaceholder'), { engine: engine.name }),
              'aria-label': t('search'),
              autoComplete: 'off',
              spellCheck: false,
              onChange: (event) => { setValue(event.target.value); setOpen(true) },
              onFocus: () => setOpen(true),
              onBlur: () => window.setTimeout(() => setOpen(false), 120),
              onKeyDown,
            }),
            open && tokens.length > 0
              ? h('div', { className: 'ainav-suggest', role: 'listbox' },
                rows.map((row, index) => {
                  if (row.kind === 'search') {
                    return h('button', {
                      key: row.key,
                      type: 'button',
                      className: 'ainav-suggest-item ainav-suggest-primary',
                      'data-active': index === active ? 'true' : 'false',
                      onMouseDown: (event) => { event.preventDefault(); submit(row) },
                      onMouseEnter: () => setActive(index),
                    },
                    h('span', null, fill(t('searchHere'), { engine: engine.name, q: value.trim() })),
                    h('span', { className: 'ainav-suggest-tail' }, h('span', { className: 'ainav-suggest-sub' }, '↵')))
                  }
                  const site = row.site
                  return h('button', {
                    key: row.key,
                    type: 'button',
                    className: 'ainav-suggest-item',
                    'data-active': index === active ? 'true' : 'false',
                    onMouseDown: (event) => { event.preventDefault(); submit(row) },
                    onMouseEnter: () => setActive(index),
                  },
                  h(Icon, { site, enabled: props.favicons }),
                  h('span', { className: 'ainav-tile-main' },
                    h('span', null, site.name),
                    h('span', { className: 'ainav-suggest-sub' }, site.desc || site.url)),
                  h('span', { className: 'ainav-suggest-tail' },
                    site.q ? h('span', {
                      className: 'ainav-chip',
                      role: 'button',
                      title: t('siteSearch'),
                      onMouseDown: (event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onOpenSearch(value, engine, site)
                        setOpen(false)
                      },
                    }, t('siteSearch')) : null,
                    h('span', { className: 'ainav-suggest-back' }, '↗')))
                }),
                matches.length === 0
                  ? h('div', { className: 'ainav-suggest-item ainav-suggest-sub' }, t('noMatch'))
                  : null)
              : null),
          h('button', {
            type: 'button',
            className: 'ainav-btn ainav-btn-primary',
            onClick: () => submit(rows[active]),
          }, t('search'))),
        h(EngineChips, {
          engines: data.engines,
          value: engine.id,
          t,
          onChange: (id) => props.onEngine(id),
        }))
    }

    function RecommendBox(props) {
      const { t, onOpen } = props
      const [need, setNeed] = React.useState('')
      const [region, setRegion] = React.useState('any')
      const [selfHost, setSelfHost] = React.useState(false)
      const [free, setFree] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [result, setResult] = React.useState(null)
      const [error, setError] = React.useState(null)
      const alive = React.useRef(true)
      React.useEffect(() => () => { alive.current = false }, [])

      const run = () => {
        const text = need.trim()
        if (!text) return
        setBusy(true)
        setError(null)
        const params = new URLSearchParams({ need: text, region, limit: '4' })
        if (selfHost) params.set('selfHost', '1')
        if (free) params.set('budget', 'free')
        fetch(RECOMMEND_PATH + '?' + params.toString(), {
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
        })
          .then((response) => response.json().then((body) => {
            if (!response.ok || (body && body.error)) throw new Error((body && body.error) || ('HTTP ' + response.status))
            return body
          }))
          .then((body) => { if (alive.current) setResult(body) })
          .catch((cause) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)) })
          .finally(() => { if (alive.current) setBusy(false) })
      }

      const picks = result && Array.isArray(result.picks) ? result.picks : []

      return h('div', { className: 'ainav-card' },
        h('div', { className: 'ainav-card-head' },
          h('span', { className: 'ainav-card-title' }, t('recommendTitle')),
          h('span', { className: 'ainav-card-hint' }, t('recommendHint'))),
        h('div', { className: 'ainav-rec-form' },
          h('input', {
            className: 'ainav-input ainav-rec-input',
            type: 'text',
            value: need,
            placeholder: t('recommendPlaceholder'),
            onChange: (event) => setNeed(event.target.value),
            onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); run() } },
          }),
          h('button', {
            type: 'button',
            className: 'ainav-btn ainav-btn-primary',
            disabled: busy || need.trim().length === 0,
            onClick: run,
          }, busy ? t('recommending') : t('recommend'))),
        h('div', { className: 'ainav-rec-filters' },
          h('span', null, t('region')),
          h('button', {
            type: 'button', className: 'ainav-chip', 'data-on': region === 'any' ? 'true' : 'false',
            onClick: () => setRegion('any'),
          }, t('anyRegion')),
          h('button', {
            type: 'button', className: 'ainav-chip', 'data-on': region === 'cn' ? 'true' : 'false',
            onClick: () => setRegion('cn'),
          }, t('onlyCn')),
          h('button', {
            type: 'button', className: 'ainav-chip', 'data-on': region === 'global' ? 'true' : 'false',
            onClick: () => setRegion('global'),
          }, t('onlyGlobal')),
          h('button', {
            type: 'button', className: 'ainav-chip', 'data-on': selfHost ? 'true' : 'false',
            onClick: () => setSelfHost(!selfHost),
          }, t('preferSelfHost')),
          h('button', {
            type: 'button', className: 'ainav-chip', 'data-on': free ? 'true' : 'false',
            onClick: () => setFree(!free),
          }, t('preferFree'))),
        error ? h('div', { className: 'ainav-error' }, error) : null,
        result
          ? h(React.Fragment, null,
            result.scenarios && result.scenarios.length > 0
              ? h('div', { className: 'ainav-rec-scenarios' },
                result.scenarios.map((scenario) => h('span', {
                  key: scenario.id, className: 'ainav-rec-role', title: scenario.hint,
                }, scenario.label)))
              : null,
            picks.length > 0
              ? h('div', { className: 'ainav-rec-list' },
                picks.map((pick) => {
                  const site = { name: pick.name, url: pick.url, host: pick.url.replace(/^https?:\/\//, '').split('/')[0], desc: pick.why }
                  return h('a', {
                    key: pick.id,
                    className: 'ainav-rec',
                    href: pick.url,
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    onClick: () => onOpen(site),
                    style: { textDecoration: 'none', color: 'inherit' },
                  },
                  h(Icon, { site, enabled: props.favicons }),
                  h('span', { className: 'ainav-rec-main' },
                    h('span', { className: 'ainav-rec-head' },
                      h('span', { className: 'ainav-rec-name' }, pick.name),
                      h('span', { className: 'ainav-rec-role' }, pick.role)),
                    h('span', { className: 'ainav-rec-why' }, t('why') + '：' + pick.why)))
                }))
              : h('div', { className: 'ainav-state-hint' }, t('recommendEmpty')),
            result.note ? h('div', { className: 'ainav-rec-note' }, result.note) : null)
          : null)
    }

    function MinePanel(props) {
      const { t, data, onChanged } = props
      const [form, setForm] = React.useState({ name: '', url: '', desc: '', cat: 'misc' })
      const [busy, setBusy] = React.useState(false)
      const [message, setMessage] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [importing, setImporting] = React.useState(false)
      const [over, setOver] = React.useState(false)
      const alive = React.useRef(true)
      React.useEffect(() => () => { alive.current = false }, [])

      const custom = data.sites.filter((site) => site.kind === 'custom')

      const save = () => {
        if (!form.url.trim()) {
          setError(t('url') + '：' + t('urlPlaceholder'))
          return
        }
        setBusy(true)
        setError(null)
        setMessage(null)
        fetch(SITES_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ name: form.name, url: form.url, desc: form.desc, cat: form.cat }),
        })
          .then((response) => response.json().then((body) => {
            if (!response.ok || (body && body.error)) throw new Error((body && body.error) || ('HTTP ' + response.status))
            return body
          }))
          .then(() => {
            if (!alive.current) return
            setForm({ name: '', url: '', desc: '', cat: 'misc' })
            onChanged()
          })
          .catch((cause) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)) })
          .finally(() => { if (alive.current) setBusy(false) })
      }

      const remove = (site) => {
        if (!window.confirm(fill(t('removeConfirm'), { name: site.name }))) return
        fetch(SITES_PATH + '?id=' + encodeURIComponent(site.id), {
          method: 'DELETE',
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
        })
          .then((response) => (response.ok ? response.json() : Promise.reject(new Error('HTTP ' + response.status))))
          .then(() => { if (alive.current) onChanged() })
          .catch((cause) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)) })
      }

      const doImport = (text) => {
        if (!text || !text.trim()) return
        setImporting(true)
        setError(null)
        setMessage(null)
        fetch(IMPORT_PATH, {
          method: 'POST',
          headers: { 'content-type': 'text/html', accept: 'application/json' },
          credentials: 'same-origin',
          body: text,
        })
          .then((response) => response.json().then((body) => {
            if (!response.ok || (body && body.error)) throw new Error((body && body.error) || ('HTTP ' + response.status))
            return body
          }))
          .then((body) => {
            if (!alive.current) return
            setMessage(fill(t('importDone'), { n: body.imported, total: body.parsed }))
            onChanged()
          })
          .catch((cause) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)) })
          .finally(() => { if (alive.current) setImporting(false) })
      }

      const onFile = (file) => {
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => doImport(String(reader.result || ''))
        reader.onerror = () => setError(t('importFailed'))
        reader.readAsText(file, 'utf-8')
      }

      const dropProps = {
        className: 'ainav-drop',
        'data-over': over ? 'true' : 'false',
        onDragOver: (event) => { event.preventDefault(); setOver(true) },
        onDragLeave: () => setOver(false),
        onDrop: (event) => {
          event.preventDefault()
          setOver(false)
          const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null
          onFile(file)
        },
      }

      return h('div', { className: 'ainav-card' },
        h('div', { className: 'ainav-card-head' },
          h('span', { className: 'ainav-card-title' }, t('addTitle')),
          h('span', { className: 'ainav-card-hint' }, t('mineEmpty'))),

        h('div', { className: 'ainav-form' },
          h('label', { className: 'ainav-field' },
            h('span', { className: 'ainav-field-label' }, t('name')),
            h('input', {
              className: 'ainav-input', type: 'text', value: form.name,
              placeholder: t('namePlaceholder'),
              onChange: (event) => setForm({ ...form, name: event.target.value }),
            })),
          h('label', { className: 'ainav-field' },
            h('span', { className: 'ainav-field-label' }, t('url')),
            h('input', {
              className: 'ainav-input', type: 'text', value: form.url,
              placeholder: t('urlPlaceholder'),
              onChange: (event) => setForm({ ...form, url: event.target.value }),
              onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); save() } },
            })),
          h('label', { className: 'ainav-field' },
            h('span', { className: 'ainav-field-label' }, t('category')),
            h('select', {
              className: 'ainav-input',
              value: form.cat,
              onChange: (event) => setForm({ ...form, cat: event.target.value }),
            },
            data.categories.map((category) => h('option', { key: category.id, value: category.id }, category.name)),
            h('option', { value: 'misc' }, t('uncategorized')))),
          h('label', { className: 'ainav-field ainav-field-wide' },
            h('span', { className: 'ainav-field-label' }, t('desc')),
            h('input', {
              className: 'ainav-input', type: 'text', value: form.desc,
              placeholder: t('descPlaceholder'),
              onChange: (event) => setForm({ ...form, desc: event.target.value }),
            })),
          h('div', { className: 'ainav-form-actions' },
            h('button', {
              type: 'button', className: 'ainav-btn ainav-btn-primary', disabled: busy, onClick: save,
            }, busy ? t('saving') : t('save')),
            error ? h('span', { className: 'ainav-error' }, error) : null,
            message ? h('span', { className: 'ainav-ok' }, message) : null)),

        h('div', { className: 'ainav-card-head' },
          h('span', { className: 'ainav-card-title' }, t('importTitle')),
          h('span', { className: 'ainav-card-hint' }, t('importHint'))),
        h('div', dropProps,
          h('label', { className: 'ainav-btn ainav-btn-sm' },
            importing ? t('importRunning') : t('importPick'),
            h('input', {
              type: 'file',
              accept: '.html,text/html',
              style: { display: 'none' },
              onChange: (event) => {
                const file = event.target.files && event.target.files[0]
                onFile(file)
                event.target.value = ''
              },
            })),
          h('span', null, t('importHint'))),

        custom.length > 0
          ? h('div', { className: 'ainav-list' },
            custom.map((site) => h('div', { key: site.id, className: 'ainav-item' },
              h(Icon, { site, enabled: props.favicons }),
              h('span', { className: 'ainav-item-main' },
                h('span', { className: 'ainav-item-name' }, site.name),
                h('span', { className: 'ainav-item-url' }, site.url)),
              h('button', {
                type: 'button', className: 'ainav-btn ainav-btn-sm ainav-btn-danger',
                onClick: () => remove(site),
              }, t('remove')))))
          : null)
    }

    /* ------------------------------------------------------------------ *
     * Page
     * ------------------------------------------------------------------ */

    function NavPage(props) {
      const { t, onBack } = props
      const [data, setData] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [error, setError] = React.useState(null)
      const [category, setCategory] = React.useState('all')
      const [filter, setFilter] = React.useState('')
      const [query, setQuery] = React.useState('')
      const [showMine, setShowMine] = React.useState(false)
      const alive = React.useRef(true)
      React.useEffect(() => () => { alive.current = false }, [])

      const load = React.useCallback(() => {
        setLoading(true)
        fetch(DIRECTORY_PATH, { headers: { accept: 'application/json' }, credentials: 'same-origin' })
          .then((response) => response.json().then((body) => {
            if (!response.ok || (body && body.error)) throw new Error((body && body.error) || ('HTTP ' + response.status))
            return body
          }))
          .then((body) => {
            if (!alive.current) return
            setData(body)
            setError(null)
          })
          .catch((cause) => { if (alive.current) setError(cause instanceof Error ? cause.message : String(cause)) })
          .finally(() => { if (alive.current) setLoading(false) })
      }, [])

      React.useEffect(() => { load() }, [load])

      const record = React.useCallback((site) => {
        fetch(VISIT_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'same-origin',
          keepalive: true,
          body: JSON.stringify({ id: site.id || site.url, name: site.name, url: site.url }),
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((body) => {
            if (!alive.current || !body || !Array.isArray(body.recents) || !data) return
            setData({ ...data, recents: body.recents })
          })
          .catch(() => {})
      }, [data])

      const openSite = (site) => record(site)

      const togglePin = React.useCallback((site, want) => {
        // Optimistic: the star flips immediately and the row moves with it, so a
        // slow disk write never leaves the board looking unresponsive.
        setData((current) => {
          if (!current) return current
          const pins = Array.isArray(current.pins) ? current.pins : []
          const next = want
            ? (pins.includes(site.id) ? pins : [...pins, site.id])
            : pins.filter((id) => id !== site.id)
          return { ...current, pins: next }
        })
        fetch(PINS_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ id: site.id, pinned: want }),
        })
          .then((response) => (response.ok ? response.json() : null))
          .then((body) => {
            if (!alive.current || !body || !Array.isArray(body.pins)) return
            setData((current) => (current ? { ...current, pins: body.pins } : current))
          })
          .catch(() => {})
      }, [])

      const openSearch = (text, engine, site) => {
        const target = site
          ? site.q.replace('{q}', encodeURIComponent(text))
          : engine.q.replace('{q}', encodeURIComponent(text))
        window.open(target, '_blank', 'noopener,noreferrer')
        if (engine && engine.id && data && data.engine !== engine.id) setEngine(engine.id)
      }

      const setEngine = (id) => {
        setData((current) => (current ? { ...current, engine: id } : current))
        fetch(SETTINGS_PATH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ engine: id }),
        }).catch(() => {})
      }

      if (loading && !data) {
        return h('div', { className: 'ainav-root' },
          h('div', { className: 'ainav-scroll' },
            h('div', { className: 'ainav-inner' },
              h('div', { className: 'ainav-state' },
                h('div', { className: 'ainav-state-title' }, t('loading'))))))
      }

      if (!data) {
        return h('div', { className: 'ainav-root' },
          h('div', { className: 'ainav-scroll' },
            h('div', { className: 'ainav-inner' },
              h('div', { className: 'ainav-state' },
                h('div', { className: 'ainav-state-title' }, t('errorTitle')),
                h('div', { className: 'ainav-state-hint' }, error || t('errorHint')),
                h('div', null, h('button', { type: 'button', className: 'ainav-btn', onClick: load }, t('retry')))))))
      }

      const pins = new Set(data.pins || [])
      const byId = new Map(data.sites.map((site) => [site.id, site]))
      const pinnedSites = (data.pins || []).map((id) => byId.get(id)).filter(Boolean)
      const recentSites = (data.recents || [])
        .map((item) => byId.get(item.id) || { id: item.id, name: item.name, url: item.url, host: item.url, desc: '' })
        .filter(Boolean)
        .slice(0, 8)

      const tokens = fold(filter).split(/\s+/).filter(Boolean)
      const visible = data.sites.filter((site) =>
        (category === 'all' || site.cat === category) && matchesLocal(site, tokens))

      // Sections follow the catalogue's own order; an empty one is dropped so a
      // search never leaves a trail of framed-but-empty boxes.
      const sections = data.categories
        .map((meta) => ({
          meta,
          sites: visible.filter((site) => site.cat === meta.id)
            .sort((a, b) => (Number(b.hot) - Number(a.hot)) || (a.order || 0) - (b.order || 0)),
        }))
        .filter((section) => section.sites.length > 0)

      const misc = visible.filter((site) => !data.categories.some((meta) => meta.id === site.cat))
      if (misc.length > 0) {
        sections.push({
          meta: { id: 'misc', name: t('uncategorized'), blurb: '' },
          sites: misc,
        })
      }

      const countOf = (id) => (id === 'all'
        ? data.sites.length
        : data.sites.filter((site) => site.cat === id).length)

      return h('div', { className: 'ainav-root' },
        h('div', { className: 'ainav-scroll' },
          h('div', { className: 'ainav-inner' },

            h('div', { className: 'ainav-head' },
              h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' } },
                h('h1', { className: 'ainav-title' }, t('title')),
                h('span', { className: 'ainav-sub' }, t('subtitle')),
                h('span', { style: { flex: '1 1 auto' } }),
                onBack ? h('button', { type: 'button', className: 'ainav-btn ainav-btn-sm', onClick: onBack }, t('back')) : null)),

            h(SearchBox, {
              data,
              t,
              favicons: true,
              onOpenSearch: (text, engine) => { setQuery(text); openSearch(text, engine, null) },
              onOpenSite: (site) => { openSite(site); window.open(site.url, '_blank', 'noopener,noreferrer') },
              onEngine: setEngine,
            }),

            h(RecommendBox, { t, favicons: true, onOpen: openSite }),

            pinnedSites.length > 0
              ? h('div', { className: 'ainav-row' },
                h('div', { className: 'ainav-row-head' },
                  h('span', { className: 'ainav-row-title' }, t('pinned')),
                  h('span', { className: 'ainav-row-note' }, t('pinnedCount', { n: pinnedSites.length }))),
                h('div', { className: 'ainav-tiles ainav-tiles-dense' },
                  pinnedSites.map((site) => h(SiteRow, {
                    key: 'pin-' + site.id,
                    site,
                    t,
                    favicons: true,
                    pinned: true,
                    onPin: togglePin,
                    onOpen: openSite,
                  }))))
              : null,

            recentSites.length > 0
              ? h('div', { className: 'ainav-row' },
                h('div', { className: 'ainav-row-head' },
                  h('span', { className: 'ainav-row-title' }, t('recent')),
                  h('span', { className: 'ainav-row-note' }, t('recentCount', { n: recentSites.length }))),
                h('div', { className: 'ainav-tiles ainav-tiles-dense' },
                  recentSites.map((site) => h(SiteRow, {
                    key: 'recent-' + site.id,
                    site,
                    t,
                    favicons: true,
                    pinned: pins.has(site.id),
                    onPin: togglePin,
                    onOpen: openSite,
                  }))))
              : null,

            h('div', { className: 'ainav-tabs' },
              h('button', {
                type: 'button', className: 'ainav-tab', 'data-on': category === 'all' ? 'true' : 'false',
                onClick: () => setCategory('all'),
              }, t('all'), h('span', { className: 'ainav-tab-count' }, countOf('all'))),
              data.categories.map((meta) => h('button', {
                key: meta.id,
                type: 'button',
                className: 'ainav-tab',
                'data-on': category === meta.id ? 'true' : 'false',
                onClick: () => setCategory(meta.id),
              }, meta.name, h('span', { className: 'ainav-tab-count' }, countOf(meta.id)))),
              h('span', { style: { flex: '1 1 auto' } }),
              h('input', {
                className: 'ainav-input', type: 'text', value: filter,
                placeholder: t('search'),
                style: { width: 150, padding: '3px 9px', fontSize: 12 },
                onChange: (event) => setFilter(event.target.value),
              }),
              h('button', {
                type: 'button', className: 'ainav-btn ainav-btn-sm',
                onClick: () => setShowMine(!showMine),
              }, t('add'))),

            showMine ? h(MinePanel, { t, data, favicons: true, onChanged: load }) : null,

            sections.length === 0
              ? h('div', { className: 'ainav-state' },
                h('div', { className: 'ainav-state-title' }, t('noMatch')))
              : sections.map((section) => h('div', { key: section.meta.id, className: 'ainav-section' },
                h('div', { className: 'ainav-section-head' },
                  h('span', {
                    className: 'ainav-section-bar',
                    style: { background: CATEGORY_COLORS[section.meta.id] || CATEGORY_COLORS.misc },
                  }),
                  h('span', { className: 'ainav-section-name' }, section.meta.name),
                  section.meta.blurb ? h('span', { className: 'ainav-section-blurb' }, section.meta.blurb) : null,
                  h('span', { style: { flex: '1 1 auto' } }),
                  h('span', { className: 'ainav-section-blurb' }, section.sites.length)),
                h('div', { className: 'ainav-tiles' },
                  section.sites.map((site) => h(SiteRow, {
                    key: site.id,
                    site,
                    t,
                    favicons: true,
                    pinned: pins.has(site.id),
                    onPin: togglePin,
                    onOpen: openSite,
                  }))))),

            h('div', { className: 'ainav-foot' },
              h('span', null, fill(t('total'), { n: data.sites.length })),
              h('span', null, fill(t('custom'), { n: data.meta ? data.meta.custom : 0 })),
              h('span', null, t('sources'))))))
    }

    /* ------------------------------------------------------------------ *
     * Sidebar icon
     * ------------------------------------------------------------------ */

    function PanelIcon(props) {
      const edge = typeof props.size === 'number' && props.size > 0 ? props.size : 16
      const accent = props.active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-label-secondary)'
      // A 3×3 board of tiles with one lit: the old portal-directory metaphor.
      return h('svg', {
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': 'true',
        style: { display: 'block', color: accent },
      },
      [[3, 3], [10, 3], [17, 3], [3, 10], [10, 10], [17, 10], [3, 17], [10, 17], [17, 17]]
        .map(([x, y], index) => h('rect', {
          key: 'r' + index,
          x, y, width: 4, height: 4, rx: 1.2,
          fill: 'currentColor',
          // One lit tile: the directory's own entry inside a grid of others.
          opacity: index === 4 ? 1 : 0.42,
        })))
    }

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots'],
      apply(ctx) {
        const locale = ctx.get('locale')
        const fallback = isEnglish(locale) ? EN : ZH

        ctx.effect(() => {
          if (!locale || typeof locale.register !== 'function') return undefined
          try {
            return locale.register(NS, { zh: ZH, en: EN })
          } catch {
            return undefined
          }
        }, 'ai-nav: locale')

        ctx.effect(() => installStyleSheet(), 'ai-nav: styles')

        const translate = (key) => translateWith(locale, fallback, key)

        function useLocaleVersion() {
          const [, bump] = React.useReducer((value) => value + 1, 0)
          React.useEffect(() => {
            if (!locale || typeof locale.subscribe !== 'function') return undefined
            return locale.subscribe(() => bump())
          }, [])
        }

        const backToConversation = () => {
          const layout = ctx.get('layout')
          if (layout && typeof layout.selectPanel === 'function') layout.selectPanel(null)
        }

        const Page = () => {
          useLocaleVersion()
          const english = isEnglish(locale)
          return h(NavPage, {
            t: (key) => translateWith(locale, english ? EN : ZH, key),
            onBack: backToConversation,
          })
        }

        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 22,
            label: () => translate('nav'),
          }, PanelIcon))

        ctx.slots.inject('main', () =>
          ctx.slots.register({
            name: 'main',
            key: PANEL_ID,
          }, Page))
      },
    }
  },
})
