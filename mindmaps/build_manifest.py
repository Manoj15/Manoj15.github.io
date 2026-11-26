#!/usr/bin/env python3
"""Build mindmaps/maps/index.json from the Markdown files in mindmaps/maps/.

Run it after adding, renaming or deleting a map:

    python3 mindmaps/build_manifest.py

The GitHub Pages workflow also runs it on every deploy, so a forgotten run
never breaks the live site. Standard library only.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

MAPS_DIR = Path(__file__).resolve().parent / "maps"
OUT = MAPS_DIR / "index.json"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


def parse_front_matter(text: str) -> tuple[dict, str]:
    """Tiny YAML subset: `key: value`, `key: [a, b]` and `key:` + `- item` lists.
    Nested blocks (like `markmap:`) are skipped; the browser reads those."""
    if not text.startswith("---"):
        return {}, text
    end = re.search(r"^---\s*$", text[3:], re.M)
    if not end:
        return {}, text
    block = text[3 : 3 + end.start()]
    body = text[3 + end.end() :]
    meta: dict = {}
    key = None
    for raw in block.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if raw[0] in " \t":
            item = raw.strip()
            if key and item.startswith("- ") and isinstance(meta.get(key), list):
                meta[key].append(unquote(item[2:]))
            continue
        k, _, v = raw.partition(":")
        key, v = k.strip(), v.strip()
        if v.startswith("[") and v.endswith("]"):
            meta[key] = [unquote(x) for x in v[1:-1].split(",") if x.strip()]
        elif v == "":
            meta[key] = []
        else:
            meta[key] = unquote(v)
    return meta, body


def unquote(s: str) -> str:
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "'\"":
        return s[1:-1]
    return s


def strip_md(s: str) -> str:
    s = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", s)
    return re.sub(r"[*_`~$]", "", s).strip()


def count_nodes(body: str) -> tuple[int, str]:
    count, title, in_code = 0, "", False
    for line in body.splitlines():
        if line.lstrip().startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        h = re.match(r"^(#{1,6})\s+(.*)", line)
        if h:
            count += 1
            if not title and len(h.group(1)) == 1:
                title = strip_md(h.group(2))
        elif re.match(r"^\s*(?:[-*+]|\d+\.)\s+\S", line):
            count += 1
    return count, title


def last_updated(path: Path) -> str | None:
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cI", "--", path.name],
            cwd=path.parent, capture_output=True, text=True, check=False,
        ).stdout.strip()
        return out or None
    except OSError:
        return None


def main() -> int:
    maps, problems = [], []
    for path in sorted(MAPS_DIR.glob("*.md")):
        if path.name.lower() == "readme.md":
            continue
        slug = path.stem
        if not SLUG_RE.match(slug):
            problems.append(f"{path.name}: use lowercase letters, digits, '-' or '_' in file names")
        text = path.read_text(encoding="utf-8")
        meta, body = parse_front_matter(text)
        nodes, heading = count_nodes(body)
        tags = meta.get("tags", [])
        if isinstance(tags, str):
            tags = [t.strip() for t in tags.split(",") if t.strip()]
        maps.append({
            "slug": slug,
            "title": meta.get("title") or heading or slug.replace("-", " ").title(),
            "description": meta.get("description") or "",
            "tags": tags,
            "nodes": nodes,
            "updated": last_updated(path),
        })
    maps.sort(key=lambda m: m["title"].lower())
    OUT.write_text(json.dumps({"maps": maps}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(MAPS_DIR.parent.parent)} with {len(maps)} maps")
    for p in problems:
        print("warning:", p, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
