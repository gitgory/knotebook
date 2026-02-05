/**
 * knotebook - Main Application
 * A visual note-taking app with graph structure
 */

// ============================================================================
// DATA STRUCTURES
// ============================================================================

// Application state - single source of truth
// All mutable application state is consolidated here for easier debugging
// and predictable data flow (immediate-mode rendering pattern)
const state = {
    nodes: [],           // All nodes at current level
    edges: [],           // All edges at current level (pairs of node IDs)
    selectedNodes: [],   // Currently selected node IDs (supports multi-select)
    selectedEdge: null,  // Currently selected edge index
    edgeStartNode: null, // Node ID when creating an edge
    dragging: null,      // Node being dragged
    dragOffsets: {},     // Drag offsets for all selected nodes (for multi-drag)
    duplicating: false,  // True when Ctrl+drag duplicating nodes
    ctrlHeld: false,     // True when Ctrl key held during mousedown
    ctrlClickNode: null, // Node ID that was Ctrl+clicked (for toggle deselection)
    dragStartPos: null,  // Mouse position when mousedown (for drag threshold)
    dragThresholdMet: false, // True when movement exceeds threshold
    currentPath: [],     // Navigation path (stack of parent nodes)
    nextId: 1,           // ID counter
    fileHandle: null,    // File system handle for saving
    // Viewport state for pan/zoom
    viewport: {
        x: 0,            // Pan offset X
        y: 0,            // Pan offset Y
        zoom: 1          // Zoom level (1 = 100%)
    },
    panning: false,      // Currently panning the canvas
    panStart: { x: 0, y: 0 },  // Mouse position when pan started
    spacebarHeld: false, // True when spacebar is held (for pan mode)
    // Hashtag filter state
    filterHashtags: [],  // Active hashtag filters (OR logic)
    filterText: '',      // Text search filter (matches title and content)
    hiddenHashtags: [],  // Hashtags hidden from node display (but still in data)
    // Selection box state
    selectionBox: null,  // { start: {x, y}, end: {x, y}, mode: 'enclosed'|'intersecting', locked: boolean } or null

    // Project state (per-notebook)
    currentProjectId: null,        // Currently open project ID
    hashtagColors: {},             // Hashtag -> color mappings
    projectSettings: { defaultCompletion: null }, // Per-project settings
    rootNodes: [],                 // Root level nodes (when navigated into children)
    rootEdges: [],                 // Root level edges (when navigated into children)

    // Editor state
    editorSnapshot: null,          // Snapshot for cancel/revert
    removedTagsInSession: new Set(), // Tags marked for removal in batch edit

    // Ghost nodes (move to notebook)
    ghostNodes: [],                // Ghost nodes being positioned in target notebook
    ghostDragging: false,          // True when dragging ghost nodes
    ghostCursorPos: { x: 0, y: 0 }, // Current cursor position in canvas coordinates
    pendingMove: null,             // Pending move operation data

    // UI state
    activeMenuProjectId: null,     // Project menu currently open
    pendingImportData: null,       // Import data waiting for user choice
    hoverTimeout: null,            // Timeout for title hover expansion
    autoSaveTimeout: null,         // Debounce timeout for auto-save

    // Save queue state (for race condition prevention)
    saveQueue: [],                 // Array of pending save requests
    saveInProgress: false,         // True when save is actively running
    saveStatus: 'saved',           // 'saved' | 'pending' | 'saving' | 'error'
    lastSaveTime: null,            // Timestamp of last successful save
    lastSaveError: null,           // Error message from last failed save
    lastSaveHash: null,            // Hash of last saved data to detect changes
    savedFadeTimeout: null         // Timeout for fading out "Saved" status
};

// Node dimensions
const NODE_WIDTH = 220;
const NODE_HEIGHT = 60;

// Drag threshold for Ctrl+Drag (prevents accidental duplication on multi-select clicks)
const DRAG_THRESHOLD = 10; // pixels

// Preset color palette for hashtags (works across all dark themes)
const HASHTAG_COLORS = [
    '#6366f1', // Indigo
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#fb923c', // Amber (replaces gray - reserved for unassigned tags)
];

// Autocomplete state (kept separate as it's transient UI state)
const autocomplete = {
    active: false,
    targetInput: null,   // DOM element (#note-text or #hashtag-input)
    query: '',           // text after '#'
    hashStart: -1,       // char index of '#'
    items: [],           // filtered tag strings
    selectedIndex: -1,   // highlighted item
    suppress: false      // temporarily suppress autocomplete (for synthetic events)
};

// Constants
const HOVER_DELAY = 500; // milliseconds before expanding title on hover
const AUTOSAVE_DELAY = 1500; // 1.5 seconds
const STORAGE_KEY_PREFIX = 'knotebook-project-';
const PROJECTS_INDEX_KEY = 'knotebook-projects';

// Check if localStorage is available
function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        return false;
    }
}

