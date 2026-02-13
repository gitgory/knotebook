# Decision History

This file tracks significant technical and design decisions made during development.

---

## 2026-02-11: Multi-File Import, Remove Overwrite

DECISION: Remove overwrite functionality, support multi-file import only
CHOSE: Import always creates new notebooks, multiple files supported
NOT: Keep overwrite option (confusing, dangerous), single file only (slower workflow)

Reasoning:
- Simplicity: One-click import, no modal choices
- Safety: No accidental data loss, can't overwrite wrong notebook
- Flexibility: Duplicate names allowed, batch import multiple files
- Easy undo: Just delete unwanted imports
- Cleaner code: Removed 158 lines (6 functions, 1 modal)

---

## 2026-02-11: Conflict Resolution in Move-to-Notebook (Not Import)

DECISION: Apply field merge logic during Move-to-Notebook, not import overwrite
CHOSE: Merge fields when moving notes between notebooks with different schemas
NOT: Merge during import/overwrite (wrong use case)

Reasoning:
- Correct use case: Moving notes between existing notebooks needs schema reconciliation
- Import creates new: Imported notebooks are isolated, no merging needed
- Overwrite replaces: Complete replacement doesn't need merge logic
- User context: Moving notes = combining workflows, conflict resolution makes sense

---

## 2026-02-11: Notebook Names in UI Elements

DECISION: Show actual notebook names instead of generic labels
CHOSE: Display notebook name in breadcrumbs and conflict modal
NOT: Generic labels like "Current" or "Root"

Reasoning:
- Context clarity: "Keep 'Project A'" vs "Keep Current Definition"
- Breadcrumbs: "NotebookName > Root" shows where you are
- Conflict resolution: Users see exactly which notebook's definitions they're choosing
- Reduces cognitive load: No need to remember which is "current" vs "imported"

Implementation:
- Breadcrumbs: "NotebookName > Root > Parent > Child"
- Conflict modal: "Keep 'TargetNotebook'" vs "Use 'SourceNotebook'"
- Batch buttons: "Keep All 'TargetNotebook'" and "Use All 'SourceNotebook'"

---

## 2026-02-11: Custom Fields Import - Merge Strategy

DECISION: Merge custom field definitions when importing notebooks
CHOSE: Merge imported field definitions with existing ones, prompt on conflicts
NOT: Replace all fields (loses existing schema), skip fields (incomplete import)

Reasoning:
- Flexibility: Users can combine notebooks with different field schemas
- Data preservation: Doesn't lose existing field definitions
- Conflict handling: User chooses which definition to keep when names clash
- Use case: Merging project notebooks, consolidating research notes
- Backwards compatible: Old exports without customFields import normally

Implementation:
- mergeCustomFieldDefinitions(existingFields, importedFields)
- Conflict modal shows both definitions, user picks one
- Field values on nodes import regardless of schema match
- Orphaned field values preserved (no data loss)

---

## 2026-02-09: Unified Field Storage (node.fields)

DECISION: Store ALL fields (First-Class and Second-Class) in node.fields.{fieldName}
CHOSE: Unified storage with migration from legacy top-level properties
NOT: Keep First-Class at top-level (node.completion, node.priority) and Second-Class nested

Reasoning:
- Symmetry: Same access pattern for all field types
- Simplified code: Single getNodeFieldValue()/setNodeFieldValue() works for everything
- Future-proof: Adding any new field works the same way
- Migration: Automatic on load, backwards compatible

Implementation:
- node.fields.{fieldName} for all fields
- migrateNodeFields() moves legacy node.completion/priority to node.fields
- getNodeFieldValue(node, fieldName) / setNodeFieldValue(node, fieldName, value)

---

## 2026-02-09: Settings UI - Field Defaults as Dropdowns

DECISION: Replace single "New notes are tasks by default" toggle with dropdown per field
CHOSE: Dropdown selects for each First-Class field's default value
NOT: Keep toggle approach, add more toggles per field

Reasoning:
- Flexibility: Can default to any state, not just on/off
- Scalability: Same pattern works for any First-Class field
- Clearer UI: Shows exact default value, not cryptic toggle

