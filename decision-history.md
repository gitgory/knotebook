# Decision History

This file tracks significant technical and design decisions made during development.

---

## 2026-02-04: Auto-Save Queue - Single Pending Item Strategy

DECISION: Limit save queue to one pending item, reset debounce on subsequent changes
CHOSE: Check if queue.length > 0, then just reset timer instead of adding more items
NOT: Allow unlimited queue items (caused infinite loop with 15+ items)
NOT: Process queue immediately without debounce (would trigger on every mousemove)

Reasoning:
- Infinite loop bug: Mousemove during drag added 15 queue items before debounce fired, causing rapid save/saved flicker
- Debounce purpose: Coalesce rapid changes (typing, dragging) into single save after user stops
- Performance: Single queue item means max one save operation per debounce period
- Correctness: Latest data snapshot is what matters, not intermediate states during drag

---

## 2026-02-04: Change Detection - Hash-Based Comparison

DECISION: Calculate hash of data to detect actual changes before scheduling save
CHOSE: Simple integer hash of JSON.stringify(data), store lastSaveHash after save
NOT: Save on every render() call (too aggressive, triggered on canvas clicks)
NOT: Manual dirty tracking per field (too complex, error-prone)

Reasoning:
- Unnecessary saves: Canvas clicks, panning, selection changes triggered render() but didn't change data
- Performance: Hash calculation is fast (<1ms), prevents localStorage writes when nothing changed
- Simplicity: Single hash covers all data (nodes, edges, colors, settings, theme) automatically
- User experience: No "Pending..." status on non-data-changing interactions

---

## 2026-02-04: Save Status UI - Subtle and Non-Distracting

DECISION: Use dimmed gray text with fade-out, skip "Saving..." state
CHOSE: text-secondary @ 60% opacity, Pending→Saved (no Saving), fade after 2s
NOT: Bright accent colors (too distracting)
NOT: Show "Saving..." state (saves complete in milliseconds, causes flicker)
NOT: Persistent indicator (visual clutter)

Reasoning:
- User feedback: Bright colors drew too much attention to routine background operation
- Speed: Saves complete so fast (<10ms) that "Saving..." flickers and feels buggy
- Subtlety: Status should inform but not distract - gray @ 60% opacity achieves this balance
- Clean UI: Fade-out after 2s keeps toolbar uncluttered when idle

---

## 2026-02-04: Async Save System - requestIdleCallback Strategy

DECISION: Use requestIdleCallback for JSON.stringify() to prevent UI blocking
CHOSE: requestIdleCallback with 1s timeout, setTimeout(0) fallback for Safari
NOT: Synchronous JSON.stringify() (blocks UI on large graphs)
NOT: Web Workers (overkill, adds complexity for marginal benefit)
NOT: IndexedDB (localStorage is sufficient for our data size)

Reasoning:
- Large graphs: 100+ nodes can take 50-100ms to stringify, blocking UI during drag/interaction
- Browser compatibility: Safari doesn't support requestIdleCallback, needs fallback
- User experience: Smooth interactions more important than instant saves
- Simplicity: Queue + debounce + idle callback is elegant and sufficient

---

## 2026-02-04: Editor Auto-Save - No Auto-Save During Typing

