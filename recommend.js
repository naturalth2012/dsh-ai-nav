/**
 * "我有一个需求，该用哪个" — turning a sentence into a short, explained stack.
 *
 * A directory answers "where is X". This module answers the question people
 * actually have: they do not know the name of the tool yet. It is a rules
 * engine, not a model call, so every pick can cite the signal that produced it
 * and a wrong answer is arguable instead of mysterious.
 *
 * The scoring rests on one idea: **a longer matched phrase is a more specific
 * signal.** "知识库" says far more about what someone needs than "问答" does, and
 * without that rule a request like "给团队搭个内部文档问答的知识库" is dominated
 * by the generic words in it and recommends an office suite. So each scenario
 * declares the phrases that trigger it, and a scenario's weight is its longest
 * matched phrase relative to the longest phrase matched anywhere in the request.
 *
 * @module dsh-ai-nav/recommend
 */

import { searchDirectory, normalize } from './search.js'

/**
 * Scenario rules.
 *
 * `cats` is the part of the directory the need belongs to, `tags` are the
 * attributes that make a tool a good fit, `role` names the slot the pick fills
 * in the stack, and `keywords` are the phrases that trigger the scenario — list
 * the *specific* ones ("知识库") alongside the generic ("问答"), because the
 * length rule above decides which one wins.
 */
export const SCENARIOS = [
  {
    id: 'kb',
    label: '搭个人 / 团队知识库',
    hint: '把自己或团队的文档灌进去，之后能提问',
    role: '知识库',
    cats: ['kb'],
    tags: ['RAG', '开源', '可自部署', '文档问答', '团队', '个人知识库'],
    keywords: [
      '知识库', '知识管理', '文档问答', '文档检索', '内部文档', '内部资料', '语料', '资料库',
      '客服机器人', '问答机器人', 'rag', 'knowledge base', '向量库', '私有部署',
    ],
  },
  {
    id: 'paper',
    label: '读论文 / 学术检索',
    hint: '要找论文、看懂论文、摸清引用脉络',
    role: '文献',
    cats: ['learn', 'search'],
    tags: ['论文', '引用', '综述', '图谱', '文献'],
    keywords: ['论文', '文献', '期刊', '学术', '引用', '综述', '科研', 'paper', 'arxiv', 'thesis', '读博', '毕业设计'],
  },
  {
    id: 'image',
    label: '出图 / 做视频',
    hint: '需要能出图、出片，或者搭一套出图工作流',
    role: '生成',
    cats: ['create'],
    tags: ['图', '视频', '模型', 'SD', '工作流', '音乐'],
    keywords: [
      '短视频', '数字人', '文生图', '图片生成', '视频生成', '出图', '画图', '绘图', '插画', '海报',
      'logo', '封面', '配乐', '配音', '视频', '做片', 'image', 'video', 'midjourney', 'stable diffusion',
    ],
  },
  {
    id: 'office',
    label: '写文档 / 做 PPT',
    hint: '要在现成的办公流程里把活干完',
    role: '办公',
    cats: ['office'],
    // 「会议」「转写」belong here: a meeting-summary request is an office task,
    // and the tools that answer it (通义听悟, 飞书, 钉钉) tag themselves that way.
    tags: ['PPT', '文档', '表格', '翻译', '演示', '协作', '会议', '转写', '办公', 'Agent'],
    keywords: ['ppt', '幻灯片', '演示文稿', '做表', '表格', 'excel', '周报', '会议纪要', '会议', '简历', '排版', '翻译', 'slide'],
  },
  {
    id: 'agent',
    label: '搭 Agent / 接 API',
    hint: '要把模型接进自己的系统，或者搭一条自动流程',
    role: '开发平台',
    cats: ['dev', 'kb'],
    tags: ['API', '工作流', 'Agent', 'Bot', '低代码', '开源', '可自部署'],
    keywords: [
      '智能体', '工作流', '机器人流程', '接入模型', '调用模型', 'api', 'openapi', 'mcp', '自动化',
      '低代码', 'agent', 'bot', '插件开发', '私有化',
    ],
  },
  {
    id: 'code',
    label: '写代码 / 做产品',
    hint: '需要一个能改全库、能跑起来的编程环境',
    role: '编程',
    cats: ['dev'],
    tags: ['编辑器', 'Agent', '补全', '前端', '全栈'],
    keywords: [
      '写代码', '改代码', '重构', '编程', '编辑器', 'ide', 'debug', '前端', '后端', '全栈',
      '小程序', '产品原型', 'code', 'coding', 'vibe coding',
    ],
  },
  {
    id: 'research',
    label: '查资料 / 做调研',
    hint: '要能给出处、能顺着线索往下查的东西',
    role: '搜索与深研',
    cats: ['search'],
    tags: ['引用', '深研', '报告', '论文', '无广告'],
    keywords: [
      '调研', '查资料', '行业研究', '竞品', '市场分析', '写报告', '深度研究', '查一下', '搜索',
      'research', 'deep research', 'search',
    ],
  },
  {
    id: 'model',
    label: '找模型 / 找社区',
    hint: '想找现成模型、权重、别人的做法',
    role: '模型社区',
    cats: ['hub'],
    tags: ['模型', '数据集', '社区', '作品'],
    keywords: ['模型下载', '权重', '开源模型', 'lora', '数据集', '模型社区', '作品', 'huggingface', 'modelscope'],
  },
  {
    id: 'ask',
    label: '日常问答 / 写作',
    hint: '想要一个能一直聊下去、写得像人话的助手',
    role: '对话助手',
    cats: ['chat'],
    tags: ['写作', '长文本', '多模态', '语音'],
    keywords: [
      '问答', '聊天', '对话', '写作', '润色', '改写', '起稿', '写文章', '写文案', '总结一下',
      '陪聊', 'chat', '写作助手',
    ],
  },
]

