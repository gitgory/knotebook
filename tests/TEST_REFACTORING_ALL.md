# Test Plan: Function Refactoring

This document tracks testing for all refactored functions to ensure behavior remains unchanged.

## Overview

Each refactoring extracts smaller, focused functions from larger monolithic functions while maintaining identical behavior. Testing focuses on:
- **Behavioral equivalence** - Refactored code produces same results as original
- **Edge cases** - Boundary conditions still handled correctly
- **Error handling** - Failures handled identically
- **State changes** - Side effects unchanged
- **Performance** - No significant performance regression

---

## Test Status Legend

- ✅ **PASS** - Test completed successfully
- ❌ **FAIL** - Test failed, needs investigation
- ⏸️ **SKIP** - Test skipped (not applicable)
- 🔄 **PENDING** - Test not yet executed

---

## 1. processSaveQueue() Refactoring

**Commit:** 67c03b1
**Date:** 2026-02-07
**Lines Reduced:** 60 → 25 (main function)
**Helper Functions Added:** 5

### Extracted Functions:
1. `shouldUpdateToSaved()` - Check if status update needed
2. `getCurrentProjectData()` - Get project data for saving
3. `handleSaveSuccess()` - Process successful save
4. `handleSaveFailure()` - Process failed save
5. `continueQueueProcessing()` - Handle queue continuation

### Test Cases

#### TC1.1: Normal Save Operation
**Status:** 🔄 PENDING
**Description:** Test successful save of project data
**Steps:**
1. Open a notebook
2. Create a new note with title and content
3. Wait for auto-save (1500ms debounce)
4. Verify save status shows "Saved" (green checkmark)
5. Refresh page
6. Verify note persists

**Expected Result:** Note saves successfully, status updates to "Saved"

---

#### TC1.2: Multiple Rapid Changes (Queue Coalescing)
**Status:** 🔄 PENDING
**Description:** Test that rapid changes don't create multiple saves
**Steps:**
1. Open a notebook
2. Create multiple notes rapidly (< 1500ms between each)
3. Watch save status indicator
4. Verify only one save occurs after debounce period

**Expected Result:** Multiple changes coalesce into single save

---

#### TC1.3: Save While Already Saving (Race Condition)
**Status:** 🔄 PENDING
**Description:** Test guard against concurrent saves
**Steps:**
1. Open a notebook with many notes (slow save)
2. Make a change to trigger save
3. Immediately make another change
4. Verify second change waits for first save to complete

**Expected Result:** Second save queued, no concurrent saves

---

#### TC1.4: Empty Queue Status Update
**Status:** 🔄 PENDING
**Description:** Test status update when queue becomes empty
**Steps:**
1. Open a notebook
2. Make a change and wait for save
3. Verify status transitions: Pending → Saved
4. Make no further changes
5. Verify status stays "Saved" (no flicker)

**Expected Result:** Status updates to "Saved" only once, no flickering

---

#### TC1.5: Save Failure Handling
**Status:** 🔄 PENDING
**Description:** Test error handling when save fails
**Steps:**
1. Open browser DevTools → Application → Storage
2. Fill localStorage to quota (create many large notes)
3. Make a change to trigger save
4. Verify save fails with quota error
5. Click on red error status indicator
6. Verify error alert shows storage quota message

**Expected Result:**
- Status shows red error indicator
- Error message displays storage quota exceeded
- Failed save removed from queue (no infinite retries)

---

#### TC1.6: Save Success Hash Update
**Status:** 🔄 PENDING
**Description:** Test that save hash updates after successful save
**Steps:**
1. Open browser console
2. Type: `state.lastSaveHash`
3. Note the hash value
4. Make a change to a note
5. Wait for save
6. Check `state.lastSaveHash` again
7. Verify hash changed

**Expected Result:** Hash updates after successful save

---

#### TC1.7: Queue Continuation After Success
**Status:** 🔄 PENDING
**Description:** Test that queue processes next item after save
**Steps:**
1. Open console and monitor `state.saveQueue.length`
2. Make multiple rapid changes (faster than debounce)
3. Verify queue processes items sequentially
4. Verify small delay (100ms) between queue items

**Expected Result:** Queue processes sequentially with delay

---