DECISION: Don't auto-save while user types in note editor
CHOSE: Keep editor's manual save/cancel flow with snapshot system
NOT: Auto-save on every keystroke (conflicts with Cancel button)
NOT: Show save status during editor typing (confusing - changes aren't persisted yet)

Reasoning:
- Cancel button: User expects Cancel to revert ALL changes since opening editor
- Modal nature: Editor is isolated modal with explicit Save/Cancel - different UX from canvas
- Snapshot system: Already have editorSnapshot for reverting on cancel - reuse this pattern
- User expectation: Modal editors typically don't auto-save until closed/confirmed

---

## 2026-02-02: XSS Protection - Eliminate innerHTML

DECISION: Convert all innerHTML usage to safe DOM APIs
CHOSE: createElement(), textContent, dataset, replaceChildren()
NOT: Continue using innerHTML with manual escaping
NOT: Use a sanitization library

Reasoning:
- Security-critical: User-generated content (project names, note titles, hashtags) was vulnerable to XSS injection via innerHTML
- Defense in depth: Browser's built-in escaping via textContent and dataset is more reliable than manual escaping
- Modern approach: replaceChildren() is the standard modern way to clear DOM (clearer intent than innerHTML = '')
- No dependencies: Keeps codebase dependency-free while achieving complete XSS protection


---

## 2026-02-02: Error Handling - Protect JSON.parse() Calls

DECISION: Wrap all JSON.parse() calls in try/catch blocks
CHOSE: Graceful degradation - log error, clear corrupted data, return safe defaults
NOT: Let app crash on corrupted localStorage data
NOT: Use a JSON validation library

Reasoning:
- Robustness: Corrupted localStorage (browser bugs, extensions, manual editing) shouldn't crash the app
- User experience: Better to show empty state than white screen of death
- Debugging: Console errors help identify when/why data corruption occurs
- Data safety: Don't auto-delete project data (user may want to recover), only delete index


---

## 2026-02-02: Storage Keys - Rename to Match App Name

DECISION: Rename localStorage keys from graph-notes-* to knotebook-*
CHOSE: Simple rename, user clears old data manually
NOT: Auto-detect and support both formats (overengineering)
NOT: Add migration logic (unnecessary complexity)

Reasoning:
- Simplicity: Clean codebase without legacy compatibility code
- Correct naming: Keys match app name "knotebook" instead of old "graph-notes"
- Small user base: Only developer testing data exists, easy to clear and recreate
- YAGNI: Don't build migration for a one-time edge case


---

## 2026-02-02: Storage Error Handling - Check Availability and Quota

DECISION: Add localStorage availability checks and quota error handling
CHOSE: Try/catch on all setItem calls, detect unavailability on startup
NOT: Assume localStorage always works
NOT: Use alternative storage (IndexedDB, etc.) - overkill for this app

Reasoning:
- Private browsing: Some browsers block localStorage in private mode
- Quota exceeded: Large projects can hit 5-10MB localStorage limits
- User experience: Better to show error than silently fail
- Graceful degradation: Warn user, suggest export as workaround


---

## 2026-02-02: State Management - Consolidate Scattered Globals

DECISION: Move all mutable globals into single state object
CHOSE: Centralized state object with all application state
NOT: Keep scattered globals across the codebase
NOT: Use getters/setters (adds unnecessary indirection)

Reasoning:
- Single source of truth: All state in one place, easier to track changes
- Easier debugging: Can inspect entire app state in one object
- Clearer data flow: Explicit state. prefix shows mutation points
- Maintainability: Less cognitive load when reasoning about state
- Immediate-mode rendering: Pattern already re-renders on any state change

Moved to state object:
- currentProjectId → state.currentProjectId
- hashtagColors → state.hashtagColors
- projectSettings → state.projectSettings
- rootNodes/rootEdges → state.rootNodes/state.rootEdges
- editorSnapshot → state.editorSnapshot
- removedTagsInSession → state.removedTagsInSession
- hoverTimeout → state.hoverTimeout
- autoSaveTimeout → state.autoSaveTimeout
- ghostNodes/ghostDragging/ghostCursorPos → state.ghostNodes/state.ghostDragging/state.ghostCursorPos
- pendingMove → state.pendingMove
- activeMenuProjectId → state.activeMenuProjectId
- pendingImportData → state.pendingImportData

Kept separate (transient UI state):
- autocomplete object (ephemeral, not app state)
- Constants (NODE_WIDTH, AUTOSAVE_DELAY, etc.)

---

## 2026-02-02: Auto-Save Race Conditions - Queue-Based System

DECISION: Implement async save queue to prevent race conditions
CHOSE: Queue-based sequential processing with async/await
NOT: Simple debounce with in-progress flag (insufficient)
NOT: Immediate + debounced hybrid (more complex)

Reasoning:
- Data integrity: Multiple rapid changes could trigger concurrent saves, corrupting data
- Non-blocking: JSON.stringify() on large graphs (100+ nodes) can freeze UI for 100ms+
- Guaranteed saves: Queue ensures all changes are saved, even during rapid editing
- Status feedback: Users can see save state (pending/saving/saved/error)
- Tab close protection: Block browser navigation during active/pending saves

Implementation:
- stringifyAsync() uses requestIdleCallback() to avoid blocking UI thread
- processSaveQueue() processes saves sequentially (one at a time)
- scheduleAutoSave() adds to queue + debounces (keeps existing 1.5s delay)
- Save status indicator in toolbar: ✓ Saved (green) | ● Pending (gray pulse) | ⟳ Saving (blue spin) | ✕ Error (red, clickable)
- beforeunload blocks navigation if: saveInProgress || saveQueue.length > 0 || saveStatus pending/saving

Edge cases handled:
- Safari: Fallback to setTimeout if requestIdleCallback unavailable
- Failed saves: Removed from queue (no infinite retry), error shown to user
- Quota exceeded: Alert with export suggestion
- Tab close: Browser shows warning dialog if save pending/in-progress

---