Implementation:
- projectSettings.fieldDefaults.{fieldName} structure
- Settings modal with select dropdowns
- Migrates legacy defaultCompletion to fieldDefaults.completion

---

## 2026-02-09: Second-Class Fields - Hybrid Options

DECISION: Field options use hybrid approach (predefined + auto-collected)
CHOSE: Combine predefined options with values used across nodes
NOT: Only predefined options (rigid), only auto-collected (no suggestions)

Reasoning:
- Best of both: Suggestions for consistency, flexibility for new values
- Like hashtags: Auto-complete from existing, can add new
- Reduces typos: Dropdown with known values, but not locked

Implementation:
- getFieldOptions(fieldDef) combines predefined + getFieldUsedValues()
- allowNew flag on field definition enables adding new values

---

## 2026-02-09: First Class Fields - Generalized Save/Load Architecture

DECISION: Generalize editor save/load workflow to automatically handle ANY field in FIRST_CLASS_FIELDS
CHOSE: Generic helper functions that loop over FIRST_CLASS_FIELDS config
NOT: Keep explicit field-specific code (updateBatchCompletion, updateBatchPriority, updateCompletionButtons)
NOT: Wait to generalize until adding 3rd field

Reasoning:
- True extensibility: Add new field by ONLY updating config and HTML (zero save/load code changes)
- Maintainability: Single loop pattern replaces copy-paste for each field
- Code reduction: Net ~50 lines saved, 3 obsolete functions deleted
- Consistency: All fields handled identically through same code path
- Future-proof: Supports unlimited fields (due date, assignee, tags, etc.)

Implementation:
- 7 new generic helpers: getFieldValue(), setFieldButtons(), getAllFieldValues(), loadAllFieldValues(), updateNodeFields(), updateBatchField(), initializeFieldButtons()
- Refactored 8 functions: getEditorFormData(), saveSingleNode(), openSingleEditor(), openBatchEditor(), saveEditor(), cancelEditor(), editor-enter handler, button event setup
- Deleted 3 obsolete functions: updateBatchCompletion(), updateBatchPriority(), updateCompletionButtons()
- Snapshot structure: Dynamically includes all FIRST_CLASS_FIELDS in editorSnapshot
- FormData structure: Spreads all field values into return object
- Event handlers: Single initializeFieldButtons() replaces individual button handlers

Example - Adding due date field (future):
1. Add to FIRST_CLASS_FIELDS config
2. Add HTML buttons to editor
3. Done! Save/load works automatically

---

## 2026-02-09: Priority as Second First Class Field

DECISION: Add priority field using established FIRST_CLASS_FIELDS pattern
CHOSE: Bottom-right position with Unicode symbols (▲▬▼) and traffic light colors
NOT: Top-left (conflicts with dog-ear), left edge stripe (too prominent)
NOT: Colored numbers or exclamation marks (less intuitive than directional arrows)

Reasoning:
- Architecture validation: Proves Phase 1 pattern is truly extensible
- Code reuse: Same 3+4 helper pattern as completion (config + render)
- Position: Bottom-right available space, no conflicts with completion (top-right) or hashtags (bottom-left)
- Visual clarity: Directional symbols (up=high, down=low) are intuitive
- Color semantics: Red/yellow/blue traffic light metaphor for urgency

Implementation:
- 4 states: None, Low, Medium, High (cycle returns to None)
- Position: offsetX:18, offsetY:18 from bottom-right
- Symbols: ▲ (U+25B2 high red), ▬ (U+25AC medium yellow), ▼ (U+25BC low blue)
- Full editor integration (batch + single mode)
- Data model: Optional `priority` field (null, 'low', 'medium', 'high')

---

## 2026-02-09: First Class Fields Architecture - Completion Refactor

DECISION: Refactor completion field to use data-driven FIRST_CLASS_FIELDS configuration
CHOSE: Extract hardcoded logic into config object with helper functions
NOT: Keep completion logic hardcoded in multiple functions
NOT: Wait to refactor until adding second First Class Field

Reasoning:
- Extensibility: Establishes pattern for future First Class Fields (priority, due date, etc.)
- Single source of truth: All completion config (states, icons, colors, position) in one object
- Maintainability: cycleCompletion 7→2 lines, renderCompletionIndicator 50→11 lines
- Testability: Config helpers independently testable
- Data-driven: Config lookup replaces if-chains and hardcoded constants
- Pure refactor: No functional changes, same behavior, same data format

