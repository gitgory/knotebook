#!/usr/bin/env python3
"""
Generate a table of contents for app.js

Extracts the structure of the JavaScript file including:
- Section headers (marked by comment blocks with ====)
- Function definitions with their line numbers
- Inline comments showing internal logic flow
"""

import re
import sys
from pathlib import Path


def extract_toc(js_file_path):
    """Parse app.js and generate a structured TOC"""

    with open(js_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    toc_lines = []

    # Add header
    toc_lines.append("/**")
    toc_lines.append(" * Graph Notes - Main Application")
    toc_lines.append(" * A visual note-taking app with graph structure")
    toc_lines.append(" */")

    current_section = None
    current_section_start = None
    indent_level = 0
    in_section = False
    last_section_added = None

    for line_num, line in enumerate(lines, start=1):
        stripped = line.strip()

        # Section headers (lines with === separators)
        if '=' * 20 in stripped and '//' in stripped:
            # Look ahead to find the actual section title
            # Pattern: // ========
            #          // SECTION NAME
            #          // ========
            if line_num < len(lines):
                next_line = lines[line_num].strip()
                if next_line.startswith('//') and '=' not in next_line:
                    section_name = next_line.replace('//', '').strip()

                    # Only add section header if it's different from last one
                    if section_name != last_section_added:
                        current_section = section_name
                        current_section_start = line_num
                        toc_lines.append(f"// ============================================================================")
                        toc_lines.append(f"// {section_name} (line {line_num})")
                        toc_lines.append(f"// ============================================================================")
                        last_section_added = section_name
                        indent_level = 0
                        in_section = True

        # Function definitions
        elif stripped.startswith('function '):
            # Extract function signature
            func_match = re.match(r'function\s+(\w+)\s*\((.*?)\)', stripped)
            if func_match:
                func_name = func_match.group(1)
                func_params = func_match.group(2)
                toc_lines.append(f"function {func_name}({func_params})  // line {line_num}")
                indent_level = 1

        # Inline comments (show structure within functions)
        elif stripped.startswith('//') and '=' not in stripped:
            # Filter out less useful comments
            comment_text = stripped[2:].strip()

            # Skip empty comments
            if not comment_text:
                continue

            # Skip very short comments (likely code snippets)
            if len(comment_text) < 3:
                continue

            # Skip if this comment is the same as the current section (avoids duplication)
            if comment_text == current_section:
                continue

            # Determine indentation by counting leading spaces in original line
            original_indent = len(line) - len(line.lstrip())

            # If indent_level is 0, this is a top-level comment (before any functions)
            if indent_level == 0 and in_section:
                # Top-level comment in a section (e.g., describing state variables)
                toc_lines.append(f"    // {comment_text}")
            elif indent_level > 0:
                # Comment inside a function - use more indentation
                # Convert spaces to conceptual indent level (rough heuristic)
                comment_indent = '    ' * min(indent_level + (original_indent // 8), 4)
                toc_lines.append(f"{comment_indent}// {comment_text}")

    return toc_lines


def main():
    # Determine paths
    script_dir = Path(__file__).parent
    js_file = script_dir / 'app.js'
    output_file = script_dir / 'app_js_table_of_contents.txt'

    # Check if app.js exists
    if not js_file.exists():
        print(f"Error: Could not find {js_file}", file=sys.stderr)
        sys.exit(1)

    # Generate TOC
    print(f"Parsing {js_file}...")
    toc_lines = extract_toc(js_file)

    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(toc_lines))

    print(f"Generated {output_file}")
    print(f"  {len(toc_lines)} lines")


if __name__ == '__main__':
    main()
