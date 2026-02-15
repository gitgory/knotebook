# Refactoring Workflow Guide

## Overview

This document describes the specialized workflow for refactoring large functions in knotebook. The workflow uses Claude Code's Plan agent to explore, analyze, and propose refactoring strategies before implementation.

## When to Use This Workflow

Use this refactoring workflow when:
- Tackling functions from `functions to refactor.txt` (50+ lines)
- Refactoring involves multiple files or dependencies
- Multiple refactoring approaches are viable
- You want to explore code structure before committing to an approach

## Quick Start

### Invoking the Refactoring Plan Agent

Use the Task tool with `subagent_type="Plan"` and copy this prompt template:

```
Refactor [FUNCTION_NAME] in scripts/app.js

Context:
- Current size: [X] lines
- Priority: [Top/Medium/Lower] (from functions to refactor.txt)
- Known issues: [describe any known problems, or "none identified yet"]

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
- Don't add features or "improvements" beyond refactoring
- Don't over-engineer with unnecessary abstractions
- Keep vanilla JavaScript, no frameworks
- Maintain XSS protection (textContent, createElement, never innerHTML with user data)
- Follow existing naming conventions
```

### Example Invocation

```javascript
// In Claude Code conversation:
Use the Task tool:
- subagent_type: "Plan"
- prompt: "Refactor populateSidebar() in scripts/app.js"

Context:
- Current size: 186 lines
- Priority: Top (from functions to refactor.txt)
- Known issues: Mixed concerns (DOM manipulation, data processing, event handling)

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
5. Present options following Grigri''s workflow preferences

Constraints:
- Do not add features or improvements beyond refactoring
- Do not over-engineer with unnecessary abstractions
- Keep vanilla JavaScript, no frameworks
- Maintain XSS protection (textContent, createElement, never innerHTML with user data)
- Follow existing naming conventions
```

## Workflow Steps

### 1. Plan Agent Exploration Phase

The Plan agent will:
1. **Read the target function** - Understand current implementation
2. **Analyze dependencies** - Find all callers and dependencies
3. **Identify responsibilities** - Map out what the function does
4. **Research patterns** - Look at similar refactorings in decision-history.md
5. **Propose approaches** - Present 2-3 refactoring strategies with pros/cons

### 2. Review and Choose Approach

You (Grigri) will:
1. Review the proposed approaches
2. Ask questions or request clarifications
3. Choose your preferred approach
4. Provide feedback on any concerns

### 3. Document the Decision

Claude will:
1. Add entry to `decision-history.md` documenting:
   - CHOSE: Selected approach with reasoning
   - NOT: Rejected approaches with reasoning
2. Follow the brief template (max 2 lines per option)

### 4. Implementation Plan

Claude will:
1. Create detailed step-by-step implementation plan
2. List all helper functions to extract
3. Identify files to modify
4. Request your confirmation before coding

### 5. Implementation

After you approve the plan, Claude will:
1. Extract helper functions following SRP
2. Add JSDoc documentation
3. Maintain code conventions
4. Preserve XSS protection

### 6. Commit and Test

Following your git workflow:
1. Claude asks if you want to commit
2. You approve or request changes
3. Claude commits with Co-Authored-By tag
4. Claude creates test plan
5. Claude updates decision-history.md

## Design Patterns to Consider

The agent will evaluate these patterns during exploration:

### Extract Method
- Break large function into focused helpers
- Each helper has single responsibility
- Used in: updateHashtagDisplay(), showNodeContextMenu(), importFromFile()

### Command Pattern
- Map action strings to command functions
- Registry lookup instead of if/else chains
- Used in: Node context menu, hashtag context menu

### Factory Pattern
- Centralize object/element creation
- Consistent structure and behavior
- Used in: Modal creation, DOM element creation

### Event Delegation
- Single listener for multiple elements
- Reduces memory footprint
- Used in: Hashtag pills (1 listener vs N)

### Guard Clauses
- Early returns for invalid states
- Reduces nesting and complexity
- Used in: placeGhostNodes(), importFromFile()

## Code Quality Checklist

The agent will ensure:

- [ ] Function reduced to ~20 lines or less
- [ ] Each helper has single responsibility
- [ ] JSDoc documentation on all new functions
- [ ] XSS protection maintained (no innerHTML with user data)
- [ ] Naming follows camelCase convention
- [ ] Constants use CONSTANT_CASE
- [ ] No features added beyond refactoring
- [ ] No unnecessary abstractions
- [ ] Error handling preserved or improved
- [ ] Performance not degraded

## Success Metrics

Successful refactoring achieves:

1. **Line count**: Main function reduced to ~20 lines
2. **Duplication**: Eliminated duplicated code blocks
3. **Testability**: Each responsibility can be tested independently
4. **Readability**: Clear function names and single responsibilities
5. **Maintainability**: Changes localized to one function
6. **Reusability**: Helpers usable across contexts

## Examples

### Recent Successful Refactorings

See `decision-history.md` for detailed examples:

1. **updateHashtagDisplay()** - 70 → 15 lines
   - 9 helpers extracted
   - Event delegation (1 listener vs N)
   - AbortController for cleanup

2. **showNodeContextMenu()** - 57 → 18 lines
   - 11 helpers extracted
   - Command Pattern for action dispatch
   - Factory Pattern for menu creation

3. **importFromFile()** - 91 → 12 lines
   - 5 helpers extracted
   - Validation layer added
   - 88% duplication eliminated

4. **placeGhostNodes()** - 57 → 15 lines
   - 7 helpers extracted
   - 8-step command pattern
   - Guard clauses and idempotency

## Tips for Working with the Agent

1. **Be specific about context** - Mention known issues or concerns
2. **Ask questions** - The agent will clarify before proposing approaches
3. **Review proposals carefully** - You know the codebase best
4. **Iterate if needed** - Agent can explore alternative approaches
5. **Approve the plan** - Don't let agent code without confirmation

## Related Documentation

- `functions to refactor.txt` - Prioritized list of refactoring candidates
- `decision-history.md` - Past refactoring decisions and patterns
- `scripts/app_js_table_of_contents.txt` - Code structure reference
- `SESSION_NOTES.md` - Session handoff notes