Implementation:
- FIRST_CLASS_FIELDS config object with states (no/partial/yes/cancelled)
- 3 config helpers: getNextCompletionState(), getCompletionStateConfig(), isCompletedState()
- 3 render helpers: createCompletionGroup(), appendCompletionBackground(), appendCompletionIcon()
- Removed NODE_COMPLETION_OFFSET_X/Y constants (now in config)

---

## 2026-02-09: Complete Refactoring - Final 5 Functions

DECISION: Refactor remaining 5 high-priority functions using Extract Method pattern
CHOSE: Apply proven pattern from previous refactorings (lifecycle/phase-based helpers)
NOT: Leave functions as-is (mixed concerns, duplication, low testability)
NOT: Over-engineer with complex abstractions

Reasoning:
- Proven pattern: 5 previous successful refactorings demonstrated effectiveness
- Consistency: All 10 functions now follow same Extract Method pattern
- Line reduction: 362→73 lines across 5 functions (80% average reduction)
- Eliminated duplication: 24 lines in updateSaveStatus, reused helpers in showHashtagContextMenu
- Single Responsibility: Each helper function does one thing
- Improved testability: Each phase independently testable
- Data-driven: updateSaveStatus uses statusConfig object instead of switch statement

Functions refactored:
1. showConfirmation() - 81→8 lines (4 helpers: lifecycle phases)
2. showHashtagContextMenu() - 73→18 lines (3 helpers: menu, actions, events)
3. showToast() - 70→20 lines (5 helpers: create, link, style, keyboard, auto-remove)
4. initiateMoveToNotebook() - 68→12 lines (2 helpers: validate, prepare)
5. updateSaveStatus() - 70→15 lines (5 helpers: get, clear, reset, apply, schedule)

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

## 2026-02-07: Function Refactoring - Extract Method Pattern

DECISION: Refactor large monolithic functions into smaller, focused helper functions
CHOSE: Extract helper functions following Single Responsibility Principle
NOT: Keep large functions with multiple responsibilities
NOT: Over-engineer with unnecessary abstractions

Reasoning:
- Readability: 70-line functions reduced to 12-18 lines
- Testability: Each helper can be unit tested independently
- Maintainability: Each concern isolated in one location
- Reusability: Helpers usable across multiple contexts
- Patterns applied: Factory Pattern, Command Pattern, Event Delegation

Functions refactored:
- `updateHashtagDisplay()`: 70 → 15 lines, 9 helpers extracted, event delegation (1 listener vs N)
- `showNodeContextMenu()`: 57 → 18 lines, 11 helpers extracted, Command Pattern for action dispatch

---

## 2026-02-07: Event Delegation vs Individual Listeners

DECISION: Use event delegation for hashtag pills, not for context menus
CHOSE: Event delegation for hashtag pills (AbortController cleanup), individual listeners for context menus
NOT: Event delegation everywhere (over-engineering)
NOT: Individual listeners everywhere (memory inefficient)

Reasoning:
- Hashtag pills: Many pills (1-20+), frequently re-rendered, benefits from delegation
- Context menus: Short-lived, created/destroyed on each use, handler removed with menu
- Memory management: AbortController for clean listener cleanup on modal close
- Performance: 1 listener vs N listeners reduces memory footprint for hashtag pills
- Simplicity: Context menu handler lifecycle matches menu lifecycle (no global handler needed)

---

## 2026-02-07: Command Pattern for Menu Actions

DECISION: Use Command Pattern with registry lookup instead of if/else chains
CHOSE: Command registry mapping action strings to command functions
NOT: Long if/else chains for action dispatch
NOT: Switch statements (similar problems to if/else)

Reasoning:
- Extensibility: Add new commands without modifying dispatcher
- Testability: Each command function independently testable
- Reusability: Commands can be invoked from keyboard shortcuts, toolbar, etc.
- Readability: Action names map directly to command functions
- Maintainability: Single location for command registry

