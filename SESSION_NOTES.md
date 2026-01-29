# Session Notes

This file tracks work across Claude Code sessions for continuity.

---

## Session 2026-01-29 - Afternoon

### Summary
UI polish session focused on visual indicators and theme refinement. Added accent color highlighting to sidebar button when filters active and breadcrumbs when navigating nested notes. Curated and finalized theme collection from 30+ options down to 10 polished themes with evocative names. Updated landing page branding to "knotebook" with two-tone color styling.

### Files Changed
- `styles/main.css` - Added `#hashtag-sidebar-btn.active` and `#breadcrumbs.active` rules for accent color highlighting; deleted 15+ theme definitions; renamed remaining themes; increased landing page h1 to 4rem; added `.knote` span styling; increased clear button font-size to 18px; reduced theme dropdown font-size to 12px
- `scripts/app.js` - Added `updateSidebarButtonState()` helper function; updated `updateFilter()`, `clearFilter()`, `openProject()` to call button state updater; modified `updateBreadcrumbs()` to add/remove active class
- `index.html` - Updated theme dropdown with 10 final themes; split landing page h1 into styled spans; bumped cache versions to CSS v29, JS v31
- `plan-outline.txt` - Updated feature entries with completion status

### Tasks Completed
- [x] Highlight sidebar # button with accent color when tag filters active
- [x] Highlight breadcrumbs with accent color when not at Root level
- [x] Increased clear button (×) size from 14px to 18px for better mobile usability
- [x] Added 25 new theme color palettes with 3 accent colors each
- [x] Deleted 17 themes after testing (kept only best 10)
- [x] Renamed themes: Teal→deleted, Lavender→Aurora, Gold→Sunset, etc.
- [x] Sorted theme dropdown by accent color hue for logical grouping
- [x] Reduced theme dropdown text from 14px to 12px for compactness
- [x] Changed landing page branding to "knotebook" with two-tone styling
- [x] Increased landing page heading from 3rem to 4rem

### Decisions Made
- **Visual indicators for active states**: Sidebar button and breadcrumbs use theme's accent color to signal active state (filtering/navigation), maintaining consistency with existing accent color usage
- **Theme curation approach**: Started with 25 candidates, iteratively deleted themes based on testing, kept only most distinct and visually appealing options
- **Theme naming convention**: Mix of literal colors (Midnight, Slate) and evocative names (Aurora, Sunset, Neon, Ocean) for personality
- **Two-tone branding**: "knote" uses highlight color, "book" uses accent color, creating visual interest and reinforcing dual-purpose (notes + knowledge)
- **Third accent color reserved**: All new themes include `--accent-3` variable for future use, documented in CSS comment

### Next Steps
- [ ] Mobile testing: settings modal
- [ ] Add Save button to note editor (mobile only)
- [ ] Test new themes on mobile
- [ ] Pick next feature from Tier 1 remaining items

### Notes
- Final 10 themes: Midnight (default), Slate, Neon, Mint, Ocean, Sky, Obsidian, Aurora, Graphite, Sunset
- All themes use consistent structure: 2 dominants, 2 active accents, 1 reserved accent, danger colors
- Landing page now displays "knotebook" in large text with split coloring
- Global `/handoff` skill successfully moved to `%USERPROFILE%\.claude\skills\handoff\SKILL.md` for cross-project use

---

## Session 2026-01-28 - Morning

### Summary
Project infrastructure updates: renamed project folder, set up GitHub repository with GitHub Pages hosting, created Python script for generating table-of-contents file from app.js, and integrated TOC generation into the /handoff skill workflow.

### Files Changed
- Project folder renamed from `FirstClaude` to `knotebook`
- New files created:
  - `scripts/generate_toc.py` - Python script that extracts structure from app.js (sections, functions, line numbers)
  - `scripts/toc.txt` - Generated table of contents output (~490 lines)
  - `scripts/generate_toc.bat` - Windows batch file for running the script

### Tasks Completed
- [x] Renamed project folder to "knotebook"
- [x] Created GitHub repository and published to GitHub Pages
- [x] Built Python script to generate hierarchical TOC from app.js
- [x] Generated initial toc.txt file
- [x] Integrated TOC generation into /handoff skill

### Decisions Made
- **GitHub Pages hosting**: Live URL at https://gitgory.github.io/knotebook/
- **Automated TOC regeneration**: TOC file regenerates automatically each time /handoff skill runs, keeping it in sync with codebase changes
- **TOC not referenced in CLAUDE.md yet**: Deferred until workflow is more established

