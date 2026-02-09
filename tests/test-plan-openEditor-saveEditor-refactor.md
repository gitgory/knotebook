# Test Plan: openEditor() and saveEditor() Refactoring

## Overview
Refactored both editor functions using Extract Method pattern:
- `openEditor()`: 121 → 15 lines (4 helpers)
- `saveEditor()`: 95 → 18 lines (10 helpers)

## Refactoring Details
- **Version**: v159
- **Commit**: 4d5ebd8
- **Date**: 2026-02-08

**openEditor() Helpers:**
1. `prepareEditorSession()` - Clear state, hide action bar
2. `getEditorElements()` - Get DOM references
3. `openBatchEditor()` - Configure for batch mode
4. `openSingleEditor()` - Configure for single mode

**saveEditor() Helpers:**
1. `getEditorMode()` - Determine mode and get nodes
2. `getEditorFormData()` - Extract form values
3. `removeBatchTags()` - Remove tags from nodes
4. `addBatchTags()` - Add tags to nodes
5. `updateBatchCompletion()` - Set completion state
6. `updateBatchTimestamps()` - Update timestamps
7. `validateSingleNodeInput()` - Async validation
8. `saveSingleNode()` - Save single node data
9. `cleanupEditorState()` - Clear state and close

## Test Environment
- **URL**: https://gitgory.github.io/knotebook/
- **Version**: v159+
- **Test Date**: ___________
- **Tester**: ___________
- **Browser**: ___________

---

## Single Node Editor Tests

### 1. Open Single Node Editor
- [ ] Create a note
- [ ] Double-click the note
- [ ] **Expected**: Editor modal opens
- [ ] **Expected**: Title input enabled and focused
- [ ] **Expected**: Textarea enabled
- [ ] **Expected**: Note's title and content loaded into inputs
- [ ] **Result**: ___________

### 2. Edit Title and Content
- [ ] Open editor for a note
- [ ] Change title to "Updated Title"
- [ ] Change content to "Updated content with #newtag"
- [ ] Click Save
- [ ] **Expected**: Note updates with new title and content
- [ ] **Expected**: #newtag appears as pill on note
- [ ] **Expected**: Editor closes
- [ ] **Result**: ___________

### 3. Add Hashtags via Content
- [ ] Open editor
- [ ] Add text: "This is a note #bug #urgent"
- [ ] Save
- [ ] **Expected**: #bug and #urgent pills appear on note
- [ ] **Expected**: Both tags appear in sidebar
- [ ] **Result**: ___________

### 4. Change Completion Status
- [ ] Open editor
- [ ] Click "To do" button
- [ ] Save
- [ ] **Expected**: Empty circle (○) appears on note
- [ ] Open editor again
- [ ] Click "Done" button
- [ ] Save
- [ ] **Expected**: Checkmark (✓) appears, note has grayscale filter
- [ ] **Result**: ___________

### 5. Enter Key Saves (Desktop)
- [ ] Open editor (on desktop)
- [ ] Edit content
- [ ] Press Enter key
- [ ] **Expected**: Editor saves and closes
- [ ] **Result**: ___________

### 6. Escape Key Cancels
- [ ] Open editor
- [ ] Make changes to title/content
- [ ] Press Escape
- [ ] **Expected**: Changes discarded (revert to original)
- [ ] **Expected**: Editor closes
- [ ] **Result**: ___________

### 7. Cancel Button
- [ ] Open editor
- [ ] Make changes
- [ ] Click Cancel button
- [ ] **Expected**: Changes discarded
- [ ] **Expected**: Editor closes
- [ ] **Result**: ___________

### 8. Click Outside to Save
- [ ] Open editor
- [ ] Make changes
- [ ] Click on canvas outside editor
- [ ] **Expected**: Changes saved
- [ ] **Expected**: Editor closes
- [ ] **Result**: ___________

### 9. Title Validation - Soft Limit
- [ ] Open editor
- [ ] Enter very long title (>200 characters)
- [ ] Save
- [ ] **Expected**: Confirmation dialog appears warning about length
- [ ] Click "OK" to confirm
- [ ] **Expected**: Note saves with long title
- [ ] **Result**: ___________

### 10. Content Validation - Soft Limit
- [ ] Open editor
- [ ] Enter very long content (>100,000 characters)
- [ ] Save
- [ ] **Expected**: Confirmation dialog appears
- [ ] Click "Cancel"
- [ ] **Expected**: Editor stays open, changes not saved
- [ ] **Result**: ___________

### 11. Delete Empty Node
- [ ] Create new note (double-click canvas)
- [ ] Leave title and content empty
- [ ] Save or Cancel
- [ ] **Expected**: Empty note is deleted
- [ ] **Expected**: Node disappears from canvas
- [ ] **Result**: ___________

### 12. Enter Button with Children
- [ ] Create note
- [ ] Double-click to enter
- [ ] Add child note
- [ ] Go back to parent (Home button)
- [ ] Open parent editor
- [ ] **Expected**: Enter button shows "View 1 nested note"
- [ ] Add 2 more children
- [ ] Open editor again
- [ ] **Expected**: Enter button shows "View 3 nested notes"
- [ ] **Result**: ___________

---

## Batch Editor Tests

### 13. Open Batch Editor
- [ ] Create 3 notes
- [ ] Select all 3 (Ctrl+Click)
- [ ] Double-click one of the selected notes
- [ ] **Expected**: Editor opens in batch mode
- [ ] **Expected**: Title shows "Editing 3 notes"
- [ ] **Expected**: Title input is disabled
- [ ] **Expected**: Textarea enabled with placeholder about adding tags
- [ ] **Expected**: Enter button disabled
- [ ] **Result**: ___________

