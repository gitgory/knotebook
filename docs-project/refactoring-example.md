# Refactoring Workflow Example

## Complete Example: Refactoring populateSidebar()

This example shows the complete workflow for refactoring `populateSidebar()` from start to finish.

---

## Step 1: Check the Function List

Look at `functions to refactor.txt`:

```
Top Priority (>100 lines):
1. populateSidebar() - 186 lines  ← We'll refactor this one
2. renderNodes() - 186 lines
3. showPrompt() - 136 lines
...
```

---

## Step 2: Start a Conversation

In Claude Code, say:

> "I'd like to refactor populateSidebar() using the Plan agent workflow. It's 186 lines and at the top of the priority list."

---

## Step 3: Claude Invokes the Plan Agent

Claude will use the Task tool:

```
Task tool invocation:
- subagent_type: "Plan"
- description: "Plan populateSidebar() refactoring"
- prompt: "Refactor populateSidebar() in scripts/app.js

Context:
- Current size: 186 lines
- Priority: Top (from functions to refactor.txt)
- Known issues: Likely mixed concerns (needs exploration)

Goals:
1. Apply Single Responsibility Principle (SRP)
2. Reduce function to ~20 lines or less
3. Extract focused helper functions
4. Improve testability and maintainability
5. Follow existing code conventions (camelCase, JSDoc, XSS protection)

Requirements:
1. Read the function and understand its current responsibilities
2. Identify all dependencies and callers
3. Propose 2-3 refactoring approaches with pros/cons
4. Consider design patterns (Extract Method, Command Pattern, Factory Pattern, Event Delegation)
5. Present options following Grigri's workflow preferences

Constraints:
- Don't add features or improvements beyond refactoring
- Don't over-engineer with unnecessary abstractions
- Keep vanilla JavaScript, no frameworks
- Maintain XSS protection (textContent, createElement, never innerHTML with user data)
- Follow existing naming conventions"
```

---

## Step 4: Agent Explores the Code

The Plan agent will:
1. Read `scripts/app.js` and locate `populateSidebar()`
2. Read `scripts/app_js_table_of_contents.txt` for context
3. Search for all calls to `populateSidebar()`
4. Analyze dependencies and responsibilities
5. Review similar refactorings in `decision-history.md`

---

## Step 5: Agent Presents Options

The agent returns with a proposal like:

```
PROPOSAL: Refactor populateSidebar()

Current State:
- 186 lines with 5 main responsibilities:
  1. Clear sidebar DOM
  2. Build project list section
  3. Build hashtag list section
  4. Build note count display
  5. Attach all event listeners

Approach 1: Extract Section Builders (Recommended)
PROS:
- Clean separation of concerns (one function per section)
- Easy to test sections independently
- Reduces main function to ~15 lines
CONS:
- Creates 5 new helper functions

Approach 2: Template-Based Rendering
PROS:
- More declarative style
- Potentially more maintainable long-term
CONS:
- Larger refactor, higher risk
- May require additional utilities

Approach 3: Component-Based Architecture
PROS:
- Maximum modularity
CONS:
- Over-engineering for current needs
- Doesn't fit vanilla JS philosophy

RECOMMENDATION: Approach 1 - Extract Section Builders
```

---

## Step 6: You Choose

You respond:

> "Approach 1 looks good. Let's go with that."

---

## Step 7: Claude Documents Decision

Claude adds to `decision-history.md`:

```markdown
## 2026-02-08: populateSidebar() Refactoring - Extract Section Builders

DECISION: Refactor populateSidebar() using Extract Method pattern
CHOSE: Extract 5 section builder functions (projects, hashtags, counts, events)
NOT: Template-based rendering (over-engineering for current needs)
NOT: Component architecture (doesn't fit vanilla JS philosophy)

Reasoning:
- Single Responsibility: Each section builder handles one UI area
- Testability: Each builder can be tested independently
- Readability: Main function reduced from 186 to ~15 lines
- Maintainability: Changes to one section isolated to one function
```

---

## Step 8: Claude Creates Implementation Plan

```
Implementation Plan:

1. Extract helper functions:
   - clearSidebar() - DOM cleanup
   - buildProjectSection() - Project list UI
   - buildHashtagSection() - Hashtag list UI
   - buildNoteCountSection() - Note counter UI
   - attachSidebarEvents() - Event listener setup

2. Refactor main function:
   - Call each helper in sequence
   - Reduce to ~15 lines

3. Add JSDoc documentation:
   - Document each new function
   - Include @param and @returns

4. Test:
   - Verify sidebar still renders correctly
   - Verify all click handlers work
   - Verify hashtag filtering works

Ready to proceed? (yes/no)
```

---

## Step 9: You Approve

> "Yes, proceed with the implementation."

---

## Step 10: Claude Implements

Claude:
1. Extracts the 5 helper functions
2. Refactors `populateSidebar()` to orchestrate them
3. Adds JSDoc documentation
4. Preserves XSS protection
5. Follows naming conventions

---

## Step 11: Commit and Test

Claude asks:

> "Implementation complete. Would you like me to commit these changes?"

You respond:

> "Yes, commit and create a test plan."

Claude:
1. Commits with appropriate message
2. Creates detailed test plan
3. Updates `decision-history.md`
4. Pushes to GitHub (for testing via github-pages)

---

## Step 12: You Test

Follow the test plan Claude created, testing:
- Project list renders
- Hashtag list renders
- Click handlers work
- Filtering works
- No XSS vulnerabilities

---

## Result

✅ Function reduced from 186 → 15 lines
✅ 5 focused helper functions extracted
✅ Full JSDoc documentation
✅ XSS protection maintained
✅ All tests passing
✅ Decision documented

---

## Next Function

Update `functions to refactor.txt` to mark `populateSidebar()` as done, then move to the next function on the list!

---

## Tips

- **Be specific about context** when starting
- **Ask questions** if options aren't clear
- **Review the plan carefully** before approving
- **Test thoroughly** after implementation
- **Iterate if needed** - agent can revise approaches
