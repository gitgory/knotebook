#!/usr/bin/env python3
"""
Reduce a JavaScript file to a "table of contents":
- Keep all block comments (/* ... */), even if inline with code (keeps only the comment portion).
- Keep all full-line // comments (including indented ones, including inside functions).
- Keep only function signatures (no bodies).
- Drop inline trailing // comments that are on the same line as code.

Usage:
  python js_toc.py input.js > output.toc.js
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import List, Tuple


# Control-flow keywords that look like "method shorthand" but are not function definitions.
CONTROL_KEYWORDS = (
    "if", "for", "while", "switch", "catch", "with", "else", "do", "try", "finally"
)

# Negative lookahead to exclude control keywords at the start of a would-be "method shorthand" line.
NOT_CONTROL = r"(?!(" + "|".join(CONTROL_KEYWORDS) + r")\b)"

FUNC_PATTERNS: List[re.Pattern] = [
    # function declarations (optionally export/default/async/generator)
    re.compile(
        r"""^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\*?\s*(?:[A-Za-z_$][\w$]*)?\s*\(""",
        re.VERBOSE,
    ),
    # variable assigned arrow function: const name = (...) => ...
    re.compile(
        r"""^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*(?:async\s+)?(?:\([^)]*|\w+)\s*=>""",
        re.VERBOSE,
    ),
    # method shorthand inside object/class: [static] [async] name(...) {
    # Excludes control-flow keywords like "if (...) {"
    re.compile(
        rf"""^\s*(?:static\s+)?(?:async\s+)?{NOT_CONTROL}[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{{""",
        re.VERBOSE,
    ),
    # getters/setters: get name() {  /  set name(v) {
    # Also exclude control-flow keywords (paranoia)
    re.compile(
        rf"""^\s*(?:static\s+)?(?:get|set)\s+{NOT_CONTROL}[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{{""",
        re.VERBOSE,
    ),
    # constructor(...) {
    re.compile(r"""^\s*constructor\s*\([^)]*\)\s*\{""", re.VERBOSE),
]


def is_full_line_slash_comment(line: str) -> bool:
    return bool(re.match(r"^\s*//", line))


def strip_inline_trailing_slash_comment(line: str) -> str:
    """
    Remove trailing // comment only if there is code before it on the same line.
    Keeps full-line // comments untouched (caller should check first).
    Naive but works well for typical JS; doesn't attempt to parse strings.
    """
    if is_full_line_slash_comment(line):
        return line.rstrip("\n")
    if "//" not in line:
        return line.rstrip("\n")
    before, _after = line.split("//", 1)
    if before.strip():
        return before.rstrip()
    return line.rstrip("\n")


def looks_like_function_signature(line: str) -> bool:
    return any(pat.match(line) for pat in FUNC_PATTERNS)


def extract_signature(line: str) -> str:
    """
    Given a line that appears to begin a function signature, return a cleaned signature:
    - Drop inline trailing // comments
    - Remove function body opener "{" and anything after
    - For arrow functions, keep only up to "=>"
    """
    s = strip_inline_trailing_slash_comment(line)

    # If there's a block comment inline, strip it from signature line (the comment is output separately)
    s = re.sub(r"/\*.*?\*/", "", s)

    # Arrow functions: keep up to =>
    if "=>" in s:
        left, _ = s.split("=>", 1)
        return (left.rstrip() + "=>").rstrip()

    # Normal functions/methods: cut at first "{"
    if "{" in s:
        s = s.split("{", 1)[0].rstrip()

    # Remove trailing ";" if present
    s = s.rstrip()
    if s.endswith(";"):
        s = s[:-1].rstrip()

    return s


def extract_inline_block_comments(raw_line: str) -> Tuple[List[str], bool]:
    """
    Extract all /* ... */ comment segments from a single line.
    Returns (extracted_segments, started_multiline_block_comment)
    If a block comment starts but doesn't end on the same line, we treat it as multiline.
    """
    extracted: List[str] = []
    line = raw_line
    i = 0
    while i < len(line):
        start = line.find("/*", i)
        if start == -1:
            break
        end = line.find("*/", start + 2)
        if end == -1:
            extracted.append(line[start:].rstrip("\n"))
            return extracted, True
        extracted.append(line[start : end + 2].rstrip("\n"))
        i = end + 2
    return extracted, False


def reduce_js_to_toc(text: str) -> str:
    lines = text.splitlines(True)
    out_lines: List[str] = []

    in_block_comment = False

    for raw in lines:
        line = raw.rstrip("\n")

        # If inside a multi-line block comment, keep whole lines until it ends
        if in_block_comment:
            out_lines.append(line)
            if "*/" in line:
                in_block_comment = False
            continue

        # Keep full-line // comments (including indented)
        if is_full_line_slash_comment(line):
            out_lines.append(line)
            continue

        # Extract and output any block comments from this line (even if inline)
        extracted_comments, started_block = extract_inline_block_comments(raw)
        out_lines.extend(extracted_comments)
        if started_block:
            in_block_comment = True
            continue

        # Keep only function signatures
        if looks_like_function_signature(line):
            sig = extract_signature(line)
            if sig.strip():
                out_lines.append(sig)
            continue

        # Drop everything else (including inline trailing // comments on code lines)
        continue

    # Collapse consecutive empty lines (optional)
    cleaned: List[str] = []
    prev_empty = False
    for l in out_lines:
        empty = (l.strip() == "")
        if empty and prev_empty:
            continue
        cleaned.append(l)
        prev_empty = empty

    return "\n".join(cleaned) + "\n"


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python js_toc.py input.js > output.toc.js", file=sys.stderr)
        return 2

    inp = Path(sys.argv[1])
    text = inp.read_text(encoding="utf-8", errors="replace")
    out = reduce_js_to_toc(text)

    # Write UTF-8 to avoid UnicodeEncodeError on Windows consoles
    sys.stdout.buffer.write(out.encode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
