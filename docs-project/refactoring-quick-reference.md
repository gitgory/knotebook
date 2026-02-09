# Refactoring Quick Reference

## Starting a Refactoring Session

### 1. Choose a Function
Check `functions to refactor.txt` for prioritized candidates.

### 2. Invoke the Plan Agent

**Template:**
```
Refactor [FUNCTION_NAME] in scripts/app.js

Context:
- Current size: [X] lines
- Priority: [Top/Medium/Lower]
- Known issues: [describe or "none identified yet"]

Goals:
1. Apply Single Responsibility Principle (SRP)
2. Reduce to ~20 lines
3. Extract focused helpers
4. Improve testability
5. Follow code conventions

Requirements:
1. Read function and understand responsibilities
2. Identify dependencies and callers
3. Propose 2-3 approaches with pros/cons
4. Consider design patterns
5. Present options per workflow preferences

Constraints:
- No feature additions
- No over-engineering
- Vanilla JavaScript only
- Maintain XSS protection
- Follow naming conventions
```

### 3. Agent Explores & Proposes
The agent will present 2-3 approaches with pros/cons.

### 4. You Choose
Review options and select your preferred approach.

### 5. Document Decision
Agent adds entry to `decision-history.md`.

### 6. Approve Plan
Agent creates implementation plan and requests confirmation.

### 7. Implement
After approval, agent refactors the code.

### 8. Commit & Test
Agent asks to commit, creates test plan, updates docs.

---

## Design Patterns Cheat Sheet

| Pattern | When to Use | Example |
|---------|-------------|---------|
| **Extract Method** | Function has multiple responsibilities | updateHashtagDisplay() |
| **Command Pattern** | Action dispatch with string keys | Context menu handlers |
| **Factory Pattern** | Consistent object/element creation | Modal creation |
| **Event Delegation** | Many similar elements, frequent re-renders | Hashtag pills |
| **Guard Clauses** | Complex nesting, validation logic | placeGhostNodes() |

---

## Code Quality Checklist

Quick checks before approving:

- [ ] Main function ~20 lines or less
- [ ] Each helper has one responsibility
- [ ] JSDoc on all new functions
- [ ] No `innerHTML` with user data
- [ ] camelCase naming
- [ ] No unnecessary features
- [ ] Error handling preserved
- [ ] Performance maintained

---

## Common Refactoring Patterns

### Before: Monolithic Function
```javascript
function doEverything() {
  // 100+ lines of mixed concerns
  // Data processing
  // DOM manipulation
  // Event handling
  // Validation
  // Error handling
  // UI updates
}
```

### After: Orchestrator + Helpers
```javascript
/**
 * Main orchestrator - coordinates workflow
 * @returns {void}
 */
function doEverything() {
  const data = processData();
  if (!validateData(data)) return;

  const element = createUIElement(data);
  attachEventHandlers(element);
  updateDisplay(element);
}

// Each helper handles one responsibility
function processData() { ... }
function validateData(data) { ... }
function createUIElement(data) { ... }
function attachEventHandlers(element) { ... }
function updateDisplay(element) { ... }
```

---

## Success Metrics

| Metric | Target | Why |
|--------|--------|-----|
| **Line count** | ~20 lines | Readability |
| **Duplication** | 0% | DRY principle |
| **Responsibilities** | 1 per function | SRP |
| **Nesting depth** | ≤2 levels | Complexity |
| **JSDoc coverage** | 100% | Maintainability |

---

## Recent Wins

Quick reference for proven patterns:

1. **updateHashtagDisplay()**: 70 → 15 lines, event delegation
2. **showNodeContextMenu()**: 57 → 18 lines, Command Pattern
3. **importFromFile()**: 91 → 12 lines, validation layer
4. **placeGhostNodes()**: 57 → 15 lines, guard clauses

See `decision-history.md` for full details.

---

## Troubleshooting

### Agent proposes over-engineered solution
→ Ask: "Can we simplify this? What's the minimal change needed?"

### Agent adds features
→ Remind: "Just refactoring, no feature additions"

### Agent breaks XSS protection
→ Check: All user data uses `textContent`, not `innerHTML`

### Plan needs iteration
→ Say: "Let's explore approach #2 in more detail"

---

## Next Steps After Refactoring

1. Test the changes (manual or via test plan)
2. Update `functions to refactor.txt` (mark as done)
3. Consider related functions for next session
4. Document any patterns for future use
