# Test Plan: Batch Edit with Clickable Tag Pills

**Feature:** Batch editing multiple notes with interactive tag removal/re-adding
**Version:** v60
**Date:** 2026-01-30

---

## Overview

Complete redesign of tag editing in both single and batch modes:
- Click tag pill → Removes tag (outlined)
- Click outlined pill → Re-adds tag (solid)
- Batch mode shows ALL unique tags with frequency counts
- Tags sorted by frequency (most common first)

**Goal:** Verify tag removal/re-adding works correctly in both single and batch modes.

---

## Setup

Create a test notebook with at least 5 notes:
- Note 1: `#urgent #project #frontend`
- Note 2: `#urgent #backend`
- Note 3: `#project #frontend #review`
- Note 4: `#urgent #project`
- Note 5: `#backend #database`

---

## Part 1: Single Note Edit Mode

### ✓ Test 1: Remove Tag (Single Note)
**Steps:**
1. Double-click Note 1 (has `#urgent #project #frontend`)
2. **Expected:** Editor opens, shows 3 tag pills (solid, colored background)
3. Click on `#urgent` pill
4. **Expected:**
   - Pill becomes outlined (transparent bg, colored border, white text)
   - Content textarea updates (tag removed from text)
   - No extra spaces left in content

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 2: Re-add Tag (Single Note)
**Steps:**
1. From Test 1, with `#urgent` outlined
2. Click outlined `#urgent` pill again
3. **Expected:**
   - Pill becomes solid (colored background)
   - `#urgent` appended to end of content
   - Tag shows in pills area

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 3: Save with Removed Tag
**Steps:**
1. Open Note 1
2. Click `#frontend` pill to remove
3. Press Escape or click outside to save
4. Re-open Note 1
5. **Expected:**
   - Only `#urgent` and `#project` pills show
   - `#frontend` is gone (not showing as outlined)
   - Content text doesn't have `#frontend`

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 4: Cancel with Removed Tag
**Steps:**
1. Open Note 2 (has `#urgent #backend`)
2. Click `#urgent` to remove (becomes outlined)
3. Click Cancel button (red X)
4. Re-open Note 2
5. **Expected:**
   - `#urgent` still present (removal was cancelled)
   - Both tags show as solid pills

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 5: Type New Tag While Removed Tag Outlined
**Steps:**
1. Open Note 3
2. Click `#review` to remove (becomes outlined)
3. In content textarea, type `#review` manually
4. **Expected:**
   - Outlined `#review` pill becomes solid immediately
   - Tag is back in active state

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 6: Visual States - Hover and Click
**Steps:**
1. Open any note with tags
2. Hover over a solid pill
3. **Expected:** Slight opacity change + scale up
4. Click the pill
5. **Expected:** Quick scale down animation on click

**Status:** [ ] Pass [ ] Fail

---

## Part 2: Batch Edit Mode - Basic Functionality

