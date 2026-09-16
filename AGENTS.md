# dshjob.com — 项目协作说明

## 项目定位

dshjob.com 面向希望使用「求职找工作」自动化项目的外部用户。
网站需要帮助访客理解项目、选择适合自己的使用方式，并找到获取与上手入口。
已明确面向 AI 新手、免费公开、静态网页，通过 Gitee / GitHub 获取工具；要求参考 dshopc 的粒子光束动效。
当前需求草稿见 [docs/product/PRD.md](docs/product/PRD.md)，版本 v1.1.0；使用方式包含软件下载、Agent、Skill、MCP。浅雾蓝 v2 视觉已获认可，具体功能与实施仍按阶段授权。

## 当前阶段与协作顺序

- 2026-09-14：完成 PRD 草稿后，用户明确要求“先按照 PRD 写一个原型我看看，绘制个原型图”；当前已制作 **首页静态视觉原型预览**。
- 2026-09-15 用户明确“这个好，进入 spec 阶段”，认可浅雾蓝 v2，并随后要求“使用方式再加一个软件下载”。当前已按该授权整理 PRD v1.1.0 draft 和 Spec 草稿；未进入网页开发或发布。
- 2026-09-15（Spec 校验通过后）：用户指示“执行项目”，随后补充“尽可能开多子智能体协同工作，速度优先”。按 proposal“验证与下一阶段”一节（用户一句话同时明确两者时无需重复询问）记录为针对完整网页范围的 `批准执行：dshjob-static-site-v1`。授权范围：本地实施与验证（index.html、guide.html、404.html、assets/ 站点资源、scripts/ 检查打包脚本、发布工作流文件）；**不含** Git 提交/推送、Gitee 同步、Cloudflare Pages 发布或上线（均需另行授权）。实施由当前 ZCode 会话组织多个子智能体并行完成（用户明确要求，取代原“Kimi 实施”分工）；PRD v1.1.0 内容作为实施依据，用户未单独批准 PRD 版本，`approved_at` 保持空值、不虚构批准日期。
- 2026-09-15（动效优化）：用户要求参考 dshopc 官网的粒子光束动效继续做并优化，颜色保持浅雾蓝 v2 不变；确认要 dshopc 式「全页滚动动效」（光束画布为全页固定背景，滚动时光束逐场景变形、粒子持续流动，正文阅读区自动减弱）。本机存在 dshopc 只读副本（`~/Documents/ChatGPT/dshopc`，HEAD `94c82df`），仅作参考、不修改。由 Kimi 在既有本地实现上执行，范围：`assets/hero-motion.js`（重写为全页滚动场景版）、`index.html` 动效层结构与 `data-flow-scene` 锚点、`assets/site.css` 层叠；不含 Git 提交/推送与发布。
- 2026-09-15（对齐原型 v2）：用户要求去除「暂停动效」按钮，并要求除光束粒子外全部板块与原型图一致。已执行：删除页面暂停按钮及其逻辑（系统「减少动态」与性能降档的自动回退保留，Spec 中手动暂停控件一条以此为准）；首页各板块按原型 v2 逐项对齐——品牌名仅「dshjob」、标题后半句品牌蓝并在逗号后换行、删除首屏第二段副文、演示区默认「查看岗位」标签（浅蓝胶囊+下划线选中态）与两行表格（待查看+行尾箭头）、四步改为无卡片虚线箭头流程、方式卡精简为「图标+一句话+状态徽标+双仓库按钮并排+查看教程」、FAQ 前三条措辞与原型一致且首条默认展开（仍保持 Spec 要求的 8 条与 4 张方式卡）、联系区改为「左标题 + 右 simon 信息/复制按钮 + 小尺寸二维码」、页脚简化为品牌名 + © 2026 simon。原型中「03 / 获取工具」编号重复系原型笔误，按顺序修正为 04。验证记录见 `docs/verification/2026-09-15-proto-align/`。
- 2026-09-15（Skill 已发布对齐）：用户确认 Skill 技能包已做好，要求首页补 GitHub/Gitee 链接、Agent/MCP/软件下载三张卡标注「没开发好」，并将使用教程与 Skill 项目实际对齐（写成给用户看的教程，不抄 README）；同时要求首页视觉不再改动、板块间距按原型压缩。已核实真实仓库 `github.com/simonsxxs/dshjob-skills` 与 `gitee.com/simonsxx/dshjob-skills`（均 200）及其 README 事实后执行：首页四卡仅改文字与链接（Skill 绿卡「已发布，可直接使用」+ 新仓库链接，其余三卡黄标「开发中，暂未发布」，按钮布局不变）；`--section-py` 压缩（桌面 88→40 等）修复板块间距过大；guide.html 的 Skill 章节按真实项目重写（准备条件：macOS/Windows + Chrome + Python 3.8+ + kimi-webbridge 扩展 + 支持 AGENTS.md 的智能体；五步上手；结果看本地「看板数据/求职看板.html」），其余三章改为「开发中，暂未发布」占位并指向 Skill 章节，页头标题纳入 .container（修复贴左边缘），页脚与首页一致。check-site.py 外链白名单已加入 dshjob-skills 两个仓库。注意：`gitee.com/simonsxx/dshjob`（官网仓库）当前 403/未公开，首页三卡保留的 Gitee 按钮指向该地址，待用户决定是否公开或替换。
- 2026-09-15/16（首次上线发布）：用户指示「这个网站根据托管和部署路线进行部署，域名是阿里的域名 dshjob.com」「参考 dshopc.com 的托管路线，让国内也能轻松访问」，并授权「剩下的你全程操作」——记录为 dshjob-static-site-v1 的发布与上线授权（登录、短信验证由用户现场完成后交回）。已按 dshopc 同款路线完成上线：
  - 代码：提交 `2e414b4`（站点完整实施，40 项静态检查通过）推送 GitHub main；Gitee 镜像 `simonsxx/dshjob` 由私有转公开并同步（README 署名完整，上一条「403/未公开」事项就此解决）。
  - Cloudflare：新增站点 dshjob.com（Free 套餐，分配 NS `adele`/`derek.ns.cloudflare.com`）；阿里云域名 DNS 服务器由 `dns17/18.hichina.com` 切换至 Cloudflare（用户短信验证后生效）；创建自定义 API Token「dshjob-pages-deploy」（仅 Cloudflare Pages Edit、限定账户）写入 GitHub Secrets（`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）；创建 Pages 项目 `dshjob`（Direct Upload）。
  - 发布：`release-pages` 三次运行——`35036040643`、`35036167641` 失败于工作流自身两处缺陷（wrangler-action 的 command 不经 shell、归属核对 grep 未兼容 API 格式化 JSON），以提交 `5f89ef1`、`0aaf1ac` 修复后 **run `35036221920` 成功**；发布提交 `0aaf1acbda137de63a9646f2756a6c6a32ff94f5`，不可变地址 `https://16b53a12.dshjob.pages.dev`。
  - 域名：主域与 www 各配 Proxied CNAME → `dshjob.pages.dev`；Redirect Rule「www to apex 301」（`https://www.dshjob.com/*` → `https://dshjob.com/${1}`，保留查询参数）；HTTP 自动 301 到 HTTPS；两个自定义域名状态 active。
  - 验证：`https://dshjob.com` 首页 / 教程 / 自定义 404 / robots / sitemap / 全部资源 200，www 与 HTTP 均 301 且路径查询保留；线上截图留证 `docs/verification/2026-09-16-deployment/`。本条即本次发布记录；回滚需另行授权。
