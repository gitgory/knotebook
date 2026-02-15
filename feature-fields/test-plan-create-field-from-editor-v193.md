# Test Plan: Create Custom Field from Editor (v193)

**Feature:** Users can create new custom field definitions directly from the note editor without navigating to Settings.

**Test URL:** https://gitgory.github.io/knotebook/

**Version:** CSS v192 | JS v193

---

## Pre-Test Setup

1. Open https://gitgory.github.io/knotebook/
2. Verify landing page shows: CSS v192 | JS v193
3. Create a new notebook called "Field Test"

---

## Test 1: Create Field When No Fields Exist

**Goal:** Verify UI and functionality when creating first custom field

### Steps:
1. Create a new note (title: "Test Note 1")
2. Look at the custom fields section in the editor

### Expected Results:
- [ ] Custom fields section shows message: "No custom fields defined. Create custom field..."
- [ ] Message is styled in italic accent color
- [ ] Message is clickable (cursor changes to pointer on hover)

### Steps (continued):
3. Click "No custom fields defined. Create custom field..."
4. Field editor modal opens

### Expected Results:
- [ ] Modal title shows "Add Custom Field"
- [ ] Name input is empty and enabled
- [ ] Label input is empty
- [ ] Type dropdown shows "Single-select" by default
- [ ] Options textarea shows default: "low\nmedium\nhigh"

### Steps (continued):
5. Fill in the form:
   - Name: `effort`
   - Label: `Effort Level`
   - Type: `single-select`
   - Options: `low\nmedium\nhigh`
6. Click "Save"

### Expected Results:
- [ ] Field editor modal closes
- [ ] New "Effort Level" field appears in the note editor immediately
- [ ] Field shows as a dropdown with options: None, low, medium, high
- [ ] Field is currently set to "None"
- [ ] Title and content of note are still intact
- [ ] "Create custom field..." link still appears below the new field
- [ ] Link text changed to: "+ Create custom field..."

### Steps (continued):
7. Set Effort Level to "medium"
8. Save the note (Escape key)
9. Reopen the note

### Expected Results:
- [ ] Effort Level field shows "medium" value
- [ ] Field persisted correctly

---

## Test 2: Create Field When Fields Already Exist

**Goal:** Verify creating additional fields preserves existing fields

### Steps:
1. Open "Test Note 1" (should have effort field from Test 1)
2. Set effort to "high" if not already set
3. Look at the custom fields section

### Expected Results:
- [ ] Effort Level field appears with current value
- [ ] Below it shows: "+ Create custom field..."

### Steps (continued):
4. Click "+ Create custom field..."
5. Fill in the form:
   - Name: `priority`
   - Label: `Task Priority`
   - Type: `multi-select`
   - Options: `urgent\nhigh\nmedium\nlow`
6. Click "Save"

### Expected Results:
- [ ] Field editor modal closes
- [ ] Both fields appear in editor:
   - Effort Level (dropdown)
   - Task Priority (multi-select dropdown with checkboxes)
- [ ] Effort Level still shows "high" (value preserved)
- [ ] Task Priority shows empty (none selected)
- [ ] "+ Create custom field..." link still appears at bottom

### Steps (continued):
7. Open Task Priority dropdown
8. Check "urgent" and "high"
9. Save note
10. Reopen note

### Expected Results:
- [ ] Effort Level shows "high"
- [ ] Task Priority shows "urgent, high"
- [ ] Both values persisted correctly

---

## Test 3: Create Field in Batch Mode

**Goal:** Verify field creation works when editing multiple notes

### Steps:
1. Create two more notes:
   - "Test Note 2" (no field values set)
   - "Test Note 3" (no field values set)
2. Select both notes (Ctrl+Click or Shift+Click)
3. Press Enter to open batch editor

### Expected Results:
- [ ] Batch editor opens
- [ ] Title input is disabled with placeholder "(multiple notes)"
- [ ] Both existing fields appear (Effort Level, Task Priority)
- [ ] Both fields show empty/none (mixed values)
- [ ] "+ Create custom field..." link appears at bottom

### Steps (continued):
4. Click "+ Create custom field..."
5. Fill in the form:
   - Name: `status`
   - Label: `Status`
   - Type: `single-select`
   - Options: `todo\ninprogress\ndone`
6. Click "Save"

### Expected Results:
- [ ] Field editor modal closes
- [ ] New "Status" field appears in batch editor
- [ ] All three fields are visible
- [ ] All fields show empty/none state
- [ ] Batch editor remains open

### Steps (continued):
7. Set Status to "todo"
8. Set Effort Level to "low"
9. Save batch editor (Escape)
10. Open "Test Note 2"

