# Test Plan: Custom Fields Settings UI (v172)

**Version:** v172
**Date:** 2026-02-10
**Feature:** Tabbed settings modal with Custom Fields management
**Related:** design-spec-custom-fields.txt Phase 2

---

## Overview

This test plan covers the new tabbed settings modal interface that allows users to define custom fields per notebook. Custom fields are Second-Class fields (user-defined, per-notebook) as opposed to First-Class fields (global, hard-coded like completion/priority).

---

## Test Environment Setup

1. Load knotebook at https://gitgory.github.io/knotebook/
2. Verify version shows CSS v150 | JS v172 on landing page
3. Create a new test notebook or use existing notebook
4. Clear browser cache if needed (Ctrl+Shift+R)

---

## 1. Tab Navigation

### 1.1 Open Settings Modal
- [ ] Click settings icon (⚙️) in toolbar
- [ ] Modal opens and displays "Notebook Settings" header
- [ ] "General" tab is active by default (highlighted with accent color)
- [ ] "Custom Fields" tab is visible but not active

### 1.2 Switch to Custom Fields Tab
- [ ] Click "Custom Fields" tab button
- [ ] Custom Fields tab becomes active (accent border bottom)
- [ ] General tab becomes inactive (gray text)
- [ ] Custom Fields panel content is displayed
- [ ] General panel content is hidden

### 1.3 Switch Back to General Tab
- [ ] Click "General" tab button
- [ ] General tab becomes active
- [ ] Custom Fields tab becomes inactive
- [ ] General panel content is displayed (completion/priority dropdowns)
- [ ] Custom Fields panel content is hidden

### 1.4 Close and Reopen Modal
- [ ] Close settings modal (click "Close" button)
- [ ] Reopen settings modal
- [ ] General tab is active again (resets to default)
- [ ] Modal state doesn't persist between opens

---

## 2. Empty State

### 2.1 No Custom Fields Defined
- [ ] Switch to Custom Fields tab
- [ ] See instructional text: "Define fields for notes in this notebook..."
- [ ] See "+ Add Field" button with dashed border
- [ ] See empty state message: "No custom fields defined yet."
- [ ] Message is centered and gray

---

## 3. Add Custom Field

### 3.1 Valid Field Creation
- [ ] Click "+ Add Field" button
- [ ] Prompt appears: "Field name (no spaces):"
- [ ] Enter: `effort`
- [ ] Click OK
- [ ] Prompt appears: "Display label:"
- [ ] Default shows field name (`effort`)
- [ ] Change to: `Effort Level`
- [ ] Click OK
- [ ] Prompt appears: "Options (comma-separated):"
- [ ] Default shows: `low, medium, high`
- [ ] Accept default
- [ ] Click OK
- [ ] Field card appears in list with:
  - Header: "Effort Level" with Edit/Delete buttons
  - Type: "Single-select"
  - Options: "low, medium, high"

### 3.2 Field Name Validation - Invalid Characters
- [ ] Click "+ Add Field"
- [ ] Enter field name: `2effort` (starts with number)
- [ ] Alert appears: "Invalid field name. Use letters, numbers, and underscores only."
- [ ] Try: `effort-level` (contains hyphen)
- [ ] Same error alert
- [ ] Try: `effort level` (contains space)
- [ ] Same error alert
- [ ] Try: `effort_level` (valid with underscore)
- [ ] Accepted, proceeds to label prompt

### 3.3 Field Name Validation - Duplicates
- [ ] Create a field named `effort`
- [ ] Click "+ Add Field" again
- [ ] Enter field name: `effort`
- [ ] Alert appears: "A field with this name already exists."
- [ ] Field is not created
- [ ] Enter different name: `priority_level`
- [ ] Proceeds normally

### 3.4 Field Name Validation - Reserved Names
- [ ] Click "+ Add Field"
- [ ] Enter field name: `completion`
- [ ] Alert appears: "This field name is reserved."
- [ ] Try: `priority`
- [ ] Same error alert
- [ ] Try: `effort` (not reserved)
- [ ] Accepted

### 3.5 Cancel During Field Creation
- [ ] Click "+ Add Field"
- [ ] Enter field name: `status`
- [ ] Click Cancel on label prompt
- [ ] Field is not created
- [ ] List remains unchanged

### 3.6 Create Multiple Fields
- [ ] Add field: `effort` (Single-select: low, medium, high)
- [ ] Add field: `author` (with options: Alice, Bob, Carol)
- [ ] Add field: `sprint` (with options: sprint-1, sprint-2, sprint-3)
- [ ] All three fields appear in list
- [ ] Fields display in order created

