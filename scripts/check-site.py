#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dshjob.com 静态站点发布前检查（仅用 Python 标准库）。

检查范围对应 openspec/changes/dshjob-static-site-v1/design.md 第 7、8 节：
  1. 必需文件存在（social-card.png 允许缺失，仅警告）；
  2. 三个 HTML 的内部链接 / 锚点 / 资源指向存在，外链仅限两个仓库白名单；
  3. 页面基础字段：lang、中文 title、meta description、唯一 h1、img 完整属性、
     404 页 noindex、guide 页不引入 hero-motion.js、index 页必须引入
     site.js 与 hero-motion.js 且带 defer；
  4. 四张 .mode-card 的 data-mode / data-status 合法，且不把「下载」措辞
     用于仓库链接（软件卡无 artifacts 时不得出现下载入口）；
  5. 不泄漏内部路径或原始素材引用；
  6. gzip 字节预算与单文件大小上限。

用法：
    python3 scripts/check-site.py [--root <站点根目录>]

站点文件由其他任务并行编写，允许暂缺：缺失会逐条打印 [FAIL] 并以退出码 1
结束，不会让脚本崩溃；全部通过时退出码 0。
"""

from __future__ import annotations

import argparse
import gzip
import json
import posixpath
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

# 默认站点根目录：本脚本位于 <仓库根>/scripts/，根取上一级
ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

SITE_PAGES = ("index.html", "guide.html", "404.html")

REQUIRED_FILES = (
    "index.html",
    "guide.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "assets/site.css",
    "assets/site.js",
    "assets/hero-motion.js",
    "assets/hero-beam.svg",
    "assets/simon-wechat.jpg",
    "assets/favicon.svg",
)

# 允许缺失的可选文件（缺失只提示 [WARN]）
OPTIONAL_FILES = ("assets/social-card.png",)

# gzip 预算覆盖的七个核心文件（HTML + CSS + JS + 光束 SVG）
BUDGET_FILES = (
    "index.html",
    "guide.html",
    "404.html",
    "assets/site.css",
    "assets/site.js",
    "assets/hero-motion.js",
    "assets/hero-beam.svg",
)

GZIP_TOTAL_LIMIT = 300 * 1024   # 七个核心文件 gzip 后合计 ≤ 300KB
HERO_BEAM_LIMIT = 60 * 1024     # hero-beam.svg 原始体积 ≤ 60KB
WECHAT_JPG_LIMIT = 600 * 1024   # simon-wechat.jpg 原始体积 ≤ 600KB

# 外链白名单：官网与技能包两个项目的精确仓库及其 /releases 子路径（仅允许 https）
# 2026-09-15 起 Skill 技能包（dshjob-skills）已发布，加入白名单
REPO_ALLOWED = (
    "github.com/simonsxxs/dshjob",
    "gitee.com/simonsxx/dshjob",
    "github.com/simonsxxs/dshjob-skills",
    "gitee.com/simonsxx/dshjob-skills",
)
RELEASE_SUBPATH = "/releases"

# 关联站点白名单：页脚「关联链接」指向的同人生态站点，仅允许 https 根路径
# 2026-09-16 按用户要求加入（dshopc / dshgeo / opcmode）
SITE_ALLOWED = ("dshopc.com", "dshgeo.com", "opcmode.com")

# link rel=canonical 的自引用只允许正式域名的两种写法（design 第 1 节）
CANONICAL_ALLOWED = ("https://dshjob.com/", "https://dshjob.com/guide")

VALID_MODES = ("software", "agent", "skill", "mcp")
VALID_STATUS = ("pending", "repository-only", "ready", "unavailable")

# 内部信息泄漏特征：在发布文本中出现即失败
LEAK_PATTERNS = (
    "/Users/",
    "simon-wechat-original",
    "docs/",
    "openspec/",
    "prototype/",
)

# 参与泄漏扫描的发布文本文件（图片等二进制不扫描）
LEAK_SCAN_FILES = (
    "index.html",
    "guide.html",
    "404.html",
    "robots.txt",
    "sitemap.xml",
    "assets/site.css",
    "assets/site.js",
    "assets/hero-motion.js",
    "assets/hero-beam.svg",
)

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
IP_HOST_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}$")

# HTML void 元素：没有结束标签，不进入嵌套栈
VOID_TAGS = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
})


# ---------------------------------------------------------------------------
# 结果输出
# ---------------------------------------------------------------------------

class Report:
    """逐条打印检查结果，并统计通过 / 警告 / 失败数量。"""

    def __init__(self) -> None:
        self.ok_count = 0
        self.warn_count = 0
        self.fail_count = 0
        self.failures: list[str] = []

    def ok(self, msg: str) -> None:
        self.ok_count += 1
        print(f"[OK] {msg}")

    def warn(self, msg: str) -> None:
        self.warn_count += 1
        print(f"[WARN] {msg}")

    def fail(self, msg: str) -> None:
        self.fail_count += 1
        self.failures.append(msg)
        print(f"[FAIL] {msg}")

    def finish(self) -> int:
        print()
        print(f"检查完成：通过 {self.ok_count} 项，警告 {self.warn_count} 项，失败 {self.fail_count} 项。")
        if self.failures:
            print("失败汇总：")
            for item in self.failures:
                print(f"  - {item}")
            print("存在失败项，站点不可打包发布。")
            return 1
        print("全部检查通过。")
        return 0


# ---------------------------------------------------------------------------
# HTML 解析
# ---------------------------------------------------------------------------

class PageParser(HTMLParser):
    """解析单个 HTML 页面，收集链接、锚点、图片、脚本与 .mode-card 信息。

    只做只读收集，不改写任何内容；对书写不规范的 HTML 尽力容忍。
    """

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.title_text = ""
        self.meta_description: str | None = None
        self.robots_content: str | None = None
        self.h1_count = 0
        self.ids: set[str] = set()
        # 每项：dict(tag, attr, url, line, rel)
        self.links: list[dict] = []
        # 每项：dict(line, alt, width, height, src, srcset)
        self.imgs: list[dict] = []
        # 每项：dict(line, src, defer)
        self.scripts: list[dict] = []
        # 每项：dict(line, mode, status, artifacts, anchors, buttons)
        self.cards: list[dict] = []
        # 全页收集到的锚点 / 按钮文本（用于「下载」措辞检查）
        self.anchors_all: list[dict] = []
        self.buttons_all: list[dict] = []

        self._title_open = False
        # 通用元素嵌套栈：每项记录 {"tag", "card"}，card 为该元素所属的 mode-card
        # （.mode-card 按类名判定，不限标签，因此用通用栈而不是只看 div）
        self._stack: list[dict] = []
        # 未闭合的 a/button 文本收集器
        self._collectors: list[dict] = []

    # -- 小工具 ------------------------------------------------------------

    @staticmethod
    def _attr_dict(attrs) -> dict:
        return {name.lower(): value for name, value in attrs}

    def _current_card(self) -> dict | None:
        return self._stack[-1]["card"] if self._stack else None

    def _finish_collector(self, item: dict) -> None:
        """把一个 a/button 收集器落盘到全页列表与其所属卡片。"""
        record = {
            "url": item["url"],
            "text": "".join(item["text"]).strip(),
            "card": item["card"],
            "line": item["line"],
        }
        if item["kind"] == "a":
            self.anchors_all.append(record)
        else:
            self.buttons_all.append(record)
        card = item["card"]
        if card is not None:
            target = card["anchors"] if item["kind"] == "a" else card["buttons"]
            target.append(record)

    # -- 解析事件 ----------------------------------------------------------

    def handle_starttag(self, tag, attrs):
        a = self._attr_dict(attrs)

        if tag == "html":
            self.lang = a.get("lang")
        elif tag == "title":
            self._title_open = True
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "meta":
            name = (a.get("name") or "").strip().lower()
            if name == "description":
                self.meta_description = a.get("content")
            elif name == "robots":
                self.robots_content = a.get("content")

        if a.get("id"):
            self.ids.add(a["id"])

        # 元素栈：非 void 元素入栈；任意标签带 mode-card 类名即开启卡片作用域
        if tag not in VOID_TAGS:
            if "mode-card" in (a.get("class") or "").split():
                card = {
                    "line": self.getpos()[0],
                    "mode": a.get("data-mode"),
                    "status": a.get("data-status"),
                    "artifacts": a.get("data-artifacts"),
                    "anchors": [],
                    "buttons": [],
                }
                self.cards.append(card)
            else:
                # 内部元素继承外层卡片，保证卡片内任意深度的链接都能归属
                card = self._current_card()
            self._stack.append({"tag": tag, "card": card})

        if tag in ("a", "button"):
            self._collectors.append({
                "kind": tag,
                "url": a.get("href") if tag == "a" else None,
                "text": [],
                "card": self._current_card(),
                "line": self.getpos()[0],
            })
        elif tag == "img":
            self.imgs.append({
                "line": self.getpos()[0],
                "alt": a.get("alt"),
                "width": a.get("width"),
                "height": a.get("height"),
                "src": a.get("src"),
                "srcset": a.get("srcset"),
            })
        elif tag == "script":
            self.scripts.append({
                "line": self.getpos()[0],
                "src": a.get("src"),
                "defer": "defer" in a,
            })

        # 通用收集 href / src / xlink:href（覆盖 link、script、img、a、SVG use 等）
        for attr in ("href", "src", "xlink:href"):
            if a.get(attr):
                self.links.append({
                    "tag": tag,
                    "attr": attr,
                    "url": a[attr],
                    "line": self.getpos()[0],
                    "rel": a.get("rel"),
                })

    def handle_endtag(self, tag):
        if tag == "title":
            self._title_open = False
        if tag in ("a", "button"):
            # 关闭最近一个同类型收集器（尽力容忍不规范嵌套）
            for i in range(len(self._collectors) - 1, -1, -1):
                if self._collectors[i]["kind"] == tag:
                    self._finish_collector(self._collectors.pop(i))
                    break
        # 从栈顶向下找同名元素弹出，同时隐式关闭未闭合的内部元素
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i]["tag"] == tag:
                del self._stack[i:]
                break

    def handle_data(self, data):
        if self._title_open:
            self.title_text += data
        for collector in self._collectors:
            collector["text"].append(data)

    def close(self):
        super().close()
        # 兜底：容忍未闭合的 a/button
        while self._collectors:
            self._finish_collector(self._collectors.pop())


# ---------------------------------------------------------------------------
# 检查逻辑
# ---------------------------------------------------------------------------

class SiteChecker:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.report = Report()
        self.pages: dict[str, PageParser] = {}

    # -- 顶层流程 ----------------------------------------------------------

    def run(self) -> int:
        self.check_required_files()
        self.parse_pages()
        self.check_links()
        self.check_page_fields()
        self.check_cards()
        self.check_leaks()
        self.check_budgets()
        return self.report.finish()

    # -- 1. 必需文件 -------------------------------------------------------

    def _file_state(self, rel: str) -> str:
        path = self.root / rel
        if path.is_symlink():
            return "symlink"
        if not path.exists():
            return "missing"
        if not path.is_file():
            return "not-file"
        return "ok"

    def check_required_files(self) -> None:
        for rel in REQUIRED_FILES:
            state = self._file_state(rel)
            if state == "ok":
                self.report.ok(f"必需文件存在：{rel}")
            elif state == "missing":
                self.report.fail(f"缺少必需文件：{rel}")
            elif state == "symlink":
                self.report.fail(f"必需文件是符号链接（不允许）：{rel}")
            else:
                self.report.fail(f"必需文件不是常规文件：{rel}")
        for rel in OPTIONAL_FILES:
            state = self._file_state(rel)
            if state == "ok":
                self.report.ok(f"可选文件存在：{rel}")
            elif state == "missing":
                self.report.warn(f"可选文件缺失（允许，仅提示）：{rel}")
            elif state == "symlink":
                self.report.fail(f"可选文件是符号链接（不允许）：{rel}")
            else:
                self.report.fail(f"可选文件不是常规文件：{rel}")

    # -- 2. 页面解析 -------------------------------------------------------

    def parse_pages(self) -> None:
        for rel in SITE_PAGES:
            path = self.root / rel
            if not path.is_file():
                continue  # 缺失已在必需文件检查中报告
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
                page = PageParser()
                page.feed(text)
                page.close()
                self.pages[rel] = page
            except Exception as exc:  # 解析异常不应让检查脚本崩溃
                self.report.fail(f"{rel} 解析失败：{exc}")

    # -- 3. 链接与锚点 -----------------------------------------------------

    def _classify_external(self, url: str) -> tuple[bool, str, str]:
        """判定外链是否在白名单内。

        返回 (是否允许, 分类 repo-root/repo-releases/空, 不允许时的原因)。
        """
        parts = urlsplit(url)
        scheme = (parts.scheme or "").lower()
        host = (parts.hostname or "").lower()
        if scheme not in ("http", "https"):
            return False, "", f"必须使用 http(s)，当前协议为「{parts.scheme or '空'}」"
        if scheme != "https":
            return False, "", "必须使用 https"
        if host == "localhost" or host in ("127.0.0.1", "0.0.0.0") or IP_HOST_RE.match(host):
            return False, "", "不允许链接 localhost 或 IP 地址"
        if host == "example.com" or host.endswith(".example.com"):
            return False, "", "不允许使用 example.com 占位链接"
        path = parts.path or ""
        # 关联站点：仅允许根路径（https://<域名>/），不带更深子路径
        if host in SITE_ALLOWED and path in ("", "/"):
            return True, "site-root", ""
        for repo in REPO_ALLOWED:
            repo_host, _, repo_path = repo.partition("/")
            if host != repo_host:
                continue
            repo_prefix = "/" + repo_path
            if path.rstrip("/") == repo_prefix:
                return True, "repo-root", ""
            if path == repo_prefix + RELEASE_SUBPATH or path.startswith(repo_prefix + RELEASE_SUBPATH + "/"):
                return True, "repo-releases", ""
        return False, "", (
            "不在外链白名单（仅允许 github.com/simonsxxs/dshjob、"
            "gitee.com/simonsxx/dshjob、github.com/simonsxxs/dshjob-skills、"
            "gitee.com/simonsxx/dshjob-skills 及以上仓库的 /releases 子路径，"
            "或关联站点 dshopc.com / dshgeo.com / opcmode.com 的根路径）"
        )

    def _check_one_url(self, page_rel: str, tag: str, attr: str,
                       url: str, line: int, rel_attr: str | None) -> None:
        where = f"{page_rel}:{line}"
        url = url.strip()
        if not url:
            self.report.fail(f"{where} {tag}[{attr}] 是空链接")
            return
        if url == "#":
            self.report.fail(f"{where} {tag}[{attr}] 使用占位锚点「#」")
            return

        parts = urlsplit(url)
        scheme = (parts.scheme or "").lower()
        if scheme in ("http", "https"):
            # 例外：link rel=canonical 是正式域名自引用，不走仓库白名单
            if tag == "link" and "canonical" in (rel_attr or "").lower().split():
                if url in CANONICAL_ALLOWED or url == "https://dshjob.com":
                    return
                self.report.fail(
                    f"{where} canonical 只能是 {CANONICAL_ALLOWED[0]} 或 {CANONICAL_ALLOWED[1]}，当前：{url}"
                )
                return
            ok, _kind, reason = self._classify_external(url)
            if ok:
                return
            self.report.fail(f"{where} 外链不合规：{url}（{reason}）")
            return
        if scheme in ("mailto", "tel"):
            return  # 联系方式允许，不属于外链白名单范围
        if scheme == "":
            if parts.netloc:
                self.report.fail(f"{where} 不允许协议相对链接：{url}")
                return
            self._check_internal(page_rel, tag, url, line)
            return
        self.report.fail(f"{where} 不允许的链接协议「{scheme}」：{url}")

    def _check_internal(self, page_rel: str, tag: str, url: str, line: int) -> None:
        where = f"{page_rel}:{line}"
        parts = urlsplit(url)
        path = unquote(parts.path)
        fragment = unquote(parts.fragment or "")

        if path == "":
            target_rel = page_rel  # 纯页内锚点
        else:
            if path.startswith("/"):
                raw = path.lstrip("/")  # 根相对（如 404 页的 /index.html）
            else:
                raw = posixpath.join(posixpath.dirname(page_rel), path)
            target_rel = posixpath.normpath(raw)
            if target_rel == ".." or target_rel.startswith("../"):
                self.report.fail(f"{where} 站内链接越出站点根目录：{url}")
                return
            if target_rel == ".":
                target_rel = page_rel

        target = self.root.joinpath(*target_rel.split("/"))
        if not target.exists():
            self.report.fail(f"{where} 站内链接目标不存在：{url}")
            return
        if not target.is_file():
            self.report.fail(f"{where} 站内链接目标不是文件：{url}")
            return

        # 锚点核对（Text Fragment 这类浏览器指令不核对）
        if fragment and not fragment.startswith(":~:"):
            if target_rel in self.pages:
                if fragment not in self.pages[target_rel].ids:
                    self.report.fail(
                        f"{where} 锚点不存在：{url}（目标页没有 id=\"{fragment}\"）"
                    )
            elif target_rel.endswith(".html"):
                self.report.warn(
                    f"{where} 目标页 {target_rel} 未纳入解析，无法核对锚点 {fragment}"
                )

    def check_links(self) -> None:
        for rel, page in self.pages.items():
            before_fail = self.report.fail_count
            internal_count = 0
            external_count = 0
            for link in page.links:
                url = link["url"]
                if urlsplit(url.strip()).scheme in ("http", "https") and not (
                    link["tag"] == "link"
                    and "canonical" in (link["rel"] or "").lower().split()
                ):
                    external_count += 1
                else:
                    internal_count += 1
                self._check_one_url(rel, link["tag"], link["attr"],
                                    url, link["line"], link["rel"])
            # img 的 srcset 候选地址同样要能落到真实文件
            for img in page.imgs:
                srcset = (img.get("srcset") or "").strip()
                if not srcset:
                    continue
                for candidate in srcset.split(","):
                    candidate = candidate.strip()
                    if not candidate:
                        continue
                    candidate_url = candidate.split(" ")[0]
                    internal_count += 1
                    self._check_one_url(rel, "img", "srcset",
                                        candidate_url, img["line"], None)
            if self.report.fail_count == before_fail:
                self.report.ok(
                    f"{rel} 链接检查通过（内部 {internal_count} 处、外链 {external_count} 处）"
                )

    # -- 4. 页面基础字段 ---------------------------------------------------

    def _script_targets(self, rel: str, page: PageParser) -> list[tuple[dict, str]]:
        """把每个 script 的 src 解析成相对仓库根的路径。"""
        out: list[tuple[dict, str]] = []
        for script in page.scripts:
            src = (script["src"] or "").strip()
            if not src:
                continue
            parts = urlsplit(src)
            if parts.scheme or parts.netloc:
                continue  # 外链脚本会先被链接检查拦下，这里只看站内
            path = unquote(parts.path)
            if path.startswith("/"):
                target_rel = posixpath.normpath(path.lstrip("/"))
            else:
                target_rel = posixpath.normpath(
                    posixpath.join(posixpath.dirname(rel), path)
                )
            out.append((script, target_rel))
        return out

    def check_page_fields(self) -> None:
        for rel, page in self.pages.items():
            # lang
            lang = (page.lang or "").strip()
            if lang:
                self.report.ok(f"{rel} html lang={lang}")
            else:
                self.report.fail(f"{rel} 缺少 html lang 属性")

            # 中文 title
            title = page.title_text.strip()
            if title and CJK_RE.search(title):
                self.report.ok(f"{rel} title 含中文：「{title}」")
            else:
                self.report.fail(f"{rel} title 缺失或不含中文（当前：「{title}」）")

            # meta description
            desc = (page.meta_description or "").strip()
            if desc:
                self.report.ok(f"{rel} meta description 存在（{len(desc)} 字）")
            else:
                self.report.fail(f"{rel} 缺少 meta description")

            # 唯一 h1
            if page.h1_count == 1:
                self.report.ok(f"{rel} h1 唯一")
            else:
                self.report.fail(f"{rel} h1 数量应为 1，实际 {page.h1_count}")

            # img 属性
            if page.imgs:
                problems = []
                for img in page.imgs:
                    if img["alt"] is None:
                        problems.append(f"第 {img['line']} 行 img 缺少 alt")
                    if not (img["width"] or "").strip():
                        problems.append(f"第 {img['line']} 行 img 缺少 width")
                    if not (img["height"] or "").strip():
                        problems.append(f"第 {img['line']} 行 img 缺少 height")
                if problems:
                    for problem in problems:
                        self.report.fail(f"{rel} {problem}")
                else:
                    self.report.ok(f"{rel} {len(page.imgs)} 个 img 均带 alt/width/height")
            else:
                self.report.ok(f"{rel} 本页没有 img，跳过图片属性检查")

            # 每页脚本规则
            targets = self._script_targets(rel, page)
            if rel == "index.html":
                for want in ("assets/site.js", "assets/hero-motion.js"):
                    hits = [s for s, t in targets if t == want]
                    if not hits:
                        self.report.fail(f"{rel} 必须引入 {want}")
                    elif any(not s["defer"] for s in hits):
                        self.report.fail(f"{rel} {want} 必须带 defer 属性")
                    else:
                        self.report.ok(f"{rel} 引入 {want}（defer）")
            elif rel == "guide.html":
                if any(t == "assets/hero-motion.js" for _s, t in targets):
                    self.report.fail(f"{rel} 不得引入 assets/hero-motion.js（首屏动效只属于首页）")
                else:
                    self.report.ok(f"{rel} 未引入 hero-motion.js")
            elif rel == "404.html":
                robots = (page.robots_content or "").lower()
                if "noindex" in robots:
                    self.report.ok(f"{rel} 已设置 noindex")
                else:
                    self.report.fail(f"{rel} 缺少 noindex（meta robots）")

    # -- 5. 四入口卡片与「下载」措辞 ---------------------------------------

    @staticmethod
    def _has_artifacts(card: dict) -> bool:
        """软件卡是否声明了 artifacts（data-artifacts 非空即为已声明）。"""
        raw = (card.get("artifacts") or "").strip()
        if not raw:
            return False
        try:
            return bool(json.loads(raw))
        except (ValueError, TypeError):
            return True  # 非 JSON 的非空值按「已声明」处理

    def check_cards(self) -> None:
        index = self.pages.get("index.html")
        if index is None:
            self.report.fail("无法检查 .mode-card（index.html 缺失或未解析）")
            return

        # 全站卡片的字段合法性（guide 等页若出现卡片同样约束）
        for rel, page in self.pages.items():
            for card in page.cards:
                if card["mode"] not in VALID_MODES:
                    self.report.fail(
                        f"{rel}:{card['line']} mode-card 的 data-mode 非法：「{card['mode']}」"
                    )
                if card["status"] not in VALID_STATUS:
                    self.report.fail(
                        f"{rel}:{card['line']} mode-card 的 data-status 非法：「{card['status']}」"
                    )

        modes = [card["mode"] for card in index.cards]
        if len(index.cards) == 4 and set(modes) == set(VALID_MODES):
            self.report.ok("index.html 四张 .mode-card 齐全（software/agent/skill/mcp）")
        else:
            present = sorted(m for m in modes if m)
            self.report.fail(
                "index.html 应有且仅有四张 .mode-card 且 data-mode 覆盖 "
                f"software/agent/skill/mcp；实际 {len(index.cards)} 张，data-mode={present}"
            )

        # 软件卡就绪判定：ready 且已声明 artifacts 才允许出现「下载」入口
        software = next((c for c in index.cards if c["mode"] == "software"), None)
        software_ready = bool(
            software and software["status"] == "ready" and self._has_artifacts(software)
        )
        if software_ready:
            self.report.ok("软件卡为 ready 且已声明 artifacts，允许出现下载入口")
        else:
            self.report.ok("软件卡未就绪或无 artifacts：全站不得出现「下载」入口")

        # 规则一：仓库（源码）链接不得使用「下载」措辞
        # 规则二：/releases 链接只有在软件就绪时才允许「下载」措辞
        for rel, page in self.pages.items():
            for anchor in page.anchors_all:
                text = anchor["text"]
                url = (anchor["url"] or "").strip()
                if "下载" not in text or not url:
                    continue
                ok, kind, _reason = self._classify_external(url)
                if not ok:
                    continue  # 外链不合规已在链接检查中报告
                if kind == "repo-root":
                    self.report.fail(
                        f"{rel}:{anchor['line']} 仓库链接不得使用「下载」措辞："
                        f"「{text}」（源码入口请写「查看仓库」）"
                    )
                elif kind == "repo-releases" and not software_ready:
                    self.report.fail(
                        f"{rel}:{anchor['line']} 软件尚无已核实 artifacts，"
                        f"/releases 链接不得使用「下载」措辞：「{text}」"
                    )

        # 规则三：未就绪的软件卡内不得出现任何「下载」锚点 / 按钮
        if software is not None and not software_ready:
            entries = [("a", a) for a in software["anchors"]]
            entries += [("button", b) for b in software["buttons"]]
            for kind, item in entries:
                if "下载" in item["text"]:
                    self.report.fail(
                        f"index.html:{item['line']} 软件卡无 artifacts，"
                        f"不得出现下载{kind == 'button' and '按钮' or '链接'}：「{item['text']}」"
                    )

    # -- 6. 泄漏扫描 -------------------------------------------------------

    def check_leaks(self) -> None:
        scanned = 0
        hit_any = False
        for rel in LEAK_SCAN_FILES:
            path = self.root / rel
            if not path.is_file():
                continue  # 缺失文件已在必需文件检查中报告
            scanned += 1
            text = path.read_text(encoding="utf-8", errors="replace")
            hits = [pattern for pattern in LEAK_PATTERNS if pattern in text]
            if hits:
                hit_any = True
                self.report.fail(f"{rel} 出现内部信息泄漏特征：{'、'.join(hits)}")
        if scanned and not hit_any:
            self.report.ok(f"内容泄漏扫描通过（{scanned} 个发布文本文件，无内部路径 / 原图引用）")

    # -- 7. 资源预算 -------------------------------------------------------

    def check_budgets(self) -> None:
        missing = [rel for rel in BUDGET_FILES if not (self.root / rel).is_file()]
        if missing:
            self.report.fail(f"gzip 预算无法计算，缺少：{'、'.join(missing)}")
        else:
            total = 0
            for rel in BUDGET_FILES:
                total += len(gzip.compress((self.root / rel).read_bytes()))
            if total <= GZIP_TOTAL_LIMIT:
                self.report.ok(
                    f"gzip 预算通过：七个核心文件共 {total / 1024:.1f}KB ≤ 300KB"
                )
            else:
                self.report.fail(
                    f"gzip 预算超限：七个核心文件共 {total / 1024:.1f}KB > 300KB"
                )

        beam = self.root / "assets/hero-beam.svg"
        if beam.is_file():
            size = beam.stat().st_size
            if size <= HERO_BEAM_LIMIT:
                self.report.ok(f"hero-beam.svg 体积 {size / 1024:.1f}KB ≤ 60KB")
            else:
                self.report.fail(f"hero-beam.svg 体积 {size / 1024:.1f}KB > 60KB")

        wechat = self.root / "assets/simon-wechat.jpg"
        if wechat.is_file():
            size = wechat.stat().st_size
            if size <= WECHAT_JPG_LIMIT:
                self.report.ok(f"simon-wechat.jpg 体积 {size / 1024:.1f}KB ≤ 600KB")
            else:
                self.report.fail(f"simon-wechat.jpg 体积 {size / 1024:.1f}KB > 600KB")


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="dshjob.com 静态站点发布前检查")
    parser.add_argument(
        "--root",
        default=str(ROOT),
        help="站点根目录（默认：脚本所在仓库根目录）",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"[FAIL] 站点根目录不存在：{root}")
        return 2

    return SiteChecker(root).run()


if __name__ == "__main__":
    sys.exit(main())
