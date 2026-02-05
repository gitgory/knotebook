# Auto-Save Race Condition Fix - Implementation Plan

## Problems Identified
1. `scheduleAutoSave()` clears previous timeout on rapid calls
2. No check if save is already in progress
3. `JSON.stringify()` can block UI thread on large data
4. No save queue - rapid changes lose intermediate state
5. `beforeunload` warns but doesn't block close during save
6. No user feedback on save status

## Solution Design

### 1. Queue-Based Save System

**State Variables:**
```javascript
state.saveQueue = [];           // Array of save requests
state.saveInProgress = false;   // Flag to prevent concurrent saves
state.saveStatus = 'saved';     // 'saved' | 'pending' | 'saving' | 'error'
state.lastSaveTime = null;      // Timestamp of last successful save
```

**Save Request Object:**
```javascript
{
    timestamp: Date.now(),
    projectId: state.currentProjectId,
    // No need to snapshot data - we'll read current state when processing
}
```

### 2. Async Save Implementation

**Convert saveProjectToStorage() to async:**
- Use `requestIdleCallback()` for JSON.stringify() to avoid blocking
- Use `Promise` for localStorage.setItem() (wrapped in try/catch)
- Process queue sequentially (one save at a time)
- Update save status at each step

**Flow:**
```
scheduleAutoSave()
  → Add to queue + debounce timer
  → processSaveQueue() (if not already running)
    → saveInProgress = true
    → status = 'saving'
    → await saveProjectToStorage() [async]
      → requestIdleCallback for JSON.stringify()
      → localStorage.setItem()
    → status = 'saved' or 'error'
    → saveInProgress = false
    → Process next in queue (if any)
```

### 3. UI Feedback

**Save Status Indicator:**
- Location: Toolbar, next to theme selector
- States:
  - `saved`: Green checkmark "✓ Saved" (fades out after 2s)
  - `pending`: Gray dot "● Pending..." (pulsing)
  - `saving`: Blue spinner "⟳ Saving..." (animated)
  - `error`: Red "✕ Error" (stays visible, click for details)

**CSS:**
```css
.save-status {
    font-size: 12px;
    color: var(--text-tertiary);
    display: flex;
    align-items: center;
    gap: 4px;
    transition: opacity 0.3s;
}

.save-status.saved { color: var(--success); }
.save-status.pending { color: var(--text-tertiary); }
.save-status.saving { color: var(--highlight); }
.save-status.error { color: var(--error); cursor: pointer; }

.save-status.fade-out { opacity: 0; }

@keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
}

.save-status.pending .icon { animation: pulse 1.5s infinite; }

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.save-status.saving .icon { animation: spin 1s linear infinite; }
```

### 4. beforeunload Protection

**Prevent tab close if:**
- `state.saveInProgress === true` (save currently running)
- `state.saveQueue.length > 0` (saves queued)
- `state.saveStatus === 'pending'` or `'saving'`

**Implementation:**
```javascript
window.addEventListener('beforeunload', (e) => {
    if (state.saveInProgress || state.saveQueue.length > 0 ||
        state.saveStatus === 'pending' || state.saveStatus === 'saving') {
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
    }
});
```

### 5. Implementation Steps

**Phase 1: Core Save Queue System**
1. Add new state variables
2. Convert `saveProjectToStorage()` to async
3. Implement `processSaveQueue()` function
4. Update `scheduleAutoSave()` to use queue

**Phase 2: UI Feedback**
1. Add save status indicator HTML to toolbar
2. Add CSS for status states and animations
3. Implement `updateSaveStatus(status, error)` function
4. Update save functions to call updateSaveStatus()

**Phase 3: beforeunload Protection**
1. Update beforeunload handler to check save state
2. Test with rapid changes + tab close attempt
3. Test with large graphs (100+ nodes)

**Phase 4: Testing**
1. Rapid editing (keystroke-level changes)
2. Large graph performance (100+ nodes)
3. Tab close scenarios (pending, saving, error)
4. Error scenarios (quota exceeded, corrupted data)
5. Multiple tabs editing same project (separate issue, but worth noting)

## Key Implementation Details

### requestIdleCallback for JSON.stringify()

```javascript
function stringifyAsync(data) {
    return new Promise((resolve, reject) => {
        requestIdleCallback(() => {
            try {
                const json = JSON.stringify(data);
                resolve(json);
            } catch (e) {
                reject(e);
            }
        }, { timeout: 1000 }); // Fallback if browser is busy
    });
}
```

### Debounced Queue Processing

```javascript
function scheduleAutoSave() {
    // Add to queue
    state.saveQueue.push({
        timestamp: Date.now(),
        projectId: state.currentProjectId
    });

    // Update status to pending
    updateSaveStatus('pending');

    // Debounce: clear and reset timer
    if (state.autoSaveTimeout) {
        clearTimeout(state.autoSaveTimeout);
    }

    state.autoSaveTimeout = setTimeout(() => {
        processSaveQueue();
        state.autoSaveTimeout = null;
    }, AUTOSAVE_DELAY);
}
```

### Sequential Queue Processing

```javascript
async function processSaveQueue() {
    // Already processing
    if (state.saveInProgress) return;

    // Empty queue
    if (state.saveQueue.length === 0) {
        updateSaveStatus('saved');
        return;
    }

    // Process next save
    state.saveInProgress = true;
    updateSaveStatus('saving');

    try {
        await saveProjectToStorage();
        updateSaveStatus('saved');
        state.lastSaveTime = Date.now();

        // Remove processed item
        state.saveQueue.shift();
    } catch (e) {
        console.error('Save failed:', e);
        updateSaveStatus('error', e.message);

        // Keep item in queue for retry?
        // Or remove and show error?
        // Decision: Remove to prevent infinite retry loop
        state.saveQueue.shift();
    } finally {
        state.saveInProgress = false;

        // Process next in queue (if any)
        if (state.saveQueue.length > 0) {
            // Small delay to avoid tight loop
            setTimeout(() => processSaveQueue(), 100);
        }
    }
}
```

## Testing Checklist

- [ ] Rapid editing (50+ keystroke changes)
- [ ] Large graph save (100+ nodes)
- [ ] Tab close during pending save (should block)
- [ ] Tab close during active save (should block)
- [ ] Tab close after save complete (should allow)
- [ ] Quota exceeded error handling
- [ ] Save status indicator updates correctly
- [ ] Status fades out after save complete
- [ ] Error status stays visible and clickable
- [ ] Multiple rapid `scheduleAutoSave()` calls
- [ ] Navigation during save (should wait)
- [ ] Browser refresh during save (should warn)

## Edge Cases to Consider

1. **User switches projects while save pending**
   - Solution: Process queue for old project before switching

2. **Multiple tabs editing same project**
   - Out of scope (requires conflict resolution)
   - Document as limitation

3. **localStorage quota exceeded mid-save**
   - Already handled with try/catch
   - Queue item removed, error shown

4. **Browser kills tab despite beforeunload**
   - Can't prevent (browser security)
   - Document as limitation

## Estimated Complexity

- **Lines of code:** ~150 lines
- **Files changed:** scripts/app.js, styles/main.css, index.html
- **Testing time:** 30-45 minutes
- **Risk level:** Medium (touching save logic is sensitive)

## Rollback Plan

If issues discovered:
1. Keep async code, remove queue
2. Fall back to simple in-progress flag
3. Keep UI feedback (low risk)
4. Keep beforeunload protection (low risk)