// Show persistent warning about localStorage unavailability
function showStorageUnavailableWarning() {
    const warning = document.createElement('div');
    warning.id = 'storage-warning';
    warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #dc2626;
        color: white;
        padding: 12px;
        text-align: center;
        z-index: 10000;
        font-size: 14px;
    `;
    warning.textContent = '⚠️ Storage unavailable (private browsing or quota exceeded). Changes will not be saved. Export your work frequently!';
    document.body.appendChild(warning);
}

// Move to notebook constant
const MOVE_STORAGE_KEY = 'knotebook-pending-move';

// ============================================================================
// THEME
// ============================================================================

function getCurrentTheme() {
    const themeAttr = document.documentElement.getAttribute('data-theme');
    return themeAttr || 'midnight';
}

function setTheme(themeName) {
    // Validate theme exists (in case of deleted/renamed themes)
    const validThemes = ['midnight', 'slate', 'neon', 'mint', 'ocean', 'sky', 'obsidian', 'aurora', 'graphite', 'sunset'];
    if (!validThemes.includes(themeName)) {
        console.warn(`Theme "${themeName}" not found, falling back to midnight`);
        themeName = 'midnight';
    }

    // Remove theme from root if it's 'midnight' (default), otherwise set it
    if (themeName === 'midnight') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', themeName);
    }

    // Update active option state
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === themeName);
    });

    // Save to localStorage (global default)
    localStorage.setItem('knotebook-theme', themeName);

    // Save to current notebook if one is open
    if (state.currentProjectId) {
        scheduleAutoSave();
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('knotebook-theme') || 'midnight';
    setTheme(savedTheme);
}

function initThemeSelector() {
    const toggle = document.getElementById('theme-toggle');
    const dropdown = document.getElementById('theme-dropdown');

    // Toggle dropdown
    toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
    });

    // Select theme option
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', () => {
            setTheme(btn.dataset.theme);
            dropdown.classList.add('hidden');
        });
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener('click', () => {
        dropdown.classList.add('hidden');
    });
}

// ============================================================================
// PROJECT STORAGE (localStorage)
// ============================================================================

// Get list of all saved projects (metadata only)
function getProjectsList() {
    const index = localStorage.getItem(PROJECTS_INDEX_KEY);
    if (!index) return [];

    try {
        return JSON.parse(index);
    } catch (e) {
        console.error('Failed to parse projects index:', e);
        // Clear corrupted data and return empty list
        localStorage.removeItem(PROJECTS_INDEX_KEY);
        return [];
    }
}

// Save projects index
function saveProjectsIndex(projects) {
    try {
        localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error('Failed to save projects index:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded! Please export and delete old projects to free up space.');
        } else {
            alert('Failed to save projects list. Your changes may not persist.');
        }
    }
}

// Generate unique project ID
function generateProjectId() {
    return 'project-' + Date.now();
}

// Count all notes in a project (including nested)
function countNotes(nodes) {
    let count = 0;
    for (const node of nodes) {
        count++;
        if (node.children && node.children.length > 0) {
            count += countNotes(node.children);
        }
    }
    return count;
}

// Helper: Stringify JSON asynchronously to avoid blocking UI
function stringifyAsync(data) {
    return new Promise((resolve, reject) => {
        // Use requestIdleCallback if available, otherwise fallback to immediate execution
        const callback = () => {
            try {
                const json = JSON.stringify(data);
                resolve(json);
            } catch (e) {
                reject(e);
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(callback, { timeout: 1000 }); // Fallback after 1s if browser busy
        } else {
            // Fallback for browsers without requestIdleCallback (like Safari)
            setTimeout(callback, 0);
        }
    });
}

// Save current project to localStorage (async to prevent race conditions)
async function saveProjectToStorage() {
    if (!state.currentProjectId) return;

    // Ensure root state is captured
    saveRootState();

    const projectData = {
        version: 1,
        nodes: state.currentPath.length === 0 ? state.nodes : state.rootNodes,
        edges: state.currentPath.length === 0 ? state.edges : state.rootEdges,
        hashtagColors: state.hashtagColors,
        settings: state.projectSettings,
        hiddenHashtags: state.hiddenHashtags,
        theme: getCurrentTheme()
    };

    try {
        // Non-blocking JSON.stringify()
        const jsonData = await stringifyAsync(projectData);

        // localStorage.setItem is synchronous, but wrap in Promise for consistency
        await new Promise((resolve, reject) => {
            try {
                localStorage.setItem(STORAGE_KEY_PREFIX + state.currentProjectId, jsonData);
                resolve();
            } catch (e) {
                reject(e);
            }
        });

        // Update project metadata in index
        const projects = getProjectsList();
        const projectIndex = projects.findIndex(p => p.id === state.currentProjectId);
        if (projectIndex >= 0) {
            projects[projectIndex].noteCount = countNotes(projectData.nodes);
            projects[projectIndex].modified = new Date().toISOString();
            saveProjectsIndex(projects);
        }

        // Success
        return true;
    } catch (e) {
        console.error('Failed to save project:', e);

        // Store error for UI display
        state.lastSaveError = e.message;

        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded! Export this project immediately to avoid losing work.');
        } else {
            alert('Failed to save project. Consider exporting to preserve your work.');
        }

        // Re-throw to allow queue to handle failure
        throw e;
    }
}

// Load project from localStorage
function loadProjectFromStorage(projectId) {
    const data = localStorage.getItem(STORAGE_KEY_PREFIX + projectId);
    if (!data) return null;

    try {
        return JSON.parse(data);
    } catch (e) {
        console.error(`Failed to parse project ${projectId}:`, e);
        // Don't remove corrupted project data automatically - user may want to recover it
        // Just return null so app doesn't crash
        return null;
    }
}

// Create a new project
function createProject(name) {
    const projectId = generateProjectId();
    const projects = getProjectsList();

    projects.unshift({
        id: projectId,
        name: name,
        noteCount: 0,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    });

    saveProjectsIndex(projects);

    // Save empty project data
    const projectData = {
        version: 1,
        nodes: [],
        edges: [],
        hashtagColors: {},
        settings: { defaultCompletion: null },
        hiddenHashtags: []
    };

    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(projectData));
    } catch (e) {
        console.error('Failed to create project:', e);
        if (e.name === 'QuotaExceededError') {
            alert('Storage quota exceeded! Cannot create new project.');
        } else {
            alert('Failed to create project.');
        }
        // Remove from index if storage failed
        const projects = getProjectsList();
        const filtered = projects.filter(p => p.id !== projectId);
        saveProjectsIndex(filtered);
        return null;
    }

    return projectId;
}

// Rename a project
function renameProject(projectId, newName) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.name = newName;
        saveProjectsIndex(projects);
    }
}

// Delete a project
function deleteProject(projectId) {
    const projects = getProjectsList();
    const filtered = projects.filter(p => p.id !== projectId);
    saveProjectsIndex(filtered);

    try {
        localStorage.removeItem(STORAGE_KEY_PREFIX + projectId);
    } catch (e) {
        console.error('Failed to delete project from storage:', e);
        // Non-critical - index is already updated
    }
}

// Open a project
function openProject(projectId) {
    const data = loadProjectFromStorage(projectId);
    if (!data) {
        alert('Notebook not found');
        return;
    }

    state.currentProjectId = projectId;

    // Reset navigation
    state.currentPath = [];

    // Load data
    state.nodes = data.nodes || [];
    state.edges = data.edges || [];
    state.rootNodes = state.nodes;
    state.rootEdges = state.edges;
    state.hashtagColors = data.hashtagColors || {};
    state.projectSettings = data.settings || { defaultCompletion: null };
    state.hiddenHashtags = data.hiddenHashtags || [];

    // Apply notebook's theme (or use current global theme if not set)
    if (data.theme) {
        setTheme(data.theme);
    }

    // Clear selection and filter
    state.selectedNodes = [];
    state.selectedEdge = null;
    state.filterHashtags = [];
    state.filterText = '';

    const input = document.getElementById('hashtag-input');
    if (input) {
        input.value = '';
        input.classList.remove('active');
    }
    const clearBtn = document.getElementById('hashtag-clear');
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }
    const textInput = document.getElementById('text-search-input');
    if (textInput) {
        textInput.value = '';
        textInput.classList.remove('active');
    }
    const textClearBtn = document.getElementById('text-search-clear');
    if (textClearBtn) {
        textClearBtn.classList.add('hidden');
    }

    // Update sidebar button state
    updateSidebarButtonState();

    // Close sidebar
    const sidebar = document.getElementById('hashtag-sidebar');
    if (sidebar) {
        sidebar.classList.add('hidden');
    }

    resetViewport();
    showGraphView();

    // Check for pending move operation
    checkForPendingMove();

    render();
}

// Update save status UI indicator
function updateSaveStatus(status, error = null) {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;

    const iconEl = statusEl.querySelector('.save-icon');
    const textEl = statusEl.querySelector('.save-text');

    // Debug logging
    console.log('updateSaveStatus:', status, 'from:', state.saveStatus);

    // Remove all status classes
    statusEl.classList.remove('saved', 'pending', 'saving', 'error');

    // Only remove fade-out if we're changing to a non-saved state
    if (status !== 'saved') {
        statusEl.classList.remove('fade-out');
    }

    // Add new status class
    statusEl.classList.add(status);

    // Update icon and text based on status
    switch (status) {
        case 'saved':
            iconEl.textContent = '✓';
            textEl.textContent = 'Saved';

            // Clear any existing fade timeout to prevent flicker
            if (state.savedFadeTimeout) {
                clearTimeout(state.savedFadeTimeout);
                state.savedFadeTimeout = null;
            }

            // Remove fade-out first (make visible)
            statusEl.classList.remove('fade-out');

            // Auto-fade after 2 seconds
            state.savedFadeTimeout = setTimeout(() => {
                statusEl.classList.add('fade-out');
                state.savedFadeTimeout = null;
            }, 2000);
            break;
        case 'pending':
            iconEl.textContent = '●';
            textEl.textContent = 'Pending...';
            // Clear saved fade timeout when transitioning away
            if (state.savedFadeTimeout) {
                clearTimeout(state.savedFadeTimeout);
                state.savedFadeTimeout = null;
            }
            break;
        case 'saving':
            iconEl.textContent = '⟳';
            textEl.textContent = 'Saving...';
            // Clear saved fade timeout when transitioning away
            if (state.savedFadeTimeout) {
                clearTimeout(state.savedFadeTimeout);
                state.savedFadeTimeout = null;
            }
            break;
        case 'error':
            iconEl.textContent = '✕';
            textEl.textContent = 'Error';
            if (error) {
                statusEl.title = error;
            }
            // Clear saved fade timeout when transitioning away
            if (state.savedFadeTimeout) {
                clearTimeout(state.savedFadeTimeout);
                state.savedFadeTimeout = null;
            }
            break;
    }
}

// Process the save queue sequentially (prevents race conditions)
async function processSaveQueue() {
    // Already processing
    if (state.saveInProgress) return;

    // Empty queue
    if (state.saveQueue.length === 0) {
        // Only update status if not already saved (prevent flicker)
        if (state.saveStatus !== 'saved') {
            state.saveStatus = 'saved';
            updateSaveStatus('saved');
        }
        return;
    }

    // Mark as in progress
    state.saveInProgress = true;
    state.saveStatus = 'saving';
    updateSaveStatus('saving');

    try {
        // Execute the save
        await saveProjectToStorage();

        // Update hash after successful save
        const savedData = {
            nodes: state.currentPath.length === 0 ? state.nodes : state.rootNodes,
            edges: state.currentPath.length === 0 ? state.edges : state.rootEdges,
            hashtagColors: state.hashtagColors,
            settings: state.projectSettings,
            hiddenHashtags: state.hiddenHashtags,
            theme: getCurrentTheme()
        };
        state.lastSaveHash = hashData(savedData);

        // Success
        state.saveStatus = 'saved';
        state.lastSaveTime = Date.now();
        state.lastSaveError = null;
        updateSaveStatus('saved');

        // Remove processed item
        state.saveQueue.shift();
    } catch (e) {
        console.error('Save failed in queue:', e);

        // Update status
        state.saveStatus = 'error';
        updateSaveStatus('error', e.message);

        // Remove failed item (don't retry infinitely)
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

// Simple hash function for change detection
function hashData(data) {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
}

// Schedule auto-save (debounced with queue to prevent race conditions)
function scheduleAutoSave() {
    if (!state.currentProjectId) return;

    // Calculate hash of current data to detect changes
    const currentData = {
        nodes: state.currentPath.length === 0 ? state.nodes : state.rootNodes,
        edges: state.currentPath.length === 0 ? state.edges : state.rootEdges,
        hashtagColors: state.hashtagColors,
        settings: state.projectSettings,
        hiddenHashtags: state.hiddenHashtags,
        theme: getCurrentTheme()
    };
    const currentHash = hashData(currentData);

    // Skip if nothing changed
    if (currentHash === state.lastSaveHash) {
        return;
    }

    // Add to queue
    state.saveQueue.push({
        timestamp: Date.now(),
        projectId: state.currentProjectId
    });

    // Update status to pending
    state.saveStatus = 'pending';
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

// ============================================================================
// PROJECT LIST UI
// ============================================================================

function populateProjectsList() {
    const list = document.getElementById('projects-list');
    const projects = getProjectsList();

    if (projects.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'projects-empty';
        emptyDiv.textContent = 'No notebooks yet. Create one to get started!';
        list.replaceChildren(emptyDiv);
        return;
    }

    list.replaceChildren();
    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.dataset.id = project.id;

        const info = document.createElement('div');
        info.className = 'project-info';

        const name = document.createElement('div');
        name.className = 'project-name';
        name.textContent = project.name;

        const stats = document.createElement('div');
        stats.className = 'project-stats';
        stats.textContent = `${project.noteCount || 0} notes`;

        info.appendChild(name);
        info.appendChild(stats);

        const btn = document.createElement('button');
        btn.className = 'project-menu-btn';
        btn.dataset.id = project.id;
        btn.title = 'More options';
        btn.textContent = '⋮';

        item.appendChild(info);
        item.appendChild(btn);
        list.appendChild(item);
    });

    // Click on project to open
    list.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.project-menu-btn')) return;
            openProject(item.dataset.id);
        });
    });

    // Click on menu button
    list.querySelectorAll('.project-menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showProjectMenu(btn.dataset.id, e.clientX, e.clientY);
        });
    });
}
function showProjectMenu(projectId, x, y) {
    const menu = document.getElementById('project-menu');
    state.activeMenuProjectId = projectId;

    // Position menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');

    // Adjust if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }
}

function hideProjectMenu() {
    document.getElementById('project-menu').classList.add('hidden');
    state.activeMenuProjectId = null;
}

function showNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    const input = document.getElementById('new-project-name');
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
}

function hideNewProjectModal() {
    document.getElementById('new-project-modal').classList.add('hidden');
}

// Show confirmation modal and return a promise
function showConfirmation(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('confirm-message');
        const yesBtn = document.getElementById('confirm-yes');
        const noBtn = document.getElementById('confirm-no');

        messageEl.textContent = message;
        modal.classList.remove('hidden');

        // Focus Yes button by default
        yesBtn.focus();

        // Handle Yes
        const handleYes = () => {
            cleanup();
            resolve(true);
        };

        // Handle No/Cancel
        const handleNo = () => {
            cleanup();
            resolve(false);
        };

        // Handle keyboard
        const handleKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleYes();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleNo();
            }
        };

        // Cleanup function
        const cleanup = () => {
            modal.classList.add('hidden');
            yesBtn.removeEventListener('click', handleYes);
            noBtn.removeEventListener('click', handleNo);
            document.removeEventListener('keydown', handleKey);
        };

        // Attach listeners
        yesBtn.addEventListener('click', handleYes);
        noBtn.addEventListener('click', handleNo);
        document.addEventListener('keydown', handleKey);
    });
}

function handleCreateProject() {
    const input = document.getElementById('new-project-name');
    const name = input.value.trim();

    if (!name) {
        input.focus();
        return;
    }

    const projectId = createProject(name);
    hideNewProjectModal();
    openProject(projectId);
}

function handleRenameProject(projectId) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newName = prompt('Rename notebook:', project.name);
    if (newName && newName.trim()) {
        renameProject(projectId, newName.trim());
        populateProjectsList();
    }
}

async function handleDeleteProject(projectId) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const confirmed = await showConfirmation(`Delete "${project.name}"? This cannot be undone.`);
    if (confirmed) {
        deleteProject(projectId);
        populateProjectsList();
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateId() {
    return `note-${Date.now()}-${state.nextId++}`;
}

function parseHashtags(text) {
    const regex = /#[\w-]+/g;
    const matches = text.match(regex);
    return matches ? [...new Set(matches)].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())) : [];
}

function truncateText(text, maxLength) {
    const firstLine = text.split('\n')[0];
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength - 3) + '...';
}

function getNodeCenter(node) {
    return {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2
    };
}

// Check if a node has body text beyond just hashtags
function hasBodyText(node) {
    if (!node.content) return false;
    const stripped = node.content.replace(/#[\w-]+/g, '').trim();
    return stripped.length > 0;
}

// Cycle completion state: null → no → yes → partial → no → ...
function cycleCompletion(current) {
    if (current === null || current === undefined) return 'no';
    if (current === 'no') return 'partial';
    if (current === 'partial') return 'yes';
    if (current === 'yes') return 'cancelled';
    return 'no';
}

// Check if a node matches the current filter (OR logic for hashtags, AND with text search)
function nodeMatchesFilter(node) {
    // Text search filter
    if (state.filterText) {
        const search = state.filterText.toLowerCase();
        const titleMatch = (node.title || '').toLowerCase().includes(search);
        const contentMatch = (node.content || '').toLowerCase().includes(search);
        if (!titleMatch && !contentMatch) return false;
    }

    // Hashtag filter (OR logic)
    if (state.filterHashtags.length === 0) return true;
    if (!node.hashtags || node.hashtags.length === 0) return false;
    return state.filterHashtags.some(tag =>
        node.hashtags.some(nodeTag => nodeTag.toLowerCase() === tag.toLowerCase())
    );
}

// Get IDs of all visible nodes (matching filter)
function getVisibleNodeIds() {
    return state.nodes.filter(nodeMatchesFilter).map(n => n.id);
}

// Update sidebar button to show active state when filters are applied
function updateSidebarButtonState() {
    const sidebarBtn = document.getElementById('hashtag-sidebar-btn');
    if (state.filterHashtags.length > 0) {
        sidebarBtn.classList.add('active');
    } else {
        sidebarBtn.classList.remove('active');
    }
}

// Update filter from input
function updateFilter(inputValue) {
    const hashtags = parseHashtags(inputValue);
    state.filterHashtags = hashtags;

    const input = document.getElementById('hashtag-input');
    const clearBtn = document.getElementById('hashtag-clear');

    // Update visual state
    if (hashtags.length > 0) {
        input.classList.add('active');
        clearBtn.classList.remove('hidden');
    } else {
        input.classList.remove('active');
        clearBtn.classList.add('hidden');
    }

    updateSidebarButtonState();
    render();
}

// Clear the filter
function clearFilter() {
    const input = document.getElementById('hashtag-input');
    input.value = '';
    state.filterHashtags = [];
    input.classList.remove('active');
    document.getElementById('hashtag-clear').classList.add('hidden');

    // Also clear text search
    const textInput = document.getElementById('text-search-input');
    if (textInput) {
        textInput.value = '';
        state.filterText = '';
        textInput.classList.remove('active');
        document.getElementById('text-search-clear').classList.add('hidden');
    }

    updateSidebarButtonState();
    render();
}

// Set filter to a specific hashtag (used when clicking hashtag in editor)
function setFilterHashtag(hashtag) {
    const input = document.getElementById('hashtag-input');
    input.value = hashtag;
    updateFilter(hashtag);
}

// Update text search filter
function updateTextFilter(text) {
    state.filterText = text.trim();

    const input = document.getElementById('text-search-input');
    const clearBtn = document.getElementById('text-search-clear');

    if (state.filterText) {
        input.classList.add('active');
        clearBtn.classList.remove('hidden');
    } else {
        input.classList.remove('active');
        clearBtn.classList.add('hidden');
    }

    render();
}

// Clear text search filter
function clearTextFilter() {
    const input = document.getElementById('text-search-input');
    input.value = '';
    state.filterText = '';
    input.classList.remove('active');
    document.getElementById('text-search-clear').classList.add('hidden');
    render();
}

// Toggle a hashtag in the filter (used by sidebar)
function toggleFilterHashtag(hashtag) {
    const input = document.getElementById('hashtag-input');
    const currentTags = parseHashtags(input.value);
    const tagLower = hashtag.toLowerCase();

    const index = currentTags.findIndex(t => t.toLowerCase() === tagLower);

    if (index >= 0) {
        // Remove it
        currentTags.splice(index, 1);
    } else {
        // Add it
        currentTags.push(hashtag);
    }

    input.value = currentTags.join(' ');
    updateFilter(input.value);
}

// Toggle a hashtag's visibility on nodes
function toggleHiddenHashtag(hashtag) {
    const tagLower = hashtag.toLowerCase();
    const index = state.hiddenHashtags.findIndex(t => t.toLowerCase() === tagLower);

    if (index >= 0) {
        // Unhide it
        state.hiddenHashtags.splice(index, 1);
    } else {
        // Hide it
        state.hiddenHashtags.push(hashtag);
    }

    render();
}

// Show all hidden hashtags (unhide everything)
function showAllHashtags() {
    state.hiddenHashtags = [];
    render();
}

// Rename a hashtag across all nodes
function renameHashtag(oldTag, newTag) {
    // Validate new tag format
    newTag = newTag.trim();
    if (!newTag.startsWith('#')) {
        newTag = '#' + newTag;
    }

    // Don't rename if it's the same
    if (oldTag.toLowerCase() === newTag.toLowerCase()) {
        return;
    }

    // Rename in all nodes at current level
    state.nodes.forEach(node => {
        // Check if this node has the tag in its content (match whole hashtag)
        const escapedTag = oldTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedTag + '(?=\\s|$)', 'gi');
        if (regex.test(node.content)) {
            // Update content text (case-insensitive replacement)
            node.content = node.content.replace(regex, newTag);

            // Re-parse hashtags from updated content
            node.hashtags = parseHashtags(node.content);
        }
    });

    // Update filter if this tag was being filtered
    const filterIndex = state.filterHashtags.findIndex(t => t.toLowerCase() === oldTag.toLowerCase());
    if (filterIndex !== -1) {
        state.filterHashtags[filterIndex] = newTag;
        // Update the filter input to show the new tag
        const input = document.getElementById('hashtag-input');
        if (input) {
            input.value = state.filterHashtags.join(' ');
        }
    }

    // Update hidden tags if this tag was hidden
    const hiddenIndex = state.hiddenHashtags.findIndex(t => t.toLowerCase() === oldTag.toLowerCase());
    if (hiddenIndex !== -1) {
        state.hiddenHashtags[hiddenIndex] = newTag;
    }

    // Transfer color to new tag name
    const oldColor = state.hashtagColors[oldTag];
    if (oldColor) {
        state.hashtagColors[newTag] = oldColor;
        delete state.hashtagColors[oldTag];
    }

    render();
}

// Delete a hashtag from all nodes
function deleteHashtag(tag) {
    // Remove from all nodes at current level
    state.nodes.forEach(node => {
        // Remove from content text (case-insensitive, match whole hashtag)
        const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('\\s*' + escapedTag + '(?=\\s|$)', 'gi');
        node.content = node.content.replace(regex, '').trim();

        // Re-parse hashtags from updated content
        node.hashtags = parseHashtags(node.content);
    });

    // Clear from filter if active
    state.filterHashtags = state.filterHashtags.filter(t => t.toLowerCase() !== tag.toLowerCase());

    // Clear from hidden tags
    state.hiddenHashtags = state.hiddenHashtags.filter(t => t.toLowerCase() !== tag.toLowerCase());

    // Remove color assignment
    delete state.hashtagColors[tag];

    render();
}

// Show hashtag context menu
function showHashtagContextMenu(tag, x, y) {
    // Remove existing menu if any
    const existingMenu = document.getElementById('hashtag-context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'hashtag-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    const menuItems = [
        { action: 'rename', text: 'Rename tag...' },
        { action: 'delete', text: 'Delete tag...' },
        { action: 'color', text: 'Change color...' }
    ];

    menuItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'context-menu-item';
        div.dataset.action = item.action;
        div.textContent = item.text;
        menu.appendChild(div);
    });

    document.body.appendChild(menu);

    // Adjust position if menu goes off screen
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }

    // Handle menu actions
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            hideHashtagContextMenu();

            if (action === 'rename') {
                const newTag = prompt(`Rename tag "${tag}" to:`, tag);
                if (newTag && newTag.trim()) {
                    renameHashtag(tag, newTag);
                }
            } else if (action === 'delete') {
                const confirmed = await showConfirmation(`Delete tag "${tag}" from all notes?`);
                if (confirmed) {
                    deleteHashtag(tag);
                }
            } else if (action === 'color') {
                // Open sidebar if not already open
                const sidebar = document.getElementById('hashtag-sidebar');
                if (sidebar.classList.contains('hidden')) {
                    showSidebar();
                }

                // Wait for sidebar to render, then open color picker
                setTimeout(() => {
                    const list = document.getElementById('hashtag-list');
                    const colorBtn = list.querySelector(`.hashtag-color-btn[data-tag="${tag}"]`);
                    if (colorBtn) {
                        colorBtn.click();
                    }
                }, 0);
            }
        });
    });
}

// Hide hashtag context menu
function hideHashtagContextMenu() {
    const menu = document.getElementById('hashtag-context-menu');
    if (menu) {
        menu.remove();
    }
}

// ============================================================================
// HASHTAG SIDEBAR
// ============================================================================

function toggleSidebar() {
    const sidebar = document.getElementById('hashtag-sidebar');
    sidebar.classList.toggle('hidden');
    if (!sidebar.classList.contains('hidden')) {
        populateSidebar();
    }
}

function showSidebar() {
    const sidebar = document.getElementById('hashtag-sidebar');
    sidebar.classList.remove('hidden');
    populateSidebar();
}

function hideSidebar() {
    document.getElementById('hashtag-sidebar').classList.add('hidden');
    closeAllColorPickers();
}

function closeAllColorPickers() {
    document.querySelectorAll('.color-picker-dropdown').forEach(el => {
        el.classList.add('hidden');
    });
}

// Get all unique hashtags with counts from current level
function getHashtagCounts() {
    const counts = {};
    for (const node of state.nodes) {
        if (node.hashtags) {
            for (const tag of node.hashtags) {
                counts[tag] = (counts[tag] || 0) + 1;
            }
        }
    }
    return counts;
}

// Get color for a hashtag (assigns default if not set and autoAssign is true)
function getHashtagColor(hashtag, autoAssign = true) {
    if (!state.hashtagColors[hashtag] && autoAssign) {
        // Assign a color based on hash of the hashtag name
        const hash = hashtag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        state.hashtagColors[hashtag] = HASHTAG_COLORS[hash % HASHTAG_COLORS.length];
    }
    return state.hashtagColors[hashtag] || '#64748b'; // Default slate color if not assigned
}

// Set color for a hashtag
function setHashtagColor(hashtag, color) {
    state.hashtagColors[hashtag] = color;
    populateSidebar();
    render(); // Re-render to update node hashtag colors
}

function populateSidebar() {
    const list = document.getElementById('hashtag-list');
    const counts = getHashtagCounts();
    const hashtags = Object.keys(counts).sort();

    if (hashtags.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'sidebar-empty';
        emptyDiv.textContent = 'No tags yet';
        list.replaceChildren(emptyDiv);
        return;
    }

    // Check which hashtags are currently active in the filter and which are hidden
    const activeFilters = state.filterHashtags.map(t => t.toLowerCase());
    const hiddenTags = state.hiddenHashtags.map(t => t.toLowerCase());

    // Clear list
    list.replaceChildren();

    // Add "Show All Tags" button (always visible, grayed out when not needed)
    const hasHiddenTags = state.hiddenHashtags.length > 0;
    const headerBtn = document.createElement('button');
    headerBtn.className = 'show-all-tags-btn' + (hasHiddenTags ? '' : ' disabled');
    headerBtn.id = 'show-all-tags-btn';
    headerBtn.disabled = !hasHiddenTags;
    headerBtn.textContent = 'Show All Tags';
    list.appendChild(headerBtn);

    // Add hashtags
    hashtags.forEach(tag => {
        const color = getHashtagColor(tag);
        const isActive = activeFilters.includes(tag.toLowerCase());
        const isHidden = hiddenTags.includes(tag.toLowerCase());

        const container = document.createElement('div');
        container.className = 'sidebar-hashtag' + (isActive ? ' active' : '') + (isHidden ? ' hidden' : '');
        container.dataset.tag = tag;

        // Pill
        const pill = document.createElement('span');
        pill.className = 'hashtag-pill hashtag-clickable';
        pill.dataset.tag = tag;
        pill.textContent = tag;
        pill.style.background = isHidden ? `linear-gradient(to right, #6b7280 0%, #6b7280 30%, ${color} 100%)` : color;

        // Count
        const count = document.createElement('span');
        count.className = 'hashtag-count hashtag-clickable';
        count.dataset.tag = tag;
        count.textContent = `(${counts[tag]})`;

        // Color button
        const colorBtn = document.createElement('button');
        colorBtn.className = 'hashtag-color-btn';
        colorBtn.style.background = color;
        colorBtn.dataset.tag = tag;
        colorBtn.title = 'Change color';

        // Hide button
        const hideBtn = document.createElement('button');
        hideBtn.className = 'hashtag-hide-btn';
        hideBtn.dataset.tag = tag;
        hideBtn.title = isHidden ? 'Show tag' : 'Hide tag';
        hideBtn.textContent = '\u00d7';

        // Color picker dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'color-picker-dropdown hidden';
        dropdown.dataset.tag = tag;

        HASHTAG_COLORS.forEach(c => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch' + (c === color ? ' active' : '');
            swatch.style.background = c;
            swatch.dataset.color = c;
            dropdown.appendChild(swatch);
        });

        container.appendChild(pill);
        container.appendChild(count);
        container.appendChild(colorBtn);
        container.appendChild(hideBtn);
        container.appendChild(dropdown);
        list.appendChild(container);
    });

    // Show all tags button handler
    const showAllBtn = document.getElementById('show-all-tags-btn');
    if (showAllBtn) {
        showAllBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAllHashtags();
        });
    }

    // Hide button handlers
    list.querySelectorAll('.hashtag-hide-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHiddenHashtag(btn.dataset.tag);
        });
    });

    // Add click handlers for filter (pill + count only)
    list.querySelectorAll('.hashtag-clickable').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFilterHashtag(el.dataset.tag);
        });
    });

    // Color button handlers
    list.querySelectorAll('.hashtag-color-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const tag = btn.dataset.tag;
            const dropdown = list.querySelector(`.color-picker-dropdown[data-tag="${tag}"]`);

            // Close other dropdowns
            list.querySelectorAll('.color-picker-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });

            dropdown.classList.toggle('hidden');
        });
    });

    // Color swatch handlers
    list.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            e.stopPropagation();
            const color = swatch.dataset.color;
            const dropdown = swatch.closest('.color-picker-dropdown');
            const tag = dropdown.dataset.tag;
            setHashtagColor(tag, color);
            dropdown.classList.add('hidden');
        });
    });

    // Context menu handlers (right-click on hashtag row)
    let longPressTimer = null;
    list.querySelectorAll('.sidebar-hashtag').forEach(row => {
        const tag = row.dataset.tag;

        // Desktop: right-click
        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showHashtagContextMenu(tag, e.clientX, e.clientY);
        });

        // Mobile: long-press (500ms)
        row.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                if (navigator.vibrate) navigator.vibrate(50);
                const touch = e.touches[0];
                showHashtagContextMenu(tag, touch.clientX, touch.clientY);
                longPressTimer = null;
            }, 500);
        });

        row.addEventListener('touchend', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });

        row.addEventListener('touchmove', () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        });
    });
}