---

## 4. Edit Custom Field

### 4.1 Edit Field Label
- [ ] Create field: name=`effort`, label=`Effort`
- [ ] Click "Edit" button on field card
- [ ] Prompt shows: "Display label:" with current value `Effort`
- [ ] Change to: `Effort Level`
- [ ] Click OK
- [ ] Options prompt appears with current options
- [ ] Click OK (accept current)
- [ ] Field card updates to show: "Effort Level"
- [ ] Type and options unchanged

### 4.2 Edit Field Options
- [ ] Create field with options: `low, medium, high`
- [ ] Click "Edit"
- [ ] Accept label prompt
- [ ] Options prompt shows: `low, medium, high`
- [ ] Change to: `low, normal, high, urgent`
- [ ] Click OK
- [ ] Field card updates to show: "Options: low, normal, high, urgent"

### 4.3 Remove Options
- [ ] Edit field with options: `low, medium, high`
- [ ] In options prompt, change to: `low, high` (remove medium)
- [ ] Click OK
- [ ] Field card updates to show only: "low, high"

### 4.4 Cancel Edit
- [ ] Click "Edit" on a field
- [ ] Click Cancel on label prompt
- [ ] Field remains unchanged
- [ ] No updates made

---

## 5. Delete Custom Field

### 5.1 Delete with Confirmation
- [ ] Create field: `effort`
- [ ] Click "Delete" button
- [ ] Confirmation appears: "Delete field 'effort'?"
- [ ] Message warns: "...field values in notes will remain but will no longer be editable"
- [ ] Click "Yes" or "Delete"
- [ ] Field is removed from list
- [ ] Empty state message appears if no fields remain

### 5.2 Cancel Delete
- [ ] Create field: `effort`
- [ ] Click "Delete" button
- [ ] Click "No" or "Cancel" on confirmation
- [ ] Field remains in list
- [ ] No changes made

### 5.3 Delete Multiple Fields
- [ ] Create three fields: `effort`, `author`, `sprint`
- [ ] Delete `author` field
- [ ] Confirm deletion
- [ ] Only `effort` and `sprint` remain
- [ ] Order of remaining fields unchanged

---

## 6. Persistence

### 6.1 Settings Persist in Current Project
- [ ] Add field: `effort`
- [ ] Close settings modal
- [ ] Reopen settings modal
- [ ] Switch to Custom Fields tab
- [ ] Field still appears in list

### 6.2 Settings Persist After Refresh
- [ ] Add field: `effort`
- [ ] Close modal
- [ ] Refresh page (F5)
- [ ] Reopen notebook
- [ ] Open settings modal → Custom Fields tab
- [ ] Field still appears in list

### 6.3 Settings Are Per-Notebook
- [ ] In Notebook A: add field `effort`
- [ ] Go to landing page
- [ ] Create or open Notebook B
- [ ] Open settings → Custom Fields tab
- [ ] No fields defined (empty state)
- [ ] Add field `rating` in Notebook B
- [ ] Return to Notebook A
- [ ] Open settings → Custom Fields tab
- [ ] Only `effort` field appears (not `rating`)

---

## 7. Visual & UI

### 7.1 Modal Sizing
- [ ] Open settings modal
- [ ] Modal is wider than previous version (480px vs 360px)
- [ ] Modal is centered on screen
- [ ] Modal has max-height (80vh) with scroll if needed
- [ ] On mobile: modal is 90% width (responsive)

### 7.2 Tab Styling
- [ ] Active tab has accent color text
- [ ] Active tab has accent color bottom border (2px)
- [ ] Inactive tab has gray text
- [ ] Hover over inactive tab: text lightens
- [ ] Tab border transitions smoothly

### 7.3 Add Field Button
- [ ] Button has dashed border
- [ ] Button text is accent color
- [ ] Hover: background changes to surface color
- [ ] Hover: border becomes solid accent color
- [ ] Button spans full width

### 7.4 Field Cards
- [ ] Card has solid border
- [ ] Card background is surface color
- [ ] Header divides name (left) and actions (right)
- [ ] Name is bold and primary text color
- [ ] Edit/Delete buttons are small and secondary color
- [ ] Hover over buttons: background darkens, text lightens
- [ ] Details section shows type and options in smaller gray text

