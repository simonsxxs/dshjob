#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按发布白名单打包 dshjob.com 静态站点（仅用 Python 标准库）。

只复制 design.md 第 7 节白名单内的文件到指定输出目录，作为 Cloudflare Pages
Direct Upload 前的暂存产物；绝不递归复制整个仓库，也绝不含 docs/、openspec/、
prototype/、AGENTS、README、.git/ 等内部内容。

安全规则：
  - 拒绝符号链接与目录穿越；
  - 缺少任一必需文件（social-card.png 除外）直接失败，不产出半成品；
  - 输出目录若含白名单之外的条目则拒绝写入（不清理、不覆盖无关文件）；
  - 复制完成后逐文件打印 sha256 清单，便于发布记录留痕。

用法：
    python3 scripts/package-site.py [--out DIR]   # DIR 默认 site-dist（相对当前目录）
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
from pathlib import Path

# 站点根目录：本脚本位于 <仓库根>/scripts/
ROOT = Path(__file__).resolve().parent.parent

# 发布白名单（design 第 7 节）：缺少任何一个必需文件即失败
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

# 可选文件：存在才复制，缺失仅提示
OPTIONAL_FILES = ("assets/social-card.png",)

# 输出目录允许出现的顶层条目（白名单文件的顶层名）
ALLOWED_TOP_ENTRIES = {Path(rel).parts[0] for rel in REQUIRED_FILES + OPTIONAL_FILES}


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")


def warn(msg: str) -> None:
    print(f"[WARN] {msg}")


def sha256_of(path: Path) -> str:
    """分块读取计算 sha256，避免大图一次性载入内存。"""
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(64 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_source(rel: str) -> tuple[Path, str | None]:
    """校验单个白名单源文件，返回 (路径, 错误信息)；错误信息为 None 表示通过。"""
    src = ROOT / rel
    if src.is_symlink():
        return src, "是符号链接（拒绝）"
    if not src.exists():
        return src, "不存在"
    if not src.is_file():
        return src, "不是常规文件"
    # 真实路径必须仍在仓库根内（白名单为固定相对路径，此处双保险防穿越）
    try:
        src.resolve().relative_to(ROOT.resolve())
    except ValueError:
        return src, "目录穿越（真实路径越出仓库根）"
    return src, None


def prepare_out_dir(out: Path) -> str | None:
    """准备输出目录，返回错误信息或 None（通过）。

    只新建目录或复用只含白名单条目的目录；绝不删除任何已有内容。
    """
    resolved = out.resolve()
    root_resolved = ROOT.resolve()
    if resolved == root_resolved or resolved in root_resolved.parents:
        return "输出目录不能是仓库根本身或其上级目录"
    if ".git" in resolved.parts:
        return "输出目录不得位于 .git 内"
    if out.is_symlink():
        return "输出目录是符号链接（拒绝）"
    if out.exists():
        if not out.is_dir():
            return "输出路径已存在且不是目录"
        unexpected = sorted(
            entry.name for entry in out.iterdir()
            if entry.name not in ALLOWED_TOP_ENTRIES
        )
        if unexpected:
            return f"输出目录含白名单之外的条目，拒绝写入：{'、'.join(unexpected)}"
    else:
        out.mkdir(parents=True, exist_ok=True)
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="按白名单打包 dshjob.com 静态站点")
    parser.add_argument(
        "--out",
        default="site-dist",
        help="输出目录（默认：site-dist，相对当前目录）",
    )
    args = parser.parse_args()

    out = Path(args.out)
    if not out.is_absolute():
        out = Path.cwd() / out

    # 1) 先校验全部源文件：任一必需文件有问题就不开始复制，避免半成品
    errors: list[str] = []
    plan: list[tuple[str, Path]] = []
    for rel in REQUIRED_FILES:
        src, err = validate_source(rel)
        if err:
            errors.append(f"必需文件 {rel}：{err}")
        else:
            plan.append((rel, src))

    optional_plan: list[tuple[str, Path]] = []
    for rel in OPTIONAL_FILES:
        src, err = validate_source(rel)
        if err == "不存在":
            warn(f"可选文件 {rel} 缺失，跳过（允许，仅提示）")
        elif err:
            errors.append(f"可选文件 {rel}：{err}")
        else:
            optional_plan.append((rel, src))

    if errors:
        for err in errors:
            fail(err)
        print("存在无法复制的文件，未创建输出目录，打包失败。")
        return 1

    # 2) 准备输出目录
    err = prepare_out_dir(out)
    if err:
        fail(f"输出目录不可用：{err}")
        return 1

    # 3) 逐文件复制并核对
    copied: list[tuple[str, Path]] = []
    for rel, src in plan + optional_plan:
        dest = out / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.is_symlink():
            fail(f"目标文件 {dest} 是符号链接，拒绝覆盖")
            return 1
        shutil.copyfile(src, dest)
        if dest.stat().st_size != src.stat().st_size:
            fail(f"复制后大小不一致：{rel}")
            return 1
        copied.append((rel, dest))
        print(f"[OK] 已复制 {rel}（{src.stat().st_size} 字节）")

    # 4) 打印 sha256 清单，供发布记录比对
    total = 0
    print()
    print("打包清单（sha256 / 字节数 / 文件）：")
    for rel, dest in sorted(copied):
        size = dest.stat().st_size
        total += size
        print(f"  {sha256_of(dest)}  {size:>9} B  {rel}")
    print(f"共 {len(copied)} 个文件，{total} 字节，输出目录：{out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
