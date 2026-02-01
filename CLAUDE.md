# CLAUDE.md - knotebook

## Initiating a New Session
Display for the user, "I have read your PROJECT-level claude.md file"

## Project Overview

knotebook is a browser-based note-taking app with interactive graph visualization. Notes ("knotes") are nodes on an infinite SVG canvas; relationships are edges. Supports unlimited nesting (notes contain sub-graphs) and hashtag organization.

## Tech Stack

- **Vanilla JavaScript** (ES6+), no frameworks or libraries
- **HTML5 + CSS3** with custom properties for theming
- **SVG** for the graph canvas (not Canvas API)
- **localStorage** for persistence, JSON file export/import for portability
- **No build system, no bundler, no package manager, no test framework**

## File Structure

```
index.html              # Entry point (landing page + graph view + modals)
scripts/app.js          # All application logic (~3200 lines)
styles/main.css         # All styles (~1500 lines), 5 dark themes
design-spec.txt         # Feature specification
ROADMAP.txt             # Status, priorities, decisions log
SESSION_NOTES.md        # Session-by-session work history
knowledge/              # Quick reference docs
```

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

### app.js Organization

| Lines       | Section                                |
|-------------|----------------------------------------|
| 1-65        | State & constants                      |
| 80-124      | Theme functions                        |
| 131-189     | Storage/project functions              |
| 219-292     | Project CRUD operations                |
| 309-341     | Projects list UI                       |
| 351-427     | Project menu & modals                  |
| 428-571     | Search/filter logic                    |
| 588-700     | Sidebar & hashtag functions            |
| 716-880     | Canvas: viewport, zoom, pan            |
| 889-1140    | Rendering (render, renderNodes, etc.)  |
| 1154-1485   | Node/edge interaction                  |
| 1487-1650   | Navigation & nesting                   |
| 1651-2030   | Editor modal logic                     |
| 2030-2540   | Touch handling & action bar            |
| 2540-3168   | Keyboard shortcuts & event setup       |

### index.html Organization

| Lines       | Section                                |
|-------------|----------------------------------------|
| 83-86       | Hashtag filter input                   |
| 108-117     | Hashtag sidebar                        |
| 120-139     | Note editor modal                      |
| 157-161     | Keyboard shortcut documentation        |

### main.css Organization

| Lines       | Section                                |
|-------------|----------------------------------------|
| 571-621     | Hashtag search input styling           |
| 809-992     | Editor modal styling                   |
| 1163-1347   | Hashtag sidebar styling                |
| 1273-1310   | Color picker dropdown styling          |


## Code Conventions

- **camelCase** for JS functions, variables, object properties
- **CONSTANT_CASE** for constants: `NODE_WIDTH`, `AUTOSAVE_DELAY`
- **snake_case with `--` prefix** for CSS custom properties: `--bg-primary`, `--text-secondary`
- **data-attributes** on HTML elements: `data-theme`, `data-action`, `data-value`
- Views toggled via `.hidden` CSS class
- SVG elements created with `document.createElementNS('http://www.w3.org/2000/svg', ...)`

## Key Design Decisions

- **Undirected, untyped edges** (no relationship labels or direction)
- **Sibling-only connections** (edges between notes at the same nesting level only)
- **Dark themes only** (no light theme)
- **localStorage primary, JSON file export secondary** (no server/database)
- **Monolithic single file** for JS (modularization deferred until >4000 lines)

## Interaction Patterns

**Desktop:**
- Click to select node
- Ctrl+Click to toggle node in multi-selection
- Ctrl+Drag (≥10px movement) to duplicate selection
- Shift+Click to start/complete edge creation
- Hover over node (500ms delay) to expand truncated title

**Mobile:**
- Tap to select node
- Long-press to add node to multi-selection (repeat on multiple nodes)
- Double-tap to edit node
- Tap outside or use action bar buttons for other actions

## Working with Grigri (Project Owner)

- **May not be aware of common design paradigms or best practices. Bring these to Grigri's attention.**
- **May not be aware of the design assumptions he is making. Bring these to Grigri's attention.**
- May not anticipate platform-specific limitations until testing (e.g., File
  System Access API not available on mobile)
- Present options with pros/cons for decisions; document the chosen option and reasoning
- Don't explain basic programming concepts, but do explain JS-specific patterns and API details
- Update `ROADMAP.txt` decisions log and `SESSION_NOTES.md` after substantive work
- Test changes on both desktop and mobile

## Git Commit Policy

**Auto-commit when:**
- Grigri asks for a test plan
- Grigri asks if changes are ready to test
- Grigri explicitly requests a commit

**Ask before committing when:**
- Completing implementation work
- Making any other code changes
- Default behavior unless above conditions are met
