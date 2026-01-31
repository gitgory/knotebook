# Test Plan: Autocomplete TAB Auto-Insert

**Feature:** Improved hashtag autocomplete - TAB automatically inserts when only one suggestion remains
**Version:** v48
**Date:** 2026-01-30

---

## Overview

When only one hashtag suggestion remains in the autocomplete dropdown, pressing TAB (or Enter) now automatically inserts it without requiring arrow key navigation to highlight it first.

**Goal:** Reduce friction when typing hashtags with unique prefixes.

---

## Setup

Create or open a notebook with multiple hashtags including:
- `#project`
- `#idea`
- `#urgent`
- `#test`
- `#important`

---

## Test Cases

### ✓ Test 1: Single Match Auto-Insert with TAB
**Location:** Note editor

1. Create or edit a note (double-click node or press N)
2. In the content field, type `#pro`
3. **Expected:** Autocomplete dropdown appears showing only `#project`
4. Press **TAB** (without pressing arrow keys)
5. **Expected:**
   - `#project ` is inserted (with trailing space)
   - Cursor positioned after the space
   - Autocomplete dropdown closes
   - Ready to continue typing

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 2: Single Match Auto-Insert with Enter
**Location:** Note editor

1. In note editor, type `#urg`
2. **Expected:** Autocomplete shows only `#urgent`
3. Press **Enter** (without pressing arrow keys)
4. **Expected:**
   - `#urgent ` is inserted (with trailing space)
   - Cursor positioned after the space
   - Autocomplete dropdown closes

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 3: Multiple Matches - No Auto-Insert
**Location:** Note editor

1. In note editor, type `#i`
2. **Expected:** Autocomplete shows multiple tags (e.g., `#idea`, `#important`)
3. Press **TAB** without using arrow keys to highlight
4. **Expected:**
   - Nothing is inserted
   - Autocomplete dropdown closes
   - TAB behavior passes through normally
5. Type `#i` again, use arrow keys to highlight `#idea`, then press TAB
6. **Expected:** `#idea ` is inserted (normal behavior)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 4: Works in Filter Input
**Location:** Hashtag sidebar filter

1. Open hashtag sidebar (# button or H key)
2. Click in the filter input at top of sidebar
3. Type `#proj`
4. **Expected:** Autocomplete shows only `#project`
5. Press **TAB**
6. **Expected:**
   - `#project` is inserted in filter input
   - Filter activates, showing only nodes with #project
   - Autocomplete closes

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 5: Unique Partial Match
**Location:** Note editor

1. Type `#te` (assuming only `#test` exists)
2. **Expected:** Autocomplete shows only `#test`
3. Press **TAB**
4. **Expected:** `#test ` is inserted

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 6: Case Insensitive Matching
**Location:** Note editor

1. Type `#PRO` (uppercase)
2. **Expected:** Autocomplete shows only `#project` (if unique)
3. Press **TAB**
4. **Expected:** `#project ` is inserted (lowercase, as stored)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 7: Works After Filtering Down
**Location:** Note editor

1. Type `#i` - shows multiple matches
2. Continue typing: `#ide`
3. **Expected:** Now only `#idea` matches
4. Press **TAB** (without highlighting)
5. **Expected:** `#idea ` is auto-inserted

**Status:** [ ] Pass [ ] Fail

---

## Edge Cases

### ✓ Test 8: Empty Autocomplete
**Location:** Note editor

1. Type `#zzz` (no matches)
2. **Expected:** Autocomplete shows "No matching tags"
3. Press **TAB**
4. **Expected:**
   - Nothing happens or autocomplete closes
   - No insertion

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 9: Highlighted Item Takes Precedence
**Location:** Note editor

1. Type `#` - shows all tags
2. Press arrow down to highlight `#project`
3. Press **TAB**
4. **Expected:** `#project ` is inserted (highlighted item, not first item)

**Status:** [ ] Pass [ ] Fail

---

## Mobile Tests

### ✓ Test 10: Mobile - Single Match Auto-Insert
**Platform:** Mobile browser

1. Open note editor on mobile
2. Tap in content field, type `#proj`
3. **Expected:** Autocomplete appears with only `#project`
4. Tap anywhere to blur or use software keyboard TAB (if available)
5. **Expected:** Behavior consistent with desktop

**Status:** [ ] Pass [ ] Fail [ ] N/A

---

## Regression Tests

### ✓ Test 11: Arrow Key Selection Still Works
**Location:** Note editor

1. Type `#` - shows all tags
2. Use arrow down to highlight desired tag
3. Press TAB or Enter
4. **Expected:** Highlighted tag is inserted (original behavior preserved)

**Status:** [ ] Pass [ ] Fail

---

### ✓ Test 12: Escape Still Closes Without Inserting
**Location:** Note editor

1. Type `#pro`
2. **Expected:** Autocomplete shows `#project`
3. Press **Escape**
4. **Expected:**
   - Autocomplete closes
   - Nothing inserted
   - Typed `#pro` remains in field

**Status:** [ ] Pass [ ] Fail

---

## Pass Criteria

**All tests must pass:**
- ✓ Single match auto-inserts on TAB/Enter
- ✓ Multiple matches still require arrow key selection
- ✓ Works in both note editor and filter input
- ✓ Cursor positioned correctly after insertion
- ✓ No regressions to existing autocomplete behavior
- ✓ Consistent behavior across platforms

---

## Notes

- This feature completes the "Improved tag suggestions" item from Tier 1
- Implementation in `handleAutocompleteKeydown()` function (scripts/app.js ~line 2058)
- Original behavior preserved: if user highlights with arrows, that takes precedence
