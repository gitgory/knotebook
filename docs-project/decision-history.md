# Decision History

This file tracks significant technical and design decisions made during development.

---

## 2026-02-06: Magic Numbers Refactor - Replace with Named Constants

DECISION: Replace ~60 magic numbers with semantic named constants
CHOSE: Create comprehensive constants section organized by category (8 categories)
NOT: Leave magic numbers inline (unclear intent, hard to maintain)
NOT: Use a config object (harder to discover, more indirection)

Reasoning:
- Self-documenting: ZOOM_MIN instead of 0.5 communicates intent
- Single source of truth: Change value in one place
- Discoverability: All configurable values in one constants section
- Maintainability: Easy to find and modify behavior
- Categories: Timing, Zoom/Viewport, UI Layout, Animation, Text Limits, Autocomplete, Z-Index, Responsive

---

## 2026-02-06: Mobile Zoom Maximum (ZOOM_MOBILE_MAX)

DECISION: Set mobile pinch zoom max to 3 (300%)
CHOSE: 3x zoom cap for mobile (300%)
NOT: 5x zoom (500%) - too extreme, poor UX
NOT: 2.5x zoom (same as desktop) - doesn't leverage mobile pinch capability

Reasoning:
- Balance: More zoom than desktop (2.5x) but not excessive
- Usability: 500% creates disorienting experience on small screens
- Accessibility: 300% sufficient for text magnification needs
- Testing: User feedback confirmed 3x is comfortable sweet spot

---

## 2026-02-06: Export Success Notification

DECISION: Silent success for regular file exports (no toast notification)
CHOSE: No success toast for exportToFile() and exportProjectToFile()
NOT: Show toast on every export (unnecessary noise)

Reasoning:
- Common pattern: File downloads typically don't show success messages
- User feedback: File save dialog is sufficient confirmation
- Error recovery: EXPORT_SUCCESS_TOAST constant still used in error recovery export
- UX principle: Don't interrupt user with redundant information

---

## 2026-02-06: Autocomplete Dropdown Boundary Detection

DECISION: Use separate constants for width and height boundary checks
CHOSE: AUTOCOMPLETE_DROPDOWN_MIN_WIDTH (200) for horizontal, AUTOCOMPLETE_DROPDOWN_ESTIMATED_HEIGHT (200) for vertical
NOT: Use same constant for both (caused bug - width used for height check)

Reasoning:
- Bug found during testing: Vertical boundary check used width constant
- Correctness: Width and height are logically distinct dimensions
- Clarity: Separate constants make intent explicit
- Maintainability: Can adjust width and height independently if needed

---

## 2026-02-06: Comprehensive JSDoc Documentation Strategy

DECISION: Complete JSDoc documentation in three batches (~94 functions total)
CHOSE: Batch 1 (PROJECT LIST + UTILITY) → Batch 2 (NODE/EDGE/NAV/EDITOR + RENDERING) → Batch 3 (AUTOCOMPLETE + MOVE + SETTINGS + FILE OPS)
NOT: Document EVENT HANDLERS section (event wiring, not complex logic)
NOT: Document trivial 1-2 line helper functions (self-documenting)

Reasoning:
- Batch approach: Efficient processing by logical sections, easier context management
- Skip EVENT HANDLERS: Event listener setup is straightforward wiring, low value for docs
- Skip trivial helpers: Functions like hideModal() with 1-2 lines are self-evident
- Focus on value: Complex algorithms, multi-step operations, state management need context
- Complete coverage: 94 functions across 16 major sections documented
- Session efficiency: Three focused passes completed all documentation in two sessions

---

## 2026-02-06: JSDoc Documentation Scope

DECISION: Document ~40 core functions, not all 200+ functions
CHOSE: Focus on complex/critical functions (>2 lines, multiple responsibilities)
NOT: Document simple getters/setters, one-line helpers, obvious functions
NOT: Skip documentation entirely (loses code maintainability)

Reasoning:
- YAGNI principle: Simple functions are self-documenting
- Focus on value: Complex storage, rendering, navigation logic benefits most from docs
- Maintainability: Future developers (or Claude sessions) need context for complex functions
- Standard format: JSDoc with @param/@returns provides IDE integration
- Sections covered: Error handling, storage, themes, viewport, rendering, sidebar, view switching

---

## 2026-02-06: Test Data Format (Legacy Import)

DECISION: Use current data model in test plans (position: {x, y})
CHOSE: Test with complete current format including all required fields
NOT: Test legacy/incomplete data (x/y direct, missing created/modified/zIndex)

Reasoning:
- App uses current format: position object, not direct x/y properties
- Testing legacy adds complexity without benefit (no migration planned)
- Test accuracy: Incomplete test data found bugs in test, not in app
- Self-healing: parseHashtags() normalizes tags on load regardless of import format

---

## 2026-02-06: Toast Link Bug Fix

DECISION: Fix showToast() property check (hasLink → linkText/linkOnClick)
CHOSE: Check actual parameters being passed (linkText && linkOnClick)
NOT: Add hasLink property everywhere (more refactoring, same result)
NOT: Restructure toast system (over-engineering for simple bug)

Reasoning:
- Root cause: v106 XSS refactor changed API but didn't update property check
- Minimal fix: One line change restores functionality
- Consistency: Use properties already being passed by callers
- Bug context: "Return to notebook" links not clickable after v106

---

## 2026-02-06: Selection Box Cleanup