// Convert screen coordinates to canvas coordinates
function screenToCanvas(screenX, screenY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left) / state.viewport.zoom + state.viewport.x,
        y: (screenY - rect.top) / state.viewport.zoom + state.viewport.y
    };
}

// Convert canvas coordinates to screen coordinates (inverse of screenToCanvas)
function canvasToScreen(canvasX, canvasY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (canvasX - state.viewport.x) * state.viewport.zoom + rect.left,
        y: (canvasY - state.viewport.y) * state.viewport.zoom + rect.top
    };
}

// Get the bounding box of all nodes (optionally filtered to visible nodes only)
function getGraphBounds(visibleOnly = false) {
    // If visibleOnly is true, only include nodes that pass the current filters
    const nodesToBound = visibleOnly
        ? state.nodes.filter(nodeMatchesFilter)
        : state.nodes;

    if (nodesToBound.length === 0) {
        return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const node of nodesToBound) {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
    }

    return { minX, minY, maxX, maxY };
}

// ============================================================================
// VIEW SWITCHING
// ============================================================================

function showLandingPage() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('graph-view').classList.add('hidden');
    state.currentProjectId = null;
    populateProjectsList();
}

function showGraphView() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('graph-view').classList.remove('hidden');
    updateViewport();
}

function newProject() {
    // Show the new project modal instead of directly creating
    showNewProjectModal();
}

async function goHome() {
    // Save current project before leaving
    if (state.currentProjectId) {
        // Force immediate save before navigation
        state.saveQueue.push({
            timestamp: Date.now(),
            projectId: state.currentProjectId
        });
        await processSaveQueue();
    }

    // Reset state
    state.nodes = [];
    state.edges = [];
    state.selectedNodes = [];
    state.selectedEdge = null;
    state.edgeStartNode = null;
    state.currentPath = [];
    state.filterHashtags = [];
    state.filterText = '';
    state.hiddenHashtags = [];
    state.rootNodes = [];
    state.rootEdges = [];
    state.hashtagColors = {};

    showLandingPage();
}

// ============================================================================
// VIEWPORT (PAN/ZOOM)
// ============================================================================

function updateViewport() {
    const canvas = document.getElementById('canvas');
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();

    // Calculate viewBox based on viewport state
    const viewWidth = rect.width / state.viewport.zoom;
    const viewHeight = rect.height / state.viewport.zoom;

    canvas.setAttribute('viewBox',
        `${state.viewport.x} ${state.viewport.y} ${viewWidth} ${viewHeight}`
    );
}

function zoomAtPoint(delta, screenX, screenY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    // Get canvas coordinates before zoom
    const beforeX = (screenX - rect.left) / state.viewport.zoom + state.viewport.x;
    const beforeY = (screenY - rect.top) / state.viewport.zoom + state.viewport.y;

    // Apply zoom
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.5, Math.min(2.5, state.viewport.zoom * zoomFactor));
    state.viewport.zoom = newZoom;

    // Get canvas coordinates after zoom
    const afterX = (screenX - rect.left) / state.viewport.zoom + state.viewport.x;
    const afterY = (screenY - rect.top) / state.viewport.zoom + state.viewport.y;

    // Adjust pan to keep the point under cursor stationary
    state.viewport.x += beforeX - afterX;
    state.viewport.y += beforeY - afterY;

    updateViewport();
}

function fitToView() {
    const container = document.getElementById('canvas-container');
    const rect = container.getBoundingClientRect();
    // Use visible nodes only when filters are active
    const hasActiveFilters = state.filterHashtags.length > 0 || state.filterText.trim() !== '';
    const bounds = getGraphBounds(hasActiveFilters);

    if (state.nodes.length === 0) {
        // No nodes, reset to default view
        state.viewport.x = 0;
        state.viewport.y = 0;
        state.viewport.zoom = 1;
        updateViewport();
        return;
    }

    // Add padding around the graph
    const padding = 50;
    const graphWidth = bounds.maxX - bounds.minX + padding * 2;
    const graphHeight = bounds.maxY - bounds.minY + padding * 2;

    // Calculate zoom to fit
    const zoomX = rect.width / graphWidth;
    const zoomY = rect.height / graphHeight;
    const newZoom = Math.min(zoomX, zoomY, 2); // Cap at 2x zoom

    state.viewport.zoom = newZoom;

    // Center the graph
    const viewWidth = rect.width / newZoom;
    const viewHeight = rect.height / newZoom;
    const graphCenterX = (bounds.minX + bounds.maxX) / 2;
    const graphCenterY = (bounds.minY + bounds.maxY) / 2;

    state.viewport.x = graphCenterX - viewWidth / 2;
    state.viewport.y = graphCenterY - viewHeight / 2;

    updateViewport();
}

function resetViewport() {
    state.viewport.x = 0;
    state.viewport.y = 0;
    state.viewport.zoom = 1;
    updateViewport();
}

// ============================================================================
// RENDERING
// ============================================================================

function render() {
    renderEdges();
    renderNodes();
    renderGhostNodes();
    renderSelectionBox();
    updateBreadcrumbs();
    updateViewport();

    // Refresh sidebar if open
    const sidebar = document.getElementById('hashtag-sidebar');
    if (sidebar && !sidebar.classList.contains('hidden')) {
        populateSidebar();
    }

    // Auto-save if we have a current project (only saves if data changed)
    if (state.currentProjectId) {
        scheduleAutoSave();
    }
}

function renderNodes() {
    const layer = document.getElementById('nodes-layer');
    layer.replaceChildren();

    // Sort nodes by zIndex (lower first = behind, higher = in front)
    const sortedNodes = [...state.nodes].sort((a, b) => {
        const aZ = a.zIndex || 0;
        const bZ = b.zIndex || 0;
        return aZ - bZ;
    });

    for (const node of sortedNodes) {
        // Skip nodes that don't match filter
        if (!nodeMatchesFilter(node)) continue;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node' +
            (state.selectedNodes.includes(node.id) ? ' selected' : '') +
            (node.children && node.children.length > 0 ? ' has-children' : '') +
            (node.completion === 'yes' || node.completion === 'cancelled' ? ' completed' : ''));
        g.setAttribute('data-id', node.id);
        g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

        // Stacked rectangles for children (rendered first so they appear behind)
        if (node.children && node.children.length > 0) {
            if (node.children.length >= 3) {
                // Second stack layer for 3+ children
                const stack2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                stack2.setAttribute('class', 'node-stack');
                stack2.setAttribute('x', 6);
                stack2.setAttribute('y', 6);
                stack2.setAttribute('width', NODE_WIDTH);
                stack2.setAttribute('height', NODE_HEIGHT);
                stack2.setAttribute('rx', 8);
                g.appendChild(stack2);
            }
            // First stack layer
            const stack1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            stack1.setAttribute('class', 'node-stack');
            stack1.setAttribute('x', 3);
            stack1.setAttribute('y', 3);
            stack1.setAttribute('width', NODE_WIDTH);
            stack1.setAttribute('height', NODE_HEIGHT);
            stack1.setAttribute('rx', 8);
            g.appendChild(stack1);
        }

        // Node body (rectangle)
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'node-body');
        rect.setAttribute('width', NODE_WIDTH);
        rect.setAttribute('height', NODE_HEIGHT);
        g.appendChild(rect);

        // Dog-ear fold for body text indicator (top-left corner)
        if (hasBodyText(node)) {
            const fold = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            fold.setAttribute('class', 'node-dog-ear');
            fold.setAttribute('d', 'M 0 18 L 18 0 L 12 0 Q 0 0 0 12 Z');
            g.appendChild(fold);
        }

        // Node title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('class', 'node-title');
        title.setAttribute('x', 10);
        title.setAttribute('y', 25);
        const fullTitle = node.title || 'Untitled';
        title.textContent = truncateText(fullTitle, 20);
        // Store full title for hover expansion
        title.setAttribute('data-full-title', fullTitle);
        g.appendChild(title);

        // Hashtags as colored pills
        if (node.hashtags && node.hashtags.length > 0) {
            const hashtagGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            hashtagGroup.setAttribute('class', 'node-hashtags-group');

            let xOffset = 8;
            const y = 44;
            const maxWidth = NODE_WIDTH - 16;

            // Filter out hidden hashtags
            const hiddenTagsLower = state.hiddenHashtags.map(t => t.toLowerCase());
            const visibleTags = node.hashtags.filter(tag => !hiddenTagsLower.includes(tag.toLowerCase()));

            for (const tag of visibleTags) {
                const color = getHashtagColor(tag);
                const displayTag = tag.length > 10 ? tag.substring(0, 9) + '…' : tag;
                const pillWidth = displayTag.length * 6.5 + 12;

                // Stop if we'd overflow the node
                if (xOffset + pillWidth > maxWidth) {
                    // Add ellipsis indicator
                    const more = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    more.setAttribute('x', xOffset);
                    more.setAttribute('y', y + 4);
                    more.setAttribute('class', 'node-hashtag-more');
                    more.textContent = '…';
                    hashtagGroup.appendChild(more);
                    break;
                }

                // Pill background
                const pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                pill.setAttribute('x', xOffset);
                pill.setAttribute('y', y - 10);
                pill.setAttribute('width', pillWidth);
                pill.setAttribute('height', 16);
                pill.setAttribute('rx', 8);
                pill.setAttribute('fill', color);
                hashtagGroup.appendChild(pill);

                // Pill text
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', xOffset + 6);
                text.setAttribute('y', y + 1);
                text.setAttribute('class', 'node-hashtag-text');
                text.textContent = displayTag;
                hashtagGroup.appendChild(text);

                xOffset += pillWidth + 4;
            }

            g.appendChild(hashtagGroup);
        }

        // Completion indicator (clickable status icon)
        if (node.completion) {
            const comp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            comp.setAttribute('class', 'node-completion');
            comp.setAttribute('data-action', 'cycle-completion');

            // Background circle for click target
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            bg.setAttribute('cx', NODE_WIDTH - 20);
            bg.setAttribute('cy', 22);
            bg.setAttribute('r', 12);
            bg.setAttribute('class', 'node-completion-bg');
            comp.appendChild(bg);

            if (node.completion === 'yes') {
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                icon.setAttribute('x', NODE_WIDTH - 20);
                icon.setAttribute('y', 28);
                icon.setAttribute('text-anchor', 'middle');
                icon.setAttribute('class', 'node-completion-icon completion-yes');
                icon.textContent = '✓';
                comp.appendChild(icon);
            } else if (node.completion === 'partial') {
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                icon.setAttribute('x', NODE_WIDTH - 20);
                icon.setAttribute('y', 29);
                icon.setAttribute('text-anchor', 'middle');
                icon.setAttribute('class', 'node-completion-icon completion-partial');
                icon.textContent = '◐';
                comp.appendChild(icon);
            } else if (node.completion === 'cancelled') {
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                icon.setAttribute('x', NODE_WIDTH - 20);
                icon.setAttribute('y', 28);
                icon.setAttribute('text-anchor', 'middle');
                icon.setAttribute('class', 'node-completion-icon completion-cancelled');
                icon.textContent = '✕';
                comp.appendChild(icon);
            } else {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', NODE_WIDTH - 20);
                circle.setAttribute('cy', 22);
                circle.setAttribute('r', 7);
                circle.setAttribute('class', 'node-completion-circle completion-no');
                comp.appendChild(circle);
            }

            g.appendChild(comp);
        }

        layer.appendChild(g);
    }
}

function renderEdges() {
    const layer = document.getElementById('edges-layer');
    layer.replaceChildren();

    // Get visible node IDs for filtering edges
    const visibleIds = getVisibleNodeIds();

    for (let i = 0; i < state.edges.length; i++) {
        const edge = state.edges[i];
        const nodeA = state.nodes.find(n => n.id === edge[0]);
        const nodeB = state.nodes.find(n => n.id === edge[1]);

        if (!nodeA || !nodeB) continue;

        // Skip edges where either node is hidden by filter
        if (!visibleIds.includes(edge[0]) || !visibleIds.includes(edge[1])) continue;

        const centerA = getNodeCenter(nodeA);
        const centerB = getNodeCenter(nodeB);

        // Create a group to hold hitbox and visible line
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'edge-group');
        g.setAttribute('data-index', i);

        // Invisible wider hitbox for easier clicking
        const hitbox = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        hitbox.setAttribute('class', 'edge-hitbox');
        hitbox.setAttribute('x1', centerA.x);
        hitbox.setAttribute('y1', centerA.y);
        hitbox.setAttribute('x2', centerB.x);
        hitbox.setAttribute('y2', centerB.y);
        g.appendChild(hitbox);

        // Visible edge line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'edge' + (state.selectedEdge === i ? ' selected' : ''));
        line.setAttribute('x1', centerA.x);
        line.setAttribute('y1', centerA.y);
        line.setAttribute('x2', centerB.x);
        line.setAttribute('y2', centerB.y);
        g.appendChild(line);

        layer.appendChild(g);
    }
}

function renderEdgePreview(x, y) {
    // Remove existing preview
    const existing = document.querySelector('.edge-preview');
    if (existing) existing.remove();

    if (!state.edgeStartNode) return;

    const startNode = state.nodes.find(n => n.id === state.edgeStartNode);
    if (!startNode) return;

    const center = getNodeCenter(startNode);
    const layer = document.getElementById('edges-layer');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'edge-preview');
    line.setAttribute('x1', center.x);
    line.setAttribute('y1', center.y);
    line.setAttribute('x2', x);
    line.setAttribute('y2', y);

    layer.appendChild(line);
}

function clearEdgePreview() {
    const existing = document.querySelector('.edge-preview');
    if (existing) existing.remove();
}

// Render selection box overlay
function renderSelectionBox() {
    const overlay = document.getElementById('selection-box-overlay');
    if (!state.selectionBox) {
        overlay.replaceChildren();
        return;
    }

    const box = state.selectionBox;
    const x = Math.min(box.start.x, box.end.x);
    const y = Math.min(box.start.y, box.end.y);
    const width = Math.abs(box.end.x - box.start.x);
    const height = Math.abs(box.end.y - box.start.y);

    const rectClass = box.mode === 'enclosed' ? 'selection-box solid' : 'selection-box dashed';

    overlay.replaceChildren();
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', rectClass);
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', width);
    rect.setAttribute('height', height);
    overlay.appendChild(rect);
}

// Clear selection box
function clearSelectionBox() {
    state.selectionBox = null;
    const overlay = document.getElementById('selection-box-overlay');
    if (overlay) overlay.replaceChildren();
}

// Render ghost nodes for move operation
function renderGhostNodes() {
    const layer = document.getElementById('ghost-layer');
    layer.replaceChildren();

    if (!state.ghostDragging || state.ghostNodes.length === 0) return;

    // Update ghost node positions to follow cursor
    if (state.pendingMove && state.pendingMove.relativeOffsets) {
        state.ghostNodes.forEach(node => {
            const offset = state.pendingMove.relativeOffsets[node.id];
            if (offset) {
                node.position = {
                    x: state.ghostCursorPos.x + offset.dx,
                    y: state.ghostCursorPos.y + offset.dy
                };
            }
        });
    }

    // Render each ghost node
    for (const node of state.ghostNodes) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'node ghost');
        g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);

        // Node body
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'node-body');
        rect.setAttribute('width', NODE_WIDTH);
        rect.setAttribute('height', NODE_HEIGHT);
        g.appendChild(rect);

        // Node title
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('class', 'node-title');
        title.setAttribute('x', 10);
        title.setAttribute('y', 25);
        title.textContent = truncateText(node.title || 'Untitled', 20);
        g.appendChild(title);

        // Hashtags as colored pills (simplified)
        if (node.hashtags && node.hashtags.length > 0) {
            const hashtagGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            let xOffset = 8;
            const y = 44;
            const maxWidth = NODE_WIDTH - 16;

            for (const tag of node.hashtags) {
                const color = getHashtagColor(tag, false);
                const displayTag = tag.length > 10 ? tag.substring(0, 9) + '…' : tag;
                const pillWidth = displayTag.length * 6.5 + 12;

                if (xOffset + pillWidth > maxWidth) break;

                const pill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                pill.setAttribute('class', 'hashtag-pill');
                pill.setAttribute('x', xOffset);
                pill.setAttribute('y', y - 10);
                pill.setAttribute('width', pillWidth);
                pill.setAttribute('height', 16);
                pill.setAttribute('rx', 8);
                pill.setAttribute('fill', color);
                hashtagGroup.appendChild(pill);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('class', 'node-hashtag-text');
                text.setAttribute('x', xOffset + 6);
                text.setAttribute('y', y + 1);
                text.textContent = displayTag;
                hashtagGroup.appendChild(text);

                xOffset += pillWidth + 4;
            }

            g.appendChild(hashtagGroup);
        }

        layer.appendChild(g);
    }
}

