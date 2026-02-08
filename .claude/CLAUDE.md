# CLAUDE.md - knotebook

## Initiating a New Session
Display for the user, "I read your PROJECT-level claude.md file"

## Documentation Organization

Project documentation is organized into folders:
- `docs-project/` - Project-level documentation (SESSION_NOTES.md, decision-history.md, design-spec.txt, ROADMAP.txt, file_structure.txt, GRIGRI.txt)
- `docs-app/` - App-specific technical reference (app-controls-reference.md, json-schema.md)
- `knowledge/` - Conceptual articles and explorations
- `tests/` - Test plans and testing documentation
- `scripts/app_js_table_of_contents.txt` - Code structure reference
- Root level - Code reviews and feature-specific design specs

## Project Overview

knotebook is a browser-based note-taking app with interactive graph visualization. Notes ("knotes") are nodes on an infinite SVG canvas; relationships are edges. Supports unlimited nesting (notes contain sub-graphs) and hashtag organization.

## Tech Stack

- **Vanilla JavaScript** (ES6+), no frameworks or libraries
- **HTML5 + CSS3** with custom properties for theming
- **SVG** for the graph canvas (not Canvas API)
- **localStorage** for persistence, JSON file export/import for portability
- **No build system, no bundler, no package manager, no test framework**

## Running the App

The app is hosted at https://gitgory.github.io/knotebook/

## Cache Busting (Important)

CSS and JS are versioned in index.html via query params:
```html
<link href="styles/main.css?v=13">
<script src="scripts/app.js?v=21">
```
**After modifying CSS or JS, increment the version number** in the corresponding tag in index.html to force browsers to reload.

## Architecture

- **Single global `state` object** holds all mutable application state (nodes, edges, selections, viewport, filters, currentPath)
- **Immediate-mode rendering**: `render()` redraws the entire SVG canvas on every state change
- **Manual DOM manipulation** via `document.getElementById()`, `createElementNS()`, etc.
- **Debounced auto-save** (1500ms) to localStorage
- **Navigation stack**: `state.currentPath[]` tracks nested graph depth; `rootNodes`/`rootEdges` globals hold root level


## Code Conventions

- **camelCase** for JS functions, variables, object properties
- **CONSTANT_CASE** for constants: `NODE_WIDTH`, `AUTOSAVE_DELAY`
- **snake_case with `--` prefix** for CSS custom properties: `--bg-primary`, `--text-secondary`
- **data-attributes** on HTML elements: `data-theme`, `data-action`, `data-value`
- Views toggled via `.hidden` CSS class
- SVG elements created with `document.createElementNS('http://www.w3.org/2000/svg', ...)`
- **XSS Protection**: NEVER use `innerHTML` with user data
  - Use `textContent` for all user-generated content (project names, note titles, hashtags, content)
  - Build complex structures with `createElement()` / `createElementNS()`
  - Use `.dataset.*` for data attributes (auto-escaped)
  - Use `replaceChildren()` for clearing DOM (modern, safer than `innerHTML = ''`)
  - All functions should have documentation in the comments, including:
    - What it does
    - Parameters and their types
    - Return value and type