### 14. Batch - Display Existing Tags
- [ ] Create 3 notes:
  - Note 1: #bug #urgent
  - Note 2: #bug #feature
  - Note 3: #urgent
- [ ] Select all 3, open batch editor
- [ ] **Expected**: Sidebar shows #bug (2/3), #urgent (2/3), #feature (1/3)
- [ ] **Expected**: Tags sorted by frequency (most common first)
- [ ] **Result**: ___________

### 15. Batch - Add Tags to All
- [ ] Select 3 notes
- [ ] Open batch editor
- [ ] Type "#review #approved" in textarea
- [ ] Save
- [ ] **Expected**: All 3 notes now have #review and #approved pills
- [ ] **Expected**: Both tags appear in sidebar
- [ ] **Result**: ___________

### 16. Batch - Remove Tag from All
- [ ] Create 3 notes all with #bug tag
- [ ] Select all 3, open batch editor
- [ ] Click X on #bug pill to remove
- [ ] **Expected**: #bug pill shows as outlined (marked for removal)
- [ ] Save
- [ ] **Expected**: #bug removed from all 3 notes
- [ ] **Expected**: #bug disappears from sidebar (if no other notes use it)
- [ ] **Result**: ___________

### 17. Batch - Remove Tag from Subset
- [ ] Create 3 notes:
  - Note 1: #bug
  - Note 2: #bug #feature
  - Note 3: #feature
- [ ] Select all 3, open batch editor
- [ ] Remove #bug
- [ ] Save
- [ ] **Expected**: #bug removed from Note 1 and Note 2
- [ ] **Expected**: Note 3 unaffected (didn't have #bug)
- [ ] **Result**: ___________

### 18. Batch - Add and Remove Tags
- [ ] Select multiple notes
- [ ] Open batch editor
- [ ] Remove one existing tag
- [ ] Add two new tags
- [ ] Save
- [ ] **Expected**: All operations applied correctly
- [ ] **Result**: ___________

### 19. Batch - Toggle Completion
- [ ] Create 3 notes with mixed completion (1 Done, 1 To do, 1 None)
- [ ] Select all 3, open batch editor
- [ ] **Expected**: Completion shows "Mixed"
- [ ] Click "Done" button
- [ ] Save
- [ ] **Expected**: All 3 notes now marked as Done (✓)
- [ ] **Result**: ___________

### 20. Batch - Keep Completion Mixed
- [ ] Select notes with mixed completion
- [ ] Open batch editor
- [ ] Don't change completion (leave as "Mixed")
- [ ] Save
- [ ] **Expected**: Each note keeps its original completion state
- [ ] **Result**: ___________

### 21. Batch - Cancel Discards Changes
- [ ] Select multiple notes
- [ ] Open batch editor
- [ ] Add/remove tags
- [ ] Press Escape (or Cancel)
- [ ] **Expected**: No changes applied to any note
- [ ] **Expected**: All tags/completion reverted
- [ ] **Result**: ___________

### 22. Batch - Focus Management
- [ ] Select multiple notes
- [ ] Open batch editor
- [ ] **Expected**: Textarea has focus (not title input)
- [ ] **Expected**: Can start typing tags immediately
- [ ] **Result**: ___________

### 23. Batch - Remove and Re-add Same Tag
- [ ] Select notes with #bug
- [ ] Open batch editor
- [ ] Remove #bug (click X)
- [ ] Click #bug again to re-add
- [ ] **Expected**: #bug pill returns to solid (no longer marked for removal)
- [ ] Save
- [ ] **Expected**: #bug still on all notes
- [ ] **Result**: ___________

---

## Edge Cases

### 24. Switch Between Single and Batch
- [ ] Open single editor → Save → Open batch editor → Save
- [ ] **Expected**: Both modes work correctly back-to-back
- [ ] **Expected**: No state contamination between modes
- [ ] **Result**: ___________

### 25. Save While Selected Nodes Change
- [ ] Select 3 notes
- [ ] Open batch editor
- [ ] While editor open, another process deselects nodes
- [ ] Save
- [ ] **Expected**: Graceful handling (save to originally selected nodes or show error)
- [ ] **Result**: ___________

### 26. Empty Textarea in Batch
- [ ] Select notes
- [ ] Open batch editor
- [ ] Leave textarea empty (don't add tags)
- [ ] Save
- [ ] **Expected**: No errors, editor closes
- [ ] **Result**: ___________

### 27. Special Characters in Tags
- [ ] Open editor
- [ ] Add tags with special chars: "#test-tag #test_tag #test123"
- [ ] Save
- [ ] **Expected**: Tags saved correctly
- [ ] **Result**: ___________

### 28. Very Long Tag
- [ ] Open editor
- [ ] Add very long tag: "#thisisaverylongtagnamethatshouldbehandled"
- [ ] Save
- [ ] **Expected**: Tag saved and displays with truncation on note
- [ ] **Result**: ___________

---

## Performance Tests

### 29. Batch Edit Large Selection
- [ ] Create 50+ notes
- [ ] Select all
- [ ] Open batch editor
- [ ] **Expected**: Editor opens without lag
- [ ] Add tag
- [ ] Save
- [ ] **Expected**: All notes update within reasonable time (< 2 seconds)
- [ ] **Result**: ___________

### 30. Rapid Open/Close
- [ ] Open editor → Save → Open → Save → Open → Save (rapidly)
- [ ] **Expected**: All operations complete successfully
- [ ] **Expected**: No memory leaks or event listener buildup
- [ ] **Result**: ___________

---

## Test Results Summary

**Total Tests**: 30
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
