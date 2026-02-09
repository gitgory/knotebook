# Test Plan: renderNodes() Refactoring

## Overview
Refactored `renderNodes()` from 186 → 20 lines by extracting 8 helper functions. Also updated `renderGhostNodes()` to use shared `renderNodeHashtags()` function, eliminating ~35 lines of duplication.

## Refactoring Details
- **Version**: v157
- **Commit**: 3a28991
- **Date**: 2026-02-08

**Helpers Extracted:**
1. `prepareNodesLayer()` - Get and clear SVG layer
2. `sortNodesByZIndex(nodes)` - Sort by zIndex for layering
3. `createNodeGroup(node)` - Create SVG group with classes/transform
4. `renderChildStackIndicators(g, node)` - Stack rectangles (1-2 layers)
5. `renderNodeBody(g, node)` - Body rect + dog-ear fold
6. `renderNodeTitle(g, node)` - Title text with truncation
7. `renderNodeHashtags(g, node)` - Pill rendering (reusable with renderGhostNodes)
8. `renderCompletionIndicator(g, node)` - 4 completion states

## Test Environment
- **URL**: https://gitgory.github.io/knotebook/
- **Version**: v157+
- **Test Date**: ___________
- **Tester**: ___________
- **Browser**: ___________

---

## Test Cases

### 1. Basic Node Rendering
- [ ] Create a new notebook
- [ ] Add several notes with titles
- [ ] **Expected**: All notes render correctly on canvas
- [ ] **Expected**: Notes are positioned at correct coordinates
- [ ] **Result**: ___________

### 2. Node Sorting (zIndex)
- [ ] Create 3 notes
- [ ] Right-click note 1 → "Bring to Front"
- [ ] Right-click note 3 → "Send to Back"
- [ ] **Expected**: Notes render in correct stacking order (zIndex)
- [ ] **Result**: ___________

### 3. Node Selection States
- [ ] Click to select a note
- [ ] **Expected**: Selected note shows lime border
- [ ] Ctrl+Click to select multiple notes
- [ ] **Expected**: All selected notes show lime border
- [ ] Click canvas to deselect
- [ ] **Expected**: Borders return to normal
- [ ] **Result**: ___________

### 4. Child Stack Indicators
- [ ] Create a note
- [ ] Add 1 child note (double-click to enter, add note, click "Home")
- [ ] **Expected**: Parent shows 1 stacked rectangle behind it
- [ ] Add 2 more children (total 3+)
- [ ] **Expected**: Parent shows 2 stacked rectangles behind it
- [ ] **Result**: ___________

### 5. Node Body and Dog-Ear Fold
- [ ] Create a note with only a title
- [ ] **Expected**: No dog-ear fold in top-left corner
- [ ] Open editor, add body text, save
- [ ] **Expected**: Dog-ear fold appears in top-left corner
- [ ] **Result**: ___________

### 6. Node Title Rendering
- [ ] Create note with short title "Test"
- [ ] **Expected**: Full title displays
- [ ] Create note with long title (>30 chars): "This is a very long title that should be truncated"
- [ ] **Expected**: Title truncates with ellipsis (...)
- [ ] Hover over truncated title
- [ ] **Expected**: Full title appears in tooltip/expanded view
- [ ] **Result**: ___________

### 7. Hashtag Pills Rendering
- [ ] Create note with hashtags: #bug #feature #urgent
- [ ] **Expected**: 3 colored pills display below title
- [ ] **Expected**: Pills have correct colors
- [ ] **Expected**: Pills are properly spaced
- [ ] Create note with many tags (10+)
- [ ] **Expected**: Pills that don't fit show "..." ellipsis
- [ ] **Result**: ___________

### 8. Hidden Hashtags
- [ ] Create note with tags: #visible #hidden
- [ ] In sidebar, click X to hide #hidden tag
- [ ] **Expected**: #hidden pill disappears from note
- [ ] **Expected**: #visible pill still displays
- [ ] Click "Show All Tags" in sidebar
- [ ] **Expected**: #hidden pill reappears on note
- [ ] **Result**: ___________

