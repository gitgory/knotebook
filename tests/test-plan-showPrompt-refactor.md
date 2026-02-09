# Test Plan: showPrompt() Refactoring

## Overview
Refactored `showPrompt()` from 57 → 12 lines by extracting 4 lifecycle helper functions.

## Refactoring Details
- **Version**: v158
- **Commit**: 7e4f0be
- **Date**: 2026-02-08

**Helpers Extracted:**
1. `getPromptModalElements()` - Get and return all modal DOM elements
2. `configurePromptModal()` - Set content, show modal, focus input
3. `createPromptHandlers()` - Create OK, Cancel, Keyboard, and Cleanup handlers
4. `attachPromptListeners()` - Attach all event listeners

## Test Environment
- **URL**: https://gitgory.github.io/knotebook/
- **Version**: v158+
- **Test Date**: ___________
- **Tester**: ___________
- **Browser**: ___________

---

## Test Cases

### 1. Rename Project - Basic Flow
- [ ] Create a project "Test Project"
- [ ] Click "..." menu → "Rename"
- [ ] **Expected**: Prompt modal appears with title "Rename Notebook"
- [ ] **Expected**: Input field contains "Test Project"
- [ ] **Expected**: Input is focused and text is selected
- [ ] Type "Renamed Project"
- [ ] Click "OK"
- [ ] **Expected**: Project renamed to "Renamed Project"
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 2. Rename Project - Enter Key
- [ ] Click "..." menu → "Rename"
- [ ] Type new name "Quick Rename"
- [ ] Press Enter key
- [ ] **Expected**: Project renamed
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 3. Rename Project - Escape Key
- [ ] Click "..." menu → "Rename"
- [ ] Type new name "Cancel Test"
- [ ] Press Escape key
- [ ] **Expected**: Project NOT renamed (change cancelled)
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 4. Rename Project - Cancel Button
- [ ] Click "..." menu → "Rename"
- [ ] Type new name "Cancel Via Button"
- [ ] Click "Cancel" button
- [ ] **Expected**: Project NOT renamed
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 5. Rename Project - Empty Input
- [ ] Click "..." menu → "Rename"
- [ ] Clear input field (delete all text)
- [ ] Click "OK"
- [ ] **Expected**: Project name unchanged OR validation error
- [ ] **Result**: ___________

### 6. Rename Hashtag - Basic Flow
- [ ] Create note with tag #oldtag
- [ ] Right-click (or long-press) #oldtag in sidebar
- [ ] Select "Rename tag"
- [ ] **Expected**: Prompt modal appears
- [ ] **Expected**: Input contains "oldtag" (without #)
- [ ] Type "newtag"
- [ ] Click "OK"
- [ ] **Expected**: Tag renamed in sidebar and on note
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 7. Rename Hashtag - Enter Key
- [ ] Right-click #tag → "Rename tag"
- [ ] Type "quickrename"
- [ ] Press Enter
- [ ] **Expected**: Tag renamed
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 8. Rename Hashtag - Cancel
- [ ] Right-click #tag → "Rename tag"
- [ ] Type "cancelled"
- [ ] Press Escape
- [ ] **Expected**: Tag NOT renamed
- [ ] **Expected**: Modal closes
- [ ] **Result**: ___________

### 9. Multiple Sequential Prompts
- [ ] Rename project "Project 1"
- [ ] Wait for modal to close
- [ ] Rename project again to "Project 2"
- [ ] **Expected**: Second prompt works correctly
- [ ] **Expected**: No leftover state from first prompt
- [ ] **Result**: ___________

### 10. Input Selection Behavior
- [ ] Trigger any prompt with default text
- [ ] **Expected**: Text is selected (highlighted)
- [ ] Start typing immediately
- [ ] **Expected**: Selected text is replaced with new input
- [ ] **Result**: ___________

### 11. Focus Management
- [ ] Trigger prompt
- [ ] **Expected**: Input field has focus (cursor visible)
- [ ] **Expected**: Can type without clicking input first
- [ ] **Result**: ___________

### 12. Modal Backdrop Click (if applicable)
- [ ] Trigger prompt
- [ ] Click outside modal (on backdrop)
- [ ] **Expected**: Modal behavior matches app design (closes or stays open)
- [ ] **Result**: ___________

### 13. Special Characters in Input
- [ ] Rename project with special chars: "Test! @#$ %^&*()"
- [ ] Click "OK"
- [ ] **Expected**: Name saved with special characters
- [ ] **Expected**: No JavaScript errors
- [ ] **Result**: ___________

### 14. Very Long Input
- [ ] Trigger prompt
- [ ] Paste very long text (500+ characters)
- [ ] Click "OK"
- [ ] **Expected**: Long text handled gracefully
- [ ] **Expected**: No UI breaking or errors
- [ ] **Result**: ___________

### 15. Rapid Cancel/Open
- [ ] Open prompt → Cancel → Open again → Cancel → Open again
- [ ] **Expected**: Each operation works correctly
- [ ] **Expected**: No leftover event listeners causing double-triggers
- [ ] **Result**: ___________

---

## Test Results Summary

**Total Tests**: 15
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