// Get nodes within selection box
function getNodesInSelectionBox(box) {
    const x1 = Math.min(box.start.x, box.end.x);
    const y1 = Math.min(box.start.y, box.end.y);
    const x2 = Math.max(box.start.x, box.end.x);
    const y2 = Math.max(box.start.y, box.end.y);

    return state.nodes.filter(node => {
        if (!nodeMatchesFilter(node)) return false;

        const nodeX = node.position.x;
        const nodeY = node.position.y;
        const nodeRight = nodeX + NODE_WIDTH;
        const nodeBottom = nodeY + NODE_HEIGHT;

        if (box.mode === 'enclosed') {
            // Drag left-to-right: fully enclosed only
            return nodeX >= x1 && nodeRight <= x2 && nodeY >= y1 && nodeBottom <= y2;
        } else {
            // Drag right-to-left: fully enclosed OR intersecting
            return !(nodeRight < x1 || nodeX > x2 || nodeBottom < y1 || nodeY > y2);
        }
    }).map(n => n.id);
}

function updateBreadcrumbs() {
    const el = document.getElementById('breadcrumbs');
    if (state.currentPath.length === 0) {
        el.textContent = 'Root';
        el.classList.remove('active');
    } else {
        const names = state.currentPath.map(p => truncateText(p.title || 'Untitled', 15));
        el.textContent = 'Root > ' + names.join(' > ');
        el.classList.add('active');
    }
}

// ============================================================================
// NODE OPERATIONS
// ============================================================================

function createNode(x, y) {
    const node = {
        id: generateId(),
        title: '',
        content: '',
        hashtags: [],
        completion: state.projectSettings.defaultCompletion,
        position: { x, y },
        zIndex: 0,
        children: [],
        childEdges: [],
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };
    state.nodes.push(node);
    render();
    return node;
}

function deepCopyNode(node, offsetX = 0, offsetY = 0) {
    const newNode = {
        id: generateId(),
        title: node.title,
        content: node.content,
        hashtags: [...(node.hashtags || [])],
        completion: node.completion || null,
        position: {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY
        },
        zIndex: node.zIndex || 0,
        children: [],
        childEdges: [],
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };

    // Deep copy children recursively and create ID mapping
    const childIdMapping = {};
    if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
            const copiedChild = deepCopyNode(child, 0, 0);
            childIdMapping[child.id] = copiedChild.id;
            newNode.children.push(copiedChild);
        });
    }

    // Copy child edges and remap IDs to new child IDs
    if (node.childEdges && node.childEdges.length > 0) {
        newNode.childEdges = node.childEdges.map(edge => [
            childIdMapping[edge[0]],
            childIdMapping[edge[1]]
        ]);
    }

    return newNode;
}

function deleteNode(nodeId) {
    // Find the node being deleted
    const node = state.nodes.find(n => n.id === nodeId);

    // Promote children to current level before deleting
    if (node && node.children && node.children.length > 0) {
        // Offset children positions relative to parent's position
        const offsetX = node.position.x;
        const offsetY = node.position.y + NODE_HEIGHT + 20; // Place below parent

        node.children.forEach((child, index) => {
            // Adjust position so children appear near where parent was
            child.position.x += offsetX;
            child.position.y += offsetY + (index * 10); // Slight stagger to avoid overlap
            state.nodes.push(child);
        });

        // Promote child edges to current level
        if (node.childEdges && node.childEdges.length > 0) {
            state.edges.push(...node.childEdges);
        }
    }

    // Remove edges connected to this node
    state.edges = state.edges.filter(e => e[0] !== nodeId && e[1] !== nodeId);

    // Remove the node
    state.nodes = state.nodes.filter(n => n.id !== nodeId);

    // Remove from selection
    state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);

    render();
}

function selectNode(nodeId, addToSelection = false) {
    if (addToSelection) {
        // Toggle: add if not selected, remove if already selected
        const index = state.selectedNodes.indexOf(nodeId);
        if (index === -1) {
            state.selectedNodes.push(nodeId);
        } else {
            state.selectedNodes.splice(index, 1);
        }
    } else {
        // Replace selection with single node
        state.selectedNodes = [nodeId];
    }
    state.selectedEdge = null;
    updateSelectionVisuals();
}

function clearSelection() {
    state.selectedNodes = [];
    state.selectedEdge = null;
    state.edgeStartNode = null;
    clearEdgePreview();
    updateSelectionVisuals();
}

function updateSelectionVisuals() {
    // Update node selection visuals without full re-render
    document.querySelectorAll('.node').forEach(el => {
        if (state.selectedNodes.includes(el.dataset.id)) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    // Update edge selection visuals
    document.querySelectorAll('.edge').forEach(el => {
        const group = el.closest('.edge-group');
        const index = group ? parseInt(group.dataset.index) : -1;
        if (index === state.selectedEdge) {
            el.classList.add('selected');
        } else {
            el.classList.remove('selected');
        }
    });

    // Update selection action bar
    updateSelectionActionBar();
}

function updateSelectionActionBar() {
    const actionBar = document.getElementById('selection-action-bar');
    if (!actionBar) return;

    const connectBtn = document.getElementById('action-connect');
    const duplicateBtn = document.getElementById('action-duplicate');
    const deleteBtn = document.getElementById('action-delete');

    if (state.selectedNodes.length > 0) {
        // Node(s) selected - show all buttons (Connect now works for batch connect)
        connectBtn.classList.remove('hidden');
        duplicateBtn.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');
        // Action bar is only shown on mobile via long-press
    } else if (state.selectedEdge !== null) {
        // Edge selected - show only delete
        connectBtn.classList.add('hidden');
        duplicateBtn.classList.add('hidden');
        deleteBtn.classList.remove('hidden');
        // On mobile, show action bar for edge deletion (hard to long-press edges)
        if ('ontouchstart' in window) {
            showActionBar();
        }
    } else {
        // Nothing selected
        hideActionBar();
    }
}

function positionActionBar() {
    // Mobile: Fixed position at top handled by CSS
    // Desktop: Keep default CSS positioning (centered at bottom)
    // No dynamic repositioning needed anymore
}

function showActionBar() {
    const actionBar = document.getElementById('selection-action-bar');
    if (!actionBar) return;

    actionBar.classList.remove('hidden');
    // Position above the selected node on mobile before animation
    positionActionBar();
    // Trigger reflow for animation
    actionBar.offsetHeight;
    actionBar.classList.add('visible');
}

function hideActionBar() {
    const actionBar = document.getElementById('selection-action-bar');
    if (!actionBar) return;

    actionBar.classList.remove('visible');
    // Hide after animation completes
    setTimeout(() => {
        if (!actionBar.classList.contains('visible')) {
            actionBar.classList.add('hidden');
        }
    }, 200);
}

// Bring selected node(s) to front (highest zIndex)
function bringToFront() {
    if (state.selectedNodes.length === 0) return;

    // Find the current max zIndex
    const maxZ = Math.max(...state.nodes.map(n => n.zIndex || 0), 0);

    // Set selected nodes to maxZ + 1
    state.selectedNodes.forEach(id => {
        const node = state.nodes.find(n => n.id === id);
        if (node) node.zIndex = maxZ + 1;
    });

    render();
}

// Send selected node(s) to back (lowest zIndex)
function sendToBack() {
    if (state.selectedNodes.length === 0) return;

    // Find the current min zIndex
    const minZ = Math.min(...state.nodes.map(n => n.zIndex || 0), 0);

    // Set selected nodes to minZ - 1
    state.selectedNodes.forEach(id => {
        const node = state.nodes.find(n => n.id === id);
        if (node) node.zIndex = minZ - 1;
    });

    render();
}

// Show context menu for node operations
function showNodeContextMenu(nodeId, x, y) {
    // Remove existing menu if any
    hideNodeContextMenu();

    const menu = document.createElement('div');
    menu.id = 'node-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.zIndex = '300';

    // Build menu items based on selection count
    const menuItems = [];

    if (state.selectedNodes.length > 1) {
        menuItems.push({ action: 'connect-to', text: 'Connect to...' });
    }

    menuItems.push({ action: 'bring-front', text: 'Bring to Front' });
    menuItems.push({ action: 'send-back', text: 'Send to Back' });
    menuItems.push({ action: 'move-to', text: 'Move to...' });

    menuItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'context-menu-item';
        div.dataset.action = item.action;
        div.textContent = item.text;
        menu.appendChild(div);
    });

    // Adjust position if menu goes off screen
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
    }

    // Handle menu actions
    menu.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action;
        if (action === 'bring-front') {
            bringToFront();
        } else if (action === 'send-back') {
            sendToBack();
        } else if (action === 'move-to') {
            showMoveToModal();
        } else if (action === 'connect-to') {
            // Start batch connect mode
            startEdgeCreation();
        }
        hideNodeContextMenu();
    });
}

function hideNodeContextMenu() {
    const menu = document.getElementById('node-context-menu');
    if (menu) menu.remove();
}

// ============================================================================
// EDGE OPERATIONS
// ============================================================================

function startEdgeCreation(nodeId) {
    // If nodeId provided, use it; otherwise use current selection (for batch connect)
    if (nodeId) {
        state.edgeStartNode = nodeId;
    } else if (state.selectedNodes.length > 0) {
        // Batch connect mode: store all selected nodes
        state.edgeStartNode = state.selectedNodes[0]; // Use first as primary for preview
        state.edgeStartNodes = [...state.selectedNodes]; // Store all for batch creation
    }
}

function completeEdgeCreation(targetNodeId) {
    if (!state.edgeStartNode || state.edgeStartNode === targetNodeId) {
        state.edgeStartNode = null;
        state.edgeStartNodes = null;
        clearEdgePreview();
        return;
    }

    // Batch connect mode: create edges from all source nodes to target
    if (state.edgeStartNodes && state.edgeStartNodes.length > 0) {
        state.edgeStartNodes.forEach(sourceId => {
            if (sourceId === targetNodeId) return; // Skip self-connection

            // Toggle edge: remove if exists, create if not
            const existingIndex = state.edges.findIndex(e =>
                (e[0] === sourceId && e[1] === targetNodeId) ||
                (e[0] === targetNodeId && e[1] === sourceId)
            );

            if (existingIndex !== -1) {
                state.edges.splice(existingIndex, 1);
            } else {
                state.edges.push([sourceId, targetNodeId]);
            }
        });
    } else {
        // Single edge creation
        const existingIndex = state.edges.findIndex(e =>
            (e[0] === state.edgeStartNode && e[1] === targetNodeId) ||
            (e[0] === targetNodeId && e[1] === state.edgeStartNode)
        );

        if (existingIndex !== -1) {
            state.edges.splice(existingIndex, 1);
        } else {
            state.edges.push([state.edgeStartNode, targetNodeId]);
        }
    }

    state.edgeStartNode = null;
    state.edgeStartNodes = null;
    clearEdgePreview();
    render();
}

function selectEdge(index) {
    state.selectedEdge = index;
    state.selectedNodes = [];
    updateSelectionVisuals();
}

function deleteSelectedEdge() {
    if (state.selectedEdge !== null) {
        state.edges.splice(state.selectedEdge, 1);
        state.selectedEdge = null;
        render();
    }
}

// ============================================================================
// NAVIGATION (NESTING)
// ============================================================================

function enterNode(nodeId) {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Save current state to the node we're leaving
    if (state.currentPath.length > 0) {
        const parent = state.currentPath[state.currentPath.length - 1];
        parent.children = state.nodes;
        parent.childEdges = state.edges;
    }

    // Push current node to path
    node.children = node.children || [];
    node.childEdges = node.childEdges || [];
    state.currentPath.push(node);

    // Load children
    state.nodes = node.children;
    state.edges = node.childEdges;
    state.selectedNodes = [];
    state.selectedEdge = null;

    // Clear filter when navigating
    clearFilter();

    // Reset viewport for the new level
    resetViewport();
    render();
}

function goBack() {
    if (state.currentPath.length === 0) return;

    // Save current state
    const current = state.currentPath.pop();
    current.children = state.nodes;
    current.childEdges = state.edges;

    // Go to parent level
    if (state.currentPath.length === 0) {
        // Back to root - need to restore root state
        state.nodes = getRootNodes();
        state.edges = getRootEdges();
    } else {
        const parent = state.currentPath[state.currentPath.length - 1];
        state.nodes = parent.children;
        state.edges = parent.childEdges;
    }

    state.selectedNodes = [];
    state.selectedEdge = null;

    // Clear filter when navigating
    clearFilter();

    // Reset viewport for the new level
    resetViewport();
    render();

    // Save after navigation to persist the updated tree
    scheduleAutoSave();
}

// Root state storage (saved when entering first node)
function getRootNodes() {
    return state.rootNodes;
}

function getRootEdges() {
    return state.rootEdges;
}

function saveRootState() {
    if (state.currentPath.length === 0) {
        state.rootNodes = state.nodes;
        state.rootEdges = state.edges;
    }
}

// ============================================================================
// EDITOR
// ============================================================================