const SCENARIO_BY_ID = Object.fromEntries(SCENARIOS.map((scenario) => [scenario.id, scenario]))

/**
 * Which scenarios a sentence triggers, and how strongly.
 *
 * The strength is the length of the longest matched keyword, which is the whole
 * specificity heuristic in one number. Ties are broken by declaration order, so
 * the more targeted scenario (declared earlier) wins.
 *
 * @param {string} need
 * @returns {{scenario: object, strength: number, terms: string[]}[]} strongest first
 */
export function matchScenarios(need) {
  const text = normalize(need)
  if (!text) return []
  const scored = []
  SCENARIOS.forEach((scenario, index) => {
    const terms = scenario.keywords.filter((keyword) => text.includes(normalize(keyword)))
    if (terms.length === 0) return
    const strength = Math.max(...terms.map((keyword) => normalize(keyword).length))
    scored.push({ scenario, strength, terms, index })
  })
  scored.sort((a, b) => b.strength - a.strength || a.index - b.index)
  return scored.map(({ scenario, strength, terms }) => ({ scenario, strength, terms }))
}

/** Matches of one scenario within a sentence, used for the "why" text. */
function matchedTerm(scenario, text) {
  const found = scenario.keywords
    .map((keyword) => ({ keyword, normalized: normalize(keyword) }))
    .filter((item) => text.includes(item.normalized))
    .sort((a, b) => b.normalized.length - a.normalized.length)
  return found.length > 0 ? found[0].keyword : null
}

/**
 * Recommend a short stack for a described need.
 *
 * @param {string} need what the user said, in their own words.
 * @param {object[]} sites the full directory (catalogue + custom).
 * @param {{
 *   limit?: number,
 *   region?: 'cn'|'global'|'any',
 *   budget?: 'free'|'paid'|'any',
 *   selfHost?: boolean,
 * }} [options] `selfHost` is a *filter*, not a preference: someone who says the
 *   data may not leave the intranet has not asked for a better-ranked SaaS.
 * @returns {{
 *   need: string,
 *   scenarios: {id:string,label:string,hint:string}[],
 *   picks: {id:string,name:string,url:string,cat:string,role:string,why:string,score:number}[],
 *   note: string,
 * }}
 */
