# Test Plan: Function Refactoring (CONSOLIDATED)

This document tracks testing for all refactored functions to ensure behavior remains unchanged.

## Overview

Each refactoring extracts smaller, focused functions from larger monolithic functions while maintaining identical behavior. Testing focuses on:
- **Behavioral equivalence** - Refactored code produces same results as original
- **Edge cases** - Boundary conditions still handled correctly
- **Error handling** - Failures handled identically
- **State changes** - Side effects unchanged
- **Performance** - No significant performance regression

**Test Plan Optimization:** This plan has been consolidated from 77 tests to 30 tests (61% reduction) by combining related assertions, removing low-value implementation tests, and creating comprehensive workflow tests. Coverage remains equivalent.

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

### Test Cases (7 tests)

#### TC1.1: Complete Save Workflow
**Status:** ✅ PASS
**Description:** Test successful save with state updates at root and nested levels
**Steps:**
1. Open a notebook (root level)
2. Create a new note with title and content
3. Wait for auto-save (1500ms debounce)
4. Verify save status shows "Saved" (green checkmark)
5. Open console and type `state.lastSaveHash` to verify it has a value
6. Open console and type `state.lastSaveTime` to verify it's a recent timestamp
7. Refresh page and verify note persists
8. Create a nested note (double-click to enter)
9. Make changes at nested level
10. Wait for auto-save
11. Verify save works at nested level

**Expected Result:** Save works correctly at all levels, state updates properly

---

#### TC1.2: Multiple Rapid Changes (Queue Coalescing)
**Status:** ✅ PASS
**Description:** Test that rapid changes don't create multiple saves
**Steps:**
1. Open a notebook
2. Create multiple notes rapidly (< 1500ms between each)
3. Watch save status indicator
4. Verify only one save occurs after debounce period

**Expected Result:** Multiple changes coalesce into single save

---

#### TC1.3: Queue Processing and Race Conditions
**Status:** ✅ PASS
**Description:** Test sequential queue processing and race condition prevention
**Steps:**
1. Open a notebook with many notes (slow save)
2. Make a change to trigger save
3. Immediately make another change
4. Verify second change waits for first save to complete
5. Open console and monitor `state.saveQueue.length`
6. Make multiple rapid changes (faster than debounce)
7. Verify queue processes items sequentially
8. Verify small delay (100ms) between queue items

**Expected Result:** Second save queued, no concurrent saves, sequential processing with delay

---

#### TC1.4: Empty Queue Status Update
**Status:** ✅ PASS
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
**Status:** ✅ PASS
**Description:** Test error handling when save fails
**Steps:**
1. Open browser DevTools Console
2. Open file `tests/fill-localstorage-helper.js` and copy entire contents
3. Paste into console and press Enter (loads helper functions)
4. Run: `fillLocalStorage()` - fills localStorage until quota exceeded
5. Watch console log showing chunks being added
6. Make a change in the notebook to trigger auto-save
7. Wait for auto-save to attempt (1500ms)
8. Verify save fails with quota error
9. Click on red error status indicator in toolbar
10. Verify error alert shows storage quota message
11. Clean up: Run `clearTestData()` in console

**Expected Result:**
- Status shows red error indicator
- Error message displays storage quota exceeded
- Failed save removed from queue (no infinite retries)
- Helper script makes testing easy

---

#### TC1.6: Queue Continuation After Failure
**Status:** ✅ PASS
**Description:** Test that queue continues processing after failure
**Steps:**
1. Fill localStorage to near quota
2. Make multiple changes rapidly
3. Allow first save to fail (quota exceeded)
4. Free up space (delete some notes)
5. Verify subsequent queued saves succeed

**Expected Result:** Failed save removed, next save proceeds

---

#### TC1.7: Error State Clears on Success
**Status:** ✅ PASS
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

## 2. showAutocomplete() Refactoring

**Commit:** 7188a28
**Date:** 2026-02-07
**Lines Reduced:** 50 → 4 (main function)
**Helper Functions Added:** 6

### Extracted Functions:
1. `updateAutocompleteState()` - Manage autocomplete state
2. `renderEmptyAutocomplete()` - Create empty state element
3. `createAutocompleteItem()` - Factory for item elements (pill + tag + count)
4. `attachAutocompleteItemHandler()` - Event handler attachment
5. `populateAutocompleteList()` - List rendering logic
6. `displayAutocompleteDropdown()` - Dropdown positioning/display