### Mobile Testing Completed (2026-01-28)
- [x] Auto-save editor - tap outside saves, double-tap to edit
- [x] Sidebar tag filter - input positioning, autocomplete, clear button
- [x] Autocomplete dropdown - full-width display, touch interaction
- [x] Clear button (×) increased from 14px to 18px font-size for easier tapping

### Next Steps
- [ ] Mobile testing: settings modal
- [ ] Add Save button to note editor (mobile only)
- [ ] Pick next feature from Tier 1 remaining items

---

## Session 2026-01-27 - Evening

### Summary
Consolidated all task/feature tracking from three separate sources (ROADMAP.txt FUTURE/MAYBE, plan-outline.txt, Graph improvements.json notebook) into a single deduplicated feature matrix in plan-outline.txt. Approximately 50 items across 4 tiers, with 12 marked done.

### Files Changed
- `plan-outline.txt` - Complete rewrite: merged all tasks from three sources into one tiered feature matrix with Impact/Effort/Done/Notes columns
- `plan-outline.csv` - Regenerated as CSV copy of plan-outline.txt with explicit Tier column for spreadsheet use
- `ROADMAP.txt` - Removed FUTURE/MAYBE section and UP NEXT tranches; replaced with reference to plan-outline.txt

### Tasks Completed
- [x] Read and inventory tasks from all three sources
- [x] Deduplicate overlapping items across sources
- [x] Assign tiers to new items based on impact/effort ratings
- [x] Write consolidated plan-outline.txt
- [x] Generate plan-outline.csv for spreadsheet use
- [x] Update ROADMAP.txt to reference single source
- [x] Delete old duplicate plan-outline.csv

### Decisions Made
- **plan-outline.txt as single source**: User chose this over ROADMAP.txt or a new file; keeps the tier/matrix format
- **CSV as secondary copy**: Kept for spreadsheet convenience; adds explicit Tier column
- **Split "Filter by connection + AND/OR"**: Separated into "AND/OR logic for search filters" and "Filter by connection status" since they're distinct features
- **Merged duplicates**: e.g., "Batch add hashtags" + "Batch edit notes" → broader "Batch edit notes"; "Drag box multi-select" + "lasso to multi-select" → merged

### Next Steps
- [ ] Mobile testing: auto-save editor, settings modal, sidebar tag filter, autocomplete
- [ ] Pick next feature from Tier 1 remaining items

---

## Session 2026-01-27 - Afternoon

### Summary
Two features implemented. (1) Changed note editor from explicit-save to auto-save behavior with a Cancel button that reverts changes. (2) Added per-notebook settings with a "default completion mode" toggle — new notes can default to "To do" (task mode) or None.