### ✓ Test 7: Open Batch Editor
**Steps:**
1. Select Notes 1, 2, 4 (Ctrl+Click) - all have `#urgent`
2. Double-click any selected note
3. **Expected:**
   - Title field disabled with "Editing 3 notes"
   - Content field enabled with placeholder "Type tags to add..."
   - Tag pills show ALL unique tags: `#urgent`, `#project`, `#frontend`, `#backend`
   - Each pill has badge count

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 8: Badge Counts Display Correctly
**Steps:**
1. From Test 7 (Notes 1, 2, 4 selected)
2. Check badge counts on pills
3. **Expected:**
   - `#urgent (3/3)` - in all 3 notes
   - `#project (2/3)` - in Notes 1 and 4
   - `#frontend (1/3)` - only in Note 1
   - `#backend (1/3)` - only in Note 2

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 9: Tags Sorted by Frequency
**Steps:**
1. From Test 8, verify tag order
2. **Expected order (most common first):**
   - `#urgent (3/3)` - first
   - `#project (2/3)` - second
   - `#frontend (1/3)` and `#backend (1/3)` - alphabetically

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 10: Remove Tag in Batch Mode
**Steps:**
1. From Test 7 (Notes 1, 2, 4 selected)
2. Click `#urgent (3/3)` pill
3. **Expected:**
   - Pill becomes outlined `#urgent (0/3)`
   - Badge updates to show 0/3

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 11: Re-add Tag in Batch Mode
**Steps:**
1. From Test 10, with `#urgent (0/3)` outlined
2. Click outlined pill
3. **Expected:**
   - Content textarea shows `#urgent` typed
   - Pill still shows `#urgent (0/3)` (won't update count until save)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 12: Save Batch Removal
**Steps:**
1. Select Notes 1, 2 (both have `#urgent #project`)
2. Open batch editor
3. Click `#urgent (2/2)` to remove (becomes outlined)
4. Save (Escape or click outside)
5. Open Note 1 individually
6. **Expected:** Only `#project` and `#frontend` remain (no `#urgent`)
7. Open Note 2 individually
8. **Expected:** Only `#backend` remains (no `#urgent`)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 13: Add New Tag in Batch Mode
**Steps:**
1. Select Notes 3, 4, 5 (any 3 notes)
2. Open batch editor
3. Type `#batch-test` in content textarea
4. **Expected:**
   - New pill appears `#batch-test (0/3)`
   - Pill is solid (not outlined)
5. Save
6. Check each selected note individually
7. **Expected:** All 3 notes now have `#batch-test` added

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 14: Mixed Operations (Add + Remove)
**Steps:**
1. Select Notes 1, 3 (have `#project #frontend`)
2. Open batch editor
3. Click `#frontend (2/2)` to remove
4. Type `#new-tag` in content
5. Save
6. **Expected:**
   - Both notes lose `#frontend`
   - Both notes gain `#new-tag`
   - `#project` unchanged

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 15: Cancel Batch Edit
**Steps:**
1. Select Notes 2, 4, 5
2. Open batch editor
3. Remove `#urgent` (if present)
4. Add `#test-cancel`
5. Click Cancel button
6. Check notes individually
7. **Expected:** No changes saved, all tags remain as before

**Status:** [ ] Pass [ ] Fail

---

## Part 3: Edge Cases

### ✓ Test 16: Remove Tag Not in All Notes
**Steps:**
1. Select Notes 1, 2, 3 (different tag combinations)
2. Open batch editor
3. Click `#frontend (2/3)` to remove (only in Notes 1 and 3)
4. Save
5. Check Note 2 (didn't have `#frontend`)
6. **Expected:** Note 2 unchanged (no error removing tag it didn't have)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 17: Re-add Tag to All Notes
**Steps:**
1. Select Notes 1, 4, 5
2. Open batch editor
3. Click `#project (2/3)` to remove (becomes outlined)
4. Click outlined `#project (0/3)` to re-add
5. Save
6. **Expected:**
   - Notes 1 and 4 keep `#project` (had it before)
   - Note 5 gains `#project` (didn't have it, now does)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 18: Remove All Tags from a Note
**Steps:**
1. Create note with only `#test` tag
2. Open editor
3. Click `#test` to remove
4. Save
5. **Expected:** Note has no tags, pill area empty on reopen

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 19: Batch Edit Single Selection
**Steps:**
1. Select only 1 note (Ctrl+Click to ensure it's in selection)
2. Double-click to open editor
3. **Expected:**
   - Should work as single edit mode (no batch mode)
   - No badge counts
   - Title and content enabled

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 20: Autocomplete Still Works
**Steps:**
1. Open batch editor (or single editor)
2. Type `#` in content textarea
3. **Expected:** Autocomplete dropdown appears
4. Select a tag suggestion
5. **Expected:** Tag inserted, new pill appears

**Status:** [ ] Pass [ ] Fail

---

## Part 4: Content Text Synchronization

### ✓ Test 21: Content Updates When Removing Tag
**Steps:**
1. Open note with content: `This is #urgent and #important stuff`
2. Click `#urgent` pill to remove
3. Check content textarea
4. **Expected:**
   - Content: `This is and #important stuff`
   - Extra space cleaned up: `This is and #important stuff` → ideally `This is and #important stuff` (single space)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 22: Re-add Appends to End
**Steps:**
1. From Test 21, click outlined `#urgent` to re-add
2. Check content textarea
3. **Expected:** Content becomes `This is and #important stuff #urgent` (tag at end)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 23: Multiple Space Cleanup
**Steps:**
1. Open note with: `#tag1  #tag2   #tag3` (multiple spaces)
2. Click `#tag2` to remove
3. **Expected:** Content cleaned to `#tag1 #tag3` (single spaces)

**Status:** [ ] Pass [ ] Fail

---

## Part 5: Set Completion Status (Batch)

### ✓ Test 24: Set Completion in Batch Mode
**Steps:**
1. Select 3 notes with different completion states
2. Open batch editor
3. Click "Done" button
4. Save
5. **Expected:** All 3 notes now marked as "Done"

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 25: Mixed Completion Shows No Active Button
**Steps:**
1. Select notes with different completion states (To do, Done, None)
2. Open batch editor
3. **Expected:** No completion button is highlighted (all inactive)

**Status:** [ ] Pass [ ] Fail

---

## Part 6: Regression Tests

### ✓ Test 26: Single Edit Still Works Normally
**Steps:**
1. Double-click single note (not multi-selected)
2. Edit title, content, tags, completion
3. Save
4. **Expected:** All changes saved correctly

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 27: Hashtag Autocomplete in Textarea
**Steps:**
1. Open batch editor
2. Type `#` followed by letters
3. **Expected:** Autocomplete dropdown works
4. Select suggestion with Tab/Enter
5. **Expected:** Tag inserted correctly

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 28: Step Into Button Disabled
**Steps:**
1. Open batch editor (multi-select)
2. Check "Step into note" button
3. **Expected:** Button is disabled (can't step into multiple notes)

**Status:** [ ] Pass [ ] Fail

---

## Part 7: Mobile Tests (Optional)

### ✓ Test 29: Mobile Batch Edit
**Platform:** Mobile browser

**Steps:**
1. On mobile, select multiple notes (long-press + tap)
2. Double-tap to open editor
3. Tap tag pills to remove/re-add
4. **Expected:** Same behavior as desktop

**Status:** [ ] Pass [ ] Fail [ ] N/A

---

## Pass Criteria

**All tests must pass:**
- ✓ Tag pills clickable to remove (solid → outlined)
- ✓ Outlined pills clickable to re-add (outlined → solid)
- ✓ Batch mode shows all unique tags with counts
- ✓ Tags sorted by frequency (most common first)
- ✓ Content text stays synchronized with pills
- ✓ Removed state is session-only (cleared on save/cancel)
- ✓ Batch operations apply correctly to all selected notes
- ✓ No regressions to existing editor functionality

---

## Notes

- This feature enables powerful batch tag management
- Visual feedback (outlined pills) makes state clear
- Undo-able via re-clicking outlined pills
- Generalizes to custom fields (just add fields to editor)
- Implementation: v58 (basic batch edit) → v59 (textarea fix) → v60 (clickable pills)