- 2026-09-16（内容微调 + 统计与关联链接）：① 用户指正 FAQ「会自动替我发送消息吗」表述（工具能自动发送、需用户授权、默认干跑），仅改该条答案（提交 `5590634`，run `35041045720`）。② 用户要求「跟 dshopc 一样」加百度统计、联系区加邮箱 `simonsxx@qq.com`、页脚加 dshopc.com / dshgeo.com / opcmode.com 关联链接：百度统计新建站点 dshjob.com（siteId 23532152，`hm.js?d49248f5e9e329231f15c05d77c2cc79`）；搜索资源平台以 https + HTML 标签验证通过（meta `codeva-nSd7zsciGi`，站点领域「信息技术」；滑块验证由用户完成）；三个页面 head 均装统计脚本与验证 meta，统计脚本的站点 ID 与验证 meta 属于公开页面内容；check-site.py 白名单补三个关联站点根路径（提交 `cd92efa`，run `35042393158`，线上已验证脚本/meta/邮箱/链接全部就位）。百度统计后台：tongji.baidu.com（账号 simonsxxs，站点 dshjob）。
- 用户指定顺序：**探讨 → PRD（产品需求文档）→ Spec（变更规格）→ 原型 → Kimi 实现完整网页**。
- 已确认视觉为[浅雾蓝原型 v2](prototype/visual/homepage-v2-light.png)；深色 v1 仅作历史对照。新增第四张软件下载卡片、教程和手机布局由 Spec 补充，原型图本身没有这些完整状态。
- 当前变更：[dshjob-static-site-v1](openspec/changes/dshjob-static-site-v1/proposal.md)。Spec 已完成并通过严格校验；2026-09-15 获实施授权，2026-09-16 已完成发布上线（见上条记录），站点运行于 https://dshjob.com。后续内容改动走新的变更与授权；回滚、再次发布均需单独授权。
- Codex 负责前期探讨，并在相应阶段获准后整理 PRD、Spec 和设计原型；Kimi 依据用户认可的文档与原型实施。
- 初始化结束后，Explore 阶段只读取资料、在对话中讨论，不自动写方案文件、安装工具或修改页面。
- 用户明确要求生成 PRD 后才创建草稿；批准具体 PRD 版本后，再按授权进入 OpenSpec，维护 proposal、specs、design、tasks。
- 本次用户明确要求直接进入 Spec，因此先完成候选规格并保留 PRD 草稿状态；实施前核对 PRD v1.1.0 与 `批准执行：dshjob-static-site-v1`，不虚构批准日期。
- 原型阶段需用户明确授权，授权范围限于原型；如原型包含代码，需在对应 change-id 的实施批准中明确仅制作原型。原型用于核对页面、流程和交互，不代表正式网站已实现。
- 原型确认后核对 PRD / Spec 的一致性；若改变产品规则或范围，先更新并重新确认相关文档，再交接 Kimi。
- Kimi 开始复杂变更实施前，须核对针对完整网页范围的 `批准执行：<change-id>`。原型批准不自动授权正式开发；上线另需发布授权。
- 阶段事实复用本文件、README 及后续正式文档，不另建重复的进度或交接台账。阶段变更须基于用户授权。
- 详细产品工作流按需读取 `~/.agents/workflows/BMad-OpenSpec-产品开发工作流.md`。BMad 仅用于产品层；工具安装与文档产出是不同动作，不将工具缺失视为自动安装授权。

