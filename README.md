# dshjob.com

面向外部用户的「求职找工作」自动化项目网站，提供软件下载、Agent（智能体）、Skill（技能包）、MCP（工具接入协议）四种使用入口。

## 当前阶段

**Spec 规格草稿，待审阅。** 2026-09-15 用户认可浅雾蓝 v2 原型、要求进入 Spec，并新增软件下载。`index.html` 仍为原有占位页，尚未开发正式网站。

- [PRD v1.1.0 草稿](docs/product/PRD.md)：已纳入软件下载和确认的视觉方向；整份 PRD 版本仍待确认。
- [PRD 文档审查](docs/product/PRD_REVIEW.md)：文档检查结果及未验证范围。
- [Spec 总览](openspec/changes/dshjob-static-site-v1/proposal.md)：范围、决策、风险和授权状态；change-id 为 `dshjob-static-site-v1`。
- [功能规格](openspec/changes/dshjob-static-site-v1/specs/static-website/spec.md)、[设计与交互](openspec/changes/dshjob-static-site-v1/design.md)、[实施任务](openspec/changes/dshjob-static-site-v1/tasks.md)：供 Kimi 后续实现和验收。
- [首页视觉原型 v2：浅雾蓝](prototype/visual/homepage-v2-light.png)：白色卡片、深蓝文字和蓝青色光束，**视觉方向已认可**；新增软件下载卡片由 Spec 补充。光束为静态示意，二维码为原图位置占位。
- [v2 原型生成提示词](prototype/visual/homepage-v2-light-prompt.md)：内置绘图工具生成依据，供后续修改和 Kimi 参考。
- [历史原型 v1：深色](prototype/visual/homepage-v1.png)及[生成提示词](prototype/visual/homepage-v1-prompt.md)：保留供配色对照。

后续按用户指定顺序推进：

**探讨 → PRD（产品需求文档）→ Spec（变更规格）→ 原型 → Kimi 实现完整网页**。

Codex 承接前期讨论与后续获准的需求、规格和原型工作；Kimi 承接正式网页实现。
当前 PRD 为 draft，Spec 已按用户明确要求编写；认可 v2 视觉不等于已批准整份 PRD 或正式开发。Kimi 实施前核对 PRD v1.1.0 及 `批准执行：dshjob-static-site-v1`；发布仍需对应授权。
具体阶段与授权约定见 [AGENTS.md](AGENTS.md)。

## 这是什么

希望让访客理解找工作自动化能帮自己做什么、需要准备什么、如何获取并开始使用。
已明确为面向 AI 新手的免费公开项目官网，通过 Gitee / GitHub 获取工具，由 Agent 在用户自己的环境中驱动。PRD 草稿提案为“首页 + 独立教程页”，待批准。

- 展示对象：找工作软件、找工作 Agent（基于 DeepSeek Harness）、找工作 MCP 服务、找工作 Skill、求职看板；软件安装包及支持系统待提供，官网任务不开发软件本体
- 用户指定动效参考：[dshopc 仓库](https://github.com/simonsxxs/dshopc) / [线上效果](https://dshopc.com) — 粒子光束为需求，具体视觉在后续原型中确认
- 当前技术基线：纯静态 HTML / CSS / JS，无构建步骤；改变技术基线需明确确认

## 本地预览

直接用浏览器打开 `index.html`，或：

```bash
cd dshjob
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 目录结构

```
dshjob/
├── index.html      # 原有占位页
├── AGENTS.md       # 阶段顺序、职责分工、技术与内容约定
├── docs/product/
│   ├── PRD.md      # v1.1.0 草稿，含软件下载
│   ├── PRD_REVIEW.md
│   └── assets/     # 微信原图及动效参考截图，仅作需求附件
├── prototype/visual/
│   ├── homepage-v1.png
│   ├── homepage-v1-prompt.md
│   ├── homepage-v2-light.png
│   └── homepage-v2-light-prompt.md
├── openspec/changes/dshjob-static-site-v1/
│   ├── proposal.md
│   ├── specs/static-website/spec.md
│   ├── design.md
│   └── tasks.md
└── README.md
```

后续在相应阶段获准后按需创建，以下文件与目录当前尚不存在：

- `docs/product/PRD_CHANGELOG.md`：已批准版本的变更记录。
- `assets/`：正式页面需要的图片等静态资源。

已完成 PRD 修订和 OpenSpec 四件套。2026-09-15 确认本机已有 OpenSpec CLI 1.7.0，可直接校验项目规格；本轮未安装工具、生成宿主技能或引入网页依赖。项目未安装 BMad 产品技能，文档按工作区产品流程编写和审查。

## 部署

按用户要求参考 dshopc 的路线：**GitHub Actions 人工发布 → Cloudflare Pages Direct Upload → dshjob.com**。网页维持纯静态，无前端构建步骤。发布只上传明确的站点文件，不上传整个仓库；配置范围见 Spec 的设计文档，当前未创建发布工作流。

- GitHub：[simonsxxs/dshjob](https://github.com/simonsxxs/dshjob)
- Gitee：[simonsxx/dshjob](https://gitee.com/simonsxx/dshjob)

2026-09-14 核验两端 HEAD 一致，远程内容仍为官网占位页；实际求职工具下载物待补齐。当前未创建发布工作流、未配置托管或域名，未推送本轮文档或发布网站。

---

作者：simon，一个不懂代码的AI极客
GitHub：https://github.com/simonsxxs ｜ Gitee：https://gitee.com/simonsxx