Implementation:
```javascript
const commands = {
  'bring-front': commandBringToFront,
  'send-back': commandSendToBack,
  'move-to': commandMoveTo,
  'connect-to': commandConnectTo
};
```

---

## 2026-02-08: Mobile Detection - Pointer/Hover Instead of Screen Width

DECISION: Use pointer type and hover capability instead of screen width for mobile detection
CHOSE: `@media (pointer: coarse) and (hover: none)` + JavaScript `isMobileDevice()` function
NOT: `@media (max-width: 600px)` and `window.innerWidth <= 600` (width-based detection)
NOT: User agent detection (unreliable, easily spoofed)
NOT: Touch support only (laptops with touchscreens would be detected as mobile)

Reasoning:
- User request: Allow desktop features on small browser windows
- Accuracy: Detects actual input capability (touch without hover = mobile)
- Flexibility: Small desktop windows retain desktop keyboard shortcuts and behaviors
- CSS consistency: All three `@media` queries updated to use pointer/hover
- JavaScript: Single `isMobileDevice()` function checks both conditions
- Desktop features: Enter key saves note, desktop action bar hidden, full zoom range
- Mobile features: Touch interactions, simplified UI, mobile-optimized layouts
- Testing: Laptops with touchscreens correctly detected as desktop (can hover)

---

## 2026-02-08: Import Refactoring - Validation Layer and Extract Method

DECISION: Refactor importFromFile() to eliminate duplication and add validation layer
CHOSE: Extract 5 helper functions following Single Responsibility Principle
NOT: Keep monolithic functions with 88% duplication
NOT: Skip validation layer (would allow corrupt imports)

Reasoning:
- Duplication: 80/91 lines (88%) duplicated between importFromFile() and importFromFileFallback()
- Mixed concerns: File I/O, parsing, validation, UI updates all in one function
- Missing validation: No data structure validation after JSON.parse()
- Design principles: Applied SRP, Extract Method, Separation of Concerns, Guard Clauses, Command Pattern

---

## 2026-02-08: Ghost Node Placement Refactoring - SRP and Command Pattern

DECISION: Refactor placeGhostNodes() and cancelGhostDrag() to apply Single Responsibility Principle
CHOSE: Extract 7 helper functions, implement 8-step command pattern
NOT: Keep 57-line monolithic function with 6 mixed responsibilities
NOT: Keep duplicated state clearing and toast notification code

Reasoning:
- Mixed concerns: 6 responsibilities in one function (data integration, selection, cleanup, UI, state, persistence)
- Duplication: Ghost state clearing and toast patterns duplicated in both functions (~25 lines)
- Silent failures: Missing guard clauses, no logging for validation failures
- No idempotency: Re-running would duplicate nodes
- Design principles: Applied SRP, Extract Method, Separation of Concerns, Guard Clauses, Command Pattern

Helpers extracted:
- `clearGhostState(clearSelectionBox)` - Centralizes ghost state cleanup
- `showMoveToast(message, sourceProjectId, sourceProjectName)` - Toast with return link
- `integrateGhostNodes()` - Integrates ghost nodes/edges into current project
- `selectPlacedNodes(nodeIds)` - Updates selection after placement
- `syncSourceAfterMove(sourceProjectId, originalNodeIds)` - Source cleanup wrapper
- `queueTargetProjectSave()` - Queues immediate save after move
- `updateProjectNoteCount(projectId, nodes)` - Updates note count in projects index

---

## 2026-02-08: Refactoring Workflow - Plan Agent vs Skill

DECISION: Use Plan agent for coordinating multi-function refactoring
CHOSE: Specialized Plan agent with standardized prompt template
NOT: Skill/slash command (less flexible, clutters main conversation)
NOT: Ad-hoc refactoring without plan (misses dependencies, inconsistent patterns)

Reasoning:
- Exploration needed: Each refactoring requires understanding unique dependencies and context
- Autonomous work: Agent can independently read files, analyze patterns, propose approaches
- Focused context: Agent works in isolated context, presents complete proposal
- Follows workflow: Agent presents options → Grigri chooses → document → plan → confirm → implement
- Reusable template: Standardized prompt ensures consistency across refactorings
- Documentation: Created refactoring-workflow.md and refactoring-quick-reference.md

