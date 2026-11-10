# 市场收录目录（Awesome DSH Plugin Submission）

本目录存放提交到 [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 注册表的条目**镜像**与状态说明。正式数据在对方仓库 `data/plugins/` 里，这里只是本地对照。

## 当前状态：已收录 ✅

- **PR**：[#12066](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/12066) "Add naturalth2012/dsh-ai-nav"
- **合并时间**：2026-11-06T16:54:02Z（merge commit `620bec2`）
- **线上文件**：`data/plugins/naturalth2012__dsh-ai-nav.yml`（`category: tools`）
- **提交者**：`naturalth2012`，分支 `add-dsh-ai-nav` → `main`

即：向 DSH 市场注册表提交条目这一步**已经成功**，且条目已合并进 `main`。注册表收录走的是 GitHub PR，与 npm 发布是两条独立通道——本插件未发布到 npm 并不影响市场收录（未发布 npm 时市场会给出「从源码构建」的安装方式；也可在 GitHub Release 附预构建 tarball 并用 `tarball:` 字段指向它）。

## 收录前置条件（均已满足）

依据注册表的 [contributing.md](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)：

- `package.json` 声明 `dsh.bundle` manifest（`dsh.bundle.patch: ./cordis.patch.yml`）——仅声明 `dsh.client` 是最常见的被拒原因。
- 仓库带 `dsh-plugin` topic。
- 仓库公开、创建满 1 天（本仓库建于 2026-11-04）。
- `category: tools` 是有效取值之一。
- 仅 `description.en` 必填；`zh` 可选。
- 两个 README 由脚本生成，**不要手工编辑**。

## 关于「市场索引里暂时搜不到」

注册表合并后，网站会自动重建；但面向 DSH GUI「Discover」的 `index.json` 是**周期性构建的快照**，会滞后数日。已观察到同一快照里也未包含其它 11-05 / 11-09 合并的条目（如 `plugin-organizer`、`dsh-nav-tidy`），属于正常的快照延迟，不是提交失败。以注册表 `data/plugins/` 里的文件与 PR 的 MERGED 状态为准。

本机 DSH 的「Discover」市场 tab 依赖 `@deepseek-ai/dsh-experimental-plugin-market-bundle`（当前未启用），启用后才会在 GUI 里浏览/安装市场条目。

## 条目更新

条目合并后不会自动更新。若插件能力有大的变化（例如站点数量、分类、推荐能力显著改变），需另开一次 PR 更新 `data/plugins/naturalth2012__dsh-ai-nav.yml` 的描述，并同步本镜像。一个 PR 最多改自己的条目，不要动别人的条目。