export function recommend(need, sites, options = {}) {
  const text = String(need || '').trim()
  const pool = Array.isArray(sites) ? sites : []
  const limit = Math.max(1, Math.min(8, Number(options.limit) || 4))
  const region = options.region === 'cn' || options.region === 'global' ? options.region : 'any'
  const selfHostOnly = options.selfHost === true

  const matched = matchScenarios(text)

  // No scenario matched: fall back to plain text search, which at least finds
  // the site whose name the user half-remembers.
  if (matched.length === 0) {
    let hits = searchDirectory(text, pool, { limit })
    if (selfHostOnly) hits = hits.filter((hit) => hit.site.selfHost)
    return {
      need: text,
      scenarios: [],
      picks: hits.map(({ site }) => ({
        id: site.id,
        name: site.name,
        url: site.url,
        cat: site.cat,
        role: '匹配',
        why: '名称或标签与「' + text + '」相符',
        score: 0,
      })),
      note: hits.length === 0
        ? '没有匹配到场景，换个说法试试（例如「我要搭个人知识库」「做短视频」）。'
        : '没有识别出具体场景，下面是按名称和标签搜到的结果。',
    }
  }

  const effective = selfHostOnly ? pool.filter((site) => site.selfHost) : pool
  const strongest = matched[0].strength
  const byScenarioId = new Map(matched.map((item) => [item.scenario.id, item]))

  const scored = []
  for (const site of effective) {
    if (region !== 'any' && (site.region || 'global') !== region) continue
    let score = 0
    const reasons = []
    let roleScenario = null
    let roleStrength = -1

    for (const { scenario, strength } of matched) {
      // Weight every scenario by how specific its trigger was, relative to the
      // most specific one in this request.
      const weight = strength / strongest
      const term = matchedTerm(scenario, text)

      if (scenario.cats.includes(site.cat)) {
        score += 55 * weight
        if (strength > roleStrength) {
          roleStrength = strength
          roleScenario = scenario
        }
        if (term && !reasons.some((reason) => reason.startsWith('「' + scenario.label))) {
          reasons.push('你在问「' + term + '」，属于' + scenario.label)
        }
      }

      const hitTags = (site.tags || []).filter((tag) => scenario.tags.includes(tag))
      if (hitTags.length > 0) {
        score += 14 * hitTags.length * weight
        reasons.push('标签 ' + hitTags.join('/'))
      }
    }

    if (score === 0) continue

    if (options.budget === 'free') {
      if ((site.tags || []).some((tag) => /免费/.test(tag))) {
        score += 12
        reasons.push('有免费额度')
      } else if ((site.tags || []).some((tag) => /付费/.test(tag))) {
        score -= 18
      }
    }
    if (site.selfHost) score += 6
    if (site.hot) score += 3

    scored.push({
      site,
      score,
      reasons,
      role: roleScenario ? roleScenario.role : site.cat,
    })
  }

  scored.sort((a, b) => b.score - a.score || (a.site.order || 0) - (b.site.order || 0))

  // Prefer a diverse stack, but never let the cap hide a clearly better answer.
  //
  // Two picks per role keep a stack readable ("内部知识库，数据不能出内网" should
  // show its two real options side by side). A hard skip, though, is wrong when
  // a need matches only one scenario: "写文档 / 做 PPT / 整理会议纪要" is entirely
  // an office question, and dropping the third-best office tool would hand that
  // slot to Kimi at 17 points while 飞书 sits at 83 — a recommendation that
  // visibly ignored the question.
  //
  // So the cap becomes a tie-breaker rather than a filter: from the third entry
  // of a role on, the score loses a fixed share of the *gap* to the leader
  // rather than a flat percentage. 飞书 (83) stays far above Kimi (17), while a
  // marginal third office tool (69 → 69 − 0.5 × (100 − 69) ≈ 54) can still fall
  // behind a strong pick from another role. The leader of each role is untouched.
  const ROLE_OVERFLOW_SHARE = 0.5
  const roleLeaders = new Map()
  for (const item of scored) {
    if (!roleLeaders.has(item.role)) roleLeaders.set(item.role, item.score)
  }
  const roleRanks = new Map()
  const ranked = scored.map((item) => {
    const rank = roleRanks.get(item.role) || 0
    roleRanks.set(item.role, rank + 1)
    if (rank < 2) return { item, adjusted: item.score }
    const leader = roleLeaders.get(item.role) || item.score
    return { item, adjusted: item.score - ROLE_OVERFLOW_SHARE * (leader - item.score) }
  })
  ranked.sort((a, b) => b.adjusted - a.adjusted || (a.item.site.order || 0) - (b.item.site.order || 0))

  const picks = ranked.slice(0, limit).map(({ item }) => {
    const extra = region === 'cn' ? '（国内直连）' : region === 'global' ? '（海外服务）' : ''
    return {
      id: item.site.id,
      name: item.site.name,
      url: item.site.url,
      cat: item.site.cat,
      role: item.role,
      why: item.reasons.slice(0, 3).join('；') + extra,
      score: Math.round(item.score),
    }
  })

  return {
    need: text,
    scenarios: matched.map(({ scenario }) => ({
      id: scenario.id, label: scenario.label, hint: scenario.hint,
    })),
    picks,
    note: buildNote(matched, picks, options),
  }
}

function buildNote(matched, picks, options) {
  if (picks.length === 0) {
    const own = options.selfHost === true ? '可自部署的' : ''
    return matched.length > 0
      ? '识别到场景「' + matched[0].scenario.label + '」，但目录里没有符合条件的' + own + '条目，试着放宽地区或筛选条件。'
      : '没有识别出场景，换个说法试试。'
  }
  const labels = matched.map(({ scenario }) => scenario.label).join('、')
  const parts = ['识别到的场景：' + labels + '。']
  if (picks.length > 1) {
    parts.push('建议的用法是：' + picks.map((pick) => pick.role + '→' + pick.name).join('，') + '。')
  }
  if (options.selfHost === true) parts.push('已只保留可自己部署的条目。')
  if (options.budget === 'free') parts.push('已优先保留有免费额度的条目。')
  if (options.region === 'cn') parts.push('已只保留国内可直接访问的站点。')
  parts.push('目录里的链接都是能直接打开的入口；要长期用，可以在导航页把它们置顶。')
  return parts.join('')
}

/** A short human summary of what a sentence triggered, for the panel's preview. */
export function describeIntent(need) {
  const matched = matchScenarios(need)
  return {
    scenarios: matched.map(({ scenario, terms }) => ({
      id: scenario.id,
      label: scenario.label,
      terms: terms.slice(0, 3),
    })),
    strongest: matched.length > 0 ? matched[0].scenario.id : null,
  }
}

export { SCENARIO_BY_ID }