### Files Changed
- `scripts/app.js` - Added `editorSnapshot` variable; `openEditor()` captures snapshot; `cancelEditor()` restores from snapshot; `saveEditor()` deletes empty nodes; swapped all close triggers from cancel→save; Enter in textarea saves (Shift+Enter for newline); editor-enter button saves before navigating; hashtag click saves; click-outside uses mousedown+click guard. Added `projectSettings` variable; `createNode()` uses `projectSettings.defaultCompletion`; settings persisted in all save/load/export/import paths; added `showSettings()`, `hideSettings()`, `updateSettingsToggle()`, `toggleSettingsTask()` functions; wired toolbar gear icon, context menu, ESC handler.
- `styles/main.css` - Restyled `#editor-save` button to red (#dc2626). Added settings modal styling (modal, toggle button with green active state, close button).
- `index.html` - Changed Save button text to "Cancel"; updated help shortcuts (ESC saves, added Shift+Enter); added settings modal HTML; added ⚙ toolbar button; added "Settings" to project context menu; bumped cache versions to CSS v=20, JS v=29.

### Tasks Completed
- [x] Auto-save editor on all close triggers
- [x] Cancel button reverts changes via snapshot
- [x] Enter saves in textarea, Shift+Enter for newline
- [x] Step-into button saves before navigating
- [x] Hashtag click in editor saves before filtering
- [x] Text selection drag out of editor no longer closes it
- [x] Per-notebook settings data model and persistence
- [x] Settings modal with task-default toggle
- [x] Settings accessible from toolbar and context menu
- [x] Backwards-compatible import of old notebooks without settings

### Decisions Made
- **Save-by-default**: All close actions save; only Cancel reverts. Reduces friction since saving is far more common than discarding.
- **Snapshot approach**: Capture title/content/hashtags/completion on open; restore on cancel. Simple and covers all fields.
- **mousedown+click guard**: Track where mousedown started; only close if both mousedown and click are on the backdrop. Prevents accidental close during text selection drag.
- **Settings as project data**: `settings` object stored alongside nodes/edges/hashtagColors. First setting: `defaultCompletion` (null or 'no').
- **Completion control always visible**: Non-task mode only changes the default for new notes; the status buttons remain in the editor so users can opt-in per-note.
- **Dual access**: Settings modal reachable from both toolbar (uses in-memory state) and context menu (reads/writes localStorage directly for non-open notebooks).

### Next Steps
- [ ] Mobile testing: tap outside saves, double-tap to edit flow
- [ ] Mobile testing: settings modal
- [ ] Test sidebar tag filter on mobile
- [ ] Test autocomplete dropdown positioning within sidebar context on mobile

---

## Session 2026-01-27

### Summary
Visual and terminology polish session. Increased the size of two node indicators for better visibility (dog-ear +50%, completion icons +50%). Added grayscale+darkened styling for completed notes. Renamed all user-facing text: "Project" → "Notebook", "Hashtag" → "Tag" (code identifiers unchanged).

### Files Changed
- `scripts/app.js` - Updated dog-ear SVG path to 18×18px; increased completion indicator hit target (r 8→12), icon y-positions, and empty circle (r 5→7); added `completed` CSS class to nodes with `completion === 'yes'`; renamed 7 user-facing strings (Project→Notebook, Hashtag→Tag)
- `styles/main.css` - Increased `.node-completion-icon` font-size from 12px to 16px, `.completion-no` circle stroke-width from 1.5 to 2; added `.node.completed` rule with `filter: grayscale(1) brightness(0.5)`
- `index.html` - Renamed 10 user-facing labels (Project→Notebook, Hashtag→Tag); bumped cache versions to CSS v=18, JS v=26

### Tasks Completed
- [x] Increase dog-ear indicator size (50% larger than original)
- [x] Increase completion status indicator size (50% larger)
- [x] Gray out completed notes (grayscale + darkened to 50% brightness)
- [x] Rename "Project" → "Notebook" in all user-facing text
- [x] Rename "Hashtag" → "Tag" in all user-facing text

### Decisions Made
- **UI text only for renames**: Code identifiers (variable names, CSS classes, HTML IDs) left unchanged to avoid risk; only user-visible labels updated
- **Grayscale over opacity**: Initially used `opacity: 0.45` but edges showed through transparent nodes; switched to `filter: grayscale(1) brightness(0.5)` which keeps nodes opaque
- **Completion icon also grayscale**: Green checkmark goes grayscale along with the rest of the node — acceptable since the shape is still visible

### Next Steps
- [ ] Test sidebar tag filter on mobile
- [ ] Test autocomplete dropdown positioning within sidebar context on mobile

---

## Session 2026-01-26 - Afternoon (continued)

### Summary
Moved the hashtag filter input from the toolbar into the hashtag sidebar to reduce toolbar clutter, since the text search bar already exists in the toolbar.

### Files Changed
- `index.html` - Moved `#hashtag-search` div from toolbar into sidebar (between header and content), updated `/` shortcut help text, added TODO comment about future removal/merge, bumped cache versions to v=13/v=21
- `styles/main.css` - Restyled `#hashtag-search` for sidebar context (full width, padding, bottom border separator), removed animated width transitions, cleaned up mobile overrides that referenced it as toolbar element
- `scripts/app.js` - Updated `/` shortcut to call `showSidebar()` before focusing the hashtag input

### Tasks Completed
- [x] Move hashtag filter input from toolbar to sidebar
- [x] Restyle filter input for sidebar context
- [x] Update `/` shortcut to open sidebar + focus input
- [x] Clean up mobile CSS that referenced hashtag search as toolbar element
- [x] Add TODO comment about future removal or merge with text search

### Decisions Made
- **Move to sidebar rather than remove**: Keeps hashtag filter functionality accessible while decluttering toolbar. Sidebar is already the hashtag management hub.
- **Future consideration noted**: May remove hashtag filter entirely or merge it with the text search bar

### Next Steps
- [ ] Test sidebar hashtag filter on mobile
- [ ] Test autocomplete dropdown positioning within sidebar context on mobile
- [ ] Consider removing hashtag filter entirely or merging with text search bar

### Notes
- Desktop testing confirmed working: sidebar opens with filter at top, `/` shortcut opens sidebar and focuses input
- Mobile testing deferred to next session

---

## Session 2026-01-26 - Afternoon

### Summary
Implemented a hashtag autocomplete dropdown feature that appears when typing `#` in either the note editor textarea or the toolbar hashtag filter input, with colored pills, keyboard navigation, and click-to-select.

### Files Changed
- `index.html` - Added `#hashtag-autocomplete` dropdown div inside `#app`, bumped CSS/JS cache versions to v=12/v=20
- `styles/main.css` - Added ~65 lines of autocomplete styling: fixed-position dropdown (z-index 300), item rows with color pill/tag/count, hover/active states, empty state, mobile full-width override
- `scripts/app.js` - Added `autocomplete` state object (6 fields), added 9 new functions (getAutocompleteSuggestions, showAutocomplete, positionAutocomplete, getTextareaCaretCoords, hideAutocomplete, selectAutocompleteItem, updateAutocompleteFromInput, handleAutocompleteKeydown, highlightAutocompleteItem), modified 4 existing event listeners to hook in autocomplete, added click-outside and blur handlers, added hideAutocomplete() call in closeEditor()

### Tasks Completed
- [x] Add autocomplete HTML dropdown element
- [x] Add autocomplete CSS styles with mobile override
- [x] Add autocomplete state object and 9 functions to app.js
- [x] Hook autocomplete into existing note-text and hashtag-input event listeners
- [x] Add click-outside dismiss and blur handlers
- [x] Hook hideAutocomplete into closeEditor

### Decisions Made
- **Single shared dropdown**: One `#hashtag-autocomplete` element repositioned per context (textarea vs filter input), avoids duplicate markup
- **`position: fixed` with z-index 300**: Above editor modal (100), project menu (200), color picker (250)
- **Mirror-div technique** for textarea caret positioning (no library needed)
- **mousedown with preventDefault** on dropdown items to prevent input blur race condition
- **Word-boundary `#` trigger**: Only at position 0 or after whitespace. User tested mid-word `#` (e.g., `foo#bar`) and it does trigger, but user accepted this as OK behavior
- **Forward-scan on select**: Skips remaining word characters after cursor to prevent duplicate text

### Next Steps
- [ ] Test on mobile (step 10 from verification plan): dropdown should appear full-width with margins
- [ ] Consider whether mid-word `#` triggering (test 12) should be tightened up or left as-is
- [ ] Dropdown dismisses on scroll/resize near edges (test 14) rather than repositioning — could enhance with reposition-on-scroll if desired

### Notes
- Tests 1-11, 13 all passed. Test 12 (mid-word `#`) triggers autocomplete but user accepted the behavior. Test 14 (scroll/resize) dismisses dropdown which user found acceptable.
- Suggestions sorted by count descending then alphabetically, limited to 20 results
- Tab/Enter selects highlighted item; Escape dismisses without inserting

---

## Session 2026-01-25 - Afternoon

### Summary
Implemented mobile action bar repositioning so it floats above the selected node instead of being fixed to the bottom of the screen, then simplified the bar to text-only buttons by removing emoji icons.

### Files Changed
- `scripts/app.js` - Added `canvasToScreen()` helper, added `positionActionBar()` function for mobile floating positioning, modified `showActionBar()`/`hideActionBar()` to use positioning logic and clean up inline styles, added `hideActionBar()` calls during touch pan and pinch zoom
- `styles/main.css` - Removed fixed-bottom mobile CSS for action bar (JS handles positioning now), restyled `.action-btn` as compact text pills, removed unused `.action-icon` and `.action-label` rules
- `index.html` - Replaced emoji+label button markup with plain text buttons ("Edit", "Connect", "Duplicate", "Delete")

### Tasks Completed
- [x] Changed location of action bar to float by the note
- [x] Convert action bar buttons from emoji+label to text-only

### Decisions Made
- **Text-only buttons**: Removed emoji icons and label spans, using plain text directly in `<button>` elements with smaller padding and font styling

### Next Steps
- [ ] Action bar on mobile: Verify flip logic when node is near top of screen
- [ ] Consider whether action bar should reposition when dragging a selected node (currently it hides)

### Notes
- The `canvasToScreen()` function accounts for both zoom and pan state when converting coordinates
- The bar uses `position: fixed` with computed `top`/`left` on mobile, so it stays in place relative to the viewport even though nodes are in canvas/SVG space

---