function openEditor(nodeId) {
    // Check if we're in batch edit mode (multiple nodes selected)
    const isBatchMode = state.selectedNodes.length > 1;

    // Clear removed tags from previous session
    state.removedTagsInSession.clear();

    if (isBatchMode) {
        // Batch edit mode
        const nodes = state.selectedNodes.map(id => state.nodes.find(n => n.id === id)).filter(Boolean);
        if (nodes.length === 0) return;

        // Snapshot all nodes for cancel/revert
        state.editorSnapshot = {
            batchMode: true,
            nodes: nodes.map(node => ({
                id: node.id,
                hashtags: [...(node.hashtags || [])],
                completion: node.completion || null
            }))
        };

        hideActionBar();
        const modal = document.getElementById('editor-modal');
        const titleInput = document.getElementById('note-title');
        const textarea = document.getElementById('note-text');
        const enterBtn = document.getElementById('editor-enter');

        // Disable title field only
        titleInput.disabled = true;
        titleInput.value = '';
        titleInput.placeholder = `Editing ${nodes.length} notes`;

        // Enable textarea for adding tags
        textarea.disabled = false;
        textarea.value = '';
        textarea.placeholder = 'Type tags to add (e.g., #urgent #review)';

        // Disable enter button
        enterBtn.disabled = true;
        enterBtn.textContent = 'Step into note';
        enterBtn.classList.remove('has-children');

        // Collect all unique tags across selected nodes with counts
        const tagCounts = {};
        nodes.forEach(node => {
            (node.hashtags || []).forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        // Sort by frequency (most common first), then alphabetically
        const allTags = Object.keys(tagCounts).sort((a, b) => {
            if (tagCounts[b] !== tagCounts[a]) {
                return tagCounts[b] - tagCounts[a]; // Descending by count
            }
            return a.localeCompare(b); // Alphabetically if same count
        });

        updateHashtagDisplay(allTags, true, nodes.length, tagCounts);

        // Check completion status - if all same, show it; otherwise show mixed
        const completions = nodes.map(n => n.completion || null);
        const allSame = completions.every(c => c === completions[0]);
        updateCompletionButtons(allSame ? completions[0] : 'mixed');

        modal.classList.remove('hidden');
        modal.dataset.batchMode = 'true';

        // Focus on textarea for tag entry
        textarea.focus();
    } else {
        // Single node edit mode
        const node = state.nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Snapshot current state for cancel/revert
        state.editorSnapshot = {
            batchMode: false,
            title: node.title || '',
            content: node.content || '',
            hashtags: [...(node.hashtags || [])],
            completion: node.completion || null
        };

        hideActionBar();
        const modal = document.getElementById('editor-modal');
        const titleInput = document.getElementById('note-title');
        const textarea = document.getElementById('note-text');
        const enterBtn = document.getElementById('editor-enter');

        // Enable all fields
        titleInput.disabled = false;
        textarea.disabled = false;
        enterBtn.disabled = false;

        titleInput.value = node.title || '';
        titleInput.placeholder = '';
        textarea.value = node.content || '';
        textarea.placeholder = '';
        updateHashtagDisplay(node.hashtags || [], false, 1, {});
        updateCompletionButtons(node.completion || '');

        // Update enter button based on whether node has children
        if (node.children && node.children.length > 0) {
            const count = node.children.length;
            enterBtn.textContent = `View ${count} nested ${count === 1 ? 'note' : 'notes'}`;
            enterBtn.classList.add('has-children');
        } else {
            enterBtn.textContent = 'Step into note';
            enterBtn.classList.remove('has-children');
        }

        modal.classList.remove('hidden');
        modal.dataset.nodeId = nodeId;
        titleInput.focus();
        titleInput.setSelectionRange(0, 0);
        titleInput.scrollLeft = 0;
    }
}

function closeEditor() {
    hideAutocomplete();
    const modal = document.getElementById('editor-modal');
    modal.classList.add('hidden');
    delete modal.dataset.nodeId;
    delete modal.dataset.batchMode;
    state.removedTagsInSession.clear();
}

function cancelEditor() {
    const modal = document.getElementById('editor-modal');

    if (state.editorSnapshot && state.editorSnapshot.batchMode) {
        // Batch mode: restore all nodes from snapshot
        state.editorSnapshot.nodes.forEach(snapshot => {
            const node = state.nodes.find(n => n.id === snapshot.id);
            if (node) {
                node.hashtags = snapshot.hashtags;
                node.completion = snapshot.completion;
            }
        });
    } else {
        // Single node mode
        const nodeId = modal.dataset.nodeId;
        const node = state.nodes.find(n => n.id === nodeId);

        // Restore node from snapshot
        if (node && state.editorSnapshot) {
            node.title = state.editorSnapshot.title;
            node.content = state.editorSnapshot.content;
            node.hashtags = state.editorSnapshot.hashtags;
            node.completion = state.editorSnapshot.completion;
        }

        // Delete empty nodes (new node that was never filled in)
        if (node && !node.title.trim() && !node.content.trim()) {
            deleteNode(nodeId);
        }
    }

    state.editorSnapshot = null;
    closeEditor();
    render();
}

function saveEditor() {
    const modal = document.getElementById('editor-modal');

    if (modal.dataset.batchMode === 'true') {
        // Batch mode: apply changes to all selected nodes
        const nodes = state.selectedNodes.map(id => state.nodes.find(n => n.id === id)).filter(Boolean);
        const textarea = document.getElementById('note-text');

        // Parse hashtags from textarea (these are tags to add)
        const newTags = parseHashtags(textarea.value);

        // Get completion state
        const activeBtn = document.querySelector('.completion-btn.active');
        const completionValue = activeBtn ? activeBtn.dataset.value : '';

        nodes.forEach(node => {
            // Remove tags that were marked for removal
            if (state.removedTagsInSession.size > 0) {
                state.removedTagsInSession.forEach(tag => {
                    // Remove from hashtags array
                    node.hashtags = node.hashtags.filter(t => t !== tag);
                    // Remove from content text
                    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedTag + '\\s?', 'gi');
                    node.content = node.content.replace(regex, '').trim();
                    // Clean up multiple spaces
                    node.content = node.content.replace(/\s+/g, ' ');
                });
            }

            // Add new tags to each node (avoid duplicates)
            if (newTags.length > 0) {
                newTags.forEach(tag => {
                    if (!node.hashtags.includes(tag)) {
                        node.hashtags.push(tag);
                    }
                });
                // Update content to include new tags
                const existingContent = node.content.trim();
                const tagsToAdd = newTags.filter(tag => !node.content.includes(tag));
                if (tagsToAdd.length > 0) {
                    node.content = existingContent + (existingContent ? ' ' : '') + tagsToAdd.join(' ');
                    node.hashtags = parseHashtags(node.content);
                }
            }

            // Set completion state (unless it's 'mixed' which means no change)
            if (completionValue && completionValue !== 'mixed') {
                node.completion = completionValue || null;
            }

            node.modified = new Date().toISOString();
        });
    } else {
        // Single node mode
        const nodeId = modal.dataset.nodeId;
        const node = state.nodes.find(n => n.id === nodeId);

        if (node) {
            const titleInput = document.getElementById('note-title');
            const textarea = document.getElementById('note-text');
            node.title = titleInput.value;
            node.content = textarea.value;
            node.hashtags = parseHashtags(textarea.value);
            node.modified = new Date().toISOString();

            // Save completion state
            const activeBtn = document.querySelector('.completion-btn.active');
            const val = activeBtn ? activeBtn.dataset.value : '';
            node.completion = val || null;

            // Delete empty nodes (created but never filled in)
            if (!node.title.trim() && !node.content.trim()) {
                deleteNode(nodeId);
            }
        }
    }

    state.editorSnapshot = null;
    closeEditor();
    render();
}

function updateHashtagDisplay(hashtags, isBatchMode = false, totalNodes = 1, tagCounts = {}) {
    const display = document.getElementById('hashtag-display');
    const modal = document.getElementById('editor-modal');
    const textarea = document.getElementById('note-text');

    display.replaceChildren();
    hashtags.forEach(tag => {
        const color = getHashtagColor(tag, false); // Don't auto-assign colors while typing
        const isRemoved = state.removedTagsInSession.has(tag);
        // If tag is removed, count is 0 (will be deleted from all notes)
        const count = isRemoved ? 0 : (tagCounts[tag] || 0);
        const badge = isBatchMode ? ` (${count}/${totalNodes})` : '';

        const span = document.createElement('span');
        span.className = 'hashtag editor-hashtag';
        span.dataset.tag = tag;
        span.textContent = tag + badge;

        // Solid pill: background color, white text
        // Outlined pill: transparent background, colored border, white text
        if (isRemoved) {
            span.style.background = 'transparent';
            span.style.border = `2px solid ${color}`;
            span.style.color = '#fff';
        } else {
            span.style.background = color;
            span.style.color = '#fff';
        }

        display.appendChild(span);
    });

    // Add click handlers to remove/re-add tags
    display.querySelectorAll('.editor-hashtag').forEach(el => {
        el.addEventListener('click', () => {
            const tag = el.dataset.tag;
            const isRemoved = state.removedTagsInSession.has(tag);

            // Save cursor position
            const cursorPos = textarea.selectionStart;

            if (isRemoved) {
                // Re-add tag: append to content
                state.removedTagsInSession.delete(tag);
                const currentContent = textarea.value.trim();
                textarea.value = currentContent + (currentContent ? ' ' : '') + tag;

                // Suppress autocomplete for this synthetic event
                autocomplete.suppress = true;
                // Trigger input event to re-parse and update display
                textarea.dispatchEvent(new Event('input'));
            } else {
                // Remove tag: delete from content and mark as removed
                state.removedTagsInSession.add(tag);
                removeTagFromContent(tag);

                // Suppress autocomplete for this synthetic event
                autocomplete.suppress = true;
                // Trigger input event to re-parse and update display
                textarea.dispatchEvent(new Event('input'));
            }

            // Restore cursor position (clamped to new content length)
            const newPos = Math.min(cursorPos, textarea.value.length);
            textarea.setSelectionRange(newPos, newPos);
        });
    });
}

// Helper function to remove a tag from content textarea
function removeTagFromContent(tag) {
    const textarea = document.getElementById('note-text');
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Remove tag + optional trailing space, preserving leading space (unless at start)
    const regex = new RegExp(escapedTag + '\\s?', 'gi');
    textarea.value = textarea.value.replace(regex, '').trim();

    // Clean up multiple spaces
    textarea.value = textarea.value.replace(/\s+/g, ' ');
}

function updateCompletionButtons(value) {
    if (value === 'mixed') {
        // In batch mode with mixed completion states, show all buttons as inactive
        document.querySelectorAll('.completion-btn').forEach(btn => {
            btn.classList.remove('active');
        });
    } else {
        document.querySelectorAll('.completion-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === value);
        });
    }
}

// ============================================================================
// HASHTAG AUTOCOMPLETE
// ============================================================================

function getAutocompleteSuggestions(query) {
    const counts = getHashtagCounts();
    const tags = Object.keys(counts);
    const q = query.toLowerCase();
    const filtered = tags
        .filter(tag => tag.toLowerCase().startsWith('#' + q))
        .sort((a, b) => {
            const diff = counts[b] - counts[a];
            return diff !== 0 ? diff : a.toLowerCase().localeCompare(b.toLowerCase());
        })
        .slice(0, 20);
    return filtered.map(tag => ({
        tag,
        color: getHashtagColor(tag, false), // Don't auto-assign colors during autocomplete typing
        count: counts[tag]
    }));
}

function showAutocomplete(inputElement) {
    const suggestions = getAutocompleteSuggestions(autocomplete.query);
    autocomplete.items = suggestions;
    autocomplete.selectedIndex = -1;

    const dropdown = document.getElementById('hashtag-autocomplete');
    const list = document.getElementById('hashtag-autocomplete-list');

    if (suggestions.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'autocomplete-empty';
        emptyDiv.textContent = 'No matching tags';
        list.replaceChildren(emptyDiv);
    } else {
        list.replaceChildren();
        suggestions.forEach((item, i) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.dataset.index = i;

            const pill = document.createElement('span');
            pill.className = 'ac-pill';
            pill.style.background = item.color;

            const tag = document.createElement('span');
            tag.className = 'ac-tag';
            tag.textContent = item.tag;

            const count = document.createElement('span');
            count.className = 'ac-count';
            count.textContent = item.count;

            div.appendChild(pill);
            div.appendChild(tag);
            div.appendChild(count);

            div.addEventListener('mousedown', (e) => {
                e.preventDefault(); // prevent input blur
                selectAutocompleteItem(i);
            });

            list.appendChild(div);
        });
    }

    positionAutocomplete(inputElement);
    dropdown.classList.remove('hidden');
    autocomplete.active = true;
    autocomplete.targetInput = inputElement;
}

function positionAutocomplete(inputElement) {
    const dropdown = document.getElementById('hashtag-autocomplete');
    const isTextarea = inputElement.id === 'note-text';

    if (!isTextarea) {
        // Filter input: position below the input
        const rect = inputElement.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = Math.max(rect.width, 200) + 'px';
    } else {
        // Textarea: position near caret
        const rect = inputElement.getBoundingClientRect();
        const coords = getTextareaCaretCoords(inputElement, autocomplete.hashStart);
        let top = rect.top + coords.top + 20; // below caret line
        let left = rect.left + coords.left;

        // Viewport clamping
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (left + 200 > vw) left = vw - 210;
        if (left < 10) left = 10;
        if (top + 200 > vh) top = rect.top + coords.top - 210; // flip above

        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';
        dropdown.style.width = '220px';
    }
}

function getTextareaCaretCoords(textarea, position) {
    const div = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    const properties = [
        'fontFamily', 'fontSize', 'fontWeight', 'wordWrap', 'whiteSpace',
        'borderLeftWidth', 'borderTopWidth', 'paddingLeft', 'paddingTop',
        'paddingRight', 'paddingBottom', 'lineHeight', 'letterSpacing',
        'textTransform', 'boxSizing', 'width'
    ];
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.overflow = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    properties.forEach(prop => { div.style[prop] = style[prop]; });

    const text = textarea.value.substring(0, position);
    div.textContent = text;

    const span = document.createElement('span');
    span.textContent = textarea.value.substring(position) || '.';
    div.appendChild(span);

    document.body.appendChild(div);
    const top = span.offsetTop - textarea.scrollTop;
    const left = span.offsetLeft;
    document.body.removeChild(div);

    return { top, left };
}

function hideAutocomplete() {
    const dropdown = document.getElementById('hashtag-autocomplete');
    dropdown.classList.add('hidden');
    autocomplete.active = false;
    autocomplete.targetInput = null;
    autocomplete.query = '';
    autocomplete.hashStart = -1;
    autocomplete.items = [];
    autocomplete.selectedIndex = -1;
}

function selectAutocompleteItem(index) {
    if (index < 0 || index >= autocomplete.items.length) return;
    const item = autocomplete.items[index];
    const input = autocomplete.targetInput;
    if (!input) return;

    // Assign color when user commits a tag via autocomplete selection
    getHashtagColor(item.tag, true);

    const text = input.value;
    const start = autocomplete.hashStart;
    const cursorPos = input.selectionStart;

    // Scan forward from cursor to skip any remaining word characters
    let end = cursorPos;
    while (end < text.length && /[\w-]/.test(text[end])) {
        end++;
    }

    const before = text.substring(0, start);
    const after = text.substring(end);
    const insertText = item.tag + ' ';
    input.value = before + insertText + after;

    // Set cursor after inserted text
    const newPos = start + insertText.length;
    input.setSelectionRange(newPos, newPos);

    // Dispatch input event to trigger existing handlers
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.focus();

    hideAutocomplete();
}

function updateAutocompleteFromInput(inputElement) {
    // Skip if autocomplete is suppressed (synthetic event from tag pill clicks)
    if (autocomplete.suppress) {
        autocomplete.suppress = false; // Reset flag
        return;
    }

    const text = inputElement.value;
    const cursorPos = inputElement.selectionStart;

    // Scan backwards from cursor to find '#'
    let i = cursorPos - 1;
    while (i >= 0 && /[\w-]/.test(text[i])) {
        i--;
    }

    // Check if we found a '#' at a word boundary
    if (i >= 0 && text[i] === '#') {
        // Word boundary check: '#' must be at position 0 or preceded by whitespace
        if (i === 0 || /\s/.test(text[i - 1])) {
            const query = text.substring(i + 1, cursorPos);
            autocomplete.hashStart = i;
            autocomplete.query = query;
            showAutocomplete(inputElement);
            return;
        }
    }

    // No valid '#' found — hide
    if (autocomplete.active) {
        hideAutocomplete();
    }
}

function handleAutocompleteKeydown(e) {
    if (!autocomplete.active) return false;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = autocomplete.selectedIndex + 1;
        if (next < autocomplete.items.length) {
            highlightAutocompleteItem(next);
        }
        return true;
    }
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = autocomplete.selectedIndex - 1;
        if (prev >= 0) {
            highlightAutocompleteItem(prev);
        }
        return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
        // If an item is highlighted, insert it
        if (autocomplete.selectedIndex >= 0) {
            e.preventDefault();
            selectAutocompleteItem(autocomplete.selectedIndex);
            return true;
        }
        // If only one suggestion remains, insert it automatically
        if (autocomplete.items.length === 1) {
            e.preventDefault();
            selectAutocompleteItem(0);
            return true;
        }
        // Otherwise, let Enter/Tab pass through
        hideAutocomplete();
        return false;
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        hideAutocomplete();
        return true;
    }
    return false;
}

function highlightAutocompleteItem(index) {
    autocomplete.selectedIndex = index;
    const list = document.getElementById('hashtag-autocomplete-list');
    list.querySelectorAll('.autocomplete-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
    // Scroll into view
    const activeEl = list.querySelector('.autocomplete-item.active');
    if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
    }
}

// ============================================================================
// HELP MODAL
// ============================================================================

function showHelp() {
    document.getElementById('help-modal').classList.remove('hidden');
}

function hideHelp() {
    document.getElementById('help-modal').classList.add('hidden');
}

// ============================================================================
// MOVE TO NOTEBOOK MODAL
// ============================================================================

function showMoveToModal() {
    if (state.selectedNodes.length === 0) return;

    const modal = document.getElementById('move-to-modal');
    const list = document.getElementById('move-to-list');

    // Get all projects except the current one
    const projects = getProjectsList().filter(p => p.id !== state.currentProjectId);

    if (projects.length === 0) {
        showToast('No other notebooks available. Create a new notebook first.');
        return;
    }

    // Populate the list
    list.replaceChildren();
    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'move-to-item';
        item.dataset.projectId = project.id;

        const name = document.createElement('span');
        name.className = 'move-to-item-name';
        name.textContent = project.name;

        const count = document.createElement('span');
        count.className = 'move-to-item-count';
        count.textContent = `${project.noteCount} notes`;

        item.appendChild(name);
        item.appendChild(count);
        list.appendChild(item);
    });

    modal.classList.remove('hidden');
}

function hideMoveToModal() {
    const modal = document.getElementById('move-to-modal');
    modal.classList.add('hidden');
}

function initiateMoveToNotebook(targetProjectId) {
    // Store original IDs for source cleanup
    const originalIds = [...state.selectedNodes];

    // Create a mapping from old IDs to new IDs for edge updates
    const idMapping = {};

    // Get selected nodes and create deep copies with new IDs
    const nodesToMove = state.selectedNodes.map(id => {
        const node = state.nodes.find(n => n.id === id);
        const copy = deepCopyNode(node);
        idMapping[id] = copy.id;
        return copy;
    });

    // Get edges where both endpoints are in the selection, and update to new IDs
    const edgesToMove = state.edges
        .filter(edge =>
            state.selectedNodes.includes(edge[0]) && state.selectedNodes.includes(edge[1])
        )
        .map(edge => [idMapping[edge[0]], idMapping[edge[1]]]);

    // Calculate bounding box and relative offsets
    const bounds = {
        minX: Math.min(...nodesToMove.map(n => n.position.x)),
        minY: Math.min(...nodesToMove.map(n => n.position.y)),
        maxX: Math.max(...nodesToMove.map(n => n.position.x + NODE_WIDTH)),
        maxY: Math.max(...nodesToMove.map(n => n.position.y + NODE_HEIGHT))
    };

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    // Store relative offsets from center for each node (using new IDs)
    const relativeOffsets = {};
    nodesToMove.forEach(node => {
        relativeOffsets[node.id] = {
            dx: node.position.x - centerX,
            dy: node.position.y - centerY
        };
    });

    // Get source project name for toast message
    const sourceProject = getProjectsList().find(p => p.id === state.currentProjectId);

    // Store pending move in sessionStorage
    const pendingMove = {
        sourceProjectId: state.currentProjectId,
        sourceProjectName: sourceProject ? sourceProject.name : 'Unknown',
        originalIds: originalIds,  // Store original IDs for source cleanup
        nodes: nodesToMove,
        edges: edgesToMove,
        boundingBox: { centerX, centerY },
        relativeOffsets: relativeOffsets
    };

    sessionStorage.setItem(MOVE_STORAGE_KEY, JSON.stringify(pendingMove));

    // Switch to target notebook
    openProject(targetProjectId);
}

function checkForPendingMove() {
    const pendingData = sessionStorage.getItem(MOVE_STORAGE_KEY);
    if (!pendingData) return;

    try {
        const pendingMove = JSON.parse(pendingData);

        // Set up ghost nodes
        state.ghostNodes = pendingMove.nodes;
        state.ghostDragging = true;

        // Store pending move data for later use
        state.pendingMove = pendingMove;

        // Remove from sessionStorage
        sessionStorage.removeItem(MOVE_STORAGE_KEY);

        // Add ghost drag cursor
        const canvas = document.getElementById('canvas');
        if (canvas) canvas.classList.add('ghost-drag-mode');

        // Show toast notification
        showToast(`Moving ${state.ghostNodes.length} note${state.ghostNodes.length > 1 ? 's' : ''}... Click to place or ESC to cancel`);

        // Initial render with ghosts
        render();
    } catch (e) {
        console.error('Error loading pending move:', e);
        sessionStorage.removeItem(MOVE_STORAGE_KEY);
    }
}

