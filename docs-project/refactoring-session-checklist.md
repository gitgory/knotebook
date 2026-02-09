# Refactoring Session Checklist

Use this checklist to ensure consistent, high-quality refactoring sessions.

---

## Pre-Session Setup

- [ ] Review `functions to refactor.txt` for next candidate
- [ ] Check `decision-history.md` for similar past refactorings
- [ ] Read `scripts/app_js_table_of_contents.txt` for context
- [ ] Note any known issues or concerns with the function

---

## Session Start

- [ ] Tell Claude which function to refactor
- [ ] Provide context (line count, priority, known issues)
- [ ] Claude invokes Plan agent with standard template
- [ ] Agent begins exploration phase

---

## Exploration Phase (Agent Does This)

- [ ] Read target function in `scripts/app.js`
- [ ] Identify all function calls and dependencies
- [ ] Search for all callers of the function
- [ ] Analyze current responsibilities
- [ ] Review similar refactorings in `decision-history.md`
- [ ] Consider applicable design patterns

---

## Proposal Review (You Do This)

- [ ] Review 2-3 proposed approaches
- [ ] Read pros/cons for each approach
- [ ] Ask clarifying questions if needed
- [ ] Consider alignment with project philosophy
- [ ] Choose preferred approach
- [ ] Provide feedback or request alternatives

---

## Decision Documentation (Claude Does This)

- [ ] Add entry to `decision-history.md`
- [ ] Follow template: CHOSE + NOT entries
- [ ] Keep reasoning brief (max 2 lines per option)
- [ ] Commit documentation before implementation

---

## Implementation Planning (Claude Does This)

- [ ] List all helper functions to extract
- [ ] Define each helper's responsibility
- [ ] Show final main function structure
- [ ] Estimate line count reduction
- [ ] Request your approval before coding

---

## Plan Approval (You Do This)

- [ ] Review the implementation plan
- [ ] Verify helpers have single responsibilities
- [ ] Check naming follows conventions
- [ ] Confirm no feature additions
- [ ] Approve or request changes
- [ ] Give explicit "proceed" confirmation

---

## Implementation (Claude Does This)

- [ ] Extract helper functions
- [ ] Refactor main function to orchestrator
- [ ] Add JSDoc documentation to all functions
- [ ] Use `textContent` and `createElement()` (never `innerHTML` with user data)
- [ ] Follow camelCase naming
- [ ] Add guard clauses for validation
- [ ] Preserve error handling
- [ ] Maintain performance characteristics

---

## Code Quality Review (You Do This)

- [ ] Main function reduced to ~20 lines
- [ ] Each helper has one clear responsibility
- [ ] JSDoc present on all new functions
- [ ] XSS protection maintained
- [ ] Naming follows conventions
- [ ] No added features beyond refactoring
- [ ] No over-engineered abstractions
- [ ] Error handling preserved

---

## Commit Phase

- [ ] Claude asks if you want to commit
- [ ] You approve commit request
- [ ] Claude commits with Co-Authored-By tag
- [ ] Claude pushes to GitHub (for testing)
- [ ] Claude creates test plan
- [ ] Claude updates `decision-history.md`

---

## Testing Phase (You Do This)

- [ ] Follow test plan Claude created
- [ ] Test happy path scenarios
- [ ] Test edge cases and error conditions
- [ ] Verify XSS protection
- [ ] Check browser console for errors
- [ ] Test on mobile if function affects mobile UI
- [ ] Verify performance not degraded

---

## Session Wrap-Up

- [ ] Mark function as complete in `functions to refactor.txt`
- [ ] Note any follow-up work needed
- [ ] Identify next function for future session
- [ ] Update `SESSION_NOTES.md` if mid-session

---

## Success Metrics

Verify these outcomes:

- [ ] **Line count**: Main function ≤20 lines
- [ ] **Duplication**: 0% duplicated code
- [ ] **Responsibilities**: 1 per function
- [ ] **Documentation**: 100% JSDoc coverage
- [ ] **Tests**: All passing
- [ ] **Security**: XSS protection maintained
- [ ] **Performance**: No degradation

---

## Red Flags (Stop and Reassess)

Watch for these warning signs:

- ⚠️ Main function still >30 lines
- ⚠️ Helper functions have multiple responsibilities
- ⚠️ New features or "improvements" added
- ⚠️ `innerHTML` used with user data
- ⚠️ Naming conventions violated
- ⚠️ Complex abstractions added
- ⚠️ Error handling removed or degraded
- ⚠️ Performance degraded

If you see red flags, ask Claude to revise the approach.

---

## Common Pitfalls to Avoid

1. **Over-engineering** - Don't add abstractions unless clearly needed
2. **Feature creep** - Stick to refactoring, no feature additions
3. **Breaking XSS protection** - Always use `textContent`/`createElement()`
4. **Skipping documentation** - Every new function needs JSDoc
5. **Incomplete testing** - Test edge cases, not just happy path
6. **Rushing approval** - Review plan carefully before proceeding

---

## Quick Reference

| Phase | Who | Duration | Key Activity |
|-------|-----|----------|--------------|
| Setup | You | 2 min | Choose function, provide context |
| Exploration | Agent | 5-10 min | Read code, analyze dependencies |
| Proposal | Agent | 5 min | Present 2-3 approaches |
| Review | You | 5-10 min | Choose approach, ask questions |
| Documentation | Claude | 2 min | Update decision-history.md |
| Planning | Claude | 5 min | Create implementation plan |
| Approval | You | 5 min | Review and approve plan |
| Implementation | Claude | 10-20 min | Write code, add docs |
| Review | You | 5-10 min | Check code quality |
| Commit | Claude | 2 min | Commit and push |
| Testing | You | 10-20 min | Follow test plan |

**Total estimated time per function: 1-1.5 hours**

---

## Files Modified Per Session

Typical refactoring session touches:

- ✏️ `scripts/app.js` - Main implementation
- ✏️ `docs-project/decision-history.md` - Decision documentation
- ✏️ `docs-project/functions to refactor.txt` - Mark function complete
- 📄 New test plan file (if applicable)

---

## Post-Session Review Questions

After each session, ask yourself:

1. Was the chosen approach the right one?
2. Did we maintain code quality standards?
3. Are there patterns we should reuse?
4. What would we do differently next time?
5. Should we update workflow documentation?

---

## Next Steps

After completing a refactoring:

1. Choose next function from priority list
2. Consider grouping related functions
3. Look for cross-cutting concerns
4. Update roadmap if needed
5. Celebrate progress! 🎉
