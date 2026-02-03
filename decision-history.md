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
