# Feature Plan - 5 Tier Organization

## Overview

Features have been reorganized into 5 tiers based on impact and effort. Within each tier, notes are sorted with:
- **To Do** items first
- **Partial** items second
- **Done** items last

### Tier Distribution:
- **Tier 1:** 7 items - **COMPLETE** ✓ (Quick Wins - High Impact, Low Effort)
- **Tier 2:** 16 items - **COMPLETE** ✓ (Important Features - Med Impact Low Effort OR High Impact Med Effort)
- **Tier 3:** 21 items (Major Investments - High Impact High Effort OR Med Impact Med Effort)
- **Tier 4:** 14 items (Polish & Refinements - Low Impact, Low Effort)
- **Tier 5:** 11 items (Future/Deferred - Low Impact High Effort, etc.)

---

## TIER 1: Quick Wins (High Impact, Low Effort)
**Y-Range: -500 to 0**

### To Do (0 items):
(none)

### Done (7 items):
1. Improved tag suggestions
2. Accidentally closing note editor
3. Completion checkbox
4. Gray out completed notes
5. Note editor saves by default
6. Set default completion per notebook
7. Text search filter

---

## TIER 2: Important Features
**Y-Range: 0 to 500**

### To Do (0 items):
(none)

### Partial (0 items):
(none)

### Done (15 items):
1. Move action bar above note
2. Sidebar editing (rename/delete tags)
3. Text search indicator
4. Ctrl+Drag only copies if selected
5. Cut max zoom in half
6. Expand note to show full title
7. Export to Markdown/plain text
8. Hashtag auto-complete
9. Make completion-status bigger
10. Note templates
11. Tag drop-down completion polish
12. Visually turn off certain hashtags
13. Zoom to fit only visible nodes

---

## TIER 3: Major Investments
**Y-Range: 500 to 1000**

### To Do (19 items):
High Impact, High Effort:
1. Add undo feature (Ctrl+Z)
2. Auto-calculate completion
3. Batch edit notes
4. Custom fields system ⭐
5. Drag box / lasso multi-select
6. Generate nodes via text
7. Nested vs. collapsible nodes
8. Performance optimization
9. Persistent search zones ⭐
10. % completion

Medium Impact, Medium Effort:
11. Adding directionality for edges
12. Advanced action bar items
13. AND/OR logic for search filters
14. create skill to export & import (and sort) notes as tasks
15. Drag nodes into another (reparent)
16. Filter notes by completion status
17. Find way to pan without losing group selection
18. add a recycle bin for notebooks
19. Search across all nested content
20. Service Workers / PWA

### Done (1 item):
21. Move to GitHub Pages

---

## TIER 4: Polish & Refinements (Low Impact, Low Effort)
**Y-Range: 1000 to 1500**

### To Do (8 items):
1. drop shadow on notes?
2. gray completed notes should still light up border when selected
3. move themes into its own CSS?
4. Move python script, batch, etc to global skills
5. remove background color from theme selector
6. Revisit toolbar button symbols
7. Snap grid for node alignment
8. visual indicator of the current theme

### Done (6 items):
9. Better confirmation popups
10. Change name -> Knotebook
11. Change themes
12. Favicon
13. Force note save on field change
14. Hashtag alphabetical sort
15. move Cancel button to top, just X
16. Note body indicator

---

## TIER 5: Future/Deferred
**Y-Range: 1500 to 2000**

### To Do (11 items):
Low Impact, High Effort:
1. Filter by connection status
2. Propose some subtle design changes that will really stretch your comfort zone

Medium Impact, High Effort:
3. Dimensionality for notes
4. Force-directed graph layout
5. Hashtag search to match any part
6. Import from other note apps
7. Integrate with Notion

Low Impact, Medium Effort:
8. create a knot icon
9. ES modules
10. JSON should only store hashtag colors currently in use
11. Notes too far away?

---

## Spatial Layout in knotebook

When you open Feature Plan.json in knotebook, you'll see:

- **Top area (Y: -500 to 0):** Tier 1 - Quick wins, mostly complete
- **Upper-middle (Y: 0 to 500):** Tier 2 - Important features to tackle next
- **Middle (Y: 500 to 1000):** Tier 3 - Major feature investments
- **Lower-middle (Y: 1000 to 1500):** Tier 4 - Polish items
- **Bottom (Y: 1500 to 2000):** Tier 5 - Deferred/future work

Notes are arranged in columns (max 8 per column) within each tier.