function placeGhostNodes() {
    if (!state.ghostDragging || state.ghostNodes.length === 0) return;

    // Add ghost nodes to current notebook as real nodes
    state.ghostNodes.forEach(node => {
        state.nodes.push(node);
    });

    // Add edges
    if (state.pendingMove && state.pendingMove.edges) {
        state.pendingMove.edges.forEach(edge => {
            state.edges.push(edge);
        });
    }

    // Select the newly placed nodes
    state.selectedNodes = state.ghostNodes.map(n => n.id);

    // Remove nodes from source notebook (using original IDs)
    if (state.pendingMove) {
        const sourceProjectId = state.pendingMove.sourceProjectId;
        const sourceProjectName = state.pendingMove.sourceProjectName;

        removeNodesFromSourceNotebook(
            sourceProjectId,
            state.pendingMove.originalIds
        );

        // Show toast with link back to source notebook
        const message = `Moved ${state.ghostNodes.length} note${state.ghostNodes.length > 1 ? 's' : ''} from ${sourceProjectName}`;
        showToast(message, {
            linkText: `Return to ${sourceProjectName}`,
            linkOnClick: () => openProject(sourceProjectId)
        });
    }

    // Clear ghost state
    state.ghostNodes = [];
    state.ghostDragging = false;
    state.pendingMove = null;

    // Remove ghost drag cursor
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.classList.remove('ghost-drag-mode');

    render();

    // Save immediately to target notebook (don't wait for auto-save)
    state.saveQueue.push({
        timestamp: Date.now(),
        projectId: state.currentProjectId
    });
    processSaveQueue(); // Start immediately but don't await (async operation)
}

function cancelGhostDrag() {
    if (!state.ghostDragging) return;

    // Store source info before clearing state
    const sourceProjectId = state.pendingMove ? state.pendingMove.sourceProjectId : null;
    const sourceProjectName = state.pendingMove ? state.pendingMove.sourceProjectName : null;

    state.ghostNodes = [];
    state.ghostDragging = false;
    state.pendingMove = null;

    // Remove ghost drag cursor
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.classList.remove('ghost-drag-mode');

    // Show toast with link back to source notebook
    if (sourceProjectId && sourceProjectName) {
        showToast('Move cancelled', {
            linkText: `Return to ${sourceProjectName}`,
            linkOnClick: () => openProject(sourceProjectId)
        });
    } else {
        showToast('Move cancelled');
    }

    render();
}

function removeNodesFromSourceNotebook(sourceProjectId, nodeIds) {
    // Load source project data
    const sourceData = localStorage.getItem(STORAGE_KEY_PREFIX + sourceProjectId);
    if (!sourceData) return;

    try {
        const project = JSON.parse(sourceData);

        // Remove nodes by ID
        project.nodes = project.nodes.filter(n => !nodeIds.includes(n.id));

        // Remove edges that reference removed nodes
        project.edges = project.edges.filter(edge =>
            !nodeIds.includes(edge[0]) && !nodeIds.includes(edge[1])
        );

        // Save back to localStorage
        localStorage.setItem(STORAGE_KEY_PREFIX + sourceProjectId, JSON.stringify(project));

        // Update note count in projects index
        const projects = getProjectsList();
        const sourceProject = projects.find(p => p.id === sourceProjectId);
        if (sourceProject) {
            sourceProject.noteCount = countNotes(project.nodes);
            saveProjectsIndex(projects);
        }
    } catch (e) {
        console.error('Error removing nodes from source notebook:', e);
    }
}

function showToast(message, options = {}) {
    // Toast notification with optional link
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'toast-notification';

    // Always use textContent for base message
    toast.textContent = message;

    // If a link is needed, append it programmatically
    if (options.linkText && options.linkOnClick) {
        toast.appendChild(document.createElement('br'));
        const link = document.createElement('a');
        link.href = '#';
        link.style.cssText = 'color: var(--highlight); text-decoration: underline; cursor: pointer;';
        link.textContent = options.linkText;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            toast.remove();
            options.linkOnClick();
        });
        toast.appendChild(link);
    }

    // Enable pointer events if there's a link
    const pointerEvents = options.hasLink ? 'auto' : 'none';

    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        color: var(--text-primary);
        padding: 12px 24px;
        border-radius: 8px;
        border: 1px solid var(--highlight);
        z-index: 1000;
        font-size: 14px;
        pointer-events: ${pointerEvents};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;
    document.body.appendChild(toast);

    // ESC key handler to dismiss toast
    const escHandler = (e) => {
        if (e.key === 'Escape' && document.getElementById('toast-notification')) {
            toast.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Auto-remove after duration (default 4s, or longer if has link)
    const duration = options.duration || (options.hasLink ? 6000 : 4000);
    const autoRemoveTimer = !message.includes('Click to place') ? setTimeout(() => {
        toast.remove();
        document.removeEventListener('keydown', escHandler);
    }, duration) : null;

    // Override toast.remove to clean up listener
    const originalRemove = toast.remove.bind(toast);
    toast.remove = () => {
        document.removeEventListener('keydown', escHandler);
        if (autoRemoveTimer) clearTimeout(autoRemoveTimer);
        originalRemove();
    };
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function showSettings(projectId) {
    const modal = document.getElementById('settings-modal');
    const toggle = document.getElementById('settings-task-toggle');

    if (projectId && projectId !== state.currentProjectId) {
        // Opened from context menu for a non-open project
        const data = loadProjectFromStorage(projectId);
        const settings = (data && data.settings) || { defaultCompletion: null };
        modal.dataset.projectId = projectId;
        updateSettingsToggle(toggle, settings.defaultCompletion === 'no');
    } else {
        // Opened from toolbar for the current project
        modal.dataset.projectId = state.currentProjectId;
        updateSettingsToggle(toggle, state.projectSettings.defaultCompletion === 'no');
    }

    modal.classList.remove('hidden');
}

function hideSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
    delete modal.dataset.projectId;
}

function updateSettingsToggle(toggle, isOn) {
    toggle.textContent = isOn ? 'On' : 'Off';
    toggle.classList.toggle('active', isOn);
}

function toggleSettingsTask() {
    const modal = document.getElementById('settings-modal');
    const toggle = document.getElementById('settings-task-toggle');
    const isOn = !toggle.classList.contains('active');

    updateSettingsToggle(toggle, isOn);
    const newValue = isOn ? 'no' : null;

    const targetId = modal.dataset.projectId;
    if (targetId === state.currentProjectId) {
        // Update in-memory settings for the currently open project
        state.projectSettings.defaultCompletion = newValue;
        scheduleAutoSave();
    } else {
        // Update localStorage directly for a non-open project
        const data = loadProjectFromStorage(targetId);
        if (data) {
            if (!data.settings) data.settings = {};
            data.settings.defaultCompletion = newValue;
            localStorage.setItem(STORAGE_KEY_PREFIX + targetId, JSON.stringify(data));
        }
    }
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

// Fallback download using data URL (for mobile/unsupported browsers)
function downloadAsFile(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Export current project to file
async function exportToFile() {
    if (!state.currentProjectId) {
        alert('No notebook open to export');
        return;
    }

    // Ensure root state is captured
    saveRootState();

    // Get project name for filename
    const projects = getProjectsList();
    const project = projects.find(p => p.id === state.currentProjectId);
    const filename = ((project ? project.name : 'knotebook-notes').slice(0, 100)) + '.json';

    const data = {
        version: 1,
        name: project ? project.name : 'Untitled',
        created: new Date().toISOString(),
        nodes: state.currentPath.length === 0 ? state.nodes : state.rootNodes,
        edges: state.currentPath.length === 0 ? state.edges : state.rootEdges,
        hashtagColors: state.hashtagColors,
        settings: state.projectSettings,
        hiddenHashtags: state.hiddenHashtags
    };

    // Try File System Access API first, fall back to data URL download
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(data, null, 2));
            await writable.close();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Export failed:', err);
                alert('Failed to export: ' + err.message);
            }
        }
    } else {
        // Fallback for mobile/unsupported browsers
        downloadAsFile(filename, data);
    }
}

// Export a specific project (from project menu)
async function exportProjectToFile(projectId) {
    const data = loadProjectFromStorage(projectId);
    if (!data) {
        alert('Notebook not found');
        return;
    }

    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    const filename = ((project ? project.name : 'knotebook-notes').slice(0, 100)) + '.json';

    const exportData = {
        version: 1,
        name: project ? project.name : 'Untitled',
        created: new Date().toISOString(),
        nodes: data.nodes || [],
        edges: data.edges || [],
        hashtagColors: data.hashtagColors || {},
        settings: data.settings || {},
        hiddenHashtags: data.hiddenHashtags || []
    };

    // Try File System Access API first, fall back to data URL download
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(exportData, null, 2));
            await writable.close();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Export failed:', err);
                alert('Failed to export: ' + err.message);
            }
        }
    } else {
        // Fallback for mobile/unsupported browsers
        downloadAsFile(filename, exportData);
    }
}

// Import from file (landing page)
async function importFromFile() {
    // Try File System Access API first, fall back to file input
    if (window.showOpenFilePicker) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });

            const file = await handle.getFile();
            const text = await file.text();
            const data = JSON.parse(text);

            // Store for import flow
            state.pendingImportData = data;

            // Show import modal
            const modal = document.getElementById('import-modal');
            const filename = document.getElementById('import-filename');
            filename.textContent = `File: ${file.name}`;

            // Hide overwrite button if no projects exist
            const overwriteBtn = document.getElementById('import-overwrite');
            const projects = getProjectsList();
            if (projects.length === 0) {
                overwriteBtn.style.display = 'none';
            } else {
                overwriteBtn.style.display = '';
            }

            modal.classList.remove('hidden');

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Import failed:', err);
                alert('Failed to import: ' + err.message);
            }
        }
    } else {
        // Fallback for mobile/unsupported browsers
        importFromFileFallback();
    }
}

// Fallback import using hidden file input
function importFromFileFallback() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Store for import flow
            state.pendingImportData = data;

            // Show import modal
            const modal = document.getElementById('import-modal');
            const filename = document.getElementById('import-filename');
            filename.textContent = `File: ${file.name}`;

            // Hide overwrite button if no projects exist
            const overwriteBtn = document.getElementById('import-overwrite');
            const projects = getProjectsList();
            if (projects.length === 0) {
                overwriteBtn.style.display = 'none';
            } else {
                overwriteBtn.style.display = '';
            }

            modal.classList.remove('hidden');

        } catch (err) {
            console.error('Import failed:', err);
            alert('Failed to import: ' + err.message);
        }
    });

    input.click();
}

function hideImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    state.pendingImportData = null;
}

function handleImportAsNew() {
    if (!state.pendingImportData) return;

    const name = state.pendingImportData.name || 'Imported Notebook';
    const projectId = createProject(name);

    // Save imported data to the new project
    const projectData = {
        version: 1,
        nodes: state.pendingImportData.nodes || [],
        edges: state.pendingImportData.edges || [],
        hashtagColors: state.pendingImportData.hashtagColors || {},
        settings: state.pendingImportData.settings || { defaultCompletion: null },
        hiddenHashtags: state.pendingImportData.hiddenHashtags || [],
        theme: state.pendingImportData.theme || getCurrentTheme()
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(projectData));

    // Update note count
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.noteCount = countNotes(projectData.nodes);
        saveProjectsIndex(projects);
    }

    hideImportModal();
    openProject(projectId);
}

