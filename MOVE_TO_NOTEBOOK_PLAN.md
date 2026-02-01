# Implementation Plan: "Move to Notebook" Feature (Option A - Cursor Drag)

## Overview
Allow users to move selected notes from one notebook to another by selecting target notebook from a modal, then dragging ghost nodes to position them in the target notebook.

---

## Phase 1: UI - Add "Move to..." to Context Menu

### Location
`showNodeContextMenu()` function

### Changes
1. Add "Move to..." menu item (after "Bring to Front" / "Send to Back")
2. On click, call `showMoveToNotebookModal()`
3. Modal displays list of all notebooks (exclude current notebook)
4. Use same styling as project selection modal on landing page

### New HTML Needed
```html
<div id="move-to-modal" class="hidden">
    <div id="move-to-content">
        <h2>Move to Notebook</h2>
        <div id="move-to-list"></div>
        <button id="move-to-cancel">Cancel</button>
    </div>
</div>
```

---

## Phase 2: Data - Capture & Store Pending Move

### New Global State
```javascript
let pendingMove = null;  // { sourceProjectId, nodes: [], edges: [] }
```

### When User Selects Target Notebook
1. Create `pendingMove` object:
   - `sourceProjectId`: current project ID
   - `nodes`: Deep copy of selected nodes with all data
   - `edges`: Edges where both endpoints are in selection
2. Calculate bounding box center of selection
3. Store relative offsets from center for each node
4. Save `pendingMove` to `sessionStorage` (survives notebook switch)
5. Call `loadProject(targetProjectId)` to switch notebooks

---

## Phase 3: Rendering - Ghost Nodes

### On Project Load, Check for pendingMove
1. If `sessionStorage.pendingMove` exists:
   - Parse the data
   - Set `state.ghostNodes` = pending nodes
   - Set `state.ghostDragging` = true
   - Remove from sessionStorage

### New Rendering Function: renderGhostNodes()
1. Render nodes with special ghost styling:
   - Semi-transparent (opacity: 0.5)
   - Dashed border
   - Different fill color (e.g., cyan tint)
2. Position relative to cursor (center of bounding box follows cursor)
3. Render in a separate SVG layer (above normal nodes)

### Track Cursor Position
- Add `mousemove` listener when ghost dragging
- Update ghost nodes positions to follow cursor
- Maintain relative offsets between nodes

---

## Phase 4: Placement - Confirm or Cancel

### On Mouse Click (While Ghost Dragging)
1. Convert ghost nodes to real nodes
2. Add to `state.nodes`
3. Remove from `state.ghostNodes`
4. Set `state.selectedNodes` to newly placed nodes
5. Call `removeNodesFromSourceNotebook()` (see Phase 5)
6. Show success toast: "Moved X notes from [Source Notebook]"
7. Call `render()`

### On ESC Key (While Ghost Dragging)
1. Clear `state.ghostNodes`
2. Set `state.ghostDragging` = false
3. Show toast: "Move cancelled"
4. Stay in current notebook (notes remain in source)
5. Call `render()`

### Visual Feedback During Drag
- Toast message: "Moving X notes... Click to place or ESC to cancel"
- Cursor: crosshair or pointer
- Ghost nodes follow cursor smoothly

---

## Phase 5: Source Cleanup - Remove from Source Notebook

### Function: removeNodesFromSourceNotebook()
1. Load source project data from localStorage
2. Remove nodes by ID from `sourceData.nodes`
3. Remove edges that reference those node IDs
4. Save updated source data back to localStorage
5. **Note:** This happens asynchronously, user doesn't see it

---

## Phase 6: Edge Cases & Polish

### Edge Case Handling
1. **Source notebook = target notebook:** Don't show in list
2. **Moving nested notes:** Preserve children (move entire subtree)
3. **No notebooks exist:** Disable "Move to..." option
4. **Browser refresh during ghost drag:** Clear pendingMove from sessionStorage on app init
5. **Ghost nodes off-screen:** Clamp cursor position to keep nodes visible?

### Visual Polish
1. Ghost nodes render above regular nodes (z-index)
2. Smooth cursor follow (no jitter)
3. Toast notifications for all states
4. Loading indicator if notebook switch is slow?