### Test Cases (9 tests)

#### TC2.1: Basic Autocomplete Display and Matching
**Status:** 🔄 PENDING
**Description:** Test basic autocomplete with case-insensitive matching and multiple tags
**Steps:**
1. Open a notebook with existing tags (#work, #personal, #urgent)
2. Edit a note
3. In the note textarea, type `#`
4. Type a letter (e.g., `#w`)
5. Verify autocomplete dropdown appears with matching tags
6. Verify case-insensitive: `#w` matches `#Work` if it exists
7. Complete first tag: `#work `
8. Type second tag: `#per`
9. Verify autocomplete shows #personal
10. Verify multiple tags work

**Expected Result:** Autocomplete shows matching tags, case-insensitive, works for multiple tags

---

#### TC2.2: Autocomplete Empty State
**Status:** 🔄 PENDING
**Description:** Test empty state when no tags match
**Steps:**
1. Open a notebook with existing tags (#work, #personal)
2. Edit a note
3. Type `#xyz` (tag that doesn't exist)
4. Verify "No matching tags" message appears

**Expected Result:** Empty state message displayed

---

#### TC2.3: Autocomplete Item Structure, Styling, and Colors
**Status:** 🔄 PENDING
**Description:** Test autocomplete items have correct structure and colors
**Steps:**
1. Create notes with tags: #work, #personal, #urgent
2. Open hashtag sidebar (H key)
3. Click color picker for #work
4. Set custom color (e.g., red #FF0000)
5. Close sidebar
6. Edit a note and type `#`
7. Inspect autocomplete dropdown with DevTools
8. Verify each item has:
   - Colored pill (`.ac-pill`)
   - Tag text (`.ac-tag`)
   - Usage count (`.ac-count`)
9. Verify #work pill has red background (custom color)

**Expected Result:** Items have pill, tag text, count, and colors match assignments

---

#### TC2.4: Autocomplete Sorting
**Status:** 🔄 PENDING
**Description:** Test tags sorted by usage count then alphabetically
**Steps:**
1. Create notes: 3 with #work, 2 with #personal, 1 with #urgent
2. Edit a note and type `#`
3. Verify order: #work (3), #personal (2), #urgent (1)
4. Create notes: 2 more with #urgent (now 3 total)
5. Type `#` again
6. Verify order: #work (3), #urgent (3), #personal (2)
7. Note: #work appears before #urgent (alphabetical tiebreaker)

**Expected Result:** Tags sorted by count desc, then alphabetically

---

#### TC2.5: Autocomplete Selection Methods
**Status:** 🔄 PENDING
**Description:** Test selection via click and keyboard
**Steps:**
1. Edit a note and type `#w`
2. **Test Click Selection:**
   - Click on #work in autocomplete
   - Verify `#work` inserted at cursor
   - Verify autocomplete closes
   - Verify cursor positioned after inserted tag
   - Verify textarea doesn't blur
3. Type `#u`
4. **Test Keyboard Selection:**
   - Press Down arrow to highlight first item
   - Press Down arrow again to highlight second item
   - Press Enter to select highlighted item
   - Verify tag inserted
   - Verify autocomplete closes

**Expected Result:** Both click and keyboard selection work, textarea stays focused

---

#### TC2.6: Autocomplete Positioning
**Status:** 🔄 PENDING
**Description:** Test autocomplete positioning in textarea and filter input
**Steps:**
1. **Textarea Positioning:**
   - Edit a note
   - Type several lines of text
   - Place cursor mid-line and type `#`
   - Verify autocomplete appears near cursor (not at top of textarea)
   - Scroll textarea
   - Type `#` again
   - Verify autocomplete follows caret position
2. **Filter Input Positioning:**
   - Open hashtag sidebar (H key)
   - Click in filter input at top
   - Type `#` in filter input
   - Verify autocomplete appears directly below input
   - Verify autocomplete width matches input width (or min width)

**Expected Result:** Dropdown positioned at caret in textarea, below filter input

---

#### TC2.7: Autocomplete Viewport Clamping
**Status:** 🔄 PENDING
**Description:** Test autocomplete doesn't go off-screen
**Steps:**
1. Edit a note
2. Scroll so note editor is at bottom of viewport
3. Type `#` near bottom
4. Verify autocomplete doesn't go below viewport
5. Resize browser window smaller
6. Type `#` near right edge
7. Verify autocomplete doesn't go past right edge

**Expected Result:** Dropdown clamped to viewport bounds

---

#### TC2.8: Autocomplete Max Results
**Status:** 🔄 PENDING
**Description:** Test result limit (20 items max)
**Steps:**
1. Create 25 different tags (#tag1, #tag2, ... #tag25)
2. Edit a note and type `#tag`
3. Count items in dropdown
4. Verify exactly 20 items shown (AUTOCOMPLETE_MAX_RESULTS)

**Expected Result:** Maximum 20 results displayed

---

### Performance Baseline

**Test Environment:**
- Browser: Chrome 131+
- OS: Windows 11
- Tag count: 50 unique tags

**Metrics to Track:**
- Autocomplete display time: < 50ms
- Item creation time: < 5ms per item
- No memory leaks after 100 autocomplete cycles

**Status:** 🔄 PENDING

---

## 3. updateHashtagDisplay() Refactoring

**Commit:** [Pending]
**Date:** 2026-02-07
**Lines Reduced:** 70 → 15 (main function)
**Helper Functions Added:** 9
**Architecture Change:** Event delegation (1 listener instead of N)

### Extracted Functions:
1. `getHashtagBadgeText()` - Calculate badge text for batch mode
2. `applyHashtagPillStyle()` - Apply solid/outlined styling
3. `createHashtagPill()` - Factory for creating pill elements
4. `saveCursorPosition()` - Save textarea cursor position
5. `restoreCursorPosition()` - Restore cursor position with clamping
6. `reAddRemovedTag()` - Re-add removed tag to state and content
7. `markTagAsRemoved()` - Mark tag as removed in state and content
8. `triggerInputWithoutAutocomplete()` - Trigger input event with suppressed autocomplete
9. `attachHashtagPillHandlers()` - Event delegation with AbortController
10. `cleanupHashtagPillHandlers()` - Cleanup for memory leak prevention

### Test Cases (9 tests)

#### TC3.1: Single Edit Mode - Complete Behavior
**Status:** 🔄 PENDING
**Description:** Test hashtag pills display correctly in single edit mode
**Steps:**
1. Open a notebook and create a note
2. Edit the note
3. In the content textarea, type: `This is a note #work #urgent #personal`
4. Verify hashtag display area shows three pills:
   - #work (colored, no badge)
   - #urgent (colored, no badge)
   - #personal (colored, no badge)
5. Verify pills have solid background (not outlined)
6. Verify no count badges appear (e.g., no "(1/1)")

**Expected Result:** Pills display with solid colors, no badges

---

#### TC3.2: Batch Edit Mode - Badge Calculations
**Status:** 🔄 PENDING
**Description:** Test hashtag pills show count badges in batch mode with various coverage scenarios
**Steps:**
1. Create 5 notes:
   - Note 1: `Task one #work #urgent`
   - Note 2: `Task two #work #personal`
   - Note 3: `Task three #work`
   - Note 4: `Task four #urgent`
   - Note 5: `Task five #personal #meeting`
2. Select all 5 notes (Ctrl+A or Select All)
3. Press E to batch edit
4. Verify hashtag display shows:
   - #work (3/5)
   - #urgent (2/5)
   - #personal (2/5)
   - #meeting (1/5)
5. Verify badge format: space before parentheses " (n/total)"
6. Click #work pill to remove it
7. Verify pill becomes outlined
8. Verify badge changes to (0/5)
9. Verify content no longer contains #work

**Expected Result:** Badges display correct counts, show (0/total) when removed

---

#### TC3.3: Tag Toggle Workflow
**Status:** 🔄 PENDING
**Description:** Test complete tag toggle cycle with autocomplete suppression
**Steps:**
1. Edit a note with content: `Meeting notes #work #urgent #personal`
2. Verify pills are solid (colored background)
3. **Test Remove:**
   - Click on #work pill
   - Verify #work pill changes to outlined (transparent bg, colored border)
   - Verify textarea content changes to: `Meeting notes #urgent #personal`
   - Verify #work removed cleanly (no extra spaces)
   - Verify cursor position unchanged
   - Verify autocomplete does NOT appear
4. **Test Re-add:**
   - Click #work pill again (outlined)
   - Verify pill becomes solid again
   - Verify textarea content becomes: `Meeting notes #urgent #personal #work`
   - Verify #work appended to end (not original position)
5. **Test Multiple Toggles:**
   - Click #urgent to remove → verify content: `Meeting notes #personal #work`
   - Click #personal to remove → verify content: `Meeting notes #work`
   - Verify no extra spaces in content
   - Verify autocomplete never appears during toggles

**Expected Result:** Pills toggle correctly, tags removed/appended cleanly, autocomplete suppressed

---

#### TC3.4: Cursor Position Management
**Status:** 🔄 PENDING
**Description:** Test cursor position maintained with edge cases
**Steps:**
1. Edit a note with content: `Meeting notes #work #urgent`
2. **Test Mid-content Cursor:**
   - Place cursor between "Meeting" and "notes" (position 8)
   - Click #work pill to remove it
   - Verify cursor still at position 8
   - Type "important"
   - Verify text: `Meeting important notes #urgent`
3. **Test Cursor at End:**
   - Create new note: `Test #work`
   - Place cursor at very end (after #work)
   - Note cursor position: position 10
   - Click #work to remove
   - Verify content: `Test`
   - Verify cursor clamped to position 4 (end of "Test")
   - Verify no error about invalid selection range
4. **Test Cursor Beyond Length:**
   - Edit note: `This is a long note #work #urgent #personal`
   - Place cursor at end
   - Click #personal, then #urgent, then #work (remove all tags)
   - Verify content: `This is a long note`
   - Verify cursor at end of remaining text
   - Verify cursor doesn't exceed content length

**Expected Result:** Cursor preserved/clamped correctly in all scenarios

---

#### TC3.5: Pill Visual Styling
**Status:** 🔄 PENDING
**Description:** Test visual styling of solid and outlined pills with custom colors
**Steps:**
1. Open hashtag sidebar (H key)
2. Click color picker for #work
3. Set custom color (e.g., red #FF0000)
4. Close sidebar
5. Edit a note with: `Test #work #urgent`
6. **Inspect Solid Pill (#work):**
   - Open DevTools and inspect #work pill
   - Verify: `background: #FF0000` (red)
   - Verify: `color: #fff`
   - Verify: No border or thin border
7. **Inspect Outlined Pill:**
   - Click #work to remove
   - Inspect outlined pill
   - Verify: `background: transparent`
   - Verify: `border: 2px solid #FF0000` (red)
   - Verify: `color: #fff`
8. Verify #urgent pill has different color (default assigned color)

**Expected Result:** Styling matches specification, colors reflect tag color assignments

---

#### TC3.6: Event Delegation Architecture
**Status:** 🔄 PENDING
**Description:** Verify event delegation uses single listener
**Steps:**
1. Edit a note with: `Test #work #urgent #personal #meeting #review`
2. Open DevTools Console
3. Inspect `#hashtag-display` element
4. Check event listeners attached (use `getEventListeners(document.getElementById('hashtag-display'))` in console)
5. Verify only ONE click listener on parent container
6. Verify NO individual listeners on pill elements
7. Click any pill and verify it works
8. Click empty space in hashtag display area (not on pill)
9. Verify no action occurs
10. Verify no errors in console

**Expected Result:** Single delegated listener, not N individual listeners, only pill clicks trigger handler

---

#### TC3.7: Memory Leak Prevention
**Status:** 🔄 PENDING
**Description:** Test event listener cleanup via AbortController
**Steps:**
1. Open DevTools Console
2. Edit a note with hashtags
3. Type: `document.getElementById('hashtag-display')._abortController`
4. Verify AbortController exists
5. **Test Modal Close Cleanup:**
   - Close editor modal (press Escape)
   - Check: `document.getElementById('hashtag-display')._abortController`
   - Verify AbortController is null (cleaned up)
6. **Test Re-render Cleanup:**
   - Open editor again with hashtags
   - Note the AbortController reference (console)
   - Type a space and `#meeting` in textarea
   - Wait for hashtag display to update (input event)
   - Verify new AbortController created
   - Verify old AbortController aborted
7. **Test Memory Growth:**
   - Open/close editor 10+ times with hashtags
   - Open DevTools Memory tab
   - Take heap snapshot
   - Verify no listener accumulation
   - Verify no memory growth

**Expected Result:** AbortController cleaned up on modal close and re-render, no memory leaks

---

#### TC3.8: Integration - Full Edit Workflow
**Status:** 🔄 PENDING
**Description:** End-to-end test of hashtag display in editor
**Steps:**
1. Create note: `Project planning #work`
2. Edit note
3. Verify #work pill appears (solid)
4. Add tag in content: ` #urgent`
5. Verify #urgent pill appears
6. Click #work to remove (outlined)
7. Type: ` #meeting`
8. Verify #meeting pill appears
9. Click #work to re-add (solid)
10. Save editor (Escape or click outside)
11. Re-open editor (double-click note)
12. Verify all pills display correctly: #urgent, #meeting, #work
13. Verify pills clickable
14. Verify content matches: `Project planning #urgent #meeting #work`

**Expected Result:** Full workflow works seamlessly, state persists across save/load

---

### Performance Baseline

**Test Environment:**
- Browser: Chrome 131+
- OS: Windows 11
- Tag count: 20 hashtags per note

**Metrics to Track:**
- Display update time: < 20ms
- Event delegation overhead: < 1ms per click
- Memory usage: Single listener vs N listeners (expect ~90% reduction)
- AbortController cleanup: < 1ms

**Status:** 🔄 PENDING

---

## 4. showNodeContextMenu() Refactoring

**Commit:** [Pending]
**Date:** 2026-02-07
**Lines Reduced:** 57 → 18 (main function)
**Helper Functions Added:** 9
**Architecture Change:** Command Pattern (registry lookup vs if/else chain)

### Extracted Functions:
1. `getNodeContextMenuItems()` - Menu item definitions based on selection
2. `createContextMenuItem()` - Factory for menu item elements
3. `createContextMenuContainer()` - Factory for menu container
4. `populateContextMenu()` - Menu population logic
5. `adjustContextMenuPosition()` - Viewport clamping
6. `commandBringToFront()` - Command for bring-to-front action
7. `commandSendToBack()` - Command for send-to-back action
8. `commandMoveTo()` - Command for move-to action
9. `commandConnectTo()` - Command for batch connect action
10. `executeContextMenuAction()` - Command dispatcher with registry
11. `attachContextMenuHandler()` - Event handler attachment

### Test Cases (5 tests)

#### TC4.1: Context Menu Display and Items
**Status:** 🔄 PENDING
**Description:** Test context menu appears with correct items based on selection
**Steps:**
1. **Single Selection:**
   - Create a note on the canvas
   - Right-click on the note
   - Verify context menu appears at cursor position
   - Verify menu contains 3 items:
     - Bring to Front
     - Send to Back
     - Move to...
   - Verify NO "Connect to..." option
2. **Multi Selection:**
   - Create 3 notes on the canvas
   - Select all 3 notes (Ctrl+click or drag-select)
   - Right-click on one of the selected notes
   - Verify context menu appears
   - Verify menu contains 4 items:
     - Connect to...
     - Bring to Front
     - Send to Back
     - Move to...
   - Verify "Connect to..." is the FIRST item
3. **DOM Structure:**
   - Open DevTools and inspect menu
   - Verify menu element has ID: `node-context-menu`
   - Verify menu has `position: fixed`
   - Verify each item has class: `context-menu-item`
   - Verify each item has `dataset.action` attribute
   - Verify actions: 'bring-front', 'send-back', 'move-to', 'connect-to'

**Expected Result:** Menu displays correctly with items based on selection count, proper DOM structure

---

#### TC4.2: Context Menu Positioning and Clamping
**Status:** 🔄 PENDING
**Description:** Test menu positioning and viewport boundary clamping
**Steps:**
1. **Normal Case:**
   - Right-click note in center of viewport
   - Verify menu appears at cursor position
   - Note cursor coordinates (e.g., x=500, y=300)
   - Inspect menu style.left and style.top
   - Verify they match cursor coordinates (500px, 300px)
2. **Right Edge Clamping:**
   - Create a note near the right edge of viewport
   - Right-click the note
   - Verify menu appears
   - Verify menu does NOT extend beyond right edge
   - Verify menu flips to the LEFT of cursor
   - Inspect menu.style.left - should be (originalX - menuWidth)
3. **Bottom Edge Clamping:**
   - Create a note near the bottom edge of viewport
   - Right-click the note
   - Verify menu appears
   - Verify menu does NOT extend beyond bottom edge
   - Verify menu flips ABOVE cursor
   - Inspect menu.style.top - should be (originalY - menuHeight)
4. **Corner Case:**
   - Create a note at bottom-right corner of viewport
   - Right-click the note
   - Verify menu appears
   - Verify menu is fully visible (not cut off)
   - Verify menu positioned to top-left of cursor
   - Verify both left and top styles adjusted

**Expected Result:** Menu positioned at cursor, flips to stay in viewport on all edges

---

#### TC4.3: Action Execution
**Status:** 🔄 PENDING
**Description:** Test all context menu commands execute correctly
**Steps:**
1. **Bring to Front:**
   - Create 2 notes, one overlapping the other
   - Click the note that's behind to select it
   - Right-click and select "Bring to Front"
   - Verify menu closes
   - Verify selected note now appears in front
   - Verify z-order changed
2. **Send to Back:**
   - Click the note that's in front to select it
   - Right-click and select "Send to Back"
   - Verify menu closes
   - Verify selected note now appears behind
   - Verify z-order changed
3. **Move to...:**
   - Create a note
   - Right-click and select "Move to..."
   - Verify context menu closes
   - Verify "Move To" modal opens
   - Verify modal shows destination options
   - Press Escape to close modal
4. **Connect to... (Multi-Select):**
   - Create 3 source notes and 1 target note
   - Select the 3 source notes
   - Right-click and select "Connect to..."
   - Verify context menu closes
   - Verify edge creation mode activated
   - Click the target note
   - Verify edges created from all 3 sources to target
5. **Event Propagation:**
   - Right-click a note and select any action
   - Verify action executes
   - Verify selected nodes remain selected (click didn't propagate to canvas)

**Expected Result:** All commands execute correctly, menu closes, no event propagation

---

#### TC4.4: Menu Lifecycle and Cleanup
**Status:** 🔄 PENDING
**Description:** Test menu creation, replacement, and cleanup
**Steps:**
1. **Click Action Cleanup:**
   - Right-click a note to show menu
   - Verify menu is visible
   - Click any menu action (e.g., "Bring to Front")
   - Verify menu disappears immediately
   - Verify no menu element in DOM (use DevTools)
   - Type in console: `document.getElementById('node-context-menu')`
   - Verify returns null
2. **New Menu Replaces Old:**
   - Right-click note #1 to show menu
   - Verify menu appears
   - Without clicking, right-click note #2
   - Verify only ONE menu appears (at new position)
   - Verify no duplicate menus
   - Check DOM - should be only one `#node-context-menu`
3. **Click Outside Cleanup:**
   - Right-click a note to show menu
   - Verify menu appears
   - Click on canvas (not on menu or node)
   - Verify menu closes
   - Verify menu removed from DOM

**Expected Result:** Menu cleaned up after action, replaced by new menu, closes on outside click

---

### Performance Baseline

**Test Environment:**
- Browser: Chrome 131+
- OS: Windows 11
- Selection count: 1-100 nodes

**Metrics to Track:**
- Menu display time: < 20ms
- Command execution time: < 10ms
- Position adjustment: < 5ms
- Memory usage: No leaks after 100+ menu cycles

**Status:** 🔄 PENDING

---

## 5. initiateMoveToNotebook() Refactoring

**Commit:** [Pending]
**Date:** 2026-02-07
**Lines Reduced:** TBD (main function)
**Helper Functions Added:** 7

### Extracted Functions:
1. `createNodeCopiesWithMapping()` - Node copying + ID mapping
2. `filterAndRemapEdges()` - Edge filtering and remapping
3. `calculateBoundingBox()` - Bounding box calculation
4. `calculateRelativeOffsets()` - Offset calculation
5. `getSourceProjectName()` - Project name lookup
6. `buildMovePackage()` - Data assembly
7. `storePendingMove()` - SessionStorage persistence

### Architecture Changes:
- Added 4 guard clauses to validate preconditions
- Separated data transformation from side effects
- Pure functions for geometric calculations

### Test Cases (7 tests)

#### TC5.1: Guard Clause Validation
**Status:** 🔄 PENDING
**Description:** Test all guard clauses reject invalid inputs
**Steps:**
1. Test no target project ID:
   - Call `initiateMoveToNotebook(null)`
   - Verify console error: "No target project ID provided"
   - Verify no navigation occurs
2. Test no current project open:
   - From landing page, call `initiateMoveToNotebook('some-id')`
   - Verify console error: "No current project open"
3. Test no selected nodes:
   - Deselect all nodes, call function
   - Verify console error: "No nodes selected to move"
4. Test target project doesn't exist:
   - Call with fake project ID: `initiateMoveToNotebook('fake-id-12345')`
   - Verify console error: "Target project does not exist"

**Expected Result:** All invalid inputs handled gracefully with console errors, no navigation

---

#### TC5.2: Single Node Move - Complete Data Preservation
**Status:** 🔄 PENDING
**Description:** Test single node move preserves all properties
**Steps:**
1. Create notebook "Source" with 1 note:
   - Title: "Test Note"
   - Content: "Body text #project #idea"
   - Completion: "Done" (✓)
   - Position: (100, 200)
2. Create empty notebook "Target"
3. Select note and move to "Target"
4. Place ghost node
5. Verify in "Target":
   - Title matches
   - Content matches
   - Hashtags preserved (#project, #idea)
   - Completion status preserved (Done)
   - Dog-ear indicator present (has body text)
6. Verify in "Source":
   - Original node removed
7. Verify toast shows link back to "Source"

**Expected Result:** All node properties preserved, source cleaned up

---

#### TC5.3: Multiple Node Move - Relative Positioning
**Status:** 🔄 PENDING
**Description:** Test multiple nodes maintain relative positions
**Steps:**
1. Create notebook "Source" with 4 notes in a square:
   - Top-left: (0, 0)
   - Top-right: (300, 0)
   - Bottom-left: (0, 300)
   - Bottom-right: (300, 300)
2. Create empty notebook "Target"
3. Select all 4 notes
4. Move to "Target"
5. Observe ghost node arrangement
6. Move cursor to different locations
7. Verify ghosts maintain square pattern
8. Place at cursor position (500, 500)
9. Verify nodes in "Target" maintain square layout relative to placement point
10. Verify all 4 removed from "Source"

**Expected Result:** Relative positions preserved, center follows cursor

---

#### TC5.4: Edge Preservation - Connected Clusters
**Status:** 🔄 PENDING
**Description:** Test edge filtering and remapping for various selection patterns
**Steps:**
1. **Test Fully Connected Cluster:**
   - Create notebook "Source" with notes A, B, C
   - Create edges: A—B, B—C, A—C (triangle)
   - Select all 3 nodes, move to "Target"
   - Verify all 3 edges preserved in "Target"
   - Verify all 3 edges removed from "Source"
2. **Test Partial Selection:**
   - Create notes A, B, C, D with edges: A—B, B—C, C—D (chain)
   - Select only B and C (middle nodes)
   - Move to "Target"
   - Verify only B—C edge moved (both endpoints in selection)
   - Verify A—B and C—D removed (endpoints separated)
   - Verify A and D remain in "Source" with no edges
3. **Test Unconnected Nodes:**
   - Create 2 nodes with no edge
   - Select both, move to "Target"
   - Verify no edges in "Target" (none to preserve)

**Expected Result:** Only edges with both endpoints selected are preserved and remapped

---

#### TC5.5: Nested Move Operations
**Status:** 🔄 PENDING
**Description:** Test moving nodes from nested level and nodes with children
**Steps:**
1. **Test Move from Nested Level:**
   - Create notebook "Source"
   - Create note "Parent" with 3 children inside
   - Double-click to enter "Parent"
   - Select 2 of the 3 children
   - Move to "Target"
   - Place in "Target"
   - Verify 2 children moved to "Target" root level
   - Verify 1 child remains in "Parent"
2. **Test Move Parent with Children:**
   - Create note "Container" with 5 nested children
   - Select "Container" at root level
   - Move to "Target"
   - Place in "Target"
   - Double-click "Container" in "Target"
   - Verify all 5 children preserved inside
   - Verify stacked rectangles indicator shows
   - Verify "Container" removed from "Source"

**Expected Result:** Moves work from any navigation level, nested children preserved

---

#### TC5.6: Ghost Drag Workflow
**Status:** 🔄 PENDING
**Description:** Test complete ghost drag interaction cycle
**Steps:**
1. Create notebooks "Source" and "Target"
2. Select 3 nodes in "Source"
3. Initiate move to "Target"
4. **Test Ghost Appearance:**
   - Verify 3 ghost nodes appear following cursor
   - Verify ghosts have semi-transparent styling
   - Verify cursor changes to ghost-drag cursor
   - Verify toast notification appears
5. **Test Ghost Interaction:**
   - Move cursor around canvas
   - Verify ghosts follow smoothly
   - Verify ghosts maintain relative positions
6. **Test Placement:**
   - Click to place ghosts
   - Verify ghosts convert to real nodes
   - Verify selection includes newly placed nodes
   - Verify ghost cursor removed
7. **Test Cancellation (ESC):**
   - Initiate new move operation
   - Press ESC before placing
   - Verify ghosts disappear
   - Verify no nodes added to target
   - Verify return to source notebook
   - Verify original nodes still in source

**Expected Result:** Complete ghost drag cycle works correctly, cancellation works

---

#### TC5.7: Data Persistence and Cleanup
**Status:** 🔄 PENDING
**Description:** Test sessionStorage handling and data persistence
**Steps:**
1. Create notebooks "A" and "B"
2. Move 2 nodes from A to B
3. **Test SessionStorage:**
   - Open DevTools → Application → Session Storage
   - Before placement, verify MOVE_STORAGE_KEY exists
   - After placement, verify key removed
4. **Test localStorage Persistence:**
   - Place nodes in "B"
   - Verify note count updated in projects list
   - Refresh browser (F5)
   - Open notebook "A"
   - Verify 2 fewer notes
   - Open notebook "B"
   - Verify 2 additional notes
   - Verify no ghost nodes after refresh
5. **Test Toast Link:**
   - After move completes, verify toast shows
   - Click "Return to [Source]" link
   - Verify navigation back to source notebook

**Expected Result:** SessionStorage cleaned up, data persists correctly, toast link works

---

### Performance Baseline

**Test Environment:**
- Browser: Chrome 131+
- OS: Windows 11
- Selection size: 50 nodes with 30 edges

**Metrics to Track:**
- Move package creation time: < 100ms
- Ghost rendering time: < 50ms
- Placement time: < 100ms
- No memory leaks after 10 move operations

**Status:** 🔄 PENDING

---

## Test Execution Log

| Date | Tester | Section | Tests Passed | Tests Failed | Notes |
|------|--------|---------|--------------|--------------|-------|
| TBD  | -      | -       | -            | -            | Awaiting initial test run |

---

## Summary

**Total Test Cases:** 37 (consolidated from 108)
**Sections:** 5 refactorings
**Status:** 🔄 All tests pending

### Tests by Section:
- processSaveQueue(): 7 tests
- showAutocomplete(): 9 tests (includes 1 performance baseline)
- updateHashtagDisplay(): 9 tests (includes 1 performance baseline)
- showNodeContextMenu(): 5 tests (includes 1 performance baseline)
- initiateMoveToNotebook(): 7 tests (includes 1 performance baseline)

### Consolidation Benefits:
- 66% reduction in test count (108 → 37)
- Faster test execution
- Comprehensive workflow tests replace fragmented tests
- Low-value implementation tests removed
- Related assertions combined
- Equivalent coverage maintained

---

## Sign-off

**Refactoring Complete:** ✅
**Tests Complete:** 🔄 PENDING
**Ready for Production:** 🔄 PENDING

---

*Last Updated: 2026-02-08*
*Consolidated test plan: Combined related tests, removed low-value implementation tests, created comprehensive workflow tests*
