/**
 * The directory itself: categories, entries, and the search-engine row.
 *
 * This module is pure data plus one normalisation pass. It is shared by the
 * Host (routes, Tools) and by the Client (the panel imports nothing — it reads
 * the catalogue over the directory route), so it must stay free of Node and
 * browser APIs alike.
 *
 * Two rules keep the list trustworthy:
 *
 * 1. Every `url` is a real, working entry point verified against the live site.
 *    A navigation page whose links 404 is worse than a shorter page.
 * 2. `q` (a deep-link template) is only set where the site genuinely accepts a
 *    query in the URL. Guessing a template produces a broken result page, which
 *    is the single most annoying failure of old-school nav sites; where no
 *    template is known the panel copies the question and opens the site instead.
 *
 * @module dsh-ai-nav/catalog
 */

/** Where the traffic mostly is; the panel groups the same way. */
export const CATEGORIES = [
  {
    id: 'chat',
    name: '对话助手',
    en: 'Assistants',
    blurb: '通用大模型：问一句，答一段',
    color: '#3d6fd6',
  },
  {
    id: 'search',
    name: 'AI 搜索与深研',
    en: 'Search & research',
    blurb: '带出处、能顺着查下去的回答',
    color: '#0f8a7e',
  },
  {
    id: 'kb',
    name: '知识库与笔记',
    en: 'Knowledge bases',
    blurb: '把资料存起来，再让模型读它',
    color: '#8a5cd6',
  },
  {
    id: 'dev',
    name: '编程与 Agent',
    en: 'Code & agents',
    blurb: '写代码、搭应用、接 API',
    color: '#c2603a',
  },
  {
    id: 'create',
    name: '图像与音视频',
    en: 'Image, video, audio',
    blurb: '出图、出片、配乐',
    color: '#c23b74',
  },
  {
    id: 'office',
    name: '办公与文档',
    en: 'Docs & office',
    blurb: '写作、表格、幻灯片、翻译',
    color: '#7a7f28',
  },
  {
    id: 'hub',
    name: '模型与社区',
    en: 'Models & community',
    blurb: '找模型、找作品、找同好',
    color: '#2f7d4f',
  },
  {
    id: 'learn',
    name: '学习与资料',
    en: 'Learning',
    blurb: '论文、百科、手册、工具箱',
    color: '#4b5fa8',
  },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

/**
 * The search box's engines, in display order.
 *
 * `q` is a template with a literal `{q}` placeholder. Every one of these is an
 * official parameter the site still honours, so "在站内搜" never lands on a 404.
 */
export const ENGINES = [
  { id: 'metaso', name: '秘塔', q: 'https://metaso.cn/?q={q}', ai: true },
  { id: 'baidu', name: '百度', q: 'https://www.baidu.com/s?wd={q}' },
  { id: 'bing', name: '必应', q: 'https://www.bing.com/search?q={q}' },
  { id: 'google', name: 'Google', q: 'https://www.google.com/search?q={q}' },
  { id: 'perplexity', name: 'Perplexity', q: 'https://www.perplexity.ai/search?q={q}', ai: true },
  { id: 'zhihu', name: '知乎', q: 'https://www.zhihu.com/search?type=content&q={q}' },
  { id: 'sogou', name: '搜狗', q: 'https://www.sogou.com/web?query={q}' },
  { id: 'so', name: '360', q: 'https://www.so.com/s?q={q}' },
  { id: 'github', name: 'GitHub', q: 'https://github.com/search?q={q}' },
  { id: 'scholar', name: '谷歌学术', q: 'https://scholar.google.com/scholar?q={q}' },
  { id: 'arxiv', name: 'arXiv', q: 'https://arxiv.org/search/?query={q}&searchtype=all' },
  { id: 'wikipedia', name: '维基', q: 'https://zh.wikipedia.org/w/index.php?search={q}' },
]

export const ENGINE_BY_ID = Object.fromEntries(ENGINES.map((e) => [e.id, e]))

/**
 * The directory.
 *
 * `aliases` are what people actually type in the box — pinyin initials, old
 * names, company names — so "ds", "月之暗面" and "doubao" all land somewhere.
 * `selfHost` marks the ones you can run on your own machine, which is the
 * difference between bookmarking a service and owning a knowledge base.
 */
const RAW = [
  /* ---- 对话助手 ------------------------------------------------------- */
  {
    id: 'deepseek', name: 'DeepSeek 对话', url: 'https://chat.deepseek.com', cat: 'chat',
    desc: '深度思考 + 联网搜索，代码与推理是强项',
    tags: ['推理', '代码', '免费'], region: 'cn', hot: true, aliases: ['ds', '深度求索', 'deepseek'],
  },
  {
    id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/', cat: 'chat',
    desc: '字节跳动出品，语音通话、看图、浏览器插件都齐',
    tags: ['语音', '多模态', '免费'], region: 'cn', hot: true, aliases: ['db', 'doubao', '字节'],
  },
  {
    id: 'kimi', name: 'Kimi', url: 'https://www.kimi.com', cat: 'chat',
    desc: '月之暗面，长文档与网页解析，可传整本书',
    tags: ['长文本', '文档', '联网'], region: 'cn', hot: true, aliases: ['km', '月之暗面', 'moonshot'],
  },
  {
    id: 'qianwen', name: '千问', url: 'https://www.qianwen.com', cat: 'chat',
    desc: '阿里通义千问，办公与文档场景结合紧密',
    tags: ['阿里', '办公', '免费'], region: 'cn', aliases: ['qw', '通义', 'tongyi', 'qwen'],
  },
  {
    id: 'yuanbao', name: '腾讯元宝', url: 'https://yuanbao.tencent.com/chat', cat: 'chat',
    desc: '混元 + DeepSeek 双模型，能翻公众号和腾讯文档',
    tags: ['微信', '公众号', '双模型'], region: 'cn', aliases: ['yb', '混元', 'hunyuan'],
  },
  {
    id: 'chatglm', name: '智谱清言', url: 'https://chatglm.cn', cat: 'chat',
    desc: 'GLM 系列，插件与智能体生态完整',
    tags: ['GLM', '智能体'], region: 'cn', aliases: ['zp', '智谱', 'glm', 'zhipu'],
  },
  {
    id: 'xinghuo', name: '讯飞星火', url: 'https://xinghuo.xfyun.cn', cat: 'chat',
    desc: '语音识别与合成见长，教育场景多',
    tags: ['语音', '教育'], region: 'cn', aliases: ['xf', '讯飞', 'spark'],
  },
  {
    id: 'wenxin', name: '文心', url: 'https://wenxin.baidu.com', cat: 'chat',
    desc: '百度文心一言，接百度搜索与百科',
    tags: ['百度', '搜索'], region: 'cn', aliases: ['wx', '文心一言', 'ernie', 'yiyan'],
  },
  {
    id: 'tiangong', name: '天工', url: 'https://www.tiangong.cn', cat: 'chat',
    desc: '昆仑万维，长文本与搜索问答',
    tags: ['搜索', '长文本'], region: 'cn', aliases: ['tg', '昆仑万维'],
  },
  {
    id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', cat: 'chat',
    desc: 'OpenAI，GPT 系列；联网、画图、代码解释器',
    tags: ['GPT', '多模态'], region: 'global', hot: true, aliases: ['gpt', 'openai', 'o1'],
  },
  {
    id: 'claude', name: 'Claude', url: 'https://claude.ai', cat: 'chat',
    desc: 'Anthropic，长文写作与代码审阅口碑最好',
    tags: ['写作', '代码', '长文本'], region: 'global', hot: true, aliases: ['克劳德', 'sonnet', 'anthropic'],
  },
  {
    id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', cat: 'chat',
    desc: 'Google，和搜索、Workspace、图片生成打通',
    tags: ['谷歌', '多模态'], region: 'global', aliases: ['bard', '谷歌'],
  },
  {
    id: 'copilot', name: 'Microsoft Copilot', url: 'https://copilot.microsoft.com', cat: 'chat',
    desc: '微软，接必应搜索与 Windows 系统',
    tags: ['微软', '搜索'], region: 'global', aliases: ['ms', '微软', 'bing chat'],
  },
  {
    id: 'grok', name: 'Grok', url: 'https://grok.com', cat: 'chat',
    desc: 'xAI，实时接入 X（推特）内容',
    tags: ['实时', '推特'], region: 'global', aliases: ['xai', '马斯克'],
  },
  {
    id: 'poe', name: 'Poe', url: 'https://poe.com', cat: 'chat',
    desc: '一个订阅聚合多家模型，适合横向比答案',
    tags: ['聚合', '对比'], region: 'global', aliases: ['quora'],
  },
  {
    id: 'huggingchat', name: 'HuggingChat', url: 'https://huggingface.co/chat', cat: 'chat',
    desc: '开源模型在线试，不用配环境',
    tags: ['开源', '试用'], region: 'global', aliases: ['hf chat'],
  },
  {
    id: 'sensetime', name: '商量', url: 'https://chat.sensetime.com', cat: 'chat',
    desc: '商汤日日新对话助手，多模态能力',
    tags: ['商汤', '多模态'], region: 'cn', aliases: ['st', '日日新'],
  },
  {
    id: 'manus', name: 'Manus', url: 'https://manus.im', cat: 'chat',
    desc: '自主执行任务的通用 Agent，能跑完整个流程再交结果',
    tags: ['Agent', '执行'], region: 'global', hot: true, aliases: ['manus'],
  },

  /* ---- AI 搜索与深研 -------------------------------------------------- */
  {
    id: 'metaso', name: '秘塔 AI 搜索', url: 'https://metaso.cn', cat: 'search',
    desc: '没有广告，答案带引用还能一键生成脑图和大纲',
    tags: ['引用', '无广告', '脑图'], region: 'cn', hot: true,
    aliases: ['mt', '秘塔', 'metaso'], q: 'https://metaso.cn/?q={q}',
  },
  {
    id: 'ncn', name: '纳米 AI 搜索', url: 'https://www.n.cn', cat: 'search',
    desc: '360 的聚合搜索，可直接调多家模型写报告',
    tags: ['聚合', '报告'], region: 'cn', aliases: ['nm', '纳米', '360'],
  },
  {
    id: 'quark', name: '夸克', url: 'https://www.quark.cn', cat: 'search',
    desc: '搜索 + 网盘 + 扫描，移动端体验好',
    tags: ['移动端', '网盘'], region: 'cn', aliases: ['kk', '阿里'],
  },
  {
    id: 'zhida', name: '知乎直答', url: 'https://zhida.zhihu.com', cat: 'search',
    desc: '把知乎的问答与专栏当语料，适合找经验帖',
    tags: ['知乎', '经验'], region: 'cn', aliases: ['zd', '直答'],
  },
  {
    id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', cat: 'search',
    desc: 'AI 搜索的标杆，逐句标注来源，可切模型',
    tags: ['引用', '深研'], region: 'global', hot: true,
    aliases: ['pplx', 'pp'], q: 'https://www.perplexity.ai/search?q={q}',
  },
  {
    id: 'genspark', name: 'Genspark', url: 'https://www.genspark.ai', cat: 'search',
    desc: '一次提问生成整页结果，含表格与对比页',
    tags: ['报告', '聚合'], region: 'global', aliases: ['gs'],
  },
  {
    id: 'you', name: 'You.com', url: 'https://you.com', cat: 'search',
    desc: '可切模型 / 切检索源的搜索工作台',
    tags: ['多模型', '工作台'], region: 'global', aliases: ['you'],
  },
  {
    id: 'phind', name: 'Phind', url: 'https://www.phind.com', cat: 'search',
    desc: '面向开发者，回答里直接给可跑的代码',
    tags: ['开发者', '代码'], region: 'global', aliases: ['ph'],
  },
  {
    id: 'elicit', name: 'Elicit', url: 'https://elicit.com', cat: 'search',
    desc: '把论文做成表格：样本、方法、结论一列列比',
    tags: ['论文', '综述'], region: 'global', aliases: ['ex'],
  },
  {
    id: 'kagi', name: 'Kagi', url: 'https://kagi.com', cat: 'search',
    desc: '付费无广告搜索，可自定义排序与摘要',
    tags: ['付费', '无广告'], region: 'global', aliases: ['kagi'],
  },

  /* ---- 知识库与笔记 --------------------------------------------------- */
  {
    id: 'ima', name: '腾讯 ima', url: 'https://ima.qq.com', cat: 'kb',
    desc: '把公众号、网页、PDF 收进知识库再提问',
    tags: ['个人知识库', '微信'], region: 'cn', hot: true, aliases: ['ima', '知识库', 'ima知识库'],
  },
  {
    id: 'notebooklm', name: 'NotebookLM', url: 'https://notebooklm.google.com', cat: 'kb',
    desc: '长文档灌进去，生成摘要、问答和播客',
    tags: ['文档问答', '播客'], region: 'global', aliases: ['nlm', '谷歌笔记'],
  },
  {
    id: 'dify', name: 'Dify', url: 'https://dify.ai', cat: 'kb',
    desc: '开源 LLM 应用平台，知识库 + 工作流 + API',
    tags: ['开源', '工作流', '可自部署'], region: 'global', selfHost: true,
    aliases: ['df', '工作流'],
  },
  {
    id: 'ragflow', name: 'RAGFlow', url: 'https://ragflow.io', cat: 'kb',
    desc: '深度文档解析的 RAG 引擎，复杂 PDF 友好',
    tags: ['RAG', '开源', '可自部署'], region: 'global', selfHost: true,
    aliases: ['rag', '知识库引擎'],
  },
  {
    id: 'fastgpt', name: 'FastGPT', url: 'https://fastgpt.in', cat: 'kb',
    desc: '国产知识库问答，接入简单，中文文档多',
    tags: ['知识库', '开源'], region: 'cn', selfHost: true, aliases: ['fg'],
  },
  {
    id: 'chatpdf', name: 'ChatPDF', url: 'https://www.chatpdf.com', cat: 'kb',
    desc: '扔一个 PDF 进去直接问，不用注册',
    tags: ['PDF', '轻量'], region: 'global', aliases: ['pdf'],
  },
  {
    id: 'yuque', name: '语雀', url: 'https://www.yuque.com', cat: 'kb',
    desc: '中文团队文档老牌，结构清晰、适合沉淀',
    tags: ['团队', '文档'], region: 'cn', aliases: ['yy', '蚂蚁'],
  },
  {
    id: 'notion', name: 'Notion', url: 'https://www.notion.so', cat: 'kb',
    desc: '块编辑器 + 数据库，AI 写在页面里',
    tags: ['数据库', '协作'], region: 'global', aliases: ['nt'],
  },
  {
    id: 'obsidian', name: 'Obsidian', url: 'https://obsidian.md', cat: 'kb',
    desc: '本地 Markdown 双链笔记，文件归你自己',
    tags: ['本地', '双链'], region: 'global', aliases: ['ob', '黑曜石'],
  },
  {
    id: 'siyuan', name: '思源笔记', url: 'https://b3log.org/siyuan/', cat: 'kb',
    desc: '国产开源本地笔记，块级引用 + 云端同步',
    tags: ['开源', '本地'], region: 'cn', aliases: ['sy'],
  },
  {
    id: 'wolai', name: 'wolai 我来', url: 'https://www.wolai.com', cat: 'kb',
    desc: '块笔记 + 关系图谱，中文排版舒服',
    tags: ['块笔记', '图谱'], region: 'cn', aliases: ['wl', '我来'],
  },
  {
    id: 'flowus', name: 'FlowUs 息流', url: 'https://flowus.cn', cat: 'kb',
    desc: '文档 + 多维表 + 网盘，一体式知识库',
    tags: ['多维表', '一体式'], region: 'cn', aliases: ['fx', '息流'],
  },
  {
    id: 'anythingllm', name: 'AnythingLLM', url: 'https://anythingllm.com', cat: 'kb',
    desc: '本地部署的文档问答，接自己的模型，数据不出机器',
    tags: ['自部署', '本地'], region: 'global', selfHost: true,
    aliases: ['allm', 'anything'],
  },

  /* ---- 编程与 Agent --------------------------------------------------- */
  {
    id: 'agent-qa', name: 'agent-qa', url: 'https://vostride.com', cat: 'dev',
    desc: '自然语言测网页与手机，持久 memidex 记忆与验证式自我改进',
    tags: ['QA', 'Android', 'iOS', 'CLI', 'MCP'], region: 'global', selfHost: true,
    aliases: ['vostride', 'agentqa', '自然语言测试'],
  },
  {
    id: 'cursor', name: 'Cursor', url: 'https://cursor.com', cat: 'dev',
    desc: 'VS Code 内核的 AI 编辑器，全库补全与改写',
    tags: ['编辑器', '补全'], region: 'global', hot: true, aliases: ['cur'],
  },
  {
    id: 'codebuddy', name: 'CodeBuddy', url: 'https://www.codebuddy.cn', cat: 'dev',
    desc: '腾讯云代码助手，IDE 插件 + 独立编辑器，接微信生态',
    tags: ['腾讯', 'IDE', '插件'], region: 'cn', hot: true,
    aliases: ['cb', '腾讯云代码助手', 'copilot'],
  },
  {
    id: 'qoder', name: 'Qoder', url: 'https://qoder.com', cat: 'dev',
    desc: '阿里 Qoder，Agent 式编码，能读整个仓库',
    tags: ['Agent', '阿里'], region: 'global', aliases: ['qd', 'qoder'],
  },
  {
    id: 'trae', name: 'Trae', url: 'https://www.trae.ai', cat: 'dev',
    desc: '字节 AI IDE，中文界面，自带 Agent 模式',
    tags: ['IDE', 'Agent'], region: 'cn', aliases: ['字节ide'],
  },
  {
    id: 'lingma', name: '通义灵码', url: 'https://lingma.aliyun.com', cat: 'dev',
    desc: '阿里编码助手，IDE 插件形态，国内直连',
    tags: ['插件', '阿里'], region: 'cn', aliases: ['lm', '灵码'],
  },
  {
    id: 'comate', name: '文心快码', url: 'https://comate.baidu.com', cat: 'dev',
    desc: '百度编码助手，支持多语言与单测生成',
    tags: ['插件', '百度'], region: 'cn', aliases: ['cm', 'comate'],
  },
  {
    id: 'codegeex', name: 'CodeGeeX', url: 'https://codegeex.cn', cat: 'dev',
    desc: '智谱开源代码模型，插件免费',
    tags: ['开源', '免费'], region: 'cn', aliases: ['cg', 'codegee'],
  },
  {
    id: 'windsurf', name: 'Windsurf', url: 'https://windsurf.com', cat: 'dev',
    desc: 'Agent 式编程环境，强调连续改动的上下文',
    tags: ['Agent', 'IDE'], region: 'global', aliases: ['ws', 'codeium'],
  },
  {
    id: 'cline', name: 'Cline', url: 'https://cline.bot', cat: 'dev',
    desc: '开源 VS Code Agent，可自带模型与 API Key',
    tags: ['开源', '插件'], region: 'global', selfHost: true, aliases: ['cl', 'claude-dev'],
  },
  {
    id: 'aider', name: 'Aider', url: 'https://aider.chat', cat: 'dev',
    desc: '终端里的结对编程，改完自动提交 git',
    tags: ['终端', '开源'], region: 'global', selfHost: true, aliases: ['ad'],
  },
  {
    id: 'github', name: 'GitHub', url: 'https://github.com', cat: 'dev',
    desc: '代码托管与 Copilot 生态，找轮子从这里开始',
    tags: ['开源', '代码'], region: 'global',
    aliases: ['gh'], q: 'https://github.com/search?q={q}',
  },
  {
    id: 'v0', name: 'v0', url: 'https://v0.dev', cat: 'dev',
    desc: 'Vercel，说一句话出 React 界面并直接部署',
    tags: ['前端', '生成'], region: 'global', aliases: ['vercel'],
  },
  {
    id: 'bolt', name: 'Bolt', url: 'https://bolt.new', cat: 'dev',
    desc: '浏览器里直接跑全栈项目，边聊边改',
    tags: ['全栈', '在线'], region: 'global', aliases: ['stackblitz'],
  },
  {
    id: 'lovable', name: 'Lovable', url: 'https://lovable.dev', cat: 'dev',
    desc: '自然语言搭 Web 应用，接 Supabase',
    tags: ['低代码', '生成'], region: 'global', aliases: ['gptengineer'],
  },
  {
    id: 'coze', name: '扣子 Coze', url: 'https://www.coze.cn', cat: 'dev',
    desc: '拖拽搭 Bot，能发到微信、飞书、网页',
    tags: ['Bot', '低代码'], region: 'cn', aliases: ['kz', '扣子', 'bot'],
  },
  {
    id: 'deepseek-platform', name: 'DeepSeek 开放平台', url: 'https://platform.deepseek.com', cat: 'dev',
    desc: 'API 文档、定价与密钥，接入自家应用',
    tags: ['API', '开放平台'], region: 'cn', aliases: ['api', '平台'],
  },
  {
    id: 'zhipu-open', name: '智谱开放平台', url: 'https://www.zhipuai.cn', cat: 'dev',
    desc: 'GLM 系列 API 与智能体开发工具',
    tags: ['API', 'GLM'], region: 'cn', aliases: ['glm api'],
  },
  {
    id: 'minimax', name: 'MiniMax', url: 'https://www.minimax.io', cat: 'dev',
    desc: '海螺背后的模型公司，语音与视频 API',
    tags: ['API', '语音'], region: 'cn', aliases: ['mm', '海螺'],
  },

  /* ---- 图像与音视频 --------------------------------------------------- */
  {
    id: 'jimeng', name: '即梦 AI', url: 'https://jimeng.jianying.com', cat: 'create',
    desc: '字节出图与出片，中文提示词友好',
    tags: ['图', '视频'], region: 'cn', hot: true, aliases: ['jm', '即梦'],
  },
  {
    id: 'kling', name: '可灵 AI', url: 'https://app.klingai.com', cat: 'create',
    desc: '快手视频生成，运镜与物理表现稳定',
    tags: ['视频', '运镜'], region: 'cn', aliases: ['kl', '可灵', 'kuaishou'],
  },
  {
    id: 'wanxiang', name: '通义万相', url: 'https://tongyi.aliyun.com/wanxiang/', cat: 'create',
    desc: '阿里图像与视频生成，免费额度多',
    tags: ['图', '视频', '阿里'], region: 'cn', aliases: ['wx2', '万相', 'wan'],
  },
  {
    id: 'hailuo', name: '海螺 AI', url: 'https://hailuoai.com', cat: 'create',
    desc: 'MiniMax 视频与语音，人物口型自然',
    tags: ['视频', '语音'], region: 'cn', aliases: ['hl', '海螺'],
  },
  {
    id: 'liblib', name: 'LiblibAI', url: 'https://www.liblib.art', cat: 'create',
    desc: '国内最大的 Stable Diffusion 模型站与在线出图',
    tags: ['SD', '模型', '在线'], region: 'cn', aliases: ['ll', '哩布'],
  },
  {
    id: 'tusi', name: '吐司 Tusi', url: 'https://tusiart.com', cat: 'create',
    desc: '在线跑 SD 工作流，云端算力按次计',
    tags: ['SD', '工作流'], region: 'cn', aliases: ['ts', 'tusiart'],
  },
  {
    id: 'civitai', name: 'Civitai', url: 'https://www.civitai.com', cat: 'create',
    desc: '全球模型与 LoRA 集散地，附示例参数',
    tags: ['模型', '社区'], region: 'global', aliases: ['c站', 'civit'],
  },
  {
    id: 'suno', name: 'Suno', url: 'https://suno.com', cat: 'create',
    desc: '一句歌词出一首完整的歌，可指定风格',
    tags: ['音乐', '作曲'], region: 'global', aliases: ['音乐'],
  },
  {
    id: 'capcut', name: '剪映', url: 'https://www.capcut.cn', cat: 'create',
    desc: '剪辑 + 字幕 + 数字人，成片流程最短',
    tags: ['剪辑', '字幕'], region: 'cn', aliases: ['jy', '剪映', 'capcut'],
  },
  {
    id: 'vidu', name: 'Vidu', url: 'https://www.vidu.cn', cat: 'create',
    desc: '生数科技视频模型，长镜头与参考图一致性好',
    tags: ['视频', '生数'], region: 'cn', aliases: ['vd', 'vidu'],
  },
  {
    id: 'pixverse', name: 'PixVerse', url: 'https://pixverse.ai', cat: 'create',
    desc: '爱诗科技视频生成，模板多、上手快',
    tags: ['视频', '模板'], region: 'global', aliases: ['px', 'pix'],
  },

  /* ---- 办公与文档 ----------------------------------------------------- */
  {
    id: 'wps-ai', name: 'WPS AI', url: 'https://ai.wps.cn', cat: 'office',
    desc: '在 WPS 里写、改、做表、做 PPT',
    tags: ['文档', '表格', 'PPT'], region: 'cn', hot: true, aliases: ['wps', '金山'],
  },
  {
    id: 'lingxi', name: 'WPS 灵犀', url: 'https://lingxi.wps.cn', cat: 'office',
    desc: '金山灵犀，独立 AI 助手，能读文档、查资料、生成内容',
    tags: ['金山', '文档', '助手'], region: 'cn', hot: true,
    aliases: ['lx', '灵犀', 'kdocs', '金山灵犀'],
  },
  {
    id: 'workbuddy', name: 'WorkBuddy', url: 'https://www.workbuddy.cn', cat: 'office',
    desc: '腾讯 AI Agent 办公工具，自主规划并交付多模态任务',
    tags: ['腾讯', 'Agent', '办公'], region: 'cn', hot: true,
    aliases: ['wb', 'work buddy', '腾讯办公'],
  },
  {
    id: 'feishu', name: '飞书', url: 'https://www.feishu.cn', cat: 'office',
    desc: '文档 + 多维表 + 会议纪要，AI 嵌在流程里',
    tags: ['协作', '会议'], region: 'cn', aliases: ['fs', 'lark', '字节'],
  },
  {
    id: 'dingtalk', name: '钉钉', url: 'https://www.dingtalk.com', cat: 'office',
    desc: '组织协作 + AI 助理，会议纪要与流程审批',
    tags: ['协作', '阿里'], region: 'cn', aliases: ['dd', '阿里钉钉'],
  },
  {
    id: 'tencent-docs', name: '腾讯文档', url: 'https://docs.qq.com', cat: 'office',
    desc: '在线文档、表格、幻灯片，接腾讯生态',
    tags: ['文档', '协作'], region: 'cn', aliases: ['td', 'docs'],
  },
  {
    id: 'tingwu', name: '通义听悟', url: 'https://tingwu.aliyun.com', cat: 'office',
    desc: '录音转写 + 摘要 + 待办，开会记录的省事解法',
    tags: ['转写', '会议', '阿里'], region: 'cn', aliases: ['tw', '听悟'],
  },
  {
    id: 'gamma', name: 'Gamma', url: 'https://gamma.app', cat: 'office',
    desc: '给个题目生成演示文稿，排版不用调',
    tags: ['PPT', '演示'], region: 'global', aliases: ['ppt', '幻灯片'],
  },
  {
    id: 'zhiwen', name: '讯飞智文', url: 'https://zhiwen.xfyun.cn', cat: 'office',
    desc: '中文 PPT / 文档一键生成，模板偏正式',
    tags: ['PPT', '中文'], region: 'cn', aliases: ['zw', '智文'],
  },
  {
    id: 'deepl', name: 'DeepL', url: 'https://www.deepl.com', cat: 'office',
    desc: '译文最像人写的一档，支持整篇文档',
    tags: ['翻译', '文档'], region: 'global', aliases: ['dl', '翻译'],
  },
  {
    id: 'immersive', name: '沉浸式翻译', url: 'https://immersivetranslate.com', cat: 'office',
    desc: '双语对照翻网页与 PDF，阅读外文资料的标配',
    tags: ['翻译', '插件'], region: 'cn', aliases: ['cj', '双语'],
  },

  /* ---- 模型与社区 ----------------------------------------------------- */
  {
    id: 'huggingface', name: 'Hugging Face', url: 'https://huggingface.co', cat: 'hub',
    desc: '模型、数据集、Spaces，开源生态的总入口',
    tags: ['模型', '数据集'], region: 'global', hot: true,
    aliases: ['hf', '抱抱脸'], q: 'https://huggingface.co/models?search={q}',
  },
  {
    id: 'modelscope', name: '魔搭 ModelScope', url: 'https://modelscope.cn', cat: 'hub',
    desc: '阿里的模型社区，国内下载快，中文模型全',
    tags: ['模型', '国内'], region: 'cn', aliases: ['ms', '魔搭'],
  },
  {
    id: 'waytoagi', name: 'WaytoAGI', url: 'https://waytoagi.com', cat: 'hub',
    desc: '中文 AI 知识库与工具导航，更新很勤',
    tags: ['知识库', '导航'], region: 'cn', hot: true, aliases: ['agi', '通往agi'],
  },
  {
    id: 'civitai-community',
    name: 'AI 作品广场（Civitai Images）',
    url: 'https://civitai.com/images',
    cat: 'hub',
    desc: '看图反推提示词，是学出图最快的办法',
    tags: ['作品', '提示词'], region: 'global', aliases: ['广场'],
  },

  /* ---- 学习与资料 ----------------------------------------------------- */
  {
    id: 'arxiv', name: 'arXiv', url: 'https://arxiv.org', cat: 'learn',
    desc: '预印本第一站，AI 论文基本都先挂这里',
    tags: ['论文', '免费'], region: 'global', hot: true,
    aliases: ['ax'], q: 'https://arxiv.org/search/?query={q}&searchtype=all',
  },
  {
    id: 'scholar', name: 'Google 学术', url: 'https://scholar.google.com', cat: 'learn',
    desc: '查引用与后续工作，判断一篇论文的分量',
    tags: ['论文', '引用'], region: 'global',
    aliases: ['xueshu'], q: 'https://scholar.google.com/scholar?q={q}',
  },
  {
    id: 'semanticscholar', name: 'Semantic Scholar', url: 'https://www.semanticscholar.org', cat: 'learn',
    desc: '带 AI 摘要的文献库，开放式引用网络',
    tags: ['论文', '引用'], region: 'global',
    aliases: ['s2'], q: 'https://www.semanticscholar.org/search?q={q}',
  },
  {
    id: 'connectedpapers', name: 'Connected Papers', url: 'https://www.connectedpapers.com', cat: 'learn',
    desc: '把一篇论文的引用关系画成图，找同族工作',
    tags: ['论文', '图谱'], region: 'global', aliases: ['cp'],
  },
  {
    id: 'cnki', name: '中国知网', url: 'https://www.cnki.net', cat: 'learn',
    desc: '中文期刊与学位论文，多数高校有机构权限',
    tags: ['论文', '中文'], region: 'cn', aliases: ['zw', '知网'],
  },
  {
    id: 'ncpssd', name: '国家哲社文献中心', url: 'https://www.ncpssd.org', cat: 'learn',
    desc: '免费的人文社科文献库，注册即可下载',
    tags: ['论文', '免费'], region: 'cn', aliases: ['ncpssd', '社科'],
  },
  {
    id: 'wikipedia', name: '维基百科', url: 'https://zh.wikipedia.org', cat: 'learn',
    desc: '查概念与来龙去脉，末尾的参考文献更有用',
    tags: ['百科', '免费'], region: 'global',
    aliases: ['wiki', '维基'], q: 'https://zh.wikipedia.org/w/index.php?search={q}',
  },
  {
    id: 'promptguide', name: '提示词工程指南', url: 'https://www.promptingguide.ai/zh', cat: 'learn',
    desc: '系统讲清提示词技巧，有中文版',
    tags: ['提示词', '手册'], region: 'global', aliases: ['prompt', '提示词'],
  },
  {
    id: 'excalidraw', name: 'Excalidraw', url: 'https://excalidraw.com', cat: 'learn',
    desc: '手绘风白板，画架构图和流程图最快',
    tags: ['白板', '绘图'], region: 'global', aliases: ['白板'],
  },
  {
    id: 'regex101', name: 'regex101', url: 'https://regex101.com', cat: 'learn',
    desc: '正则调试与解释，逐段拆开给你看',
    tags: ['工具', '正则'], region: 'global', aliases: ['正则'],
  },
]

/**
 * Derive `host` and a stable order, then freeze.
 *
 * Hand-writing `host` next to `url` is how a directory ends up with links that
 * disagree with their own labels; deriving it means the search index, the
 * favicon lookup and the tool text can never drift from the URL.
 */
export const SITES = RAW.map((entry, index) => {
  let host = ''
  try {
    host = new URL(entry.url).host
  } catch {
    host = ''
  }
  return Object.freeze({
    kind: 'site',
    order: index,
    region: 'global',
    tags: [],
    aliases: [],
    hot: false,
    selfHost: false,
    q: null,
    host,
    ...entry,
  })
})

export const SITE_BY_ID = Object.fromEntries(SITES.map((s) => [s.id, s]))

/** Ids of the entries marked hot, used by the panel's "热门" row. */
export const HOT_IDS = SITES.filter((s) => s.hot).map((s) => s.id)

/** Every id the catalogue owns; a user site may never reuse one. */
export const RESERVED_IDS = new Set(SITES.map((s) => s.id))

/**
 * Find one catalogue entry by id, name, alias or host.
 * Used by the Tools so "秘塔" and "metaso.cn" both resolve.
 *
 * @param {string} query
 * @returns {(typeof SITES)[number] | null}
 */
export function findSite(query) {
  const text = String(query || '').trim().toLowerCase()
  if (!text) return null
  const byId = SITE_BY_ID[text]
  if (byId) return byId
  const stripHost = text.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return SITES.find((site) =>
    site.name.toLowerCase() === text
    || site.name.toLowerCase().includes(text)
    || site.host === stripHost
    || site.host.startsWith(stripHost + '.')
    || site.aliases.some((alias) => alias.toLowerCase() === text)) || null
}