## 相关项目与内容依据

展示对象（同工作区内的兄弟项目）：
- `找工作-agent/` — 基于 DeepSeek Harness (dsh) 的找工作 Agent，含看板插件
- `找工作-mcp/` — BOSS 直聘的 MCP 服务；`boss_job_hunter/` 是 BOSS 业务逻辑唯一真源
- `找工作-skill-版本2/` — 找工作 Skill（含 openspec、看板数据）
- `求职看板原型/index.html` — 求职看板的静态原型，可作为内容/视觉素材

上述目录均位于本项目的上一级。引用其资料不代表可以修改兄弟项目。
能力描述、平台支持范围、下载入口与安装条件须回到对应项目核实；方案、脚本存在和实际验收通过应明确区分。
不得直接把本机绝对路径、凭据、真实简历、招聘沟通或个人求职记录作为公开素材。

## 技术约束

- **纯静态 HTML/CSS/JS，无构建步骤**。不使用框架、不引入 npm 依赖，除非用户明确要求。
- 入口为 `index.html`，样式优先内联或单文件 CSS，图片等静态资源放 `assets/`。
- 本地预览：直接在浏览器打开 `index.html`，或 `python3 -m http.server`。
- 用户指定部署路线参考 dshopc：GitHub Actions 人工发布 → Cloudflare Pages Direct Upload → dshjob.com；Gitee 保留对应版本入口。准确配置范围已在 Spec 固化，当前不实施。
- GitHub 项目：https://github.com/simonsxxs/dshjob；Gitee 项目：https://gitee.com/simonsxx/dshjob。2026-09-14 核验时为官网占位页；实际发布物必须刷新核实，不把历史结果当当前事实。
- 软件下载仅新增官网获取入口和教程，不包含制作软件、安装器或自动更新服务。软件名称、系统 / 架构、版本及真实包地址未确认时按 Spec 展示准备状态。

## 设计与内容方向

- 用户指定动效参考：https://github.com/simonsxxs/dshopc（线上 https://dshopc.com）。
  粒子光束为明确需求；页面数量、布局、具体色板和动效强度以获批 PRD / Spec / 原型为准，不直接迁入参考项目框架。
- 内容基调：真实、可复核，不虚构客户案例或夸大效果（与 dshopc.com 一致）。
- 目标读者：对 AI 不熟练的普通求职者；上手指引需说明实际 Agent、安装条件与第一步。开箱即用是待验收目标，不据本地文件存在就宣称已实现。
- 页面应讲清楚使用前提、运行位置和需要人工确认的动作，不将“默认干跑”描述成“所有动作均未执行”。

## 协作约定

- 用户为文科背景 Vibe Coder，沟通和注释用中文，术语首次出现附中文解释。
- 正式页面由 Kimi 依据获批文档与确认原型实现；保持简单、可直接打开验证，不留无关构建产物。
- 公开发布时按全局规范在 README 附署名（作者 simon，GitHub/Gitee 同发）。