### 7.5 Scrolling with Many Fields
- [ ] Add 10+ fields
- [ ] Custom Fields panel scrolls
- [ ] Tab navigation remains fixed at top
- [ ] Close button remains fixed at bottom
- [ ] Scroll is smooth

---

## 8. Edge Cases

### 8.1 Very Long Field Names
- [ ] Create field with long label: `This is a very long field label that might cause layout issues`
- [ ] Field card doesn't break layout
- [ ] Name wraps to multiple lines if needed
- [ ] Edit/Delete buttons stay aligned right

### 8.2 Many Options
- [ ] Create field with 20+ options
- [ ] Options display correctly in card details
- [ ] Long options list doesn't break layout
- [ ] Options wrap to multiple lines

### 8.3 Special Characters in Options
- [ ] Create field with options: `low, high-priority, "quoted"`
- [ ] Options save correctly
- [ ] Display properly in card
- [ ] Can edit and re-save

### 8.4 Empty Options
- [ ] Create field
- [ ] In options prompt, enter empty string
- [ ] Field created with empty options array
- [ ] Card shows: "Type: Single-select" (no options line)

### 8.5 Whitespace in Options
- [ ] Create field with options: `  low  ,  high  ` (extra spaces)
- [ ] Options are trimmed: displays as `low, high`
- [ ] No empty options from consecutive commas

---

## 9. Cross-Browser Testing

### 9.1 Desktop Browsers
- [ ] Chrome/Edge: All features work
- [ ] Firefox: All features work
- [ ] Safari (if available): All features work

### 9.2 Mobile Browsers
- [ ] Chrome Mobile: Tabs, buttons, prompts work
- [ ] Safari iOS (if available): All features work
- [ ] Modal is responsive, fits screen
- [ ] Touch targets are adequate (44px minimum)

---

## 10. Integration with Existing Features

### 10.1 General Tab Still Works
- [ ] Switch to General tab
- [ ] Change default completion to "To do"
- [ ] Change default priority to "High"
- [ ] Close modal
- [ ] Create new note
- [ ] Verify note has completion="no" and priority="high"

### 10.2 Settings From Landing Page
- [ ] Go to landing page
- [ ] Click ⋮ menu on a notebook
- [ ] Select "Settings" (if available, otherwise skip)
- [ ] Settings modal opens for that notebook
- [ ] Add custom field
- [ ] Close modal
- [ ] Open notebook normally
- [ ] Open settings → Custom Fields
- [ ] Field persists

### 10.3 Close Modal Methods
- [ ] Click "Close" button → modal closes
- [ ] Click outside modal (on backdrop) → modal closes
- [ ] Press Escape key → modal closes (if implemented)
- [ ] All methods preserve changes made

---

## 11. Known Limitations (Current Implementation)

These are expected limitations in v172:

- [ ] Only single-select type supported (text, number, date, etc. not yet implemented)
- [ ] Cannot reorder fields (no drag-to-reorder yet)
- [ ] Cannot change field type after creation
- [ ] Simple prompts instead of full field editor dialog
- [ ] Custom fields don't appear in note editor yet (Phase 3)
- [ ] Cannot rename field's internal name (only label editable)

---

## 12. Regression Testing

### 12.1 Existing Settings Features
- [ ] Default completion setting still works
- [ ] Default priority setting still works
- [ ] Settings save to localStorage
- [ ] Settings export with notebook (if custom fields exist)

### 12.2 Modal Behavior
- [ ] Modal backdrop darkens screen
- [ ] Click outside closes modal
- [ ] Close button works
- [ ] Modal centers on screen
- [ ] Modal z-index above other UI elements

---

## Success Criteria

✅ All tab navigation works smoothly
✅ Can add/edit/delete custom fields
✅ Validation prevents invalid field names
✅ Fields persist across sessions
✅ Fields are per-notebook (not global)
✅ UI is clean, responsive, and accessible
✅ No console errors
✅ No layout breaking issues
✅ Works on desktop and mobile

---

## Test Results

**Tester:** ___________
**Date:** ___________
**Browser:** ___________
**OS:** ___________

**Overall Status:** [ ] PASS [ ] FAIL [ ] PARTIAL

**Issues Found:**
-

**Notes:**
-

---

## Next Steps

After this test plan passes:
1. Phase 3: Editor integration for custom fields
2. Render custom fields in note editor
3. Support all field types (text, number, date, checkbox, etc.)
4. Batch mode support for custom fields
5. Full field editor dialog (replace prompts)