---

## 2026-02-08: populateSidebar() Refactoring - Extract Method Pattern

DECISION: Refactor populateSidebar() using Extract Method pattern with 6 focused helpers
CHOSE: Extract 6 helper functions - DOM creation, event handlers, context menus (186 → ~20 lines)
NOT: Factory Pattern with event delegation (12-14 functions, over-engineering)
NOT: Hybrid approach (keeps 55-line event handler, insufficient separation)

Reasoning:
- Proven pattern: Matches successful refactorings (updateHashtagDisplay, showNodeContextMenu)
- 7 responsibilities: Data prep, empty state, state computation, DOM building, event handlers, context menus
- Balanced approach: 6 helpers achieves 89% reduction without over-engineering
- Clear separation: Each helper has single responsibility (create UI, attach handlers, context menu)
- Testability: Each function independently testable
- Maintainability: Event handlers grouped by logical purpose

---

## 2026-02-08: renderNodes() Refactoring - Extract Method Pattern

DECISION: Refactor renderNodes() using Extract Method pattern with 8 focused helpers
CHOSE: Extract 8 helpers for each visual element (186 → 20 lines, 89% reduction)
NOT: Factory Pattern with render registry (over-engineering, unnecessary indirection)
NOT: Hybrid with sub-renderers (12-14 functions, excessive granularity)

Reasoning:
- Proven pattern: Matches 5 successful refactorings (updateHashtagDisplay, showNodeContextMenu, importFromFile, placeGhostNodes, populateSidebar)
- Eliminates duplication: renderNodeHashtags() shared with renderGhostNodes() (~25 lines saved)
- Clear separation: Each helper renders one visual element (SRP)
- Testable: Each render function independently testable
- Right abstraction: Not too granular, not over-engineered

---

## 2026-02-08: showPrompt() Refactoring - Extract Modal Lifecycle Helpers

DECISION: Refactor showPrompt() by extracting lifecycle phase helpers
CHOSE: Extract 4 helpers by lifecycle phase (57 → 12 lines, 79% reduction)
NOT: Factory Pattern with shared modal infrastructure (touches 3 functions, higher risk, over-engineering)
NOT: Minimal refactoring with handler extraction only (doesn't achieve line count goal or full SRP)

Reasoning:
- Proven pattern: Matches Extract Method pattern from successful refactorings
- Clear separation: Each helper handles one lifecycle phase (get → configure → create handlers → attach)
- Low risk: Only touches showPrompt(), no changes to working functions
- Testable: Each phase independently testable
- Consistent: Aligns with existing refactoring style

---

## 2026-02-08: openEditor() and saveEditor() Refactoring - Extract Method Pattern

DECISION: Refactor both editor functions using Extract Method pattern
CHOSE: Extract mode-specific handlers for openEditor (4 helpers), operation-specific helpers for saveEditor (10 helpers)
NOT: Strategy Pattern with mode classes (over-engineering for 2 modes)
NOT: Granular extraction with 15+ helpers (excessive, too much parameter passing)

Reasoning:
- Proven pattern: Matches successful refactorings (renderNodes, populateSidebar, showPrompt)
- Clear separation: Batch vs single mode logic fully isolated
- Right-sized: 14 total helpers achieves goals without over-engineering
- Testability: Can test batch operations, single operations, validation independently
- Maintainability: Changes to one mode don't affect the other

openEditor() - 121 → 15 lines (88% reduction, 4 helpers):
- prepareEditorSession() - Clear state, hide action bar
- getEditorElements() - Get DOM references
- openBatchEditor() - Configure editor for batch mode
- openSingleEditor() - Configure editor for single mode

saveEditor() - 95 → 18 lines (81% reduction, 10 helpers):
- getEditorMode() - Determine mode and get nodes
- getEditorFormData() - Extract form values
- removeBatchTags() - Remove tags from nodes
- addBatchTags() - Add tags to nodes
- updateBatchCompletion() - Set completion state
- updateBatchTimestamps() - Update modified timestamps
- validateSingleNodeInput() - Async validation with confirmations
- saveSingleNode() - Save single node data
- cleanupEditorState() - Clear state and close editor

---