### 9. Hashtag Truncation
- [ ] Create note with long tag: #thisisaverylongtagname
- [ ] **Expected**: Tag truncates in pill with ellipsis
- [ ] **Result**: ___________

### 10. Completion Indicators
- [ ] Create note, open editor
- [ ] Click "To do" button
- [ ] **Expected**: Empty circle (○) appears in top-right
- [ ] Click circle on note to cycle
- [ ] **Expected**: Cycles through: To do (○) → Done (✓) → Partial (◐) → Cancelled (✕) → To do
- [ ] **Expected**: Done and Cancelled notes show grayscale filter
- [ ] **Result**: ___________

### 11. Completion Icons Positioning
- [ ] Create note with completion status
- [ ] **Expected**: Completion icon positioned correctly in top-right
- [ ] **Expected**: Icon doesn't overlap with title or hashtags
- [ ] Create note with long title + many tags + completion
- [ ] **Expected**: All elements render without overlap
- [ ] **Result**: ___________

### 12. Filter by Hashtag
- [ ] Create notes with tags: #bug, #feature, #docs
- [ ] Click #bug pill in sidebar
- [ ] **Expected**: Only notes with #bug display on canvas
- [ ] **Expected**: Other notes are hidden (not rendered)
- [ ] **Result**: ___________

### 13. Text Search Filter
- [ ] Create notes with titles: "API Bug", "UI Feature", "Documentation"
- [ ] Type "bug" in search box
- [ ] **Expected**: Only "API Bug" note displays
- [ ] Clear search
- [ ] **Expected**: All notes reappear
- [ ] **Result**: ___________

### 14. Ghost Nodes (Move to Notebook) - Shared Hashtag Rendering
- [ ] Create notebook "Source" with notes containing hashtags
- [ ] Create second notebook "Target"
- [ ] Select notes in Source → Right-click → "Move to Notebook"
- [ ] Select Target notebook
- [ ] **Expected**: Ghost nodes appear following cursor
- [ ] **Expected**: Ghost nodes show hashtag pills correctly (same as regular nodes)
- [ ] **Expected**: Hashtag colors match between ghost and regular rendering
- [ ] Click to place ghost nodes
- [ ] **Expected**: Notes move successfully with all hashtags intact
- [ ] **Result**: ___________

### 15. Ghost Nodes - Hidden Hashtags
- [ ] In Source notebook, hide a tag (#hidden)
- [ ] Initiate "Move to Notebook" with note containing #hidden
- [ ] **Expected**: Ghost node respects hidden tags (doesn't show #hidden pill)
- [ ] Place nodes in Target
- [ ] **Expected**: Moved notes show all tags (including #hidden) in target notebook
- [ ] **Result**: ___________

### 16. Performance - Many Nodes
- [ ] Create 50+ notes on canvas
- [ ] Pan around canvas
- [ ] **Expected**: Smooth rendering, no lag
- [ ] **Expected**: All nodes render correctly
- [ ] **Result**: ___________

### 17. Performance - Rapid Interactions
- [ ] Drag a node around quickly
- [ ] **Expected**: Node follows cursor smoothly
- [ ] **Expected**: No visual glitches or flickering
- [ ] **Result**: ___________

### 18. Completed Notes Styling
- [ ] Create note, set completion to "Done"
- [ ] **Expected**: Note renders with grayscale filter
- [ ] **Expected**: Border still visible (not grayed out)
- [ ] Select completed note
- [ ] **Expected**: Lime selection border shows clearly
- [ ] **Result**: ___________

---

## Test Results Summary

**Total Tests**: 18
**Passed**: _____
**Failed**: _____
**Pass Rate**: _____%

## Issues Found

| # | Description | Severity | Status |
|---|-------------|----------|--------|
|   |             |          |        |

## Notes

---

## Sign-off

- [ ] All critical tests passed
- [ ] No regressions found
- [ ] Ready for production

**Tester**: ___________
**Date**: ___________