### Expected Results:
- [ ] Status shows "todo"
- [ ] Effort Level shows "low"
- [ ] Task Priority is empty (wasn't set in batch)

### Steps (continued):
11. Open "Test Note 3"

### Expected Results:
- [ ] Same as Note 2: Status="todo", Effort="low", Priority=empty

---

## Test 4: Cancel Field Creation

**Goal:** Verify canceling doesn't affect editor state

### Steps:
1. Open "Test Note 1"
2. Change Effort Level to "medium"
3. Type some text in content area: "Testing cancel behavior"
4. Click "+ Create custom field..."
5. Fill in partial field data:
   - Name: `category`
   - Label: `Category`
6. Click "Cancel" in field editor modal

### Expected Results:
- [ ] Field editor modal closes
- [ ] Note editor remains open
- [ ] Effort Level still shows "medium"
- [ ] Content still shows "Testing cancel behavior"
- [ ] No new "category" field appears
- [ ] Editor is in the exact same state as before opening field modal

### Steps (continued):
7. Save the note
8. Open Settings → Custom Fields

### Expected Results:
- [ ] Only three fields are defined: effort, priority, status
- [ ] No "category" field exists

---

## Test 5: Validation Errors

**Goal:** Verify validation works correctly from editor context

### Steps:
1. Open any note
2. Click "+ Create custom field..."
3. Leave Name empty
4. Click "Save"

### Expected Results:
- [ ] Alert appears: "Field name is required."
- [ ] Field editor modal stays open
- [ ] Note editor remains open in background (doesn't close)

### Steps (continued):
5. Click OK on alert
6. Enter Name: `123invalid` (starts with number)
7. Click "Save"

### Expected Results:
- [ ] Alert appears: "Invalid field name. Use letters, numbers, and underscores only."
- [ ] Field editor modal stays open

### Steps (continued):
8. Click OK on alert
9. Enter Name: `completion` (reserved name)
10. Enter Label: "Completion Status"
11. Click "Save"

### Expected Results:
- [ ] Alert appears: "This field name is reserved."
- [ ] Field editor modal stays open

### Steps (continued):
12. Click OK on alert
13. Enter Name: `effort` (duplicate)
14. Enter Label: "Effort"
15. Click "Save"

### Expected Results:
- [ ] Alert appears: "A field with this name already exists."
- [ ] Field editor modal stays open

### Steps (continued):
16. Click OK on alert
17. Click "Cancel"

### Expected Results:
- [ ] Field editor modal closes
- [ ] Note editor remains open
- [ ] No new fields were created

---

## Test 6: Field Appears in Settings

**Goal:** Verify fields created from editor appear in Settings UI

### Steps:
1. Click Settings button (⚙ in toolbar)
2. Click "Custom Fields" tab

### Expected Results:
- [ ] Three field cards appear:
   - effort (Single-select: high, low, medium)
   - priority (Multi-select: high, low, medium, urgent)
   - status (Single-select: done, inprogress, todo)
- [ ] All fields created from editor are visible
- [ ] Can edit/delete fields from here

---

## Test 7: Add New Option from Editor

**Goal:** Verify "(add new...)" option still works

### Steps:
1. Open any note
2. In Effort Level dropdown, select "(add new...)"
3. Enter new option: `extreme`
4. Click OK

### Expected Results:
- [ ] Dropdown re-renders
- [ ] New option "extreme" appears in list
- [ ] "extreme" is automatically selected
- [ ] Change auto-saves to project settings

### Steps (continued):
5. Click "+ Create custom field..."
6. Create a new field:
   - Name: `department`
   - Label: `Department`
   - Type: `single-select`
   - Options: `engineering\ndesign`
7. Click "Save"
8. In new Department field, select "(add new...)"
9. Enter: `marketing`
10. Click OK

### Expected Results:
- [ ] Department dropdown re-renders
- [ ] "marketing" option appears
- [ ] Can select "marketing"

---

## Test 8: Mobile/Touch Interaction

**Goal:** Verify touch interaction works (if testing on mobile)

### Steps (Mobile):
1. Open note on mobile device
2. Tap "Create custom field..."
3. Fill in field details on mobile keyboard
4. Tap "Save"

### Expected Results:
- [ ] Field editor modal opens
- [ ] Can type in all fields
- [ ] Save button works with tap
- [ ] New field appears in editor

---

## Test 9: Persistence Across Sessions

**Goal:** Verify fields persist after page reload

### Steps:
1. Note current state:
   - Three fields exist: effort, priority, status
   - Test Note 1 has values set
2. Refresh the page (F5)
3. Open "Field Test" notebook
4. Open "Test Note 1"

### Expected Results:
- [ ] All three custom fields appear in editor
- [ ] All field values are preserved
- [ ] "+ Create custom field..." link appears

### Steps (continued):
4. Click "+ Create custom field..."
5. Create field:
   - Name: `owner`
   - Label: `Owner`
   - Type: `single-select`
   - Options: `alice\nbob\ncarol`
6. Save
7. Set Owner to "alice"
8. Save note
9. Refresh page again (F5)
10. Reopen notebook and note

### Expected Results:
- [ ] Four fields exist
- [ ] Owner field shows "alice"
- [ ] All other values preserved

---

## Test 10: Edge Case - Empty Options

**Goal:** Verify validation prevents creating field with no options

### Steps:
1. Open any note
2. Click "+ Create custom field..."
3. Fill in:
   - Name: `test_empty`
   - Label: `Test Empty`
   - Type: `single-select`
   - Options: (leave empty or just whitespace)
4. Click "Save"

### Expected Results:
- [ ] Alert appears: "At least one option is required."
- [ ] Field editor modal stays open
- [ ] No field is created

---

## Summary Checklist

After completing all tests:

- [ ] Can create first field when none exist
- [ ] Can create additional fields when some exist
- [ ] Fields appear immediately in editor after creation
- [ ] Editor state (title, content, field values) is preserved
- [ ] Works in single-note mode
- [ ] Works in batch-edit mode
- [ ] Cancel preserves editor state
- [ ] Validation errors are handled correctly
- [ ] Fields persist across page reloads
- [ ] Fields appear in Settings → Custom Fields
- [ ] "(add new...)" option still works for field options
- [ ] UI text changes based on field count
- [ ] No console errors during any operation

---

## Known Issues / Notes

*Document any issues found during testing here:*

-
-
-

---

## Test Results

**Tester:** _______________
**Date:** _______________
**Result:** ⬜ PASS | ⬜ FAIL | ⬜ PARTIAL

**Notes:**