### Accessibility
- Keyboard shortcut for "Move to..."? (e.g., Shift+M?)
- Arrow keys to position ghost nodes instead of mouse?

---

## Phase 7: Mobile Support

### Mobile Action Bar
- Add "Move to..." button (if room, or in overflow menu)
- Modal works same on mobile
- Ghost nodes follow touch position instead of cursor

---

## Implementation Order

1. **Phase 1** - Add context menu item + modal UI
2. **Phase 2** - Create pendingMove state + notebook switching
3. **Phase 3** - Ghost node rendering + cursor follow
4. **Phase 4** - Click to place + ESC to cancel
5. **Phase 5** - Remove nodes from source
6. **Phase 6** - Edge cases + polish
7. **Phase 7** - Mobile support

---

## Estimated Complexity

- **Medium-High** - Multiple moving parts, state management across notebook switches
- **Risky areas:** SessionStorage persistence, ghost rendering, async source cleanup
- **Benefits:** Super intuitive UX, solves spatial placement elegantly

---

## Technical Considerations

### Data Flow
```
1. User: Right-click → "Move to..." → Select notebook
2. App: Store pendingMove → sessionStorage
3. App: Switch to target notebook (loadProject)
4. App: Load pendingMove from sessionStorage
5. App: Render ghost nodes following cursor
6. User: Click to place (or ESC to cancel)
7. App: Add nodes to target, remove from source
8. App: Clear pendingMove, render normal nodes
```

### State Management
```javascript
// Global state additions
let pendingMove = null;

// State object additions
state.ghostNodes = [];
state.ghostDragging = false;
state.ghostCursorPos = { x: 0, y: 0 };
```

### SessionStorage Structure
```javascript
sessionStorage.pendingMove = JSON.stringify({
    sourceProjectId: "project-123",
    sourceProjectName: "Work Notes",
    nodes: [...], // Full node objects
    edges: [...], // Edge pairs
    boundingBox: { centerX, centerY, width, height },
    relativeOffsets: { nodeId: { dx, dy }, ... }
});
```

---

## CSS Needed

### Ghost Node Styling
```css
.node.ghost {
    opacity: 0.5;
    pointer-events: none;
}

.node.ghost .node-body {
    fill: rgba(34, 211, 238, 0.2); /* Cyan tint */
    stroke: var(--highlight);
    stroke-width: 2;
    stroke-dasharray: 5, 5;
}

#ghost-layer {
    pointer-events: none;
    z-index: 150; /* Above regular nodes */
}
```

### Move To Modal
```css
#move-to-modal {
    /* Similar to existing modals */
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 300;
}

#move-to-content {
    /* Similar to project modal */
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 30px;
    max-width: 500px;
    margin: 100px auto;
}

#move-to-list {
    /* Same as projects-list */
}
```

---

## Testing Checklist

### Basic Flow
- [ ] Right-click node → "Move to..." appears
- [ ] Modal shows all notebooks except current
- [ ] Select notebook → switches and shows ghost nodes
- [ ] Ghost nodes follow cursor
- [ ] Click → places nodes in target
- [ ] Source notebook has nodes removed

### Multi-Select
- [ ] Select 3 notes → move all 3
- [ ] Relative positions maintained during drag
- [ ] All 3 selected after placement

### Edges
- [ ] Edges between selected nodes move with them
- [ ] Edges to non-selected nodes are removed

### Cancel
- [ ] ESC key cancels move
- [ ] Toast shows "Move cancelled"
- [ ] Notes remain in source notebook

### Edge Cases
- [ ] Move notes with children (nested)
- [ ] Move single note
- [ ] Move notes with complex edge connections
- [ ] Cancel during ghost drag
- [ ] Browser refresh during ghost drag (should clear)

### Mobile
- [ ] Action bar "Move to..." button works
- [ ] Modal displays correctly on small screen
- [ ] Ghost nodes follow touch position
- [ ] Tap to place works

---

## Future Enhancements (Not in Initial Implementation)

1. **Copy instead of Move** - Shift+Click in modal to copy instead of move?
2. **Undo support** - Allow undo of last move operation
3. **Preview target notebook** - Small thumbnail preview in modal
4. **Batch operations** - Move multiple selections to different notebooks
5. **Drag & Drop** - Drag nodes onto sidebar notebook list?
