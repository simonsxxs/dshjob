# 首页视觉原型 v2：浅雾蓝

- 日期：2026-09-15。
- 依据：用户要求背景不使用黑色，并要求再制作原型预览。
- 生成方式：内置 `image_gen` 编辑模式，未使用付费 API / CLI fallback。
- 输入：`homepage-v1.png`；保留原始深色版本。
- 输出：`homepage-v2-light.png`；浅雾蓝背景、白色卡片、深蓝文字和蓝青色光束。
- 状态：待视觉确认的静态图，非已实现网页；二维码仍为带文字标签的原图位置。

## 完整生成提示词

```text
Use case: style-transfer / ui-mockup.
EDIT the provided full-page dshjob website prototype into a cohesive LIGHT MIST BLUE palette. Preserve its complete desktop homepage layout, every section, exact Chinese copy, cards, navigation, particle-beam composition and footer. This is a static visual prototype, not a SaaS application. Full-page portrait artwork, crisp readable typography, no device frame.

Replace ALL black and dark navy large background areas:
- Page background: very pale mist blue #F2F7FC, reading sections close to white.
- Hero: soft pale sky-blue gradient #E9F3FF to #F5FAFF, spacious and welcoming.
- Cards and demonstration board: white #FFFFFF with very subtle blue shadows and thin #C8DAEB borders. No dark panels.
- Main headings and text: deep ink blue #16324F; supporting text #516579, with excellent contrast.
- Primary button: vivid tasteful blue #3478F6 with white type. Other buttons white with deep-blue text.
- Particle beam: visible flowing curved blue and cyan strands #3689F5 and #58BDD9, with a stronger blue core and restrained soft pale halo. The grand arc behind the hero should resemble fine luminous blue silk moving across a bright sky. Its small blue/cyan particles must stay visible against the light background. Do not wash it out into white.
- Logo, line icons, step circles, tabs and status pills: harmonious medium-blue accents.
- Contact panel: soft powder blue #E7F1FF.
- Remove harsh neon edging; replace with refined light-theme depth. Keep lower sections visually quiet and uncluttered.

Keep the original site information and structure. Preserve exact labels "dshjob", "让 AI 帮你找工作，从这里开始。", "免费获取工具", "查看使用教程", "演示数据", "Agent 智能体", "Skill 技能包", "MCP 工具连接", "查看 Gitee", "查看 GitHub", "simon", "微信：simonsxxs". Preserve the intentionally labeled QR placeholder "二维码原图位置"; never invent an actual QR pattern. Keep all footer content in frame. Tiny footer version label should read "首页视觉原型 v2 · 浅雾蓝".
Only restyle colors, light/shadow and particle visibility; do not add features, pricing, login, input forms, fake usage statistics or terminal code.
Aim for a warm, friendly, premium Chinese website for people new to AI. Entire page must be light, not just the hero.
```

