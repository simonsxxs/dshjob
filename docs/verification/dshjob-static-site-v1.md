# dshjob-static-site-v1 实施验证记录

日期：2026-09-15。实施授权：用户指示「执行项目」「尽可能开多子智能体协同工作，速度优先」（原话记录于 AGENTS.md 当前阶段一节）。范围：本地实施与验证，不含推送 / 发布 / 上线。

## 交付文件

| 类别 | 文件 |
|---|---|
| 页面 | `index.html`（413+ 行）、`guide.html`（274+ 行）、`404.html` |
| 样式 / 脚本 | `assets/site.css`（1800+ 行）、`assets/site.js`（157 行）、`assets/hero-motion.js`（614 行，重做版） |
| 视觉资源 | `assets/hero-beam.svg`（280 行，重做版）、`assets/favicon.svg`、`assets/social-card.png`（1200×630，PIL 绘制）、`assets/simon-wechat.jpg`（原图逐字节复制，SHA-256 与 `docs/product/assets/simon-wechat-original.jpg` 一致：`4732501…7111e`） |
| 站点文件 | `robots.txt`、`sitemap.xml`（`/` 与 `/guide`，域名 dshjob.com） |
| 工具 | `scripts/check-site.py`（40 项检查）、`scripts/package-site.py`（白名单打包） |
| 发布准备 | `.github/workflows/release-pages.yml`（仅 workflow_dispatch，未运行；运行需另行发布授权） |

## 重做记录（对标 dshopc）

用户首版打回后，对标 dshopc（本机副本 commit `94c82dfa`，与 PRD 9.1 记录一致）重做首屏：三层复合光束（外层青氛围 / 中层蓝光晕 / 深蓝核心亮线）、沿束高斯分布三档粒子（大粒子辉光 sprite 8%、中 32%、微 60%）、三团浅蓝柔光斑、SVG 静态底图与 Canvas 动态层按 object-fit:cover 对齐叠加。**配色、字体、排版规格锁定 design.md 第 3 节原值未动**（用户明确要求）。内容层同步润色：徽标、主按钮投影、示意卡氛围呼应、两段说明分级。

## 已验证项（本机：macOS 26.6.2 arm64，Chrome，HTTP 127.0.0.1:8742）

1. **静态检查**：`python3 scripts/check-site.py` 通过 40 项、0 警告、0 失败（链接 / 锚点 / 字段 / 四卡状态 / 泄漏扫描 / gzip 预算 31KB ≤ 300KB / 二维码 117.5KB ≤ 600KB）。
2. **JS 接线**：index / guide 无控制台错误；`html.js` 注入、tablist 增强（方向键 / Home / End / aria-selected / roving tabindex 实测通过）、复制成功反馈（「已复制」）、guide 页不引 hero-motion 且安全退出。
3. **动效状态机**（重做后回归）：暂停↔恢复按钮文案与 userPaused 同步；滚出首屏 heroVisible=false 停帧、回顶恢复；系统减少动态实时切换 → 「已按系统设置减少动效」+ aria-disabled；档位 desktop（≥1100+fine）/ mobile（390 粗指针）实测正确；node 桩测试降档至 static 全链路通过（子智能体执行）。
4. **响应式**：390 / 768 / 1440 / 1686 无横向溢出；手机品牌名单行、菜单按钮 20px 边距（修补后精确复检）。
5. **手机菜单**：开合、aria-expanded、Escape 关闭并把焦点还给按钮。
6. **视觉 QA**（图像分析）：桌面首屏三层光束结构可辨、粒子有密度与景深、氛围光斑可见、文字区干净；手机端光效不干扰可读性。留证截图：`screenshots/desktop-1440-hero.png`、`desktop-full.png`、`desktop-guide-top.png`、`mobile-390-hero.png`。
7. **打包脚本**：白名单 + sha256 清单（子智能体夹具验证）。

## 未验证项（如实记录，不得视为通过）

- 动效帧率 30 秒实测采样、冷缓存 3 次 LCP/CLS、200% 缩放、file:// 双击全流程（设计第 8 节实验室条件）。
- 真实手机（iPhone 13 / Pixel 6）触摸与切后台；Safari / Edge 实机。
- 软件安装包真实下载与首次上手（软件本体未立项，卡片按「准备中」呈现）。
- 二维码真实扫码联系 simon（原图未重绘，待本人核对）。
- 邀请测试 SM-01~04；Cloudflare Pages 发布链路（工作流仅就绪未运行）。

## 遗留待办

- 四张方式卡当前仅指向两个官网仓库（兄弟项目无公开远程，远程 dshjob 仓库为占位内容）；真实工具发布物补齐后按 design 第 4 节状态机更新。
- 推送、Gitee 同步、Pages 发布均需用户另行授权。
