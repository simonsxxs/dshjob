/**
 * dshjob 全页粒子光束动效（Canvas 2D，经典脚本，无第三方库）
 *
 * 契约：index.html 在 <body> 起始处提供 .hero-motion-layer（固定全页装饰层，
 *       aria-hidden、pointer-events:none）> img.hero-beam（静态 SVG 兜底）
 *       + canvas#hero-canvas。无 canvas 的页面（教程页等）直接安全退出。
 *       页面不提供暂停按钮；系统「减少动态」设置与性能降档会自动退回静态 SVG。
 *
 * 渲染工艺（对齐 dshopc HeroFlowField.tsx 的光束 / 粒子工艺，配色锁定浅雾蓝家族）：
 *   氛围光斑 + 场景辉光（预渲染柔光贴图，缓慢漂移）
 *   → 三条复合光束（多层 stroke 沿束渐变 + 核心亮线呼吸 + 细丝流 filaments）
 *   → 三档景深粒子（沿束高斯散布 + 缓慢流动 + 摆动 + 指针点亮）与少量亮点节点。
 *   光束为全页固定背景：滚动在 5 个场景（对应首屏与各正文锚点）之间插值变形，
 *   亮度随场景档过渡：首屏最强，正文阅读区明显减弱（MOT-03），不锁滚动。
 *   运行动画时隐藏静态 SVG（光束由 Canvas 完整绘制，data-state="running"）；
 *   暂停 / 失败 / 系统减少动态 / 性能降到 static 档时清空画布，
 *   SVG 兜底渐显（data-state="static"），正文与链接不受影响。
 *
 * 指针交互（仅桌面档）：高斯衰减的局部扰动——只推动指针附近的光束采样点、
 *   细丝与粒子（带缓慢摆动，离开平滑回稳），总位移上限 8px（MOT-02）；
 *   指针附近粒子轻微提亮放大。不推动文字、按钮或页面本身。
 *
 * 状态机（design.md 第 6 节扩展）：
 *   允许绘制 = !userPaused && !reducedMotion && pageVisible && !failed && tier !== 'static'
 *   任一条件失效 → 立即 cancelAnimationFrame 并清空画布（露出静态 SVG）；
 *   恢复 → 重新评估全部条件，重置时间基线后恢复。
 *   本页唯一后台循环：任何时刻最多一个排队的 requestAnimationFrame。
 */
