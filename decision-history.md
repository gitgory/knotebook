# Decision History

This file tracks significant technical and design decisions made during development.

---

## 2026-02-02: XSS Protection - Eliminate innerHTML

**DECISION**: Convert all `innerHTML` usage to safe DOM APIs
**CHOSE**: `createElement()`, `textContent`, `dataset`, `replaceChildren()`
**NOT**: Continue using `innerHTML` with manual escaping
**NOT**: Use a sanitization library

**Reasoning**:
- **Security-critical**: User-generated content (project names, note titles, hashtags) was vulnerable to XSS injection via innerHTML
- **Defense in depth**: Browser's built-in escaping via textContent and dataset is more reliable than manual escaping
- **Modern approach**: `replaceChildren()` is the standard modern way to clear DOM (clearer intent than `innerHTML = ''`)
- **No dependencies**: Keeps codebase dependency-free while achieving complete XSS protection

**Impact**:
- 13 innerHTML usages eliminated across app.js
- All user data now rendered safely via textContent
- Removed obsolete `escapeHtml()` function
- Added security guidelines to design-spec.txt and CLAUDE.md
- Version bumped to v106

**Testing**:
- Verified XSS attack vectors blocked (malicious project names, note titles, hashtags)
- Full regression testing passed
- Fixed one regression: context menu "Change color" now opens sidebar first

---

## 2026-02-02: Error Handling - Protect JSON.parse() Calls

**DECISION**: Wrap all JSON.parse() calls in try/catch blocks
**CHOSE**: Graceful degradation - log error, clear corrupted data, return safe defaults
**NOT**: Let app crash on corrupted localStorage data
**NOT**: Use a JSON validation library

**Reasoning**:
- **Robustness**: Corrupted localStorage (browser bugs, extensions, manual editing) shouldn't crash the app
- **User experience**: Better to show empty state than white screen of death
- **Debugging**: Console errors help identify when/why data corruption occurs
- **Data safety**: Don't auto-delete project data (user may want to recover), only delete index

**Impact**:
- `getProjectsList()` - wrapped, clears corrupted index
- `loadProjectFromStorage()` - wrapped, returns null (preserves corrupt data for recovery)
- 4 other calls already had try/catch protection
- Version bumped to v107

**Testing**:
- App gracefully handles corrupted localStorage
- Projects list shows empty when index is corrupted
- Individual corrupted projects return null without crashing

---