#### TC1.8: Queue Continuation After Failure
**Status:** 🔄 PENDING
**Description:** Test that queue continues processing after failure
**Steps:**
1. Fill localStorage to near quota
2. Make multiple changes rapidly
3. Allow first save to fail (quota exceeded)
4. Free up space (delete some notes)
5. Verify subsequent queued saves succeed

**Expected Result:** Failed save removed, next save proceeds

---

#### TC1.9: getCurrentProjectData() at Root Level
**Status:** 🔄 PENDING
**Description:** Test data extraction at root level
**Steps:**
1. Open a notebook (root level)
2. Create notes and edges
3. Trigger save
4. Verify `state.nodes` and `state.edges` used (not root variants)

**Expected Result:** Correct data saved from root level

---

#### TC1.10: getCurrentProjectData() at Nested Level
**Status:** 🔄 PENDING
**Description:** Test data extraction at nested level
**Steps:**
1. Open a notebook
2. Create a note with children (nested notes)
3. Double-click note to enter nested level
4. Make changes to nested notes
5. Trigger save
6. Verify `state.rootNodes` and `state.rootEdges` used

**Expected Result:** Correct data saved from nested level

---

#### TC1.11: Save Status Timestamps
**Status:** 🔄 PENDING
**Description:** Test that save timestamps update correctly
**Steps:**
1. Open console
2. Type: `state.lastSaveTime`
3. Note the timestamp
4. Make a change and wait for save
5. Check `state.lastSaveTime` again
6. Verify timestamp updated to recent time

**Expected Result:** Timestamp reflects latest save time

---

#### TC1.12: Error State Clears on Success
**Status:** 🔄 PENDING
**Description:** Test that error state clears after successful save
**Steps:**
1. Force a save error (fill storage quota)
2. Verify status shows error (red)
3. Free up space
4. Make another change
5. Wait for save to succeed
6. Verify status shows saved (green)
7. Verify `state.lastSaveError` is null

**Expected Result:** Error state clears after successful save

---

### Performance Baseline

**Test Environment:**
- Browser: Chrome 131+
- OS: Windows 11
- Notebook size: 100 notes, 50 edges

**Metrics to Track:**
- Save operation time: ~50ms (baseline)
- Queue processing overhead: < 5ms per item
- Memory usage: No leaks after 100 saves

**Status:** 🔄 PENDING

---

## Future Refactorings

### Planned Refactorings (Largest First):

1. **initEventListeners()** - ~1441 lines
   - Extract mouse event handlers
   - Extract touch event handlers
   - Extract keyboard handlers
   - Extract modal event handlers

2. **populateSidebar()** - ~186 lines
   - Extract tag rendering
   - Extract event handler attachment
   - Extract color picker logic

3. **renderNodes()** - ~186 lines
   - Extract node body rendering
   - Extract title rendering
   - Extract hashtag pill rendering
   - Extract completion indicator rendering

4. **openEditor()** - ~121 lines
   - Extract batch mode setup
   - Extract single mode setup
   - Extract tag collection logic

5. **saveEditor()** - ~126 lines
   - Extract batch mode save
   - Extract single mode save
   - Extract validation logic

---

## Testing Notes

### Manual Testing Tips:
- Use browser DevTools Console to inspect `state` object
- Use Application tab to view localStorage
- Use Network tab to verify no external requests during save
- Use Performance tab to profile save operations

### Common Issues to Watch For:
- Status indicator flickering
- Race conditions with rapid user input
- Memory leaks from uncleaned event listeners
- Queue starvation under heavy load
- Hash collisions (unlikely but possible)

### Regression Testing:
After each refactoring, run full test suite:
1. Create/read/update/delete notes
2. Navigate nested levels
3. Import/export notebooks
4. Test all keyboard shortcuts
5. Test all context menus
6. Test mobile touch interactions

---

## Test Execution Log

| Date | Tester | Test Cases | Pass | Fail | Notes |
|------|--------|------------|------|------|-------|
| TBD  | -      | -          | -    | -    | Awaiting initial test run |

---

## Sign-off

**Refactoring Complete:** ✅
**Tests Complete:** 🔄 PENDING
**Ready for Production:** 🔄 PENDING

---

*Last Updated: 2026-02-07*