async function handleImportOverwrite() {
    if (!state.pendingImportData) return;

    const projects = getProjectsList();
    if (projects.length === 0) {
        showToast('No existing notebooks to overwrite. Use "Create New Notebook" instead.');
        return;
    }

    // Show a simple selection
    const names = projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    const choice = prompt(`Enter the number of the project to overwrite:\n\n${names}`);

    if (!choice) return;

    const index = parseInt(choice) - 1;
    if (isNaN(index) || index < 0 || index >= projects.length) {
        alert('Invalid selection');
        return;
    }

    const targetProject = projects[index];
    const confirmed = await showConfirmation(`Overwrite "${targetProject.name}"? This cannot be undone.`);
    if (!confirmed) {
        return;
    }

    // Save imported data to the existing project
    const projectData = {
        version: 1,
        nodes: state.pendingImportData.nodes || [],
        edges: state.pendingImportData.edges || [],
        hashtagColors: state.pendingImportData.hashtagColors || {},
        settings: state.pendingImportData.settings || { defaultCompletion: null },
        hiddenHashtags: state.pendingImportData.hiddenHashtags || [],
        theme: state.pendingImportData.theme || getCurrentTheme()
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + targetProject.id, JSON.stringify(projectData));

    // Update note count
    targetProject.noteCount = countNotes(projectData.nodes);
    targetProject.modified = new Date().toISOString();
    saveProjectsIndex(projects);

    hideImportModal();
    openProject(targetProject.id);
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function initEventListeners() {
    const canvas = document.getElementById('canvas');
    const container = document.getElementById('canvas-container');

    // Mouse down on canvas
    canvas.addEventListener('mousedown', (e) => {
        const target = e.target;
        const nodeEl = target.closest('.node');
        const edgeEl = target.closest('.edge-group');

        if (nodeEl) {
            const nodeId = nodeEl.dataset.id;
            const node = state.nodes.find(n => n.id === nodeId);

            // Click on children indicator - enter the node
            if (target.classList.contains('node-stack')) {
                saveRootState();
                enterNode(nodeId);
                return;
            }

            // Click on completion indicator - cycle state
            if (target.closest('.node-completion')) {
                const node = state.nodes.find(n => n.id === nodeId);
                if (node) {
                    node.completion = cycleCompletion(node.completion);
                    render();
                }
                return;
            }

            if (e.shiftKey) {
                // Shift+click: start/complete edge creation (single or batch)
                if (state.edgeStartNode) {
                    // Complete edge creation to this target
                    completeEdgeCreation(nodeId);
                } else {
                    // Start edge creation from selected node(s)
                    if (state.selectedNodes.length > 1) {
                        // Batch mode: create edges from all selected nodes
                        startEdgeCreation();
                    } else if (state.selectedNodes.length === 1) {
                        // Single mode: use selected node
                        startEdgeCreation(state.selectedNodes[0]);
                    } else {
                        // No selection: use clicked node
                        startEdgeCreation(nodeId);
                    }
                }
            } else {
                // Regular click or Ctrl+click for multi-select/duplicate or Alt+click to remove
                const alreadySelected = state.selectedNodes.includes(nodeId);
                const ctrlHeld = e.ctrlKey || e.metaKey;
                const altHeld = e.altKey;

                // Alt+click: remove from selection (if already selected), or do nothing (if not selected)
                if (altHeld) {
                    if (alreadySelected) {
                        // Remove from selection
                        state.selectedNodes = state.selectedNodes.filter(id => id !== nodeId);
                        updateSelectionVisuals();
                        render();
                    }
                    // Whether selected or not, don't set up dragging or change selection further
                    return;
                }

                // Store ctrl state and drag start position
                state.ctrlHeld = ctrlHeld;
                state.dragStartPos = { x: e.clientX, y: e.clientY };
                state.dragThresholdMet = false;
                state.ctrlClickNode = null; // Reset

                if (ctrlHeld && !alreadySelected) {
                    // Ctrl+click on unselected node: add to selection
                    selectNode(nodeId, true);
                } else if (ctrlHeld && alreadySelected) {
                    // Ctrl+click on already-selected: mark for potential deselection on mouseup
                    state.ctrlClickNode = nodeId;
                } else if (!alreadySelected) {
                    // Click on unselected node: replace selection
                    selectNode(nodeId, false);
                } else {
                    // Click on already-selected node without Ctrl: keep selection
                    // Don't change selection
                }

                // Set up dragging state
                state.dragging = nodeId;
                const canvasPos = screenToCanvas(e.clientX, e.clientY);
                state.dragOffsets = {};
                state.selectedNodes.forEach(id => {
                    const n = state.nodes.find(n => n.id === id);
                    if (n) {
                        state.dragOffsets[id] = {
                            x: canvasPos.x - n.position.x,
                            y: canvasPos.y - n.position.y
                        };
                    }
                });
            }
        } else if (edgeEl) {
            const index = parseInt(edgeEl.dataset.index);
            selectEdge(index);
        } else {
            // Click on empty space - start panning or selection box
            if (state.edgeStartNode) {
                // Cancel edge creation
                state.edgeStartNode = null;
                clearEdgePreview();
            } else if (state.spacebarHeld || e.button === 1 || e.button === 2) {
                // Spacebar held, middle mouse, or right-click - pan (preserve selection)
                state.panning = true;
                state.panStart = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
            } else if (e.button === 0) {
                // Left click on empty canvas - start selection box
                // Mode (enclosed vs intersecting) determined by initial drag direction
                const canvasPos = screenToCanvas(e.clientX, e.clientY);
                state.selectionBox = {
                    start: { x: canvasPos.x, y: canvasPos.y },
                    end: { x: canvasPos.x, y: canvasPos.y },
                    mode: 'enclosed', // Default, will be determined by initial drag direction
                    locked: false,     // Mode not locked until initial direction detected
                    ctrlHeld: e.ctrlKey || e.metaKey,
                    altHeld: e.altKey
                };
                renderSelectionBox(); // Render immediately (even though it's a point)
            } else {
                // Other mouse buttons - pan
                state.panning = true;
                state.panStart = { x: e.clientX, y: e.clientY };
                canvas.style.cursor = 'grabbing';
            }
        }
    });

    // Handle context menu - show node menu or prevent default for selection box
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();

        // If we're in selection box mode, don't do anything else
        if (state.selectionBox) {
            return;
        }

        const target = e.target;
        const nodeEl = target.closest('.node');

        if (nodeEl) {
            // Right-click on node - show context menu
            const nodeId = nodeEl.dataset.id;
            // Select the node if not already selected
            if (!state.selectedNodes.includes(nodeId)) {
                selectNode(nodeId, false);
            }
            showNodeContextMenu(nodeId, e.clientX, e.clientY);
        }
        // Otherwise, context menu is prevented (used for selection box)
    });

    // Mouse move
    canvas.addEventListener('mousemove', (e) => {
        const canvasPos = screenToCanvas(e.clientX, e.clientY);

        // Update ghost cursor position if dragging ghosts
        if (state.ghostDragging) {
            state.ghostCursorPos = canvasPos;
            renderGhostNodes();
            return;
        }

        if (state.panning) {
            // Pan the canvas
            const dx = (e.clientX - state.panStart.x) / state.viewport.zoom;
            const dy = (e.clientY - state.panStart.y) / state.viewport.zoom;
            state.viewport.x -= dx;
            state.viewport.y -= dy;
            state.panStart = { x: e.clientX, y: e.clientY };
            updateViewport();
        }

        // Update selection box
        if (state.selectionBox) {
            const box = state.selectionBox;
            box.end = { x: canvasPos.x, y: canvasPos.y };

            // Detect initial drag direction to determine mode (only if not locked yet)
            if (!box.locked) {
                const dx = box.end.x - box.start.x;
                const dy = box.end.y - box.start.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Lock mode after moving at least 15 pixels
                if (distance >= 15) {
                    // Determine mode based on horizontal direction
                    if (dx > 0) {
                        box.mode = 'enclosed';  // Drag left-to-right = fully enclosed
                    } else {
                        box.mode = 'intersecting';  // Drag right-to-left = intersecting
                    }
                    box.locked = true;
                }
            }

            renderSelectionBox();
        }

        if (state.dragging && state.selectedNodes.length > 0) {
            // Check if we've exceeded the drag threshold (only for Ctrl+Drag)
            if (state.ctrlHeld && !state.dragThresholdMet && state.dragStartPos) {
                const dx = e.clientX - state.dragStartPos.x;
                const dy = e.clientY - state.dragStartPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance >= DRAG_THRESHOLD) {
                    // Threshold met - trigger duplication
                    state.dragThresholdMet = true;
                    state.duplicating = true;

                    const newNodeIds = [];
                    const idMapping = {}; // Maps original ID to copy ID
                    const newDragOffsets = {};

                    // Create deep copies of all selected nodes
                    state.selectedNodes.forEach(id => {
                        const originalNode = state.nodes.find(n => n.id === id);
                        if (originalNode) {
                            const copy = deepCopyNode(originalNode, 0, 0);
                            state.nodes.push(copy);
                            newNodeIds.push(copy.id);
                            idMapping[id] = copy.id;

                            // Use the same offsets for the copies
                            newDragOffsets[copy.id] = state.dragOffsets[id];
                        }
                    });

                    // Copy edges where both endpoints are in the selection
                    state.edges.forEach(edge => {
                        const [srcId, dstId] = edge;
                        if (idMapping[srcId] && idMapping[dstId]) {
                            state.edges.push([idMapping[srcId], idMapping[dstId]]);
                        }
                    });

                    // Select the new copies
                    state.selectedNodes = newNodeIds;
                    state.dragOffsets = newDragOffsets;
                    updateSelectionVisuals();
                }
            }

            // Move all selected nodes together (whether originals or duplicates)
            state.selectedNodes.forEach(nodeId => {
                const node = state.nodes.find(n => n.id === nodeId);
                const offset = state.dragOffsets[nodeId];
                if (node && offset) {
                    node.position.x = canvasPos.x - offset.x;
                    node.position.y = canvasPos.y - offset.y;
                }
            });
            render();
        }

        if (state.edgeStartNode) {
            renderEdgePreview(canvasPos.x, canvasPos.y);
        }

        // Title expansion on hover (only when not dragging/panning)
        if (!state.dragging && !state.panning) {
            const target = e.target;
            const nodeEl = target.closest('.node');

            // Clear any pending hover timeout
            if (state.hoverTimeout) {
                clearTimeout(state.hoverTimeout);
                state.hoverTimeout = null;
            }

            // Collapse all previously expanded titles
            document.querySelectorAll('.node-title-expanded').forEach(el => {
                const fullTitle = el.getAttribute('data-full-title');
                el.textContent = truncateText(fullTitle, 20);
                el.classList.remove('node-title-expanded');
            });

            // Expand title after delay if hovering over node body or title
            if (nodeEl && (target.classList.contains('node-body') || target.classList.contains('node-title'))) {
                const titleEl = nodeEl.querySelector('.node-title');
                if (titleEl) {
                    const fullTitle = titleEl.getAttribute('data-full-title');
                    if (fullTitle && fullTitle.length > 20) {
                        state.hoverTimeout = setTimeout(() => {
                            titleEl.textContent = fullTitle;
                            titleEl.classList.add('node-title-expanded');
                            state.hoverTimeout = null;
                        }, HOVER_DELAY);
                    }
                }
            }
        }
    });

    // Mouse up
    canvas.addEventListener('mouseup', (e) => {
        // Place ghost nodes if in ghost dragging mode
        if (state.ghostDragging) {
            placeGhostNodes();
            return;
        }

        // Check if releasing over a node while in edge creation mode
        if (state.edgeStartNode) {
            const target = e.target;
            const nodeEl = target.closest('.node');
            if (nodeEl) {
                const targetNodeId = nodeEl.dataset.id;
                completeEdgeCreation(targetNodeId);
            }
        }

        // Handle Ctrl+Click deselection (if no drag occurred)
        if (state.ctrlClickNode && !state.dragThresholdMet) {
            // Deselect the node that was Ctrl+clicked (it was already selected)
            state.selectedNodes = state.selectedNodes.filter(id => id !== state.ctrlClickNode);
            updateSelectionVisuals();
            render();
        }

        // Complete selection box
        if (state.selectionBox) {
            const box = state.selectionBox;
            const selectedIds = getNodesInSelectionBox(box);

            if (!box.ctrlHeld && !box.altHeld) {
                // Replace selection
                state.selectedNodes = selectedIds;
            } else if (box.ctrlHeld) {
                // Add to selection
                selectedIds.forEach(id => {
                    if (!state.selectedNodes.includes(id)) {
                        state.selectedNodes.push(id);
                    }
                });
            } else if (box.altHeld) {
                // Remove from selection
                state.selectedNodes = state.selectedNodes.filter(id => !selectedIds.includes(id));
            }

            clearSelectionBox();
            updateSelectionVisuals();
            render();
        }

        state.dragging = null;
        state.duplicating = false;
        state.ctrlHeld = false;
        state.ctrlClickNode = null;
        state.dragStartPos = null;
        state.dragThresholdMet = false;
        if (state.panning) {
            state.panning = false;
            canvas.style.cursor = 'default';
        }
    });

    // Mouse leave - stop panning if mouse leaves canvas
    canvas.addEventListener('mouseleave', () => {
        if (state.panning) {
            state.panning = false;
            canvas.style.cursor = 'default';
        }
    });

    // Mouse wheel for zooming
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        zoomAtPoint(e.deltaY, e.clientX, e.clientY);
    }, { passive: false });

    // Touch state for mobile
    let touchStartNode = null;
    let touchStartEdge = false;  // Track if touch started on an edge
    let touchStartPos = null;
    let touchMoved = false;
    let longPressTimer = null;
    let pinchStartDist = null;
    let pinchStartZoom = null;
    let lastTapTime = 0;
    let lastTapNode = null;
    let tapToAddMode = false;  // After long-press, taps add to selection

    // Helper to get distance between two touches
    function getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Helper to get center point between two touches
    function getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }

    // Touch start (for mobile drag and pan)
    canvas.addEventListener('touchstart', (e) => {
        // Close hashtag sidebar on touch (mobile UX)
        const sidebar = document.getElementById('hashtag-sidebar');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            hideSidebar();
        }

        // Handle pinch zoom (2 fingers)
        if (e.touches.length === 2) {
            e.preventDefault();
            pinchStartDist = getTouchDistance(e.touches);
            pinchStartZoom = state.viewport.zoom;
            // Cancel any single-touch operations
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            touchStartNode = null;
            state.panning = false;
            state.dragging = null;
            return;
        }

        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const nodeEl = target?.closest('.node');
        const edgeEl = target?.closest('.edge-group');

        touchMoved = false;
        touchStartPos = { x: touch.clientX, y: touch.clientY };

        if (nodeEl) {
            e.preventDefault();
            const nodeId = nodeEl.dataset.id;

            // Touch on children indicator - enter the node immediately
            if (target?.classList.contains('node-stack')) {
                saveRootState();
                enterNode(nodeId);
                return;
            }

            // Touch on completion indicator - cycle state
            if (target?.closest('.node-completion')) {
                const node = state.nodes.find(n => n.id === nodeId);
                if (node) {
                    node.completion = cycleCompletion(node.completion);
                    render();
                }
                return;
            }

            // Touch on node - remember it, but don't drag yet
            touchStartNode = nodeId;

            // Start long-press timer for multi-select toggle
            longPressTimer = setTimeout(() => {
                if (touchStartNode && !touchMoved) {
                    // Long press detected - add to selection and enable tap-to-add mode
                    selectNode(touchStartNode, true);
                    tapToAddMode = true;  // Enable tap-to-add mode
                    // Vibrate if available for feedback
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }
                longPressTimer = null;
            }, 500); // 500ms for long press
        } else if (edgeEl) {
            // Touch on edge - select it and show action bar
            e.preventDefault();
            const index = parseInt(edgeEl.dataset.index);
            selectEdge(index);
            touchStartNode = null;
            touchStartEdge = true;
        } else {
            // Touch on empty space - start panning, selection box, or cancel edge mode
            e.preventDefault();
            touchStartNode = null;

            if (state.edgeStartNode) {
                // Cancel edge creation
                state.edgeStartNode = null;
                clearEdgePreview();
            } else {
                // Start long-press timer for selection box
                const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
                longPressTimer = setTimeout(() => {
                    if (!touchMoved && !state.panning) {
                        // Long press on empty canvas - start selection box
                        state.selectionBox = {
                            start: canvasPos,
                            end: canvasPos,
                            mode: 'enclosed',  // Default to enclosed, can change based on drag direction
                            locked: false
                        };
                        // Vibrate for feedback
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                    longPressTimer = null;
                }, 500);

                // Also start panning (will be cancelled if selection box starts)
                state.panning = true;
                state.panStart = { x: touch.clientX, y: touch.clientY };
            }
        }
    }, { passive: false });

    // Touch move (for mobile drag and pan)
    canvas.addEventListener('touchmove', (e) => {
        // Update ghost cursor position if dragging ghosts
        if (state.ghostDragging && e.touches.length === 1) {
            const touch = e.touches[0];
            const canvasPos = screenToCanvas(touch.clientX, touch.clientY);
            state.ghostCursorPos = canvasPos;
            renderGhostNodes();
            return;
        }

        // Handle pinch zoom
        if (e.touches.length === 2 && pinchStartDist !== null) {
            e.preventDefault();
            hideActionBar();
            const currentDist = getTouchDistance(e.touches);
            const scale = currentDist / pinchStartDist;
            const newZoom = Math.max(0.5, Math.min(5, pinchStartZoom * scale));

            // Zoom toward center of pinch
            const center = getTouchCenter(e.touches);
            const canvasBefore = screenToCanvas(center.x, center.y);

            state.viewport.zoom = newZoom;

            const canvasAfter = screenToCanvas(center.x, center.y);
            state.viewport.x += canvasBefore.x - canvasAfter.x;
            state.viewport.y += canvasBefore.y - canvasAfter.y;

            updateViewport();
            return;
        }

        if (e.touches.length !== 1) return;

        const touch = e.touches[0];

        // Cancel long-press if moved
        if (longPressTimer) {
            const dx = Math.abs(touch.clientX - touchStartPos.x);
            const dy = Math.abs(touch.clientY - touchStartPos.y);
            if (dx > 5 || dy > 5) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }

        // Check if we've moved enough to count as a drag (5px threshold)
        if (!touchMoved && touchStartPos) {
            const dx = Math.abs(touch.clientX - touchStartPos.x);
            const dy = Math.abs(touch.clientY - touchStartPos.y);
            if (dx > 5 || dy > 5) {
                touchMoved = true;

                // If we started on a node, begin dragging it now
                if (touchStartNode) {
                    const node = state.nodes.find(n => n.id === touchStartNode);
                    if (node) {
                        // If the node isn't already selected, select only it
                        if (!state.selectedNodes.includes(touchStartNode)) {
                            selectNode(touchStartNode);
                        }
                        state.dragging = touchStartNode;
                        const canvasPos = screenToCanvas(touchStartPos.x, touchStartPos.y);
                        // Store drag offsets for ALL selected nodes (for multi-drag)
                        state.dragOffsets = {};
                        state.selectedNodes.forEach(id => {
                            const n = state.nodes.find(n => n.id === id);
                            if (n) {
                                state.dragOffsets[id] = {
                                    x: canvasPos.x - n.position.x,
                                    y: canvasPos.y - n.position.y
                                };
                            }
                        });
                    }
                }
            }
        }

        const canvasPos = screenToCanvas(touch.clientX, touch.clientY);

        // Update selection box if active
        if (state.selectionBox) {
            e.preventDefault();
            state.selectionBox.end = canvasPos;

            // Detect drag direction for mode (enclosed vs intersecting)
            if (!state.selectionBox.locked) {
                const dx = state.selectionBox.end.x - state.selectionBox.start.x;
                if (Math.abs(dx) > 15) {
                    state.selectionBox.locked = true;
                    state.selectionBox.mode = dx > 0 ? 'enclosed' : 'intersecting';
                }
            }

            // Cancel panning if selection box started
            state.panning = false;

            render();
            return;
        }

        if (state.panning) {
            e.preventDefault();
            hideActionBar();
            const dx = (touch.clientX - state.panStart.x) / state.viewport.zoom;
            const dy = (touch.clientY - state.panStart.y) / state.viewport.zoom;
            state.viewport.x -= dx;
            state.viewport.y -= dy;
            state.panStart = { x: touch.clientX, y: touch.clientY };
            updateViewport();
        }

        if (state.dragging && state.selectedNodes.length > 0) {
            e.preventDefault();
            // Move all selected nodes together
            state.selectedNodes.forEach(nodeId => {
                const node = state.nodes.find(n => n.id === nodeId);
                const offset = state.dragOffsets[nodeId];
                if (node && offset) {
                    node.position.x = canvasPos.x - offset.x;
                    node.position.y = canvasPos.y - offset.y;

                    // Update just the node's transform without full re-render
                    const nodeEl = document.querySelector(`.node[data-id="${nodeId}"]`);
                    if (nodeEl) {
                        nodeEl.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);
                    }
                }
            });

            // Update connected edges
            renderEdges();
        }
    }, { passive: false });

    // Touch end
    canvas.addEventListener('touchend', (e) => {
        // Place ghost nodes if in ghost dragging mode
        if (state.ghostDragging) {
            placeGhostNodes();
            // Clear touch state
            touchStartNode = null;
            touchStartEdge = false;
            touchStartPos = null;
            touchMoved = false;
            return;
        }

        // Clear long-press timer
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }

        // Reset pinch state
        pinchStartDist = null;
        pinchStartZoom = null;

        // If there are still touches, don't reset everything
        if (e.touches.length > 0) return;

        // Complete selection box if active
        if (state.selectionBox) {
            const selectedIds = getNodesInSelectionBox(state.selectionBox);
            if (selectedIds.length > 0) {
                // Add to existing selection
                selectedIds.forEach(id => {
                    if (!state.selectedNodes.includes(id)) {
                        state.selectedNodes.push(id);
                    }
                });
                updateSelectionVisuals();
            }
            clearSelectionBox();
            state.panning = false;
            touchMoved = false;
            touchStartNode = null;
            touchStartPos = null;
            return;
        }

        // If we didn't move, treat as a tap
        if (!touchMoved && touchStartNode) {
            const now = Date.now();
            const isDoubleTap = (now - lastTapTime < 300) && (lastTapNode === touchStartNode);

            if (isDoubleTap) {
                // Double-tap on node - open editor
                openEditor(touchStartNode);
                lastTapTime = 0;
                lastTapNode = null;
                tapToAddMode = false;  // Exit tap-to-add mode
            } else if (state.edgeStartNode && state.edgeStartNode !== touchStartNode) {
                // Complete edge creation
                completeEdgeCreation(touchStartNode);
                lastTapTime = 0;
                lastTapNode = null;
            } else {
                // Single tap
                const alreadySelected = state.selectedNodes.includes(touchStartNode);

                if (tapToAddMode && !alreadySelected) {
                    // In tap-to-add mode - add to selection
                    selectNode(touchStartNode, true);
                } else if (alreadySelected) {
                    // Tap on already-selected node - show action bar
                    showActionBar();
                } else {
                    // Tap on unselected node - select it (replaces selection and exits tap-to-add)
                    selectNode(touchStartNode);
                    tapToAddMode = false;
                }
                lastTapTime = now;
                lastTapNode = touchStartNode;
            }
        } else if (!touchMoved && !touchStartNode && !touchStartEdge) {
            // Tap on empty space - deselect and exit tap-to-add mode
            clearSelection();
            tapToAddMode = false;
            lastTapTime = 0;
            lastTapNode = null;
        }

        // Full render after drag to sync everything
        if (touchMoved) {
            render();
        }

        // Reset touch state
        state.dragging = null;
        state.duplicating = false;
        state.panning = false;
        touchStartNode = null;
        touchStartEdge = false;
        touchStartPos = null;
        touchMoved = false;
    });

    // Double click to edit
    canvas.addEventListener('dblclick', (e) => {
        const nodeEl = e.target.closest('.node');
        if (nodeEl) {
            openEditor(nodeEl.dataset.id);
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't handle shortcuts when editing text
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
            return;
        }

        // Don't handle shortcuts when a modal is open
        const confirmModal = document.getElementById('confirm-modal');
        if (confirmModal && !confirmModal.classList.contains('hidden')) {
            return;
        }

        // Only handle shortcuts when in graph view
        const inGraphView = !document.getElementById('graph-view').classList.contains('hidden');
        if (!inGraphView) return;

        // Ctrl+S - Export to file
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            exportToFile();
        }

        // N - New note
        if (e.key.toLowerCase() === 'n' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            const centerScreen = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            const canvasPos = screenToCanvas(centerScreen.x, centerScreen.y);
            const x = canvasPos.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * 100;
            const y = canvasPos.y - NODE_HEIGHT / 2 + (Math.random() - 0.5) * 100;
            const node = createNode(x, y);
            selectNode(node.id);
            openEditor(node.id);
        }

        // Enter - Edit selected node(s)
        if (e.key === 'Enter' && state.selectedNodes.length > 0) {
            e.preventDefault();
            openEditor(state.selectedNodes[0]); // openEditor handles batch mode automatically
        }

        // F - Fit to view
        if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            fitToView();
        }

        // + or = - Zoom in
        if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            zoomAtPoint(-100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        // - - Zoom out
        if (e.key === '-') {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            zoomAtPoint(100, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        // 0 - Reset zoom to 100%
        if (e.key === '0' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            state.viewport.zoom = 1;
            updateViewport();
        }

        // C - Start connect/edge mode (from selected node, only if single selection)
        if (e.key.toLowerCase() === 'c' && !e.ctrlKey && !e.metaKey && state.selectedNodes.length === 1) {
            e.preventDefault();
            if (state.edgeStartNode) {
                // Already in edge mode, cancel
                state.edgeStartNode = null;
                clearEdgePreview();
            } else {
                // Start edge creation from selected node
                startEdgeCreation(state.selectedNodes[0]);
            }
        }

        // ? - Show help
        if (e.key === '?') {
            e.preventDefault();
            showHelp();
        }

        // S - Focus text search
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            document.getElementById('text-search-input').focus();
        }

        // / - Open sidebar and focus hashtag filter
        if (e.key === '/') {
            e.preventDefault();
            showSidebar();
            document.getElementById('hashtag-input').focus();
        }

        // H - Toggle hashtag sidebar
        if (e.key.toLowerCase() === 'h' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleSidebar();
        }

        // Delete or Backspace - Delete selected
        if (e.key === 'Delete' || (e.key === 'Backspace' && !e.altKey)) {
            if (state.selectedNodes.length > 0) {
                e.preventDefault();
                const count = state.selectedNodes.length;
                const msg = count === 1
                    ? 'Delete this note? Any children will be moved to the current level.'
                    : `Delete ${count} notes? Any children will be moved to the current level.`;
                showConfirmation(msg).then(confirmed => {
                    if (confirmed) {
                        // Delete all selected nodes (copy array since deleteNode modifies it)
                        [...state.selectedNodes].forEach(nodeId => deleteNode(nodeId));
                    }
                });
            } else if (state.selectedEdge !== null) {
                deleteSelectedEdge();
            }
        }

        // Escape - Save editor or clear selection (also closes modals)
        if (e.key === 'Escape') {
            // Cancel ghost drag if active
            if (state.ghostDragging) {
                cancelGhostDrag();
                return;
            }

            const editorModal = document.getElementById('editor-modal');
            const helpModal = document.getElementById('help-modal');
            const settingsModal = document.getElementById('settings-modal');
            const moveToModal = document.getElementById('move-to-modal');
            if (!editorModal.classList.contains('hidden')) {
                saveEditor();
            } else if (!settingsModal.classList.contains('hidden')) {
                hideSettings();
            } else if (!helpModal.classList.contains('hidden')) {
                hideHelp();
            } else if (!moveToModal.classList.contains('hidden')) {
                hideMoveToModal();
            } else if (state.edgeStartNode) {
                state.edgeStartNode = null;
                clearEdgePreview();
            } else {
                clearSelection();
            }
        }

        // Alt+Up Arrow - Go back in navigation
        if (e.key === 'ArrowUp' && e.altKey) {
            e.preventDefault();
            goBack();
        }

        // Ctrl+] - Bring to front
        if (e.key === ']' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            bringToFront();
        }

        // Ctrl+[ - Send to back
        if (e.key === '[' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            sendToBack();
        }

        // Spacebar - Enter pan mode
        if (e.key === ' ' && !state.spacebarHeld) {
            e.preventDefault();
            state.spacebarHeld = true;
            const canvas = document.getElementById('canvas');
            canvas.classList.add('pan-mode');
        }
    });

    // Spacebar keyup - Exit pan mode
    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            state.spacebarHeld = false;
            const canvas = document.getElementById('canvas');
            canvas.classList.remove('pan-mode');
        }
    });

    // Toolbar buttons
    document.getElementById('add-node-btn').addEventListener('click', () => {
        // Create node in center of visible viewport
        const rect = container.getBoundingClientRect();
        const centerScreen = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        const canvasPos = screenToCanvas(centerScreen.x, centerScreen.y);
        const x = canvasPos.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * 100;
        const y = canvasPos.y - NODE_HEIGHT / 2 + (Math.random() - 0.5) * 100;
        const node = createNode(x, y);
        selectNode(node.id);
        openEditor(node.id);
    });

    document.getElementById('fit-view-btn').addEventListener('click', fitToView);
    document.getElementById('home-btn').addEventListener('click', goHome);
    document.getElementById('help-btn').addEventListener('click', showHelp);
    document.getElementById('help-close').addEventListener('click', hideHelp);

    // Close help modal when clicking outside
    document.getElementById('help-modal').addEventListener('click', (e) => {
        if (e.target.id === 'help-modal') {
            hideHelp();
        }
    });

    // Settings modal
    document.getElementById('settings-btn').addEventListener('click', () => showSettings());
    document.getElementById('settings-close').addEventListener('click', hideSettings);
    document.getElementById('settings-task-toggle').addEventListener('click', toggleSettingsTask);
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') {
            hideSettings();
        }
    });

    document.getElementById('save-btn').addEventListener('click', exportToFile);

    // Import modal buttons
    document.getElementById('import-new').addEventListener('click', handleImportAsNew);
    document.getElementById('import-overwrite').addEventListener('click', handleImportOverwrite);
    document.getElementById('import-cancel').addEventListener('click', hideImportModal);

    // Move to modal buttons
    document.getElementById('move-to-cancel').addEventListener('click', hideMoveToModal);
    document.getElementById('move-to-modal').addEventListener('click', (e) => {
        if (e.target.id === 'move-to-modal') {
            hideMoveToModal();
        }
    });
    document.getElementById('move-to-list').addEventListener('click', (e) => {
        const item = e.target.closest('.move-to-item');
        if (item) {
            const targetProjectId = item.dataset.projectId;
            hideMoveToModal();
            initiateMoveToNotebook(targetProjectId);
        }
    });

    // Landing page buttons
    document.getElementById('new-project-btn').addEventListener('click', newProject);
    document.getElementById('import-project-btn').addEventListener('click', importFromFile);

    // New project modal
    document.getElementById('new-project-create').addEventListener('click', handleCreateProject);
    document.getElementById('new-project-cancel').addEventListener('click', hideNewProjectModal);
    document.getElementById('new-project-name').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleCreateProject();
        if (e.key === 'Escape') hideNewProjectModal();
    });

    // Project menu actions
    document.querySelectorAll('.project-menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const action = item.dataset.action;
            const projectId = state.activeMenuProjectId;
            hideProjectMenu();

            if (action === 'rename') handleRenameProject(projectId);
            else if (action === 'settings') showSettings(projectId);
            else if (action === 'delete') handleDeleteProject(projectId);
            else if (action === 'export') exportProjectToFile(projectId);
        });
    });

    // Close project menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#project-menu') && !e.target.closest('.project-menu-btn')) {
            hideProjectMenu();
        }
    });

    // Close context menus when clicking anywhere
    document.addEventListener('mousedown', (e) => {
        const hashtagMenu = document.getElementById('hashtag-context-menu');
        if (hashtagMenu && !e.target.closest('#hashtag-context-menu')) {
            hideHashtagContextMenu();
        }

        const nodeMenu = document.getElementById('node-context-menu');
        if (nodeMenu && !e.target.closest('#node-context-menu')) {
            hideNodeContextMenu();
        }
    });

    // Editor buttons — Cancel (X) reverts changes, Save closes (mobile only)
    document.getElementById('editor-cancel').addEventListener('click', cancelEditor);
    document.getElementById('editor-save-mobile').addEventListener('click', saveEditor);
    // Click outside editor content to save (only if mousedown also started on backdrop,
    // so dragging a text selection out of the editor doesn't accidentally close it)
    let editorMouseDownOnBackdrop = false;
    document.getElementById('editor-modal').addEventListener('mousedown', (e) => {
        editorMouseDownOnBackdrop = (e.target.id === 'editor-modal');
    });
    document.getElementById('editor-modal').addEventListener('click', (e) => {
        if (e.target.id === 'editor-modal' && editorMouseDownOnBackdrop) {
            saveEditor();
        }
        editorMouseDownOnBackdrop = false;
    });

    // Editor enter button (save then view nested notes)
    document.getElementById('editor-enter').addEventListener('click', () => {
        const modal = document.getElementById('editor-modal');
        const nodeId = modal.dataset.nodeId;
        const node = state.nodes.find(n => n.id === nodeId);

        // Sync editor fields to node before navigating
        if (node) {
            const titleInput = document.getElementById('note-title');
            const textarea = document.getElementById('note-text');
            node.title = titleInput.value;
            node.content = textarea.value;
            node.hashtags = parseHashtags(textarea.value);
            node.modified = new Date().toISOString();
            const activeBtn = document.querySelector('.completion-btn.active');
            const val = activeBtn ? activeBtn.dataset.value : '';
            node.completion = val || null;
        }

        state.editorSnapshot = null;
        closeEditor();
        saveRootState();
        enterNode(nodeId);
    });

    // Enter in title field saves, Escape saves
    document.getElementById('note-title').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEditor();
        }
        if (e.key === 'Escape') {
            saveEditor();
        }
    });

    // Textarea: autocomplete gets first chance, then Enter saves on desktop, Escape saves
    document.getElementById('note-text').addEventListener('keydown', (e) => {
        if (handleAutocompleteKeydown(e)) return;
        // On desktop: Enter saves (unless Shift). On mobile: Enter always inserts newline
        const isMobile = window.innerWidth <= 600;
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            saveEditor();
        }
        if (e.key === 'Escape') {
            saveEditor();
        }
    });

    // Update hashtags as user types + autocomplete
    document.getElementById('note-text').addEventListener('input', (e) => {
        const modal = document.getElementById('editor-modal');
        const isBatchMode = modal.dataset.batchMode === 'true';
        const hashtags = parseHashtags(e.target.value);

        // If any removed tags are now in the content, un-remove them
        hashtags.forEach(tag => {
            if (state.removedTagsInSession.has(tag)) {
                state.removedTagsInSession.delete(tag);
            }
        });

        if (isBatchMode) {
            // In batch mode, show all unique tags across selected nodes
            const nodes = state.selectedNodes.map(id => state.nodes.find(n => n.id === id)).filter(Boolean);
            const tagCounts = {};

            // Count existing tags in nodes
            nodes.forEach(node => {
                (node.hashtags || []).forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            });

            // Add newly typed tags (they have count 0 until saved)
            hashtags.forEach(tag => {
                if (!tagCounts[tag]) {
                    tagCounts[tag] = 0;
                }
            });

            // Combine all tags
            const allTags = [...new Set([...Object.keys(tagCounts), ...hashtags])];

            // Sort by frequency
            allTags.sort((a, b) => {
                if (tagCounts[b] !== tagCounts[a]) {
                    return tagCounts[b] - tagCounts[a];
                }
                return a.localeCompare(b);
            });

            updateHashtagDisplay(allTags, true, nodes.length, tagCounts);
        } else {
            // Single edit mode: show tags from content + removed tags
            const allTags = [...new Set([...hashtags, ...state.removedTagsInSession])].sort();
            updateHashtagDisplay(allTags, false, 1, {});
        }

        updateAutocompleteFromInput(e.target);
    });

    // Completion buttons in editor
    document.querySelectorAll('.completion-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            updateCompletionButtons(btn.dataset.value);
        });
    });

    // Breadcrumbs click to go back
    document.getElementById('breadcrumbs').addEventListener('click', () => {
        if (state.currentPath.length > 0) {
            goBack();
        }
    });
    document.getElementById('breadcrumbs').style.cursor = 'pointer';

    // Hashtag sidebar toggle
    document.getElementById('hashtag-sidebar-btn').addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-close').addEventListener('click', hideSidebar);

    // Close color pickers when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.color-picker-dropdown') && !e.target.closest('.hashtag-color-btn')) {
            closeAllColorPickers();
        }
    });

    // Hashtag search input + autocomplete
    document.getElementById('hashtag-input').addEventListener('input', (e) => {
        updateFilter(e.target.value);
        updateAutocompleteFromInput(e.target);
    });

    // Hashtag clear button
    document.getElementById('hashtag-clear').addEventListener('click', clearFilter);

    // Allow Escape to blur the search input and clear filter (autocomplete gets first chance)
    document.getElementById('hashtag-input').addEventListener('keydown', (e) => {
        if (handleAutocompleteKeydown(e)) return;
        if (e.key === 'Escape') {
            e.target.blur();
            clearFilter();
        }
    });

    // Click-outside to dismiss autocomplete
    document.addEventListener('mousedown', (e) => {
        if (autocomplete.active && !e.target.closest('#hashtag-autocomplete')) {
            hideAutocomplete();
        }
    });

    // Blur handlers for autocomplete inputs (delayed to allow mousedown on dropdown)
    document.getElementById('note-text').addEventListener('blur', () => {
        setTimeout(() => {
            if (autocomplete.active && autocomplete.targetInput &&
                autocomplete.targetInput.id === 'note-text') {
                hideAutocomplete();
            }
        }, 150);
    });
    document.getElementById('hashtag-input').addEventListener('blur', () => {
        setTimeout(() => {
            if (autocomplete.active && autocomplete.targetInput &&
                autocomplete.targetInput.id === 'hashtag-input') {
                hideAutocomplete();
            }
        }, 150);
    });

    // Text search input
    document.getElementById('text-search-input').addEventListener('input', (e) => {
        updateTextFilter(e.target.value);
    });

    // Text search clear button
    document.getElementById('text-search-clear').addEventListener('click', clearTextFilter);

    // Allow Escape to blur and clear text search
    document.getElementById('text-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.target.blur();
            clearTextFilter();
        }
    });

    // Selection action bar buttons
    document.getElementById('action-connect').addEventListener('click', () => {
        if (state.selectedNodes.length > 0) {
            if (state.edgeStartNode) {
                // Cancel if already in edge mode
                state.edgeStartNode = null;
                state.edgeStartNodes = null;
                clearEdgePreview();
            } else {
                // Start edge creation (single or batch)
                if (state.selectedNodes.length === 1) {
                    startEdgeCreation(state.selectedNodes[0]);
                } else {
                    // Batch connect mode (no toast - behavior is clear from context)
                    startEdgeCreation();
                }
            }
        }
    });

    document.getElementById('action-move-to').addEventListener('click', () => {
        hideActionBar();
        showMoveToModal();
    });

    document.getElementById('action-bring-front').addEventListener('click', () => {
        bringToFront();
        hideActionBar();
    });

    document.getElementById('action-send-back').addEventListener('click', () => {
        sendToBack();
        hideActionBar();
    });

    document.getElementById('action-duplicate').addEventListener('click', () => {
        if (state.selectedNodes.length > 0) {
            const offset = 30; // Offset for duplicated nodes
            const newNodeIds = [];
            const idMapping = {};

            // Create deep copies of all selected nodes
            state.selectedNodes.forEach(id => {
                const originalNode = state.nodes.find(n => n.id === id);
                if (originalNode) {
                    const copy = deepCopyNode(originalNode, offset, offset);
                    state.nodes.push(copy);
                    newNodeIds.push(copy.id);
                    idMapping[id] = copy.id;
                }
            });

            // Copy edges where both endpoints are in the selection
            state.edges.forEach(edge => {
                const [srcId, dstId] = edge;
                if (idMapping[srcId] && idMapping[dstId]) {
                    state.edges.push([idMapping[srcId], idMapping[dstId]]);
                }
            });

            // Select the new copies
            state.selectedNodes = newNodeIds;
            hideActionBar();
            render();
        }
    });

    document.getElementById('action-delete').addEventListener('click', () => {
        if (state.selectedNodes.length > 0) {
            const count = state.selectedNodes.length;
            let msg;
            if (count === 1) {
                const node = state.nodes.find(n => n.id === state.selectedNodes[0]);
                const childCount = node?.children?.length || 0;
                msg = 'Delete this note?';
                if (childCount > 0) {
                    msg = `Delete this note? Its ${childCount} child note${childCount > 1 ? 's' : ''} will be moved to this level.`;
                }
            } else {
                msg = `Delete ${count} notes? Any children will be moved to the current level.`;
            }
            showConfirmation(msg).then(confirmed => {
                if (confirmed) {
                    // Delete all selected nodes (copy array since deleteNode modifies it)
                    [...state.selectedNodes].forEach(nodeId => deleteNode(nodeId));
                    hideActionBar();
                }
            });
        } else if (state.selectedEdge !== null) {
            deleteSelectedEdge();
            hideActionBar();
        }
    });

    // Close sidebar when tapping canvas on mobile
    canvas.addEventListener('touchstart', () => {
        const sidebar = document.getElementById('hashtag-sidebar');
        if (!sidebar.classList.contains('hidden')) {
            hideSidebar();
        }
    }, { passive: true });

    // Save status error click - show details
    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
        saveStatus.addEventListener('click', () => {
            if (state.saveStatus === 'error' && state.lastSaveError) {
                alert(`Save failed: ${state.lastSaveError}\n\nConsider exporting your work to avoid data loss.`);
            }
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    // Check if localStorage is available
    if (!isLocalStorageAvailable()) {
        showStorageUnavailableWarning();
    }

    // Clear any stale pending move operations from browser refresh
    try {
        sessionStorage.removeItem(MOVE_STORAGE_KEY);
    } catch (e) {
        console.warn('sessionStorage not available:', e);
    }

    loadSavedTheme();
    initThemeSelector();
    initEventListeners();
    showLandingPage();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

// Warn before closing if there are pending or in-progress saves
window.addEventListener('beforeunload', (e) => {
    // Block navigation if save is pending, in progress, or queued
    if (state.saveInProgress ||
        state.saveQueue.length > 0 ||
        state.saveStatus === 'pending' ||
        state.saveStatus === 'saving' ||
        state.autoSaveTimeout) {
        // Browser will show a generic warning dialog
        e.preventDefault();
        e.returnValue = ''; // Chrome requires returnValue to be set
        return ''; // Some browsers show this message
    }
});