DECISION: Clear state.selectionBox in placeGhostNodes()
CHOSE: Clear alongside other ghost state (ghostNodes, ghostDragging, pendingMove)
NOT: Clear in render() or selection box code (fragmented cleanup)
NOT: Leave selection box (creates visual artifact)

Reasoning:
- Single responsibility: Ghost placement handles all state cleanup
- UI consistency: No artifacts left after operation completes
- Clear code: All cleanup together, not scattered across modules

---

## 2026-02-05: Render Throttling - requestAnimationFrame vs Debounce

DECISION: Use requestAnimationFrame throttling instead of debounce or dirty tracking
CHOSE: Throttle render() to max 60 FPS synced to display refresh
NOT: Debounce (would delay all renders, not just frequent ones)
NOT: Dirty tracking (200-300 lines, complex, premature optimization)
NOT: No optimization (100+ renders/sec during drag wastes CPU)

Reasoning:
- Display sync: requestAnimationFrame ensures renders happen when browser can display them (60 FPS)
- Mousemove frequency: Fires 60-120x/sec but screen only refreshes 60x/sec → wasted renders
- CPU savings: ~40% reduction during drag operations (100+ renders/sec → 60)
- Simplicity: Only 12 lines of code (vs 200-300 for dirty tracking)
- No visual difference: 60 FPS already smooth to human eye
- Battery life: Lower CPU usage benefits mobile devices
- Trade-off: Chose 80% benefit with 5% complexity over 100% benefit with huge complexity

---

## 2026-02-05: Loading Spinners - Minimal Scope

DECISION: Add spinners only to toolbar export/import buttons, skip project menu
CHOSE: Toolbar buttons (easy button reference), keyboard shortcuts (trigger toolbar button)
NOT: Project menu export (no button reference, would need DOM search)
NOT: All operations (over-engineering for rare use case)
NOT: No spinners (poor UX for large file operations)

Reasoning:
- Main use cases: Toolbar export button, landing page import button, Ctrl+S keyboard shortcut
- Project menu: Exporting from "..." menu has no button reference to add spinner to
- Simplicity: ~50 lines total (CSS + JS) for 90% of use cases
- Edge case handling: Large files (1MB+) are rare, but spinners prevent perceived freeze
- Implementation: .loading class hides text, shows spinning circle, prevents double-clicks

---

## 2026-02-05: Error Boundaries - Recovery Modal vs Silent Logging

DECISION: Show error recovery modal with 3 options (Export/Reload/Continue)
CHOSE: Modal with user-friendly message, technical details, and recovery options
NOT: Silent console.error only (user sees white screen, no recovery)
NOT: Auto-reload on error (loses user context and work)
NOT: Toast notification only (too subtle for critical errors)

Reasoning:
- User control: Let user decide (export work, reload fresh, or try to continue)
- Data safety: Export button works even during error state (emergency backup)
- Debugging: Technical details (stack trace, browser info) help diagnose issues
- Graceful degradation: Better than white screen of death
- Coverage: window.onerror + onunhandledrejection catch all uncaught errors
- Fallback: Alert shown if error happens before DOM loads (modal not available yet)

---

## 2026-02-05: Tag Normalization - Lowercase on Parse vs Display

DECISION: Normalize hashtags to lowercase during parsing (storage), not display
CHOSE: parseHashtags() converts to lowercase, content text keeps original case
NOT: Normalize on display only (storage still has duplicates)
NOT: Preserve exact case (creates #Bug, #bug, #BUG duplicates in sidebar)
NOT: Force lowercase in content text (destructive, loses user intent)

Reasoning:
- Storage deduplication: #Bug, #bug, #BUG all become #bug in hashtags array
- Content preservation: User can type #Bug in content, but it's stored as #bug internally
- Sidebar cleanup: No more duplicate tags with different cases
- Filtering simplification: Direct comparison (no .toLowerCase() needed)
- Backwards compatible: Existing mixed-case tags auto-normalize on next parse (non-destructive)
- Rename consistency: renameHashtag() normalizes new tag names to lowercase

---

## 2026-02-04: Input Validation - Soft vs Hard Limits

DECISION: Use soft limits (confirmation dialogs) for note content, hard limits (errors) for project names
CHOSE: Confirm dialogs for title/content with option to override, block for project names
NOT: Hard limits for everything (too restrictive)
NOT: No limits at all (poor UX, potential issues)

Reasoning:
- User autonomy: Users may have legitimate reasons for long titles/content
- UI protection: Project names affect UI layout, need hard limits
- Storage awareness: Warn users when approaching localStorage quota risk
- Test-driven: Started with low limits (20/100) to test, then raised to production (200/100k)
- Validation: Empty project names blocked, prevents UI bugs

---

## 2026-02-04: Stack Overflow Risk - No Protection Needed

DECISION: Don't add depth limits to recursive functions (countNotes)
CHOSE: Trust browser stack limits (10k-50k calls depending on browser)
NOT: Add artificial depth limits (unnecessary complexity)
NOT: Rewrite as iterative (not worth the complexity)

Reasoning:
- Practical limits: Typical nesting 2-5 levels, extreme 20-50 levels
- Stack limits: Browsers support 10k+ recursive calls before overflow
- Risk assessment: Would need 10,000+ nested levels to overflow (impossible in practice)
- processSaveQueue: Already safe (uses setTimeout, breaks call stack)
- Cost/benefit: Adding protection adds complexity for zero real-world benefit

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
