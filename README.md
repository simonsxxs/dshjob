# dshjob.com

面向外部用户的「求职找工作」自动化项目网站，介绍 Skill（技能包）、Agent（智能体）、MCP（工具接入协议）等使用方式。

## 当前阶段

**Explore（探讨）**。2026-09-14 完成项目说明初始化；`index.html` 仍为原有占位页。

后续按用户指定顺序推进：

**探讨 → PRD（产品需求文档）→ Spec（变更规格）→ 原型 → Kimi 实现完整网页**。

Codex 承接前期讨论与后续获准的需求、规格和原型工作；Kimi 承接正式网页实现。
当前尚无已批准 PRD、Spec 或原型，未进入正式开发或发布。
具体阶段与授权约定见 [AGENTS.md](AGENTS.md)。

## 这是什么

希望让访客理解找工作自动化能帮自己做什么、需要准备什么、如何获取并开始使用。
网站最终形态、主要用户、首页行动入口、页面数量与首版范围将在探讨中确定。

- 展示对象：找工作 Agent（基于 DeepSeek Harness）、找工作 MCP 服务、找工作 Skill、求职看板
- 候选风格参考：[dshopc.com](https://dshopc.com) — 是否采用其布局与风格，待讨论
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
└── README.md
```

后续在相应阶段获准后按需创建，以下文件与目录当前尚不存在：

- `docs/product/PRD.md`：产品需求及其批准状态。
- `docs/product/PRD_CHANGELOG.md`：已批准版本的变更记录。
- `openspec/changes/<change-id>/`：当次变更的 proposal、specs、design、tasks。
- `prototype/`：原型及必要说明，与正式页面区分。
- `assets/`：正式页面需要的图片等静态资源。

本次初始化仅更新项目说明，未安装 BMad / OpenSpec 或网页依赖。

## 部署

纯静态文件，可托管到 GitHub Pages / Vercel / 任意静态服务器，绑定域名 dshjob.com。

---

作者：simon，一个不懂代码的AI极客
GitHub：https://github.com/simonsxxs ｜ Gitee：https://gitee.com/simonsxx