(function () {
  'use strict';

  /* ===== 元素与安全退出 ===== */
  var canvas = document.getElementById('hero-canvas');
  if (!canvas) return; // 教程页等无动效层：不注册任何监听，直接退出
  var layer = canvas.parentElement; // .hero-motion-layer（固定全页装饰层）

  var ctx = null;
  try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
  // 注意：2d context 为 null 的失败检查放在全部状态声明之后执行（见文件底部 init 前），
  // 避免 fail() 早于状态对象初始化而抛错。

  /* ===== 常量 ===== */
  var COLORS = {
    deep: '#2563EB', // 核心亮线：浅底上「亮」的读感来自高饱和深蓝
    blue: '#3689F5', // 主蓝
    cyan: '#58BDD9', // 青
    mistA: '#C7E2FF', // 氛围光斑浅蓝（同族）
    mistB: '#D6E9FF'
  };
  var LADDER = ['desktop', 'compact', 'mobile', 'static']; // 只降不升
  var TIERS = {
    // strands / fsamp：每束细丝条数与单丝采样点（细丝流预算随档位下降）
    desktop: { count: 360, dpr: 1.5,  mouse: true,  minFps: 45, strands: 22, fsamp: 36 },
    compact: { count: 180, dpr: 1.25, mouse: false, minFps: 28, strands: 10, fsamp: 28 },
    mobile:  { count: 100, dpr: 1,    mouse: false, minFps: 28, strands: 4,  fsamp: 20 },
    static:  { count: 0,   dpr: 1,    mouse: false, minFps: 0,  strands: 0,  fsamp: 0  }
  };
  var FPS_WINDOW_MS = 2000;   // 帧率统计窗口：连续可见的每 2 秒
  var FPS_BAD_WINDOWS = 3;    // 连续 3 个不达标窗口才降档，避免偶发抖动误伤
  var MAX_MOUSE_SHIFT = 8;    // 指针扰动位移上限（px，MOT-02）
  var POINTER_REST = { x: 0.72, y: 0.34 }; // 指针离开后的回稳位置（归一化）
  var SCENE_COUNT = 5;        // 场景数 = 页内 data-flow-scene 锚点数

  /* ===== 光束角色（三条束的线宽 / 颜色 / 透明度结构，跨场景共用） =====
   * 每条束由多层 stroke 复合：w 线宽（基准 px，随视口缩放）、col 颜色、
   * a 沿束透明度渐变 [起, 中, 穿出端]，穿出端最亮；core 层附带 ±10% 亮度呼吸。
   * sigma 为细丝流与沿束粒子的散布标准差（基准 px）。 */
  var BEAM_ROLES = [
    { // 主束
      sigma: 46,
      layers: [
        { w: 64,  col: COLORS.cyan, a: [0.03, 0.06, 0.09] },
        { w: 36,  col: COLORS.cyan, a: [0.04, 0.08, 0.12] },
        { w: 15,  col: COLORS.blue, a: [0.14, 0.24, 0.34] },
        { w: 6.5, col: COLORS.blue, a: [0.24, 0.40, 0.52] },
        { w: 2.6, col: COLORS.deep, a: [0.55, 0.80, 0.95], core: true }
      ]
    },
    { // 次级束：更细更淡
      sigma: 34,
      layers: [
        { w: 42,  col: COLORS.cyan, a: [0.02, 0.05, 0.08] },
        { w: 11,  col: COLORS.blue, a: [0.08, 0.15, 0.22] },
        { w: 1.6, col: COLORS.deep, a: [0.32, 0.52, 0.68], core: true }
      ]
    },
    { // 上行细束
      sigma: 26,
      layers: [
        { w: 30,  col: COLORS.cyan, a: [0.02, 0.04, 0.07] },
        { w: 8,   col: COLORS.blue, a: [0.06, 0.12, 0.18] },
        { w: 1.2, col: COLORS.deep, a: [0.26, 0.42, 0.56], core: true }
      ]
    }
  ];
  var ROLE_INTENSITY = [1, 0.75, 0.6]; // 细丝亮度按角色递减

  /* ===== 场景底稿（视口归一化坐标，滚动时逐场景插值变形） =====
   * curves[k] 为第 k 条束的三次贝塞尔四个控制点；glow 为场景辉光中心。
   * 场景对应页面锚点：0 首屏 / 1 能做什么 / 2 看看效果 / 3 获取工具 / 4 常见问题。 */
  var SCENES = [
    { // 首屏：主束左下入画弧线扫过，上行细束收向右上
      curves: [
        [[-0.08, 0.96], [0.30, 0.72], [0.72, 0.92], [1.12, 0.44]],
        [[-0.06, 1.10], [0.34, 0.88], [0.70, 1.04], [1.10, 0.62]],
        [[0.32, 1.08], [0.62, 0.58], [0.86, 0.40], [1.12, 0.24]]
      ],
      glow: [0.80, 0.40], glowStrength: 1
    },
    { // 能做什么：束形下沉，趋于平缓横波
      curves: [
        [[-0.10, 0.78], [0.24, 0.60], [0.52, 0.94], [1.10, 0.62]],
        [[-0.08, 0.92], [0.30, 0.76], [0.62, 1.02], [1.10, 0.78]],
        [[0.38, 1.06], [0.60, 0.72], [0.84, 0.60], [1.12, 0.48]]
      ],
      glow: [0.70, 0.62], glowStrength: 0.7
    },
    { // 看看效果：中部柔和拱波
      curves: [
        [[-0.10, 0.70], [0.26, 0.88], [0.55, 0.62], [1.10, 0.80]],
        [[-0.10, 0.82], [0.30, 1.00], [0.60, 0.74], [1.10, 0.92]],
        [[0.30, 1.08], [0.55, 0.86], [0.80, 0.74], [1.12, 0.66]]
      ],
      glow: [0.55, 0.72], glowStrength: 0.55
    },
    { // 获取工具：低位缓波
      curves: [
        [[-0.10, 0.82], [0.28, 0.66], [0.58, 0.90], [1.10, 0.70]],
        [[-0.10, 0.95], [0.32, 0.82], [0.66, 1.00], [1.10, 0.84]],
        [[0.42, 1.06], [0.62, 0.80], [0.86, 0.72], [1.12, 0.60]]
      ],
      glow: [0.68, 0.70], glowStrength: 0.45
    },
    { // 常见问题：最淡的底部漂移
      curves: [
        [[-0.10, 0.76], [0.30, 0.84], [0.60, 0.70], [1.10, 0.82]],
        [[-0.10, 0.88], [0.34, 0.94], [0.66, 0.80], [1.10, 0.92]],
        [[0.36, 1.06], [0.58, 0.88], [0.82, 0.80], [1.12, 0.72]]
      ],
      glow: [0.50, 0.78], glowStrength: 0.35
    }
  ];

  /* 场景亮度档：首屏最强，正文阅读区明显减弱（MOT-03）；随滚动插值 */
  var PROFILES = [
    { beam: 1.15, particles: 1.15, glow: 1.00 },
    { beam: 0.55, particles: 0.60, glow: 0.65 },
    { beam: 0.42, particles: 0.45, glow: 0.50 },
    { beam: 0.34, particles: 0.36, glow: 0.40 },
    { beam: 0.26, particles: 0.28, glow: 0.32 }
  ];

  /* 常驻氛围光斑：大面积浅蓝柔光（预渲染贴图 + 缓慢漂移），视口归一化定位 */
  var BLOBS = [
    { x: 0.845, y: 0.52, r: 330, a: 0.17, key: 'bA', dr: 14, sp: 0.05, ph: 1.7 },
    { x: 0.735, y: 0.36, r: 290, a: 0.15, key: 'bB', dr: 12, sp: 0.04, ph: 4.2 },
    { x: 0.16,  y: 0.87, r: 250, a: 0.10, key: 'bA', dr: 10, sp: 0.06, ph: 0.3 }
  ];

  /* ===== 独立状态（不得合并成单个布尔） ===== */
  var S = {
    userPaused: false,          // 用户主动暂停（本页有效，不写存储）
    reducedMotion: false,       // 系统减少动态，最高优先级，实时监听
    pageVisible: !document.hidden,
    failed: false,              // 图形失败，本页锁定，不自动重启
    tier: 'desktop'             // 档位；'static' 表示性能降级到静态
  };

  /* ===== 运行时变量 ===== */
  var rafId = null;             // 当前排队的 rAF（null 表示无）
  var lastT = 0;                // 上一帧时间；0 表示需要重置时间基线
  var simT = 0;                 // 动画时钟（呼吸 / 摆动 / 闪烁共用，恢复后不回跳）
  var particles = [];
  var cssW = 0, cssH = 0, dpr = 1;
  var sprites = {};             // 预渲染离屏贴图：粒子 / 大粒子辉光 / 氛围光斑
  var fillCache = {};           // 微粒实色字符串缓存
  var viewportScale = 1;        // 线宽 / 散布幅度随视口缩放（夹在 0.55–1.25）
  var anchors = [];             // data-flow-scene 锚点的页面纵坐标
  var scrollTarget = 0;         // 滚动对应的目标场景位置（浮点场景序号）
  var scrollValue = 0;          // 平滑后的当前场景位置
  var scrollDirty = true;       // scroll 只记录脏标记，绘制帧内消费
  var mouse = { x: POINTER_REST.x, y: POINTER_REST.y, tx: POINTER_REST.x, ty: POINTER_REST.y };
  var frameCurves = [];         // 本帧插值后的三束控制点
  var frameProfile = PROFILES[0]; // 本帧插值后的亮度档
  var frameGlow = { x: 0.8, y: 0.4, strength: 1 };
  var fpsWin = { start: 0, frames: 0, bad: 0 };
  var pt = { x: 0, y: 0 }, pt2 = { x: 0, y: 0 }, dpt = { x: 0, y: 0 };

  /* ===== 小工具 ===== */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t * t * (3 - 2 * t); }
  function fract(v) { return v - Math.floor(v); }
  function hash(v) { return fract(Math.sin(v * 127.1) * 43758.5453123); }
  function mq(query) {
    return window.matchMedia ? window.matchMedia(query) : { matches: false };
  }
  function rgba(hex, a) {
    return 'rgba(' + parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) +
      ',' + parseInt(hex.slice(5, 7), 16) + ',' + a + ')';
  }
  /* 颜色向白色混合（仅用于大粒子中心的一点高光），仍返回 #RRGGBB 供 rgba() 解析 */
  function mixWhite(hex, t) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  /* 三次贝塞尔取点（p 为 4 个控制点，t ∈ [0,1]），坐标为视口归一化 */
  function curvePoint(p, t, out) {
    var mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    out.x = a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0];
    out.y = a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1];
  }
  /* 近似标准正态（四次均匀采样之和） */
  function gauss() {
    return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 1.732;
  }

  /* ===== 预渲染贴图（离屏 canvas，逐帧 drawImage，不用 shadowBlur） ===== */
  function makeCanvas(size) {
    var s = document.createElement('canvas');
    s.width = s.height = size;
    var c = null;
    try { c = s.getContext('2d'); } catch (e) { c = null; }
    return c ? { el: s, c: c } : null;
  }
  /* 中等粒子：柔和实心小点 */
  function makeDot(color) {
    var m = makeCanvas(32);
    if (!m) return null;
    var g = m.c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, rgba(color, 0.95));
    g.addColorStop(0.4, rgba(color, 0.3));
    g.addColorStop(1, rgba(color, 0));
    m.c.fillStyle = g;
    m.c.fillRect(0, 0, 32, 32);
    return m.el;
  }
  /* 大粒子 / 节点：径向渐变辉光，中心一点近白高光（浅底上唯一的近白允许处） */
  function makeGlow(color) {
    var m = makeCanvas(96);
    if (!m) return null;
    var g = m.c.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, rgba(mixWhite(color, 0.6), 0.95));
    g.addColorStop(0.15, rgba(color, 0.8));
    g.addColorStop(0.42, rgba(color, 0.2));
    g.addColorStop(1, rgba(color, 0));
    m.c.fillStyle = g;
    m.c.fillRect(0, 0, 96, 96);
    return m.el;
  }
  /* 氛围光斑：大面积浅蓝柔光 */
  function makeBlob(color) {
    var m = makeCanvas(256);
    if (!m) return null;
    var g = m.c.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, rgba(color, 0.55));
    g.addColorStop(0.5, rgba(color, 0.24));
    g.addColorStop(1, rgba(color, 0));
    m.c.fillStyle = g;
    m.c.fillRect(0, 0, 256, 256);
    return m.el;
  }

  /* ===== 场景插值 ===== */
  function sceneState() {
    var bounded = clamp(scrollValue, 0, SCENE_COUNT - 1);
    var index = Math.min(SCENE_COUNT - 1, Math.floor(bounded));
    return { index: index, mix: index >= SCENE_COUNT - 1 ? 0 : ease(bounded - index) };
  }

  /* 每帧先算：三束控制点、亮度档、辉光中心按场景 mix 插值 */
  function updateFrameScene() {
    var st = sceneState();
    var a = SCENES[st.index];
    var b = SCENES[Math.min(st.index + 1, SCENE_COUNT - 1)];
    var pa = PROFILES[st.index];
    var pb = PROFILES[Math.min(st.index + 1, SCENE_COUNT - 1)];
    var m = st.mix;
    for (var r = 0; r < 3; r++) {
      var ca = a.curves[r], cb = b.curves[r];
      var out = frameCurves[r] || (frameCurves[r] = [[0, 0], [0, 0], [0, 0], [0, 0]]);
      for (var k = 0; k < 4; k++) {
        out[k][0] = lerp(ca[k][0], cb[k][0], m);
        out[k][1] = lerp(ca[k][1], cb[k][1], m);
      }
    }
    frameProfile = {
      beam: lerp(pa.beam, pb.beam, m),
      particles: lerp(pa.particles, pb.particles, m),
      glow: lerp(pa.glow, pb.glow, m)
    };
    frameGlow = {
      x: lerp(a.glow[0], b.glow[0], m),
      y: lerp(a.glow[1], b.glow[1], m),
      strength: lerp(a.glowStrength, b.glowStrength, m)
    };
    canvas.dataset.sceneIndex = String(st.index);
    canvas.dataset.sceneMix = m.toFixed(3);
  }

  /* 指针局部扰动（仅桌面档）：高斯衰减，只推动指针附近的点。
   * nx/ny 为视口归一化坐标；strength ∈ [0,1]；seed 让不同点错开摆动相位。
   * 输出 px 位移写入 out，总幅度由 MAX_MOUSE_SHIFT 封顶。 */
  function disturb(nx, ny, strength, seed, out) {
    out.x = 0; out.y = 0;
    if (!TIERS[S.tier].mouse) return;
    var dx = nx - mouse.x;
    var dy = (ny - mouse.y) * (cssH / Math.max(cssW, 1));
    var influence = Math.exp(-(dx * dx + dy * dy) / 0.02);
    var amp = influence * strength * MAX_MOUSE_SHIFT;
    if (amp < 0.05) return;
    out.x = amp * Math.sin(simT * 0.75 + seed * 4);
    out.y = amp * Math.cos(simT * 0.66 + seed * 3);
  }

  /* ===== 档位 ===== */
  function viewportTier() {
    var w = window.innerWidth || document.documentElement.clientWidth || 640;
    if (w < 640 || mq('(pointer: coarse)').matches) return 'mobile';
    if (w >= 1100 && mq('(pointer: fine)').matches) return 'desktop';
    return 'compact';
  }

  function resizeCanvas() {
    cssW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
    cssH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // 之后统一按 CSS 像素绘制
    ctx.clearRect(0, 0, cssW, cssH);
    viewportScale = clamp(Math.min(cssW, cssH) / 720, 0.55, 1.25);
    for (var n = 0; n < BLOBS.length; n++) {
      var bl = BLOBS[n];
      bl.px = bl.x * cssW;
      bl.py = bl.y * cssH;
      bl.pr = bl.r * viewportScale;
    }
    measureAnchors();
  }

  /* 粒子构建：三档景深（微 / 中 / 大）+ 少量亮点节点（node）。
   * 九成沿束高斯散布、一成散在走廊外围偏右；node 更亮更慢，绕束点轻微环绕。
   * key 决定绘制方式与贴图（node 复用大粒子辉光贴图）；构建后按 key 排序，
   * 逐帧成组绘制减少状态切换。 */
  var KEY_RANK = { mb: 0, mc: 1, db: 2, dc: 3, gb: 4, gc: 5 };
  function buildParticles(count) {
    particles = [];
    for (var i = 0; i < count; i++) {
      var d = Math.random();          // 景深：0 远（小而暗）→ 1 近（大而亮）
      var roll = Math.random();
      var field = Math.random() < 0.10; // 少量散点铺在光束走廊外围
      var path = 0;
      if (!field) {
        var pr = Math.random();
        path = pr < 0.42 ? 0 : (pr < 0.78 ? 1 : 2); // 按束长度加权分流
      }
      var blue = Math.random() < 0.5;
      var node = false, type, size, alpha;
      if (roll < 0.06) {        // 亮点节点（~6%）：更亮更慢，轻微环绕
        node = true; type = 'g'; size = 2.2 + Math.random() * 2; alpha = 0.5 + 0.35 * d;
      } else if (roll < 0.14) { // 大粒子（~8%）：辉光贴图
        type = 'g'; size = 2 + Math.random() * 2; alpha = 0.5 + 0.3 * d;
      } else if (roll < 0.45) { // 中粒子（主体）
        type = 'd'; size = 1 + Math.random(); alpha = 0.35 + 0.35 * d;
      } else {                  // 微粒（铺底）
        type = 'm'; size = 0.5 + Math.random() * 0.5; alpha = 0.10 + 0.20 * d;
      }
      particles.push({
        field: field, path: path, node: node,
        t: Math.random(),                                 // 沿束相位
        speed: (0.010 + Math.random() * 0.022) * (0.65 + 0.5 * d) * (node ? 0.5 : 1), // 走完约 30–100 秒
        dir: Math.random() < 0.10 ? -1 : 1,               // 少量逆向
        gu: gauss(),                                      // 法向高斯偏移（标准差单位）
        wobA: 1.5 + 3 * d,                                // 法向慢摆幅度
        wobR: 0.25 + Math.random() * 0.5,
        wobP: Math.random() * 6.283,
        twR: type === 'm' ? 0 : 0.5 + Math.random() * 1.3, // 微粒不闪烁
        twP: Math.random() * 6.283,
        size: size, alpha: alpha, depth: d,
        key: type + (blue ? 'b' : 'c'),
        fx: 0.06 + 0.92 * Math.pow(Math.random(), 0.72),  // 散点偏右（左稳右飘）
        fy: Math.random()
      });
    }
    particles.sort(function (a, b) { return KEY_RANK[a.key] - KEY_RANK[b.key]; });
  }

  /* 应用档位：重设 DPR、尺寸与粒子预算；static 时停帧只留 SVG */
  function applyTier(tier) {
    var cfg = TIERS[tier];
    S.tier = tier;
    dpr = Math.min(window.devicePixelRatio || 1, cfg.dpr);
    resizeCanvas();
    if (particles.length !== cfg.count) buildParticles(cfg.count);
    resetFpsWindow();
    if (tier === 'static') stopDrawing(); // 性能降级：停帧，SVG 可见
  }

  /* ===== 滚动场景锚点 ===== */
  function measureAnchors() {
    var els = document.querySelectorAll('[data-flow-scene]');
    var y = window.scrollY || window.pageYOffset || 0;
    anchors = [];
    for (var i = 0; i < els.length; i++) {
      anchors.push(els[i].getBoundingClientRect().top + y);
    }
    if (anchors.length !== SCENE_COUNT) { // 锚点缺失时均匀兜底，不影响绘制
      anchors = [];
      for (var k = 0; k < SCENE_COUNT; k++) anchors.push(k * Math.max(cssH, 780));
    }
  }

  function updateScrollTarget() {
    if (!anchors.length) measureAnchors();
    var y = window.scrollY || window.pageYOffset || 0;
    var idx = anchors.length - 1;
    for (var k = 0; k < anchors.length - 1; k++) {
      if (y < anchors[k + 1]) { idx = k; break; }
    }
    var start = anchors[idx];
    var end = anchors[Math.min(idx + 1, anchors.length - 1)];
    var local = end > start ? clamp((y - start) / (end - start), 0, 1) : 0;
    scrollTarget = idx + local;
  }

  /* ===== 绘制门控 ===== */
  function allowed() {
    return !S.failed && S.tier !== 'static' && !S.userPaused &&
      !S.reducedMotion && S.pageVisible;
  }

  function schedule() {
    if (rafId === null && allowed()) rafId = requestAnimationFrame(tick);
  }

  /* 停帧：取消排队 rAF、清空画布露出静态 SVG、标记时间基线待重置 */
  function stopDrawing() {
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    lastT = 0;
    if (layer) layer.dataset.state = 'static'; // SVG 兜底渐显
    try { if (cssW && cssH) ctx.clearRect(0, 0, cssW, cssH); } catch (e) { fail(); }
  }

  /* 任何状态变化后的统一入口：允许则恢复（重置基线与帧率样本），否则立即停帧 */
  function reevaluate() {
    if (allowed()) {
      if (layer) layer.dataset.state = 'running'; // 隐藏静态 SVG，光束由 Canvas 绘制
      lastT = 0; resetFpsWindow(); schedule();
    } else {
      stopDrawing();
    }
  }

  function resetFpsWindow() { fpsWin.start = 0; fpsWin.frames = 0; }

  /* 性能降档：降一档并重设预算；最低档仍不达标 → static */
  function downgrade() {
    var idx = LADDER.indexOf(S.tier);
    applyTier(LADDER[Math.min(idx + 1, LADDER.length - 1)]);
    fpsWin.bad = 0; // 降档后清空慢窗口样本
  }

  /* ===== 光束与细丝 ===== */
  /* 单束采样折线（带指针扰动），供 stroke 层使用；返回端点供渐变取向 */
  function strokeBeam(role, roleIndex, breath) {
    var samples = 56;
    var pts = frameCurves[roleIndex];
    var path = (typeof Path2D === 'function') ? new Path2D() : null;
    var x0 = 0, y0 = 0, x1 = 0, y1 = 0;
    ctx.beginPath();
    for (var k = 0; k <= samples; k++) {
      var t = k / samples;
      curvePoint(pts, t, pt);
      disturb(pt.x, pt.y, 0.5, t, dpt);
      var x = pt.x * cssW + dpt.x;
      var y = pt.y * cssH + dpt.y;
      if (k === 0) { x0 = x; y0 = y; }
      if (k === samples) { x1 = x; y1 = y; }
      if (path) { if (k === 0) path.moveTo(x, y); else path.lineTo(x, y); }
      else { if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    }
    for (var li = 0; li < role.layers.length; li++) {
      var lay = role.layers[li];
      var g = ctx.createLinearGradient(x0, y0, x1, y1);
      var boost = frameProfile.beam;
      g.addColorStop(0, rgba(lay.col, clamp(lay.a[0] * boost, 0, 1)));
      g.addColorStop(0.5, rgba(lay.col, clamp(lay.a[1] * boost, 0, 1)));
      g.addColorStop(1, rgba(lay.col, clamp(lay.a[2] * boost, 0, 1)));
      ctx.strokeStyle = g;
      ctx.lineWidth = Math.max(1, lay.w * viewportScale);
      ctx.globalAlpha = lay.core ? breath : 1;
      if (path) ctx.stroke(path); else ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* 细丝流：每束 N 条 1px 细线，车道 pow 分布（中间密两边疏），
   * 各自只占束的一段、带时间相位波动——dshopc 光束的标志性纹理 */
  function strokeFilaments(role, roleIndex) {
    var cfg = TIERS[S.tier];
    var strands = cfg.strands;
    if (!strands) return;
    var samples = cfg.fsamp;
    var pts = frameCurves[roleIndex];
    var spread = role.sigma * viewportScale;
    ctx.lineWidth = Math.max(0.75, viewportScale);
    for (var s = 0; s < strands; s++) {
      var laneRaw = (s / Math.max(strands - 1, 1)) * 2 - 1;
      var lane = (laneRaw < 0 ? -1 : 1) * Math.pow(Math.abs(laneRaw), 0.74);
      var tStart = hash(s * 3.7 + roleIndex * 19.1) * 0.14;
      var tEnd = 0.82 + hash(s * 4.9 + roleIndex * 23.4) * 0.18;
      var phase = s * 0.39 + roleIndex;
      ctx.beginPath();
      for (var k = 0; k <= samples; k++) {
        var local = k / samples;
        var t = lerp(tStart, tEnd, local);
        curvePoint(pts, clamp(t - 0.002, 0, 1), pt);
        var bx = pt.x, by = pt.y;
        curvePoint(pts, clamp(t + 0.002, 0, 1), pt2);
        curvePoint(pts, t, pt);
        var dx = (pt2.x - bx) * cssW, dy = (pt2.y - by) * cssH;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len; // 曲线法线方向
        var waveLane = lane + Math.sin(s * 2.18 + roleIndex * 1.7 + t * 5.4) * (0.045 + hash(s + 71) * 0.08);
        var wave = Math.sin(t * 18 + phase + simT * 0.24) * spread * 0.12;
        var off = waveLane * spread * 0.9 + wave;
        var pxn = pt.x + nx * off / Math.max(cssW, 1);
        var pyn = pt.y + ny * off / Math.max(cssH, 1);
        disturb(pxn, pyn, 0.4 + Math.abs(lane) * 0.2, lane + s, dpt);
        var x = pxn * cssW + dpt.x;
        var y = pyn * cssH + dpt.y;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      var centrality = 1 - Math.abs(laneRaw);
      var a = (0.05 + centrality * 0.15) * frameProfile.beam * ROLE_INTENSITY[roleIndex];
      ctx.strokeStyle = centrality > 0.5 ? rgba(COLORS.blue, a) : rgba(COLORS.cyan, a * 0.9);
      ctx.globalAlpha = 1;
      ctx.stroke();
    }
  }

  /* ===== 唯一绘制循环 ===== */
  function tick(now) {
    rafId = null; // 本帧已消费，先清标志，保证任何时刻最多一个排队 rAF
    try {
      if (lastT === 0) lastT = now;                       // 恢复后的首帧：重置基线，dt 从 0 起
      if (fpsWin.start === 0) { fpsWin.start = now; fpsWin.frames = 0; }
      var dt = Math.min(0.05, (now - lastT) / 1000);      // 钳制大间隔，避免跳变
      lastT = now;
      simT += dt;

      /* 帧率治理：每 2 秒窗口统计实际帧数（只在真实绘制期间累积） */
      fpsWin.frames++;
      if (now - fpsWin.start >= FPS_WINDOW_MS) {
        var fps = fpsWin.frames * 1000 / (now - fpsWin.start);
        fpsWin.start = now; fpsWin.frames = 0;
        if (fps < TIERS[S.tier].minFps) {
          fpsWin.bad++;
          if (fpsWin.bad >= FPS_BAD_WINDOWS) {
            downgrade();
            if (!allowed()) return; // 已进入 static：不再排队
          }
        } else {
          fpsWin.bad = 0;
        }
      }

      /* 指针平滑趋近目标（仅桌面档；其余档固定回稳点且扰动关闭） */
      if (TIERS[S.tier].mouse) {
        mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 5);
        mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 5);
      } else {
        mouse.x = POINTER_REST.x; mouse.y = POINTER_REST.y;
      }

      /* 滚动：绘制时才消费进度，场景位置平滑趋近目标 */
      if (scrollDirty) { scrollDirty = false; updateScrollTarget(); }
      scrollValue += (scrollTarget - scrollValue) * Math.min(1, dt * 6.5);
      updateFrameScene();

      /* ---- 1. 氛围光斑 + 场景辉光（最底层，缓慢漂移） ---- */
      ctx.clearRect(0, 0, cssW, cssH);
      for (var bi = 0; bi < BLOBS.length; bi++) {
        var bl = BLOBS[bi];
        var bx = bl.px + Math.sin(simT * bl.sp + bl.ph) * bl.dr;
        var by = bl.py + Math.cos(simT * bl.sp * 0.87 + bl.ph) * bl.dr;
        ctx.globalAlpha = bl.a * frameProfile.glow;
        ctx.drawImage(sprites[bl.key], bx - bl.pr, by - bl.pr, bl.pr * 2, bl.pr * 2);
      }
      var gr = 340 * viewportScale;
      ctx.globalAlpha = 0.16 * frameGlow.strength * frameProfile.glow;
      ctx.drawImage(sprites.bB, frameGlow.x * cssW - gr, frameGlow.y * cssH - gr, gr * 2, gr * 2);

      /* ---- 2. 三条复合光束：多层 stroke + 细丝流，核心线亮度呼吸 ---- */
      var breath = 1 + 0.10 * Math.sin(simT * 0.97); // 周期约 6.5 秒
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var b = 0; b < BEAM_ROLES.length; b++) {
        strokeBeam(BEAM_ROLES[b], b, breath);
        strokeFilaments(BEAM_ROLES[b], b);
      }

      /* ---- 3. 粒子：按 key 成组绘制，减少样式切换 ---- */
      var mouseOn = TIERS[S.tier].mouse;
      var lastKey = '';
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        var x, y, a;
        if (p.field) {
          /* 走廊外围散点：定点轻微游移 */
          x = p.fx * cssW + Math.sin(simT * p.wobR + p.wobP) * 4;
          y = p.fy * cssH + Math.cos(simT * p.wobR * 0.83 + p.wobP) * 6;
          a = p.alpha;
        } else {
          p.t += p.speed * p.dir * dt;
          if (p.t > 1) p.t -= 1; else if (p.t < 0) p.t += 1;

          var cp = frameCurves[p.path];
          curvePoint(cp, p.t, pt);
          curvePoint(cp, clamp(p.t + 0.004 * p.dir, 0, 1), pt2);
          var tx = (pt2.x - pt.x) * cssW, ty = (pt2.y - pt.y) * cssH;
          var len = Math.sqrt(tx * tx + ty * ty);
          var nx2 = 0, ny2 = 0;
          if (len > 0.00001) { nx2 = -ty / len; ny2 = tx / len; } // 曲线法线方向

          /* 法向高斯偏移 + 慢速正弦摆动；穿出端略亮（端点在画布外，环绕不闪跳） */
          var o = p.gu * BEAM_ROLES[p.path].sigma * viewportScale + Math.sin(simT * p.wobR + p.wobP) * p.wobA;
          x = pt.x * cssW + nx2 * o;
          y = pt.y * cssH + ny2 * o;
          if (p.node) { // 亮点节点：绕束点轻微环绕
            var orb = 3 + 4 * p.depth;
            x += Math.cos(simT * (0.28 + p.speed * 7) + p.twP) * orb;
            y += Math.sin(simT * (0.24 + p.speed * 6) + p.twP) * orb;
          }
          disturb(x / cssW, y / cssH, 0.8, p.gu + p.wobP, dpt);
          x += dpt.x; y += dpt.y;
          a = p.alpha * (0.72 + 0.45 * p.t);
        }
        if (x < -8 || x > cssW + 8 || y < -8 || y > cssH + 8) continue; // 画布外跳过

        var alpha = a * frameProfile.particles;
        var sizeMul = 1;
        if (mouseOn) { // 指针点亮：附近粒子轻微变亮变大
          var pdx = (x / cssW - mouse.x) * 1.2, pdy = y / cssH - mouse.y;
          var light = Math.exp(-(pdx * pdx + pdy * pdy) / 0.025);
          sizeMul = 1 + light * 1.1;
          alpha *= 0.92 + light * 0.8;
        }
        if (p.twR) alpha *= 0.76 + 0.24 * Math.sin(simT * p.twR + p.twP); // 缓慢闪烁
        ctx.globalAlpha = clamp(alpha, 0, 1);
        if (p.key === 'mb' || p.key === 'mc') {
          if (p.key !== lastKey) { ctx.fillStyle = fillCache[p.key]; lastKey = p.key; }
          var sz = p.size * 2 * sizeMul;
          ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
        } else {
          var dd = p.size * (p.key.charAt(0) === 'g' ? 3.4 : 2.6) * sizeMul;
          if (p.node) dd *= 1.4;
          ctx.drawImage(sprites[p.key], x - dd, y - dd, dd * 2, dd * 2);
          lastKey = p.key;
        }
      }
      ctx.globalAlpha = 1;
    } catch (err) {
      fail(); // 绘制抛错：锁定失败，保留静态 SVG
      return;
    }
    schedule(); // 仍允许时排队下一帧
  }

  /* ===== 失败锁定 ===== */
  function fail() {
    S.failed = true; // 锁定，本页不再自动重启
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    if (layer) layer.dataset.state = 'static';
    try { if (cssW && cssH) ctx.clearRect(0, 0, cssW, cssH); } catch (e) {}
  }

  /* ===== 事件绑定（各只注册一次） ===== */
  function bindEvents() {
    /* 系统减少动态：实时监听并即时生效 */
    var rm = mq('(prefers-reduced-motion: reduce)');
    S.reducedMotion = rm.matches;
    var onRM = function (e) { S.reducedMotion = e.matches; reevaluate(); };
    if (rm.addEventListener) rm.addEventListener('change', onRM);
    else if (rm.addListener) rm.addListener(onRM); // 旧 Safari 兜底

    /* 页面可见性：隐藏停帧；恢复时 reevaluate 内重置时间基线 */
    document.addEventListener('visibilitychange', function () {
      S.pageVisible = !document.hidden;
      reevaluate();
    });

    /* 滚动：只记录，不在这里读布局 */
    window.addEventListener('scroll', function () { scrollDirty = true; }, { passive: true });

    /* 指针：监听在 window 上（动效层自身 pointer-events:none 且全页固定） */
    window.addEventListener('pointermove', function (e) {
      if (!TIERS[S.tier].mouse || e.pointerType === 'touch') return;
      mouse.tx = clamp(e.clientX / Math.max(cssW, 1), 0, 1);
      mouse.ty = clamp(e.clientY / Math.max(cssH, 1), 0, 1);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () {
      mouse.tx = POINTER_REST.x; mouse.ty = POINTER_REST.y; // 离开后目标回稳，绘制中平滑复位
    });

    /* resize：防抖后只重设尺寸与档位，不重复注册循环；本页不自动升档 */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        if (S.tier === 'static' || S.failed) return;
        var want = LADDER.indexOf(viewportTier());
        var cur = LADDER.indexOf(S.tier);
        applyTier(LADDER[Math.max(want, cur)]); // 只允许更低的档位生效
        reevaluate();
      }, 150);
    });

    /* 图片等加载完成后布局可能变化：重新测量场景锚点 */
    window.addEventListener('load', function () { measureAnchors(); scrollDirty = true; });

    /* 上下文丢失：立即锁定失败，不尝试恢复 */
    canvas.addEventListener('contextlost', function () { fail(); });
  }

  /* ===== 初始化 ===== */
  function init() {
    sprites['db'] = makeDot(COLORS.blue);
    sprites['dc'] = makeDot(COLORS.cyan);
    sprites['gb'] = makeGlow(COLORS.blue);
    sprites['gc'] = makeGlow(COLORS.cyan);
    sprites['bA'] = makeBlob(COLORS.mistA);
    sprites['bB'] = makeBlob(COLORS.mistB);
    fillCache['mb'] = COLORS.blue;
    fillCache['mc'] = COLORS.cyan;
    for (var k in sprites) {
      if (!sprites[k]) { fail(); return; }
    }
    bindEvents();
    applyTier(viewportTier());
    updateScrollTarget();
    scrollValue = scrollTarget; // 初始直接落在当前滚动位置对应的场景，避免入场变形
    reevaluate();

    /* 唯一调试句柄（只读状态 + 受限控制，不参与页面逻辑） */
    window.__dshHero = {
      get state() {
        return {
          userPaused: S.userPaused, reducedMotion: S.reducedMotion,
          pageVisible: S.pageVisible,
          tier: S.tier, failed: S.failed, particles: particles.length,
          scene: Math.round(scrollValue * 1000) / 1000, sceneTarget: scrollTarget,
          slowWindows: fpsWin.bad, drawing: rafId !== null
        };
      },
      pause: function () {
        if (!S.userPaused) { S.userPaused = true; reevaluate(); }
      },
      resume: function () {
        if (S.userPaused && !S.failed && S.tier !== 'static' && !S.reducedMotion) {
          S.userPaused = false; reevaluate();
        }
      }
    };
  }

  // 2d 上下文不可用：锁定失败，保留静态 SVG，按钮保持 hidden
  if (!ctx) { fail(); return; }

  init();
})();
