# 首页视觉原型 v1：生成说明

- 依据：PRD v1.0.0 草稿与用户本轮“先按 PRD 绘制原型图”的明确要求。
- 生成方式：内置 `image_gen`，未使用 CLI / API fallback。
- 参考图：`../../docs/product/assets/dshopc-desktop-reference.png`，仅作风格参考。
- 结果：`homepage-v1.png`，静态首页长图，待用户确认。
- 二维码区域是带标签的原图位置，不是可扫描二维码；画面中的光束仅表现动效的视觉状态。
- 本轮未实现可点击网页、未生成 Spec、未批准 PRD、未上线。

## 完整生成提示词

```text
Use case: ui-mockup.
Generate ONE high-fidelity static full-page DESKTOP website prototype image for the Chinese project "dshjob". This is an image for design review, not an implemented website. Portrait full-page artboard, intended resolution 1536 x 3072, completely flat front-on UI with no device frame or perspective. Beautiful coherent production-quality website design, very crisp readable Simplified Chinese text, disciplined alignment, generous whitespace, realistic sizing.

Input image 1 is STYLE REFERENCE ONLY: the user's DSHOPC website screenshot. Borrow its dark navy background, luminous flowing curved blue-white particle beams, subtle fine stars and refined glow. Create a distinctly new website with a friendlier tone, shorter clear Chinese copy and softer 12–16px rounded cards. Do not copy the DSHOPC logo, slogans, developer terminal, command lines or technical navigation. Keep all text bright and high-contrast, let most star particles live in the hero, keep lower-page reading surfaces quieter.

Brand and product facts: "dshjob", free public job-search automation resources for AI beginners. Users get projects from Gitee/GitHub and give them to their own Agent. This is a STATIC project showcase, NOT a SaaS app. No sign-in, pricing, subscriptions, dashboard sidebar, chat input, resume uploader or actual live-task controls. Label any example job data as "演示数据". Actual download packages are still being prepared: repository buttons should say "查看 Gitee" / "查看 GitHub", and show a discreet "工具包待补齐" note in the downloads area, not on every card.

Build an elegant single long homepage with these sections, in order. Avoid excessive body text; use the exact labels below. Exact spelling for dshjob, simon, simonsxxs, Gitee, GitHub, Agent, Skill and MCP is essential.

1. HEADER, around 80px tall: simple tiny luminous orbit mark next to lowercase "dshjob" on left; navigation on right "能做什么" "看看效果" "获取工具" "使用教程" "联系 simon". Fine translucent bottom border. No login.
2. HERO, around 620px tall, dominant: left has a small pill "免费公开 · Agent 驱动", large readable two-line title "让 AI 帮你找工作，" then "从这里开始。"; subtitle "搜集岗位、筛选机会、整理求职进度。" and "把重复工作交给 AI，把选择留给自己。"; one luminous ice-blue filled button "免费获取工具" and a restrained outlined secondary button "查看使用教程". Right has a refined STATIC preview card titled "我的求职助手", a small "演示数据" tag, a quoted request "想找上海的运营岗位，先筛选，不发送消息。" and two compact example result rows "内容运营" / "用户运营" with chips "待查看" and a footer "结果和进度，一眼看清". No text input. One grand elegant luminous arc travels from bottom left to upper right BEHIND content, with thousands of delicate tiny moving-looking particles following strands; no overpowering bloom over text. Small "暂停动效" control near lower right of hero.
3. CAPABILITIES: small blue index "01 / 能做什么", headline "少一点重复，多一点机会。", four compact equal tiles with thin custom line icons and labels "搜集岗位" "筛选机会" "沟通拟稿" "整理进度". Short quiet line "支持范围因平台而异，请查看使用说明。"
4. DEMO: small index "02 / 看看效果", heading "从一句需求，到清楚的求职进度。" Below a wide elegant illustration of a simplified job-results board with three tabs "说出需求" "查看岗位" "查看进度", with "查看岗位" active. Two example rows only, clear status chips, tiny "演示数据 · 非实时任务" tag. This board is a contained screenshot preview, not the whole website's frame.
5. START: small index "03 / 如何开始", heading "跟着四步，开始第一次尝试。" A horizontal four-step path with numbered circles "01 获取项目" → "02 按引导准备" → "03 告诉 Agent" → "04 查看结果", tasteful line connector and gentle sparse particles, no paragraphs of commands.
6. DOWNLOADS: small index "04 / 获取工具", heading "选一种适合你的使用方式。", three balanced cards with labels "Agent 智能体" / "Skill 技能包" / "MCP 工具连接". Each has one line explanation respectively "跟着引导，让 AI 帮你处理任务。" / "给现有 AI 助手增加找工作能力。" / "把找工作工具接入你的 AI 软件。". Each has two compact clearly readable outlined link buttons "查看 Gitee" and "查看 GitHub", plus subtle "查看教程 →". Under the cards one quiet note "项目免费公开 · 当前可查看仓库，工具包待补齐". Do NOT mark one as already universally easy to install, do NOT add ratings or download counts.
7. FAQ: small index "05 / 常见问题", heading "你可能还想知道". Three understated full-width accordion rows "项目是免费的吗？" / "不会写代码，可以使用吗？" / "会自动替我发送消息吗？", plus icons, first one may show the short answer "项目免费公开，运行前请查看工具的使用条件。".
8. CONTACT: calm warm human touch against stable navy, rounded panel, heading "遇到问题？找 simon 帮忙。", secondary "一起把第一步走顺。", name "simon", exact WeChat ID "微信：simonsxxs", button "复制微信号". On right a WHITE square with a simple neutral placeholder outline and text "二维码原图位置". IMPORTANT DO NOT generate any actual QR code modules or pretend a generated code works; this is intentionally a labeled placeholder for the user's original QR image.
9. FOOTER: discreet "dshjob · AI 找工作助手" on left and "© 2026 simon" on right. Tiny internal review label at very bottom "首页视觉原型 v1".

Constraints: cohesive desktop 12-column grid, side margins around 100px, same alignment across sections; no paragraphs too tiny to read, no illegible decorative text. Mix editorial open layouts with bounded cards, avoid a wall of uniform boxes. Keep static website nature obvious. No fake metrics, fake testimonials, guarantees, payment UI, technology deployment labels or Cloudflare branding in the website UI. Blue-white particles and soft near-black surfaces, friendly professional Chinese typography, premium but welcoming. Entire footer must be in frame.
```

