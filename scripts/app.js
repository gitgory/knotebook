/**
 * knotebook - Main Application
 * A visual note-taking app with graph structure
 */

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Global error boundary - catches all uncaught exceptions
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Uncaught error:', error);
    showErrorRecoveryUI(error || new Error(message));
    return true; // Prevent default browser error handling
};

// Global promise rejection handler
window.onunhandledrejection = function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorRecoveryUI(event.reason);
    event.preventDefault(); // Prevent default browser handling
};

/**
 * Displays the error recovery modal with error details and recovery options.
 * Provides three actions: export data, reload app, or try to continue.
 * Falls back to alert() if modal doesn't exist yet (early initialization errors).
 *
 * @param {Error|string} error - The error object or message to display
 * @returns {void}
 */
function showErrorRecoveryUI(error) {
    const modal = document.getElementById('error-modal');
    const messageEl = document.getElementById('error-message');
    const stackEl = document.getElementById('error-stack');

    if (!modal) {
        // Fallback if modal doesn't exist yet
        alert('A critical error occurred. Please refresh the page.\n\n' + (error?.message || error));
        return;
    }

    // Set error message
    const errorMessage = error?.message || String(error) || 'Unknown error';
    messageEl.textContent = 'An unexpected error occurred: ' + errorMessage;

    // Set stack trace
    const stack = error?.stack || 'No stack trace available';
    const browserInfo = `Browser: ${navigator.userAgent}\nTime: ${new Date().toISOString()}`;
    stackEl.textContent = stack + '\n\n' + browserInfo;

    // Show modal
    modal.classList.remove('hidden');
}

/**
 * Hides the error recovery modal, allowing user to continue using the app.
 * Called when user clicks "Try to Continue" button.
 *
 * @returns {void}
 */
function hideErrorRecoveryUI() {
    const modal = document.getElementById('error-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/**
 * Exports current notebook data as emergency backup during error recovery.
 * If a notebook is open, exports that notebook. Otherwise exports all projects list.
 * Provides last-resort data recovery when app is in error state.
 *
 * @returns {Promise<void>}
 */
async function exportCurrentDataForRecovery() {
    try {
        // Try to export current project if one is open
        if (state.currentProjectId) {
            exportCurrentProject();
        } else {
            // Export all projects list
            const projects = getProjectsList();
            const data = {
                projects: projects,
                exportedAt: new Date().toISOString(),
                note: 'Emergency export from error recovery'
            };
            downloadAsFile('knotebook-emergency-backup.json', JSON.stringify(data, null, 2));
        }
        showToast('Data exported successfully', { duration: EXPORT_SUCCESS_TOAST });
    } catch (exportError) {
        console.error('Failed to export data:', exportError);
        await showAlert('Failed to export data. Please try manually copying localStorage.', 'Export Error');
    }
}

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
    projectSettings: {
        fieldDefaults: { completion: null, priority: null },  // Default values for First-Class fields
        customFields: []  // Second-Class field definitions
    },
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
    savedFadeTimeout: null,        // Timeout for fading out "Saved" status

    // Render throttling
    renderScheduled: false         // True when render is scheduled for next frame
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

/**
 * First Class Field Definitions
 * Data-driven configuration for node fields with visual indicators.
 */
const FIRST_CLASS_FIELDS = {
    completion: {
        position: {
            offsetX: 20,  // From right edge
            offsetY: 22   // From top
        },
        states: {
            'no': {
                label: 'To do',
                icon: null,
                iconType: 'circle',
                color: 'var(--text-secondary)',
                cssClass: 'completion-no',
                marksCompleted: false
            },
            'partial': {
                label: 'Partial',
                icon: '◐',
                iconType: 'text',
                color: '#f97316',
                cssClass: 'completion-partial',
                marksCompleted: false,
                iconYOffset: 1
            },
            'yes': {
                label: 'Done',
                icon: '✓',
                iconType: 'text',
                color: '#22c55e',
                cssClass: 'completion-yes',
                marksCompleted: true
            },
            'cancelled': {
                label: 'Cancelled',
                icon: '✕',
                iconType: 'text',
                color: '#ef4444',
                cssClass: 'completion-cancelled',
                marksCompleted: true
            }
        },
        cycleOrder: ['no', 'partial', 'yes', 'cancelled'],
        noneState: { label: 'None', value: null }
    },
    priority: {
        position: {
            offsetX: 18,  // From right edge
            offsetY: 18   // From bottom edge (measured from NODE_HEIGHT)
        },
        states: {
            'low': {
                label: 'Low',
                icon: '▼',
                iconType: 'text',
                color: '#3b82f6',
                cssClass: 'priority-low'
            },
            'medium': {
                label: 'Medium',
                icon: '▬',
                iconType: 'text',
                color: '#eab308',
                cssClass: 'priority-medium'
            },
            'high': {
                label: 'High',
                icon: '▲',
                iconType: 'text',
                color: '#ef4444',
                cssClass: 'priority-high'
            }
        },
        cycleOrder: ['low', 'medium', 'high'],
        noneState: { label: 'None', value: null }
    }
};

/**
 * Gets the next completion state in the cycle.
 * @param {string|null} current - Current completion state
 * @returns {string} - Next completion state
 */
function getNextCompletionState(current) {
    const cycle = FIRST_CLASS_FIELDS.completion.cycleOrder;
    if (current === null || current === undefined) return cycle[0];
    const idx = cycle.indexOf(current);
    return cycle[(idx + 1) % cycle.length];
}

/**
 * Gets completion state configuration.
 * @param {string|null} state - Completion state value
 * @returns {Object|null} - State config or null
 */
function getCompletionStateConfig(state) {
    if (!state) return null;
    return FIRST_CLASS_FIELDS.completion.states[state] || null;
}

/**
 * Checks if a completion state marks node as completed (grayscale).
 * @param {string|null} state - Completion state value
 * @returns {boolean}
 */
function isCompletedState(state) {
    const config = getCompletionStateConfig(state);
    return config ? config.marksCompleted : false;
}

/**
 * Gets the next priority state in the cycle.
 * @param {string|null} current - Current priority state
 * @returns {string|null} - Next priority state, or null after 'high'
 */
function getNextPriorityState(current) {
    const cycle = FIRST_CLASS_FIELDS.priority.cycleOrder;
    if (current === null || current === undefined) return cycle[0];
    const idx = cycle.indexOf(current);
    // After last item, return null (none state)
    return idx === cycle.length - 1 ? null : cycle[idx + 1];
}

/**
 * Gets priority state configuration.
 * @param {string|null} state - Priority state value
 * @returns {Object|null} - State config or null
 */
function getPriorityStateConfig(state) {
    if (!state) return null;
    return FIRST_CLASS_FIELDS.priority.states[state] || null;
}

/**
 * Cycles to the next priority state.
 * @param {string|null} current - Current priority state
 * @returns {string|null} - Next priority state in the cycle
 */
function cyclePriority(current) {
    return getNextPriorityState(current);
}

// ============================================================================
// GENERIC FIRST CLASS FIELD HELPERS
// ============================================================================

/**
 * Gets active button value for any First Class Field.
 * @param {string} fieldName - Field name from FIRST_CLASS_FIELDS (e.g., 'completion')
 * @returns {string} - Active button's data-value or empty string
 */
function getFieldValue(fieldName) {
    const activeBtn = document.querySelector(`.${fieldName}-btn.active`);
    return activeBtn ? activeBtn.dataset.value : '';
}

/**
 * Checks if a field has an active button selection.
 * Used in batch mode to distinguish "no selection" from "None selected".
 * @param {string} fieldName - Field name
 * @returns {boolean} - True if any button is active
 */
function hasFieldSelection(fieldName) {
    return document.querySelector(`.${fieldName}-btn.active`) !== null;
}

/**
 * Sets active button for any First Class Field.
 * @param {string} fieldName - Field name from FIRST_CLASS_FIELDS
 * @param {string} value - Field value to set active
 */
function setFieldButtons(fieldName, value) {
    const buttons = document.querySelectorAll(`.${fieldName}-btn`);
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === (value || ''));
    });
}

/**
 * Gets all field values from editor (First-Class and Second-Class).
 * @returns {Object} - Object with fieldName: value pairs
 */
function getAllFieldValues() {
    const values = {};

    // Get First-Class field values (button-based)
    for (const fieldName in FIRST_CLASS_FIELDS) {
        values[fieldName] = getFieldValue(fieldName) || null;
    }

    // Get Second-Class field values (various input types)
    const customFields = getCustomFieldDefinitions();
    for (const fieldDef of customFields) {
        values[fieldDef.name] = getCustomFieldInputValue(fieldDef);
    }

    return values;
}

/**
 * Loads all field values into editor controls (First-Class and Second-Class).
 * Uses unified field storage (node.fields).
 * @param {Object} node - Node object with field values
 */
function loadAllFieldValues(node) {
    // Load First-Class field values into buttons
    for (const fieldName in FIRST_CLASS_FIELDS) {
        const value = getNodeFieldValue(node, fieldName) || '';
        setFieldButtons(fieldName, value);
    }

    // Load Second-Class field values into their inputs
    const customFields = getCustomFieldDefinitions();
    for (const fieldDef of customFields) {
        const value = getNodeFieldValue(node, fieldDef.name);
        setCustomFieldInputValue(fieldDef, value);
    }
}

/**
 * Updates all fields on a node (First-Class and Second-Class).
 * Uses unified field storage (node.fields).
 * @param {Object} node - Node to update
 * @param {Object} fieldValues - Object with fieldName: value pairs
 */
function updateNodeFields(node, fieldValues) {
    // Update First-Class fields
    for (const fieldName in FIRST_CLASS_FIELDS) {
        if (fieldName in fieldValues) {
            setNodeFieldValue(node, fieldName, fieldValues[fieldName]);
        }
    }

    // Update Second-Class fields
    const customFields = getCustomFieldDefinitions();
    for (const fieldDef of customFields) {
        if (fieldDef.name in fieldValues) {
            setNodeFieldValue(node, fieldDef.name, fieldValues[fieldDef.name]);
        }
    }
}

/**
 * Generic batch field updater.
 * Uses unified field storage (node.fields).
 * @param {Array} nodes - Nodes to update
 * @param {string} fieldName - Field name
 * @param {string} value - Field value
 */
function updateBatchField(nodes, fieldName, value) {
    if (!value) return;
    nodes.forEach(node => {
        setNodeFieldValue(node, fieldName, value);
    });
}

/**
 * Initializes button event listeners for all First Class Fields.
 */
function initializeFieldButtons() {
    for (const fieldName in FIRST_CLASS_FIELDS) {
        document.querySelectorAll(`.${fieldName}-btn`).forEach(btn => {
            btn.addEventListener('click', () => {
                setFieldButtons(fieldName, btn.dataset.value);
            });
        });
    }
}

// ============================================================================
// UNIFIED FIELD STORAGE (node.fields.{fieldName})
// ============================================================================

/**
 * Gets a field value from a node using unified storage.
 * All fields (First-Class and Second-Class) are stored in node.fields.{}.
 * @param {Object} node - Node object
 * @param {string} fieldName - Field name
 * @returns {*} - Field value or null
 */
function getNodeFieldValue(node, fieldName) {
    return node.fields?.[fieldName] ?? null;
}

/**
 * Sets a field value on a node using unified storage.
 * @param {Object} node - Node object
 * @param {string} fieldName - Field name
 * @param {*} value - Value to set (null/undefined removes the field)
 */
function setNodeFieldValue(node, fieldName, value) {
    if (!node.fields) node.fields = {};
    if (value === null || value === undefined || value === '') {
        delete node.fields[fieldName];
    } else {
        node.fields[fieldName] = value;
    }
}

/**
 * Migrates a node from legacy storage (top-level completion/priority) to unified storage (node.fields).
 * Called during data load to ensure backwards compatibility.
 * @param {Object} node - Node object to migrate
 */
function migrateNodeFields(node) {
    // Skip if already migrated (has fields object with data, or no legacy fields)
    if (node.fields && Object.keys(node.fields).length > 0) return;

    // Initialize fields object if needed
    if (!node.fields) node.fields = {};

    // Migrate completion from top-level
    if (node.completion !== undefined) {
        if (node.completion) {
            node.fields.completion = node.completion;
        }
        delete node.completion;
    }

    // Migrate priority from top-level
    if (node.priority !== undefined) {
        if (node.priority) {
            node.fields.priority = node.priority;
        }
        delete node.priority;
    }
}

/**
 * Migrates all nodes in an array from legacy to unified field storage.
 * Recursively migrates children.
 * @param {Array} nodes - Array of nodes to migrate
 */
function migrateAllNodeFields(nodes) {
    if (!nodes) return;
    for (const node of nodes) {
        migrateNodeFields(node);
        if (node.children && node.children.length > 0) {
            migrateAllNodeFields(node.children);
        }
    }
}

// ============================================================================
// UNIFIED FIELD DEFINITIONS (First-Class + Second-Class)
// ============================================================================

/**
 * Gets all field definitions for the current notebook.
 * Combines First-Class (global) and Second-Class (per-notebook) fields.
 * Returns normalized field definition objects for uniform handling.
 *
 * @param {Object} options - Options
 * @param {boolean} options.includeFirstClass - Include First Class Fields (default: true)
 * @param {boolean} options.includeSecondClass - Include Second Class Fields (default: true)
 * @returns {Array} - Array of normalized field definition objects
 */
function getFieldDefinitions({ includeFirstClass = true, includeSecondClass = true } = {}) {
    const fields = [];

    if (includeFirstClass) {
        for (const fieldName in FIRST_CLASS_FIELDS) {
            const config = FIRST_CLASS_FIELDS[fieldName];
            fields.push({
                name: fieldName,
                label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
                type: 'single-select',
                options: config.cycleOrder || [],
                isFirstClass: true,
                _config: config // Original config for rendering
            });
        }
    }

    if (includeSecondClass) {
        const customFields = state.projectSettings?.customFields || [];
        for (const field of customFields) {
            fields.push({
                ...field,
                isFirstClass: false
            });
        }
    }

    return fields;
}

/**
 * Gets the custom field definitions for the current notebook.
 * @returns {Array} - Array of custom field definitions
 */
function getCustomFieldDefinitions() {
    return state.projectSettings?.customFields || [];
}

/**
 * Gets value from a custom field input in the editor.
 * Handles different field types (single-select, text, number, date, checkbox, multi-select).
 * @param {Object} fieldDef - Field definition
 * @returns {*} - Field value
 */
function getCustomFieldInputValue(fieldDef) {
    switch (fieldDef.type) {
        case 'single-select':
            const activeBtn = document.querySelector(`.${fieldDef.name}-btn.active`);
            return activeBtn ? (activeBtn.dataset.value || null) : null;

        case 'multi-select':
            const selectedBtns = document.querySelectorAll(`.${fieldDef.name}-btn.active`);
            const values = [];
            selectedBtns.forEach(btn => {
                if (btn.dataset.value) values.push(btn.dataset.value);
            });
            return values.length > 0 ? values : null;

        case 'text':
            const textInput = document.querySelector(`input.field-input[data-field-name="${fieldDef.name}"]`);
            return textInput?.value || null;

        case 'number':
            const numInput = document.querySelector(`input.field-input[data-field-name="${fieldDef.name}"]`);
            if (!numInput || numInput.value === '') return null;
            return Number(numInput.value);

        case 'date':
            const dateInput = document.querySelector(`input.field-input[data-field-name="${fieldDef.name}"]`);
            return dateInput?.value || null;

        case 'checkbox':
            const checkbox = document.querySelector(`input.field-checkbox[data-field-name="${fieldDef.name}"]`);
            return checkbox ? checkbox.checked : false;

        default:
            return null;
    }
}

/**
 * Sets value in a custom field input in the editor.
 * Handles different field types.
 * @param {Object} fieldDef - Field definition
 * @param {*} value - Value to set
 */
function setCustomFieldInputValue(fieldDef, value) {
    switch (fieldDef.type) {
        case 'single-select':
            setFieldButtons(fieldDef.name, value || '');
            break;

        case 'multi-select':
            // Clear all buttons first
            document.querySelectorAll(`.${fieldDef.name}-btn`).forEach(btn => {
                btn.classList.remove('active');
            });
            // Activate selected values
            if (Array.isArray(value)) {
                value.forEach(v => {
                    const btn = document.querySelector(`.${fieldDef.name}-btn[data-value="${v}"]`);
                    if (btn) btn.classList.add('active');
                });
            }
            break;

        case 'text':
        case 'date':
            const textInput = document.querySelector(`input.field-input[data-field-name="${fieldDef.name}"]`);
            if (textInput) textInput.value = value ?? '';
            break;

        case 'number':
            const numInput = document.querySelector(`input.field-input[data-field-name="${fieldDef.name}"]`);
            if (numInput) numInput.value = value ?? '';
            break;

        case 'checkbox':
            const checkbox = document.querySelector(`input.field-checkbox[data-field-name="${fieldDef.name}"]`);
            if (checkbox) checkbox.checked = !!value;
            break;
    }
}

/**
 * Collects all used values for a custom field across all nodes.
 * Used for auto-complete/suggestions in single-select fields with allowNew.
 * @param {string} fieldName - Field name
 * @returns {Array} - Array of unique values used in this field
 */
function getFieldUsedValues(fieldName) {
    const values = new Set();

    function collectFromNodes(nodes) {
        for (const node of nodes) {
            const value = node.fields?.[fieldName];
            if (value !== null && value !== undefined) {
                if (Array.isArray(value)) {
                    value.forEach(v => values.add(v));
                } else {
                    values.add(value);
                }
            }
            if (node.children && node.children.length > 0) {
                collectFromNodes(node.children);
            }
        }
    }

    // Collect from current level and root
    collectFromNodes(state.nodes);
    if (state.rootNodes && state.rootNodes !== state.nodes) {
        collectFromNodes(state.rootNodes);
    }

    return Array.from(values).sort();
}

/**
 * Gets available options for a field, combining predefined options with used values.
 * For hybrid option handling (predefined + auto-collected).
 * @param {Object} fieldDef - Field definition
 * @returns {Array} - Array of option values
 */
function getFieldOptions(fieldDef) {
    const options = new Set(fieldDef.options || []);

    // Add used values if field allows new entries or has no predefined options
    if (fieldDef.allowNew || options.size === 0) {
        const usedValues = getFieldUsedValues(fieldDef.name);
        usedValues.forEach(v => options.add(v));
    }

    return Array.from(options).sort();
}

/**
 * Compares two field definitions for equality.
 * Used during import to detect conflicts.
 * @param {Object} field1 - First field definition
 * @param {Object} field2 - Second field definition
 * @returns {boolean} - True if definitions are equivalent
 */
function fieldDefinitionsMatch(field1, field2) {
    // Compare essential properties
    if (field1.type !== field2.type) return false;
    if (field1.label !== field2.label) return false;

    // For select types, compare options (order-independent)
    if (field1.type === 'single-select' || field1.type === 'multi-select') {
        const options1 = JSON.stringify([...(field1.options || [])].sort());
        const options2 = JSON.stringify([...(field2.options || [])].sort());
        if (options1 !== options2) return false;
    }

    return true;
}

/**
 * Merges imported custom field definitions with existing ones.
 * Detects conflicts (same name, different definition) and returns them for user resolution.
 * @param {Array} existingFields - Current notebook's custom field definitions
 * @param {Array} importedFields - Imported custom field definitions
 * @returns {Object} - { merged: Array, conflicts: Array }
 */
function mergeCustomFieldDefinitions(existingFields, importedFields) {
    const merged = [...existingFields]; // Start with existing
    const conflicts = [];

    for (const importedField of importedFields) {
        const existing = merged.find(f => f.name === importedField.name);

        if (!existing) {
            // New field, add it
            merged.push(importedField);
        } else {
            // Field name exists, check if definitions match
            if (!fieldDefinitionsMatch(existing, importedField)) {
                conflicts.push({
                    name: importedField.name,
                    existing: existing,
                    imported: importedField
                });
            }
            // If they match, keep existing (no action needed)
        }
    }

    return { merged, conflicts };
}

/**
 * Formats a field definition for display in conflict resolution modal.
 * @param {Object} fieldDef - Field definition
 * @returns {string} - Formatted string
 */
function formatFieldDefinition(fieldDef) {
    let str = `Type: ${fieldDef.type}`;
    if (fieldDef.label) str += `, Label: "${fieldDef.label}"`;
    if (fieldDef.options && fieldDef.options.length > 0) {
        str += `, Options: [${fieldDef.options.join(', ')}]`;
    }
    return str;
}

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
// Timing (milliseconds)
const HOVER_DELAY = 500; // milliseconds before expanding title on hover
const AUTOSAVE_DELAY = 1500; // 1.5 seconds
const SAVE_FADE_DELAY = 2000; // How long "Saved" status shows before fading
const SAVE_RETRY_DELAY = 100; // Delay between save queue retries
const LONG_PRESS_DURATION = 500; // Mobile long-press duration
const DOUBLE_TAP_THRESHOLD = 300; // Max time between taps for double-tap
const TOAST_DURATION_DEFAULT = 4000; // Default toast notification duration
const TOAST_DURATION_WITH_LINK = 6000; // Toast duration when link is present
const EXPORT_SUCCESS_TOAST = 3000; // Toast duration for export success
const IDLE_CALLBACK_TIMEOUT = 1000; // Timeout for requestIdleCallback fallback

// Zoom & Viewport
const ZOOM_FACTOR_IN = 0.9; // Zoom in multiplier
const ZOOM_FACTOR_OUT = 1.1; // Zoom out multiplier
const ZOOM_MIN = 0.3; // Minimum zoom level (30%)
const ZOOM_MAX = 2.5; // Maximum zoom level (250%)
const ZOOM_MAX_FIT_TO_VIEW = 2; // Maximum zoom when fitting to view
const ZOOM_MOBILE_MAX = 1.5; // Maximum zoom on mobile (pinch)
const VIEWPORT_PADDING = 50; // Padding around graph when fitting to view
const DEFAULT_VIEWPORT_WIDTH = 800; // Default viewport width when no nodes
const DEFAULT_VIEWPORT_HEIGHT = 600; // Default viewport height when no nodes

// UI Layout & Spacing
const TITLE_TRUNCATE_LENGTH = 20; // Max characters before truncating node titles
const BREADCRUMB_TRUNCATE_LENGTH = 15; // Max characters for breadcrumb names
const HASHTAG_PILL_SPACING = 4; // Space between hashtag pills
const HASHTAG_PILL_PADDING_X = 6; // Horizontal padding inside pill
const HASHTAG_PILL_PADDING_Y = 10; // Vertical padding inside pill
const HASHTAG_PILL_RADIUS = 8; // Border radius for hashtag pills
const HASHTAG_PILL_CHAR_WIDTH = 6.5; // Approximate width per character in pill
const HASHTAG_TRUNCATE_LENGTH = 10; // Max hashtag length before truncating
const NODE_CONTENT_PADDING_X = 10; // Horizontal padding inside node
const NODE_CONTENT_PADDING_TOP = 25; // Top padding for node title
const NODE_HASHTAG_OFFSET_X = 8; // Starting X offset for hashtag pills
const NODE_HASHTAG_OFFSET_Y = 44; // Y offset for hashtag pills
const NODE_STACK_OFFSET_1 = 3; // First stack layer offset
const NODE_STACK_OFFSET_2 = 6; // Second stack layer offset
const CHILD_NODE_VERTICAL_OFFSET = 20; // Vertical space below parent when promoting children
const CHILD_NODE_STAGGER = 10; // Vertical stagger between promoted children

// Animation & Interaction
const ACTION_BAR_HIDE_DELAY = 200; // Delay before hiding action bar
const DRAG_DETECTION_THRESHOLD = 5; // Pixels moved before counting as drag (touch)
const SELECTION_MODE_LOCK_DISTANCE = 15; // Distance before locking drag/selection mode
const NODE_CREATE_RANDOM_OFFSET = 100; // Random offset when creating node at cursor

// Text Limits & Validation
const PROJECT_NAME_MAX_LENGTH = 100; // Maximum project name length
const TITLE_SOFT_LIMIT = 200; // Soft limit for node title (warns but allows)
const CONTENT_SOFT_LIMIT = 100000; // Soft limit for node content (warns but allows)
const FILENAME_MAX_LENGTH = 100; // Max length when generating filenames

// Autocomplete
const AUTOCOMPLETE_MAX_RESULTS = 20; // Maximum number of autocomplete suggestions
const AUTOCOMPLETE_DROPDOWN_WIDTH = 220; // Width of autocomplete dropdown (textarea)
const AUTOCOMPLETE_DROPDOWN_MIN_WIDTH = 200; // Min width of autocomplete dropdown
const AUTOCOMPLETE_DROPDOWN_ESTIMATED_HEIGHT = 200; // Estimated max height for boundary checks
const AUTOCOMPLETE_DROPDOWN_OFFSET_Y = 20; // Offset below caret
const AUTOCOMPLETE_DROPDOWN_FLIP_OFFSET = 210; // Height to flip dropdown above caret
const AUTOCOMPLETE_VIEWPORT_MARGIN = 10; // Margin from viewport edge

// Z-Index Layers
const CONTEXT_MENU_Z_INDEX = 100; // Z-index for context menus (below modals)
const TOAST_Z_INDEX = 10001; // Z-index for toast notifications (above modals)
const MODAL_Z_INDEX = 10000; // Z-index for modals

// Mobile Detection
// Use pointer type (coarse = touch) and hover capability instead of screen width
// This allows small desktop windows to keep desktop features
function isMobileDevice() {
    // Check if device has coarse pointer (touch) and cannot hover
    const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const cannotHover = window.matchMedia('(hover: none)').matches;

    // Both conditions should be true for mobile devices
    // This avoids treating small desktop windows as mobile
    return hasCoarsePointer && cannotHover;
}

// Storage Keys
const STORAGE_KEY_PREFIX = 'knotebook-project-';
const PROJECTS_INDEX_KEY = 'knotebook-projects';

/**
 * Tests if localStorage is available and writable.
 * Returns false in private browsing modes or when storage is disabled/full.
 * Used to detect storage issues before attempting to save data.
 *
 * @returns {boolean} - True if localStorage is available and writable, false otherwise
 */
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

/**
 * Displays a persistent red banner warning when localStorage is unavailable.
 * Warns user that changes won't be saved (private browsing or storage disabled).
 * Called on app initialization if isLocalStorageAvailable() returns false.
 *
 * @returns {void}
 */
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

/**
 * Gets the currently active theme name from the document root element.
 * Returns 'midnight' if no theme is set (midnight is the default).
 *
 * @returns {string} - The current theme name (e.g., 'midnight', 'neon', 'ocean')
 */
function getCurrentTheme() {
    const themeAttr = document.documentElement.getAttribute('data-theme');
    return themeAttr || 'midnight';
}

/**
 * Sets the active theme by updating the data-theme attribute on document root.
 * Validates theme name, updates UI state, saves to localStorage, and schedules
 * notebook save if one is open (notebooks remember their own theme).
 *
 * @param {string} themeName - Theme name to apply (e.g., 'midnight', 'neon', 'ocean')
 * @returns {void}
 */
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

/**
 * Loads and applies the user's saved theme preference from localStorage.
 * Called on app initialization. Defaults to 'midnight' if no theme is saved.
 *
 * @returns {void}
 */
function loadSavedTheme() {
    const savedTheme = localStorage.getItem('knotebook-theme') || 'midnight';
    setTheme(savedTheme);
}

/**
 * Initializes the theme selector dropdown in the toolbar.
 * Sets up event listeners for opening/closing dropdown and selecting themes.
 * Called once during app initialization.
 *
 * @returns {void}
 */
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

/**
 * Retrieves the list of all saved projects (metadata only, not full content).
 * Returns project index from localStorage with id, name, noteCount, created, modified.
 * Handles corrupted index gracefully by clearing and returning empty array.
 *
 * @returns {Array<Object>} - Array of project metadata objects
 */
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

/**
 * Saves the projects index (list of all project metadata) to localStorage.
 * Handles quota exceeded errors and other storage failures with user alerts.
 *
 * @param {Array<Object>} projects - Array of project metadata objects to save
 * @returns {Promise<void>}
 */
async function saveProjectsIndex(projects) {
    try {
        localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(projects));
    } catch (e) {
        console.error('Failed to save projects index:', e);
        if (e.name === 'QuotaExceededError') {
            await showAlert(
                'Storage quota exceeded! To free up space:\n\n' +
                '1. Export important notebooks (⋮ menu → Export)\n' +
                '2. Delete unneeded notebooks from landing page\n' +
                '3. Or clear browser data: Settings → Privacy → Clear browsing data → Site data',
                'Storage Error'
            );
        } else {
            await showAlert('Failed to save projects list. Your changes may not persist.', 'Save Error');
        }
    }
}

/**
 * Generates a unique project ID using timestamp.
 * Format: 'project-{timestamp}' ensures chronological ordering.
 *
 * @returns {string} - Unique project ID
 */
function generateProjectId() {
    return 'project-' + Date.now();
}

/**
 * Recursively counts all notes in a project, including nested notes.
 * Used to update project metadata's noteCount field.
 *
 * @param {Array<Object>} nodes - Array of node objects to count
 * @returns {number} - Total count of notes including all nested children
 */
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

/**
 * Asynchronously stringifies JSON data without blocking the UI thread.
 * Uses requestIdleCallback when available (Chrome/Firefox), falls back to setTimeout (Safari).
 * Prevents UI freezing on large graphs (100+ nodes) during save operations.
 *
 * @param {Object} data - Data object to stringify
 * @returns {Promise<string>} - Promise resolving to JSON string
 */
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
            requestIdleCallback(callback, { timeout: IDLE_CALLBACK_TIMEOUT }); // Fallback after 1s if browser busy
        } else {
            // Fallback for browsers without requestIdleCallback (like Safari)
            setTimeout(callback, 0);
        }
    });
}

/**
 * Saves the current project to localStorage asynchronously.
 * Uses async stringification to prevent UI blocking on large projects.
 * Updates project metadata (noteCount, modified timestamp) in index.
 * Handles quota errors and stores error state for UI display.
 *
 * @returns {Promise<boolean>} - Promise resolving to true on success, throws on failure
 */
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
            await showAlert(
                'Storage quota exceeded! Export (⬇) this notebook immediately to avoid losing work.\n\n' +
                'To free up space:\n' +
                '1. Delete unneeded notebooks from landing page\n' +
                '2. Or clear browser data: Settings → Privacy → Clear browsing data → Site data',
                'Storage Error'
            );
        } else {
            await showAlert('Failed to save project. Consider exporting to preserve your work.', 'Save Error');
        }

        // Re-throw to allow queue to handle failure
        throw e;
    }
}

/**
 * Loads project data from localStorage by project ID.
 * Returns null if project doesn't exist or JSON parsing fails.
 * Preserves corrupted data for potential manual recovery.
 *
 * @param {string} projectId - The project ID to load
 * @returns {Object|null} - Project data object or null if not found/corrupted
 */
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

/**
 * Creates a new empty project with the given name.
 * Adds project to index and initializes empty project data in localStorage.
 * Handles storage errors and rolls back index changes on failure.
 *
 * @param {string} name - The name for the new project
 * @returns {Promise<string|null>} - Project ID on success, null on failure
 */
async function createProject(name) {
    const projectId = generateProjectId();
    const projects = getProjectsList();

    projects.unshift({
        id: projectId,
        name: name,
        noteCount: 0,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    });

    await saveProjectsIndex(projects);

    // Save empty project data
    const projectData = {
        version: 1,
        nodes: [],
        edges: [],
        hashtagColors: {},
        settings: { fieldDefaults: { completion: null, priority: null }, customFields: [] },
        hiddenHashtags: []
    };

    try {
        localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(projectData));
    } catch (e) {
        console.error('Failed to create project:', e);
        if (e.name === 'QuotaExceededError') {
            await showAlert(
                'Storage quota exceeded! Cannot create new notebook.\n\n' +
                'To free up space:\n' +
                '1. Export important notebooks (⋮ menu → Export)\n' +
                '2. Delete unneeded notebooks from landing page\n' +
                '3. Or clear browser data: Settings → Privacy → Clear browsing data → Site data',
                'Storage Error'
            );
        } else {
            await showAlert('Failed to create project.', 'Error');
        }
        // Remove from index if storage failed
        const projects = getProjectsList();
        const filtered = projects.filter(p => p.id !== projectId);
        await saveProjectsIndex(filtered);
        return null;
    }

    return projectId;
}

/**
 * Renames a project by updating its name in the projects index.
 * Changes are saved immediately to localStorage.
 *
 * @param {string} projectId - The ID of the project to rename
 * @param {string} newName - The new name for the project
 * @returns {void}
 */
function renameProject(projectId, newName) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.name = newName;
        saveProjectsIndex(projects);
    }
}

/**
 * Deletes a project by removing it from the index and localStorage.
 * Index update happens first to ensure UI consistency even if storage removal fails.
 *
 * @param {string} projectId - The ID of the project to delete
 * @returns {void}
 */
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

/**
 * Opens a project by loading its data into the application state.
 * Resets navigation, applies theme, clears filters, and switches to graph view.
 * Checks for pending "Move to Notebook" operations after loading.
 *
 * @param {string} projectId - The ID of the project to open
 * @returns {Promise<void>}
 */
async function openProject(projectId) {
    const data = loadProjectFromStorage(projectId);
    if (!data) {
        await showAlert('Notebook not found', 'Error');
        return;
    }

    state.currentProjectId = projectId;

    // Reset navigation
    state.currentPath = [];

    // Load data
    state.nodes = data.nodes || [];
    state.edges = data.edges || [];

    // Migrate legacy field storage (completion/priority at top-level) to unified storage (node.fields)
    migrateAllNodeFields(state.nodes);
    state.rootNodes = state.nodes;
    state.rootEdges = state.edges;
    state.hashtagColors = data.hashtagColors || {};
    state.projectSettings = data.settings || { fieldDefaults: { completion: null, priority: null }, customFields: [] };

    // Migrate legacy defaultCompletion to new fieldDefaults structure
    if (state.projectSettings.defaultCompletion !== undefined) {
        if (!state.projectSettings.fieldDefaults) {
            state.projectSettings.fieldDefaults = { completion: null, priority: null };
        }
        state.projectSettings.fieldDefaults.completion = state.projectSettings.defaultCompletion;
        delete state.projectSettings.defaultCompletion;
    }

    // Ensure fieldDefaults and customFields exist for backwards compatibility
    if (!state.projectSettings.fieldDefaults) {
        state.projectSettings.fieldDefaults = { completion: null, priority: null };
    }
    if (!state.projectSettings.customFields) {
        state.projectSettings.customFields = [];
    }
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

/**
 * Updates the save status indicator in the toolbar.
 * Shows "Saved" (auto-fades after 2s), "Pending...", "Saving...", or "Error".
 * Manages fade timeouts to prevent flicker during rapid status changes.
 *
 * @param {string} status - Status to display: 'saved', 'pending', 'saving', or 'error'
 * @param {string|null} error - Optional error message to show in tooltip when status is 'error'
 * @returns {void}
 */
/**
 * Gets and validates save status DOM elements.
 * @returns {Object|null} Object with statusEl, iconEl, textEl or null if not found
 */
function getSaveStatusElements() {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return null;

    return {
        statusEl,
        iconEl: statusEl.querySelector('.save-icon'),
        textEl: statusEl.querySelector('.save-text')
    };
}

/**
 * Clears any existing saved status fade timeout.
 */
function clearSaveFadeTimeout() {
    if (state.savedFadeTimeout) {
        clearTimeout(state.savedFadeTimeout);
        state.savedFadeTimeout = null;
    }
}

/**
 * Resets save status CSS classes.
 * @param {HTMLElement} statusEl - Status container element
 * @param {string} newStatus - New status to apply
 */
function resetSaveStatusClasses(statusEl, newStatus) {
    // Remove all status classes
    statusEl.classList.remove('saved', 'pending', 'saving', 'error');

    // Only remove fade-out if we're changing to a non-saved state
    if (newStatus !== 'saved') {
        statusEl.classList.remove('fade-out');
    }

    statusEl.classList.add(newStatus);
}

/**
 * Applies status-specific content (icon, text, tooltip).
 * @param {Object} elements - DOM elements from getSaveStatusElements()
 * @param {string} status - Status identifier (saved, pending, saving, error)
 * @param {string|null} error - Error message for tooltip (error status only)
 */
function applyStatusContent(elements, status, error) {
    const statusConfig = {
        saved: { icon: '✓', text: 'Saved' },
        pending: { icon: '●', text: 'Pending...' },
        saving: { icon: '⟳', text: 'Saving...' },
        error: { icon: '✕', text: 'Error' }
    };

    const config = statusConfig[status];
    elements.iconEl.textContent = config.icon;
    elements.textEl.textContent = config.text;

    if (status === 'error' && error) {
        elements.statusEl.title = error;
    }
}

/**
 * Schedules saved status fade-out animation.
 * @param {HTMLElement} statusEl - Status container element
 */
function scheduleSavedFadeOut(statusEl) {
    // Remove fade-out first (make visible)
    statusEl.classList.remove('fade-out');

    // Auto-fade after 2 seconds
    state.savedFadeTimeout = setTimeout(() => {
        statusEl.classList.add('fade-out');
        state.savedFadeTimeout = null;
    }, SAVE_FADE_DELAY);
}

/**
 * Updates the save status indicator in the toolbar.
 * @param {string} status - Status to display (saved, pending, saving, error)
 * @param {string|null} error - Error message for tooltip (error status only)
 */
function updateSaveStatus(status, error = null) {
    // 1. Get elements (guard clause)
    const elements = getSaveStatusElements();
    if (!elements) return;

    // 2. Clean up any existing fade timeout
    clearSaveFadeTimeout();

    // 3. Update CSS classes
    resetSaveStatusClasses(elements.statusEl, status);

    // 4. Update icon and text
    applyStatusContent(elements, status, error);

    // 5. Handle saved status fade animation
    if (status === 'saved') {
        scheduleSavedFadeOut(elements.statusEl);
    }
}

/**
 * Checks if the save status should be updated to 'saved' when queue is empty.
 * Prevents unnecessary status updates that cause UI flicker.
 *
 * @returns {boolean} - True if status should be updated to 'saved'
 */
function shouldUpdateToSaved() {
    return state.saveQueue.length === 0 && state.saveStatus !== 'saved';
}

/**
 * Gets the current project data for saving.
 * Returns root data if at root level, otherwise returns current level data.
 *
 * @returns {Object} - Project data object with nodes, edges, colors, settings, etc.
 */
function getCurrentProjectData() {
    return {
        nodes: state.currentPath.length === 0 ? state.nodes : state.rootNodes,
        edges: state.currentPath.length === 0 ? state.edges : state.rootEdges,
        hashtagColors: state.hashtagColors,
        settings: state.projectSettings,
        hiddenHashtags: state.hiddenHashtags,
        theme: getCurrentTheme()
    };
}

/**
 * Handles successful save operation.
 * Updates save hash, timestamps, clears errors, updates UI, and removes from queue.
 *
 * @param {Object} savedData - The data that was successfully saved
 */
function handleSaveSuccess(savedData) {
    state.lastSaveHash = hashData(savedData);
    state.saveStatus = 'saved';
    state.lastSaveTime = Date.now();
    state.lastSaveError = null;
    updateSaveStatus('saved');
    state.saveQueue.shift();
}

/**
 * Handles failed save operation.
 * Logs error, updates status, and removes from queue (no infinite retries).
 *
 * @param {Error} error - The error that occurred during save
 */
function handleSaveFailure(error) {
    console.error('Save failed in queue:', error);
    state.saveStatus = 'error';
    updateSaveStatus('error', error.message);
    state.saveQueue.shift();
}

/**
 * Continues processing the save queue if items remain.
 * Uses a small delay to avoid tight loops and give UI time to update.
 */
function continueQueueProcessing() {
    if (state.saveQueue.length > 0) {
        setTimeout(() => processSaveQueue(), SAVE_RETRY_DELAY);
    }
}

/**
 * Processes the save queue sequentially to prevent race conditions.
 * Executes one save at a time, updating status and hash after successful saves.
 * Automatically processes next queued save after completion or failure.
 * Skips "Saving..." status display (saves are too fast, goes directly to "Saved").
 *
 * @returns {Promise<void>}
 */
async function processSaveQueue() {
    // Guard: Already processing
    if (state.saveInProgress) return;

    // Guard: Empty queue - update status if needed
    if (state.saveQueue.length === 0) {
        if (shouldUpdateToSaved()) {
            state.saveStatus = 'saved';
            updateSaveStatus('saved');
        }
        return;
    }

    // Mark as in progress
    state.saveInProgress = true;
    state.saveStatus = 'saving';

    try {
        await saveProjectToStorage();
        const savedData = getCurrentProjectData();
        handleSaveSuccess(savedData);
    } catch (error) {
        handleSaveFailure(error);
    } finally {
        state.saveInProgress = false;
        continueQueueProcessing();
    }
}

/**
 * Generates a simple integer hash of data for change detection.
 * Used to determine if project data has changed since last save.
 * Fast computation suitable for frequent calls during user interactions.
 *
 * @param {Object} data - Data object to hash
 * @returns {number} - 32-bit integer hash value
 */
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

/**
 * Schedules an auto-save operation with debouncing and change detection.
 * Only queues save if data has changed since last save (via hash comparison).
 * Debounces rapid changes (1.5s delay) to avoid excessive saves during typing/dragging.
 * Limits queue to one pending item to prevent infinite loop scenarios.
 *
 * @returns {void}
 */
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

    // Skip if nothing changed since last save
    if (currentHash === state.lastSaveHash) {
        return;
    }

    // Don't add to queue if we already have a pending save
    // The debounce will handle coalescing multiple rapid changes
    if (state.saveQueue.length > 0) {
        // Just reset the debounce timer
        if (state.autoSaveTimeout) {
            clearTimeout(state.autoSaveTimeout);
        }
        state.autoSaveTimeout = setTimeout(() => {
            processSaveQueue();
            state.autoSaveTimeout = null;
        }, AUTOSAVE_DELAY);
        return;
    }

    // Add to queue (only if queue is empty)
    state.saveQueue.push({
        timestamp: Date.now(),
        projectId: state.currentProjectId
    });

    // Update status to pending
    state.saveStatus = 'pending';
    updateSaveStatus('pending');

    // Debounce: set timer
    state.autoSaveTimeout = setTimeout(() => {
        processSaveQueue();
        state.autoSaveTimeout = null;
    }, AUTOSAVE_DELAY);
}

// ============================================================================
// PROJECT LIST UI
// ============================================================================

/**
 * Populate the projects list in the landing page.
 * Creates DOM elements for each project showing name, note count, and options menu.
 * Shows empty state message if no projects exist. Attaches click handlers for opening
 * projects and displaying the context menu.
 */
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
        item.addEventListener('click', async (e) => {
            if (e.target.closest('.project-menu-btn')) return;
            await openProject(item.dataset.id);
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

/**
 * Display the project context menu at a specific screen position.
 * Menu provides options for rename, delete, export, and settings. Position is adjusted
 * if menu would extend beyond screen boundaries.
 *
 * @param {string} projectId - The ID of the project to show menu for
 * @param {number} x - Screen X coordinate for menu position
 * @param {number} y - Screen Y coordinate for menu position
 */
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

/**
 * Hide the project context menu and clear the active project ID.
 */
function hideProjectMenu() {
    document.getElementById('project-menu').classList.add('hidden');
    state.activeMenuProjectId = null;
}

/**
 * Display the new project modal and focus the name input field.
 * Clears any previous input value.
 */
function showNewProjectModal() {
    const modal = document.getElementById('new-project-modal');
    const input = document.getElementById('new-project-name');
    input.value = '';
    modal.classList.remove('hidden');
    input.focus();
}

/**
 * Hide the new project modal.
 */
function hideNewProjectModal() {
    document.getElementById('new-project-modal').classList.add('hidden');
}

/**
 * Display a confirmation modal with Yes/No buttons and return user's choice as a promise.
 * Handles keyboard shortcuts (Enter for Yes, Escape for No) and cleans up event listeners
 * after user responds.
 *
 * @param {string} message - The confirmation message to display
 * @param {number} [delay=0] - Optional delay in seconds before Yes button becomes enabled
 * @returns {Promise<boolean>} - Resolves to true if user confirms, false if user cancels
 */
/**
 * Gets all DOM elements needed for the confirmation modal.
 * @returns {Object} Object containing modal elements (modal, messageEl, yesBtn, noBtn)
 */
function getConfirmModalElements() {
    return {
        modal: document.getElementById('confirm-modal'),
        messageEl: document.getElementById('confirm-message'),
        yesBtn: document.getElementById('confirm-yes'),
        noBtn: document.getElementById('confirm-no')
    };
}

/**
 * Configures the confirmation modal with content and shows it.
 * @param {Object} elements - DOM elements from getConfirmModalElements()
 * @param {string} message - The confirmation message to display
 */
function configureConfirmModal(elements, message) {
    elements.messageEl.textContent = message;
    elements.modal.classList.remove('hidden');
}

/**
 * Creates event handlers for the confirmation modal, including countdown logic.
 * @param {Object} elements - DOM elements from getConfirmModalElements()
 * @param {Function} resolve - Promise resolve function
 * @param {number} delay - Optional countdown delay in seconds
 * @returns {Object} Object containing handler functions
 */
function createConfirmHandlers(elements, resolve, delay) {
    let intervalId = null;
    const originalYesText = elements.yesBtn.textContent;

    // Start countdown if delay specified
    if (delay > 0) {
        let countdown = delay;
        elements.yesBtn.disabled = true;
        elements.yesBtn.textContent = `Yes (${countdown})`;
        elements.yesBtn.style.opacity = '0.5';
        elements.yesBtn.style.cursor = 'not-allowed';

        intervalId = setInterval(() => {
            countdown--;
            if (countdown > 0) {
                elements.yesBtn.textContent = `Yes (${countdown})`;
            } else {
                elements.yesBtn.disabled = false;
                elements.yesBtn.textContent = originalYesText;
                elements.yesBtn.style.opacity = '';
                elements.yesBtn.style.cursor = '';
                clearInterval(intervalId);
                elements.yesBtn.focus();
            }
        }, 1000);
    } else {
        elements.yesBtn.focus();
    }

    const cleanup = () => {
        if (intervalId) clearInterval(intervalId);
        elements.yesBtn.disabled = false;
        elements.yesBtn.textContent = originalYesText;
        elements.yesBtn.style.opacity = '';
        elements.yesBtn.style.cursor = '';
        elements.modal.classList.add('hidden');
        elements.yesBtn.removeEventListener('click', handlers.handleYes);
        elements.noBtn.removeEventListener('click', handlers.handleNo);
        document.removeEventListener('keydown', handlers.handleKey);
    };

    const handlers = {
        handleYes: () => {
            cleanup();
            resolve(true);
        },
        handleNo: () => {
            cleanup();
            resolve(false);
        },
        handleKey: (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlers.handleYes();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handlers.handleNo();
            }
        }
    };

    return handlers;
}

/**
 * Attaches event listeners to the confirmation modal.
 * @param {Object} elements - DOM elements from getConfirmModalElements()
 * @param {Object} handlers - Event handlers from createConfirmHandlers()
 */
function attachConfirmListeners(elements, handlers) {
    elements.yesBtn.addEventListener('click', handlers.handleYes);
    elements.noBtn.addEventListener('click', handlers.handleNo);
    document.addEventListener('keydown', handlers.handleKey);
}

/**
 * Shows a confirmation modal dialog and returns user choice.
 * @param {string} message - The confirmation message to display
 * @param {number} delay - Optional countdown delay in seconds before Yes button is enabled
 * @returns {Promise<boolean>} True if user confirmed, false if cancelled
 */
function showConfirmation(message, delay = 0) {
    return new Promise((resolve) => {
        const elements = getConfirmModalElements();
        configureConfirmModal(elements, message);
        const handlers = createConfirmHandlers(elements, resolve, delay);
        attachConfirmListeners(elements, handlers);
    });
}

/**
 * Display an alert modal with a message and OK button.
 *
 * @param {string} message - The alert message to display
 * @param {string} [title='Alert'] - Optional title for the alert
 * @returns {Promise<void>} - Resolves when user clicks OK
 */
function showAlert(message, title = 'Alert') {
    return new Promise((resolve) => {
        const modal = document.getElementById('alert-modal');
        const titleEl = document.getElementById('alert-title');
        const messageEl = document.getElementById('alert-message');
        const okBtn = document.getElementById('alert-ok');

        // Set content and show
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.classList.remove('hidden');

        // Focus OK button
        okBtn.focus();

        // OK handler
        const handleOk = () => {
            cleanup();
            resolve();
        };

        // Keyboard handler
        const handleKey = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                handleOk();
            }
        };

        // Cleanup
        const cleanup = () => {
            modal.classList.add('hidden');
            okBtn.removeEventListener('click', handleOk);
            document.removeEventListener('keydown', handleKey);
        };

        // Attach listeners
        okBtn.addEventListener('click', handleOk);
        document.addEventListener('keydown', handleKey);
    });
}

/**
 * Display a prompt modal with a message, text input, and OK/Cancel buttons.
 *
 * @param {string} message - The prompt message to display
 * @param {string} [defaultValue=''] - Default value for the input field
 * @param {string} [title='Input Required'] - Optional title for the prompt
 * @returns {Promise<string|null>} - Resolves to input value if OK, null if cancelled
 */
/**
 * Gets all DOM elements needed for the prompt modal.
 * @returns {Object} Object containing modal elements
 */
function getPromptModalElements() {
    return {
        modal: document.getElementById('prompt-modal'),
        titleEl: document.getElementById('prompt-title'),
        messageEl: document.getElementById('prompt-message'),
        input: document.getElementById('prompt-input'),
        okBtn: document.getElementById('prompt-ok'),
        cancelBtn: document.getElementById('prompt-cancel')
    };
}

/**
 * Configures the prompt modal with content and shows it.
 * @param {Object} elements - DOM elements from getPromptModalElements()
 * @param {string} message - The prompt message to display
 * @param {string} defaultValue - Default input value
 * @param {string} title - Modal title
 */
function configurePromptModal(elements, message, defaultValue, title) {
    elements.titleEl.textContent = title;
    elements.messageEl.textContent = message;
    elements.input.value = defaultValue;
    elements.modal.classList.remove('hidden');
    elements.input.focus();
    elements.input.select();
}

/**
 * Creates event handlers for the prompt modal.
 * @param {Object} elements - DOM elements from getPromptModalElements()
 * @param {Function} resolve - Promise resolve function
 * @returns {Object} Object containing handler functions
 */
function createPromptHandlers(elements, resolve) {
    const cleanup = () => {
        elements.modal.classList.add('hidden');
        elements.okBtn.removeEventListener('click', handlers.handleOk);
        elements.cancelBtn.removeEventListener('click', handlers.handleCancel);
        elements.input.removeEventListener('keydown', handlers.handleKey);
    };

    const handlers = {
        handleOk: () => {
            const value = elements.input.value.trim();
            cleanup();
            resolve(value);
        },
        handleCancel: () => {
            cleanup();
            resolve(null);
        },
        handleKey: (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handlers.handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handlers.handleCancel();
            }
        }
    };

    return handlers;
}

/**
 * Attaches event listeners to the prompt modal.
 * @param {Object} elements - DOM elements from getPromptModalElements()
 * @param {Object} handlers - Event handlers from createPromptHandlers()
 */
function attachPromptListeners(elements, handlers) {
    elements.okBtn.addEventListener('click', handlers.handleOk);
    elements.cancelBtn.addEventListener('click', handlers.handleCancel);
    elements.input.addEventListener('keydown', handlers.handleKey);
}

/**
 * Shows a prompt modal dialog and returns user input.
 * @param {string} message - The prompt message to display
 * @param {string} defaultValue - Default input value
 * @param {string} title - Modal title
 * @returns {Promise<string|null>} The user's input or null if cancelled
 */
function showPrompt(message, defaultValue = '', title = 'Input Required') {
    return new Promise((resolve) => {
        const elements = getPromptModalElements();
        configurePromptModal(elements, message, defaultValue, title);
        const handlers = createPromptHandlers(elements, resolve);
        attachPromptListeners(elements, handlers);
    });
}

/**
 * Handle creating a new project from the new project modal.
 * Validates the project name (non-empty, max 100 chars), creates the project,
 * hides the modal, and opens the newly created project.
 */
async function handleCreateProject() {
    const input = document.getElementById('new-project-name');
    const name = input.value.trim();

    if (!name) {
        await showAlert('Notebook name cannot be empty.', 'Validation Error');
        input.focus();
        return;
    }

    // Validate: max length
    if (name.length > PROJECT_NAME_MAX_LENGTH) {
        await showAlert(`Notebook name is too long (${name.length} characters). Maximum: ${PROJECT_NAME_MAX_LENGTH} characters.`, 'Validation Error');
        input.focus();
        return;
    }

    const projectId = await createProject(name);
    hideNewProjectModal();
    await openProject(projectId);
}

/**
 * Handle renaming a project via a prompt dialog.
 * Validates the new name (non-empty, max 100 chars), updates the project in storage,
 * and refreshes the projects list.
 *
 * @param {string} projectId - The ID of the project to rename
 */
async function handleRenameProject(projectId) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newName = await showPrompt('Enter new notebook name:', project.name, 'Rename Notebook');
    if (newName === null) return; // User cancelled

    const trimmed = newName.trim();

    // Validate: not empty
    if (!trimmed) {
        await showAlert('Notebook name cannot be empty.', 'Validation Error');
        return;
    }

    // Validate: max length
    if (trimmed.length > PROJECT_NAME_MAX_LENGTH) {
        await showAlert(`Notebook name is too long (${trimmed.length} characters). Maximum: ${PROJECT_NAME_MAX_LENGTH} characters.`, 'Validation Error');
        return;
    }

    renameProject(projectId, trimmed);
    populateProjectsList();
}

/**
 * Handle deleting a project after user confirmation.
 * Shows confirmation dialog, deletes the project if confirmed, and refreshes the projects list.
 *
 * @param {string} projectId - The ID of the project to delete
 */
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

/**
 * Generate a unique ID for a new note node.
 * Uses timestamp and incrementing counter to ensure uniqueness.
 *
 * @returns {string} - Unique node ID in format "note-{timestamp}-{counter}"
 */
function generateId() {
    return `note-${Date.now()}-${state.nextId++}`;
}

/**
 * Extract and normalize hashtags from text.
 * Finds all hashtags (e.g., #example), normalizes to lowercase, removes duplicates,
 * and returns sorted array.
 *
 * @param {string} text - Text to parse for hashtags
 * @returns {string[]} - Array of unique hashtags in lowercase, sorted alphabetically
 */
function parseHashtags(text) {
    const regex = /#[\w-]+/g;
    const matches = text.match(regex);
    // Normalize to lowercase for consistent storage and comparison
    return matches ? [...new Set(matches.map(tag => tag.toLowerCase()))].sort((a, b) => a.localeCompare(b)) : [];
}

/**
 * Truncate text to a maximum length, taking only the first line.
 * Adds ellipsis (...) if text exceeds maxLength.
 *
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} - Truncated text with ellipsis if needed
 */
function truncateText(text, maxLength) {
    const firstLine = text.split('\n')[0];
    if (firstLine.length <= maxLength) return firstLine;
    return firstLine.substring(0, maxLength - 3) + '...';
}

/**
 * Calculate the center point coordinates of a node.
 *
 * @param {Object} node - The node object with position property
 * @returns {Object} - Object with x and y coordinates of node center
 */
function getNodeCenter(node) {
    return {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2
    };
}

/**
 * Check if a node has body text beyond just hashtags.
 * Used to determine if dog-ear indicator should be shown on node.
 *
 * @param {Object} node - The node object to check
 * @returns {boolean} - True if node has content beyond hashtags
 */
function hasBodyText(node) {
    if (!node.content) return false;
    const stripped = node.content.replace(/#[\w-]+/g, '').trim();
    return stripped.length > 0;
}

/**
 * Cycle through completion states in order: null → no → partial → yes → cancelled → no → ...
 * Used when user clicks the completion indicator on a node.
 *
 * @param {string|null} current - Current completion state
 * @returns {string} - Next completion state in the cycle
 */
function cycleCompletion(current) {
    return getNextCompletionState(current);
}

/**
 * Check if a node matches the current filter criteria.
 * Applies text search (AND logic) and hashtag filter (OR logic). Both filters must
 * pass if both are active.
 *
 * @param {Object} node - The node object to check
 * @returns {boolean} - True if node matches all active filters
 */
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
    // Tags are already normalized to lowercase, so direct comparison is safe
    return state.filterHashtags.some(tag => node.hashtags.includes(tag));
}

/**
 * Get IDs of all nodes that match the current filter.
 *
 * @returns {string[]} - Array of node IDs that pass the filter
 */
function getVisibleNodeIds() {
    return state.nodes.filter(nodeMatchesFilter).map(n => n.id);
}

/**
 * Update sidebar button visual state to show when filters are active.
 * Adds 'active' class if any hashtag filters are applied.
 */
function updateSidebarButtonState() {
    const sidebarBtn = document.getElementById('hashtag-sidebar-btn');
    if (state.filterHashtags.length > 0) {
        sidebarBtn.classList.add('active');
    } else {
        sidebarBtn.classList.remove('active');
    }
}

/**
 * Update the hashtag filter from input field value.
 * Parses hashtags, updates state, shows/hides clear button, updates sidebar button state,
 * and triggers re-render.
 *
 * @param {string} inputValue - Raw input value containing hashtags
 */
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

/**
 * Clear both hashtag and text search filters.
 * Resets filter state, clears input fields, hides clear buttons, updates sidebar button,
 * and triggers re-render.
 */
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

/**
 * Set the filter to a specific hashtag.
 * Used when clicking a hashtag pill in the editor.
 *
 * @param {string} hashtag - The hashtag to filter by (e.g., "#example")
 */
function setFilterHashtag(hashtag) {
    const input = document.getElementById('hashtag-input');
    input.value = hashtag;
    updateFilter(hashtag);
}

/**
 * Update the text search filter.
 * Shows/hides clear button based on whether text is present, and triggers re-render.
 *
 * @param {string} text - Search text to filter notes by
 */
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

/**
 * Clear the text search filter.
 * Resets filter state, clears input field, hides clear button, and triggers re-render.
 */
function clearTextFilter() {
    const input = document.getElementById('text-search-input');
    input.value = '';
    state.filterText = '';
    input.classList.remove('active');
    document.getElementById('text-search-clear').classList.add('hidden');
    render();
}

/**
 * Toggle a hashtag in the filter on/off.
 * Used when clicking hashtag pills in the sidebar. If hashtag is in filter, removes it;
 * otherwise adds it.
 *
 * @param {string} hashtag - The hashtag to toggle in the filter
 */
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

/**
 * Toggle a hashtag's visibility on nodes (hide/unhide).
 * Hidden hashtags are not displayed as pills on nodes but remain in the data.
 * Used via the "hide" button in the sidebar.
 *
 * @param {string} hashtag - The hashtag to hide or unhide
 */
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

/**
 * Unhide all hidden hashtags.
 * Clears the hiddenHashtags array and triggers re-render. Used via the "Show All Tags"
 * button in the sidebar.
 */
function showAllHashtags() {
    state.hiddenHashtags = [];
    render();
}

/**
 * Rename a hashtag across all nodes at the current level.
 * Updates the tag in node content, filter state, hidden tags, and color assignments.
 * Validates new tag format and handles case-insensitive replacement.
 *
 * @param {string} oldTag - Current hashtag name (e.g., "#old")
 * @param {string} newTag - New hashtag name (e.g., "#new" or "new")
 * @returns {Promise<void>}
 */
async function renameHashtag(oldTag, newTag) {
    // Validate new tag format
    newTag = newTag.trim();
    if (!newTag.startsWith('#')) {
        newTag = '#' + newTag;
    }

    // Validate hashtag format (must be #word with alphanumeric, underscore, or hyphen)
    if (!/^#[a-zA-Z0-9_-]+$/.test(newTag)) {
        await showAlert('Invalid tag format. Tags can only contain letters, numbers, underscores, and hyphens (no spaces or special characters).', 'Validation Error');
        return;
    }

    // Normalize to lowercase
    newTag = newTag.toLowerCase();

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

/**
 * Delete a hashtag from all nodes at the current level.
 * Removes the tag from node content, filter state, hidden tags, and color assignments.
 * Uses case-insensitive matching.
 *
 * @param {string} tag - The hashtag to delete (e.g., "#example")
 */
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

/**
 * Display the hashtag context menu at a specific screen position.
 * Menu provides options for rename, delete, and change color. Position is adjusted
 * if menu would extend beyond screen boundaries.
 *
 * @param {string} tag - The hashtag to show menu for (e.g., "#example")
 * @param {number} x - Screen X coordinate for menu position
 * @param {number} y - Screen Y coordinate for menu position
 */
/**
 * Gets menu item definitions for hashtag context menu.
 * @returns {Array<{action: string, text: string}>} Menu item definitions
 */
function getHashtagContextMenuItems() {
    return [
        { action: 'rename', text: 'Rename tag...' },
        { action: 'delete', text: 'Delete tag...' },
        { action: 'color', text: 'Change color...' }
    ];
}

/**
 * Executes hashtag context menu action.
 * Handles async operations: rename, delete, and color picker.
 * @param {string} action - Action identifier ('rename', 'delete', 'color')
 * @param {string} tag - The hashtag to operate on
 */
async function executeHashtagMenuAction(action, tag) {
    if (action === 'rename') {
        const newTag = await showPrompt(`Enter new name for tag "${tag}":`, tag, 'Rename Tag');
        if (newTag && newTag.trim()) {
            await renameHashtag(tag, newTag);
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
}

/**
 * Attaches click handler to hashtag context menu.
 * Handles action execution and menu cleanup.
 * @param {HTMLElement} menu - Menu element
 * @param {string} tag - The hashtag for action callbacks
 */
function attachHashtagMenuHandler(menu, tag) {
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            hideHashtagContextMenu();
            await executeHashtagMenuAction(action, tag);
        });
    });
}

/**
 * Display the hashtag context menu at a specific screen position.
 * Menu provides options for rename, delete, and change color. Position is adjusted
 * if menu would extend beyond screen boundaries.
 *
 * @param {string} tag - The hashtag to show menu for (e.g., "#example")
 * @param {number} x - Screen X coordinate for menu position
 * @param {number} y - Screen Y coordinate for menu position
 */
function showHashtagContextMenu(tag, x, y) {
    hideHashtagContextMenu(); // Guard: cleanup existing menu

    // 1. Get menu configuration
    const items = getHashtagContextMenuItems();

    // 2. Create menu structure
    const menu = createContextMenuContainer('hashtag-context-menu', x, y);
    populateContextMenu(menu, items);

    // 3. Add to DOM (required for position adjustment)
    document.body.appendChild(menu);

    // 4. Adjust position to prevent off-screen rendering
    adjustContextMenuPosition(menu, x, y);

    // 5. Attach event handler
    attachHashtagMenuHandler(menu, tag);
}

/**
 * Hide the hashtag context menu and remove it from the DOM.
 */
function hideHashtagContextMenu() {
    const menu = document.getElementById('hashtag-context-menu');
    if (menu) {
        menu.remove();
    }
}

// ============================================================================
// HASHTAG SIDEBAR
// ============================================================================

/**
 * Toggles the hashtag sidebar visibility.
 * Refreshes sidebar content when opening.
 *
 * @returns {void}
 */
function toggleSidebar() {
    const sidebar = document.getElementById('hashtag-sidebar');
    sidebar.classList.toggle('hidden');
    if (!sidebar.classList.contains('hidden')) {
        populateSidebar();
    }
}

/**
 * Shows the hashtag sidebar and refreshes its content.
 *
 * @returns {void}
 */
function showSidebar() {
    const sidebar = document.getElementById('hashtag-sidebar');
    sidebar.classList.remove('hidden');
    populateSidebar();
}

/**
 * Hides the hashtag sidebar and closes any open color pickers.
 *
 * @returns {void}
 */
function hideSidebar() {
    document.getElementById('hashtag-sidebar').classList.add('hidden');
    closeAllColorPickers();
}

/**
 * Closes all open color picker dropdowns in the sidebar.
 *
 * @returns {void}
 */
function closeAllColorPickers() {
    document.querySelectorAll('.color-picker-dropdown').forEach(el => {
        el.classList.add('hidden');
    });
}

/**
 * Calculates hashtag usage counts for all nodes at the current level.
 * Returns object mapping hashtag -> count for sidebar display.
 *
 * @returns {Object} - Object with hashtags as keys and counts as values
 */
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

/**
 * Gets the assigned color for a hashtag.
 * Auto-assigns a color based on hashtag name hash if autoAssign is true and no color is set.
 * Returns default slate color (#64748b) if no color assigned and autoAssign is false.
 *
 * @param {string} hashtag - The hashtag to get color for
 * @param {boolean} autoAssign - Whether to auto-assign color if not set (default: true)
 * @returns {string} - Hex color code
 */
function getHashtagColor(hashtag, autoAssign = true) {
    if (!state.hashtagColors[hashtag] && autoAssign) {
        // Assign a color based on hash of the hashtag name
        const hash = hashtag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        state.hashtagColors[hashtag] = HASHTAG_COLORS[hash % HASHTAG_COLORS.length];
    }
    return state.hashtagColors[hashtag] || '#64748b'; // Default slate color if not assigned
}

/**
 * Sets the color for a hashtag and updates UI.
 * Refreshes sidebar and re-renders canvas to show updated colors.
 *
 * @param {string} hashtag - The hashtag to set color for
 * @param {string} color - Hex color code to assign
 * @returns {void}
 */
function setHashtagColor(hashtag, color) {
    state.hashtagColors[hashtag] = color;
    populateSidebar();
    render(); // Re-render to update node hashtag colors
}

/**
 * Renders empty state message when no hashtags exist
 * @param {HTMLElement} list - The hashtag list container element
 * @returns {void}
 */
function renderEmptyHashtagState(list) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'sidebar-empty';
    emptyDiv.textContent = 'No tags yet';
    list.replaceChildren(emptyDiv);
}

/**
 * Creates "Show All Tags" button for sidebar header
 * @param {boolean} hasHiddenTags - Whether any tags are currently hidden
 * @returns {HTMLButtonElement} Button element with appropriate state
 */
function createShowAllTagsButton(hasHiddenTags) {
    const headerBtn = document.createElement('button');
    headerBtn.className = 'show-all-tags-btn' + (hasHiddenTags ? '' : ' disabled');
    headerBtn.id = 'show-all-tags-btn';
    headerBtn.disabled = !hasHiddenTags;
    headerBtn.textContent = 'Show All Tags';
    return headerBtn;
}

/**
 * Creates complete hashtag row with pill, count, color button, hide button, and color picker
 * @param {string} tag - The hashtag text
 * @param {string} color - The hashtag color hex code
 * @param {boolean} isActive - Whether tag is currently filtered
 * @param {boolean} isHidden - Whether tag is currently hidden
 * @param {number} count - Number of notes with this tag
 * @returns {HTMLElement} Complete row container with all child elements
 */
function createHashtagRow(tag, color, isActive, isHidden, count) {
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
    const countSpan = document.createElement('span');
    countSpan.className = 'hashtag-count hashtag-clickable';
    countSpan.dataset.tag = tag;
    countSpan.textContent = `(${count})`;

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
    container.appendChild(countSpan);
    container.appendChild(colorBtn);
    container.appendChild(hideBtn);
    container.appendChild(dropdown);

    return container;
}

/**
 * Populates the sidebar hashtag list with tags from current project
 * @returns {void}
 */
function populateSidebar() {
    const list = document.getElementById('hashtag-list');
    const counts = getHashtagCounts();
    const hashtags = Object.keys(counts).sort();

    if (hashtags.length === 0) {
        renderEmptyHashtagState(list);
        return;
    }

    const activeFilters = state.filterHashtags.map(t => t.toLowerCase());
    const hiddenTags = state.hiddenHashtags.map(t => t.toLowerCase());
    list.replaceChildren();

    const showAllBtn = createShowAllTagsButton(state.hiddenHashtags.length > 0);
    list.appendChild(showAllBtn);

    hashtags.forEach(tag => {
        const row = createHashtagRow(
            tag,
            getHashtagColor(tag),
            activeFilters.includes(tag.toLowerCase()),
            hiddenTags.includes(tag.toLowerCase()),
            counts[tag]
        );
        list.appendChild(row);
    });

    attachShowAllTagsHandler(showAllBtn);
    attachHashtagRowHandlers(list);
    attachHashtagContextMenuHandlers(list);
}

/**
 * Attaches click handler to "Show All Tags" button
 * @param {HTMLButtonElement} button - The show all tags button element
 * @returns {void}
 */
function attachShowAllTagsHandler(button) {
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        showAllHashtags();
    });
}

/**
 * Attaches all interaction handlers to hashtag rows (filter, hide, color picker)
 * @param {HTMLElement} list - The hashtag list container element
 * @returns {void}
 */
function attachHashtagRowHandlers(list) {
    // Hide button handlers
    list.querySelectorAll('.hashtag-hide-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleHiddenHashtag(btn.dataset.tag);
        });
    });

    // Filter handlers (pill + count only)
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
}

/**
 * Attaches context menu handlers (right-click and long-press) to hashtag rows
 * @param {HTMLElement} list - The hashtag list container element
 * @returns {void}
 */
function attachHashtagContextMenuHandlers(list) {
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

/**
 * Convert screen coordinates to canvas coordinates.
 * Takes mouse/touch screen position and converts to SVG canvas coordinates,
 * accounting for viewport pan and zoom transformations.
 *
 * @param {number} screenX - Screen X coordinate (e.g., from mouse event)
 * @param {number} screenY - Screen Y coordinate (e.g., from mouse event)
 * @returns {Object} - Object with x and y canvas coordinates
 */
function screenToCanvas(screenX, screenY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (screenX - rect.left) / state.viewport.zoom + state.viewport.x,
        y: (screenY - rect.top) / state.viewport.zoom + state.viewport.y
    };
}

/**
 * Convert canvas coordinates to screen coordinates.
 * Inverse of screenToCanvas - takes SVG canvas position and converts to screen position,
 * accounting for viewport pan and zoom transformations.
 *
 * @param {number} canvasX - Canvas X coordinate
 * @param {number} canvasY - Canvas Y coordinate
 * @returns {Object} - Object with x and y screen coordinates
 */
function canvasToScreen(canvasX, canvasY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
        x: (canvasX - state.viewport.x) * state.viewport.zoom + rect.left,
        y: (canvasY - state.viewport.y) * state.viewport.zoom + rect.top
    };
}

/**
 * Calculate the bounding box of all nodes or visible nodes only.
 * Used by fitToView to calculate zoom level and center point. Returns default bounds
 * if no nodes exist.
 *
 * @param {boolean} visibleOnly - If true, only include nodes that match current filters
 * @returns {Object} - Object with minX, minY, maxX, maxY coordinates
 */
function getGraphBounds(visibleOnly = false) {
    // If visibleOnly is true, only include nodes that pass the current filters
    const nodesToBound = visibleOnly
        ? state.nodes.filter(nodeMatchesFilter)
        : state.nodes;

    if (nodesToBound.length === 0) {
        return { minX: 0, minY: 0, maxX: DEFAULT_VIEWPORT_WIDTH, maxY: DEFAULT_VIEWPORT_HEIGHT };
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

/**
 * Switches to the landing page view (project list).
 * Clears current project ID and refreshes project list.
 *
 * @returns {void}
 */
function showLandingPage() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('graph-view').classList.add('hidden');
    state.currentProjectId = null;
    populateProjectsList();
}

/**
 * Switches to the graph view (canvas where notes are displayed).
 * Updates viewport to apply any pan/zoom state.
 *
 * @returns {void}
 */
function showGraphView() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('graph-view').classList.remove('hidden');
    updateViewport();
}

/**
 * Show the new project modal.
 * Wrapper function used by toolbar button to create a new project.
 */
function newProject() {
    // Show the new project modal instead of directly creating
    showNewProjectModal();
}

/**
 * Returns to the landing page (home/project list).
 * Saves current project before leaving and resets all state.
 * Called when user clicks the home button in the toolbar.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Updates the SVG canvas viewBox based on current viewport state (pan/zoom).
 * Called after any viewport changes (panning, zooming, resetting).
 * Translates viewport.x/y and viewport.zoom into SVG viewBox coordinates.
 *
 * @returns {void}
 */
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

/**
 * Zoom in or out at a specific screen point (mouse cursor position).
 * Adjusts pan offset to keep the point under the cursor stationary during zoom.
 * Clamps zoom between 0.5x and 2.5x.
 *
 * @param {number} delta - Positive to zoom in, negative to zoom out
 * @param {number} screenX - Screen X coordinate to zoom towards
 * @param {number} screenY - Screen Y coordinate to zoom towards
 */
function zoomAtPoint(delta, screenX, screenY) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    // Get canvas coordinates before zoom
    const beforeX = (screenX - rect.left) / state.viewport.zoom + state.viewport.x;
    const beforeY = (screenY - rect.top) / state.viewport.zoom + state.viewport.y;

    // Apply zoom
    const zoomFactor = delta > 0 ? ZOOM_FACTOR_IN : ZOOM_FACTOR_OUT;
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.viewport.zoom * zoomFactor));
    state.viewport.zoom = newZoom;

    // Get canvas coordinates after zoom
    const afterX = (screenX - rect.left) / state.viewport.zoom + state.viewport.x;
    const afterY = (screenY - rect.top) / state.viewport.zoom + state.viewport.y;

    // Adjust pan to keep the point under cursor stationary
    state.viewport.x += beforeX - afterX;
    state.viewport.y += beforeY - afterY;

    updateViewport();
}

/**
 * Fit all nodes (or visible nodes if filters active) into the viewport.
 * Calculates optimal zoom level and pan position to show all nodes with padding.
 * Caps zoom at 2x maximum. If no nodes exist, resets to default view.
 */
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
    const padding = VIEWPORT_PADDING;
    const graphWidth = bounds.maxX - bounds.minX + padding * 2;
    const graphHeight = bounds.maxY - bounds.minY + padding * 2;

    // Calculate zoom to fit
    const zoomX = rect.width / graphWidth;
    const zoomY = rect.height / graphHeight;
    const newZoom = Math.min(zoomX, zoomY, ZOOM_MAX_FIT_TO_VIEW); 

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

/**
 * Resets viewport to default position (0,0) and zoom level (1x).
 * Called when opening a new project or resetting view.
 *
 * @returns {void}
 */
function resetViewport() {
    state.viewport.x = 0;
    state.viewport.y = 0;
    state.viewport.zoom = 1;
    updateViewport();
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Throttled render function - schedules rendering for next animation frame (max 60 FPS).
 * Prevents excessive rendering during rapid events like mousemove during drag.
 * Uses requestAnimationFrame to sync with browser refresh cycle.
 * Skips if render is already scheduled to avoid queueing multiple renders.
 *
 * @returns {void}
 */
function render() {
    if (state.renderScheduled) return; // Already scheduled, skip

    state.renderScheduled = true;
    requestAnimationFrame(() => {
        renderImmediate();
        state.renderScheduled = false;
    });
}

/**
 * Execute immediate rendering without throttling.
 * Called by throttled render() function. Renders all canvas layers (edges, nodes, ghosts,
 * selection box), updates breadcrumbs and viewport, refreshes sidebar if open, and
 * schedules auto-save if project is open.
 */
function renderImmediate() {
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

/**
 * Render all nodes to the SVG canvas.
 * Sorts nodes by zIndex for proper layering. Skips nodes that don't match current filters.
 * Renders node body, title, hashtag pills, completion indicator, dog-ear fold, and stacked
 * rectangles for nodes with children. Applies selection styling.
 */
/**
 * Prepares the nodes layer for rendering by clearing existing content.
 * @returns {SVGElement} The cleared nodes layer element
 */
function prepareNodesLayer() {
    const layer = document.getElementById('nodes-layer');
    layer.replaceChildren();
    return layer;
}

/**
 * Sorts nodes by zIndex for proper rendering order (lower zIndex = behind).
 * @param {Array} nodes - Array of node objects to sort
 * @returns {Array} Sorted array of nodes
 */
function sortNodesByZIndex(nodes) {
    return [...nodes].sort((a, b) => {
        const aZ = a.zIndex || 0;
        const bZ = b.zIndex || 0;
        return aZ - bZ;
    });
}

/**
 * Creates an SVG group container for a node with appropriate classes and transform.
 * @param {Object} node - The node object
 * @returns {SVGGElement} The configured SVG group element
 */
function createNodeGroup(node) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'node' +
        (state.selectedNodes.includes(node.id) ? ' selected' : '') +
        (node.children && node.children.length > 0 ? ' has-children' : '') +
        (isCompletedState(getNodeFieldValue(node, 'completion')) ? ' completed' : ''));
    g.setAttribute('data-id', node.id);
    g.setAttribute('transform', `translate(${node.position.x}, ${node.position.y})`);
    return g;
}

/**
 * Renders stacked rectangle indicators for nodes with children.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderChildStackIndicators(g, node) {
    if (!node.children || node.children.length === 0) return;

    // Second stack layer for 3+ children
    if (node.children.length >= 3) {
        const stack2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        stack2.setAttribute('class', 'node-stack');
        stack2.setAttribute('x', NODE_STACK_OFFSET_2);
        stack2.setAttribute('y', NODE_STACK_OFFSET_2);
        stack2.setAttribute('width', NODE_WIDTH);
        stack2.setAttribute('height', NODE_HEIGHT);
        stack2.setAttribute('rx', 8);
        g.appendChild(stack2);
    }

    // First stack layer
    const stack1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    stack1.setAttribute('class', 'node-stack');
    stack1.setAttribute('x', NODE_STACK_OFFSET_1);
    stack1.setAttribute('y', NODE_STACK_OFFSET_1);
    stack1.setAttribute('width', NODE_WIDTH);
    stack1.setAttribute('height', NODE_HEIGHT);
    stack1.setAttribute('rx', 8);
    g.appendChild(stack1);
}

/**
 * Renders the node body rectangle and optional dog-ear fold indicator.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderNodeBody(g, node) {
    // Node body rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', 'node-body');
    rect.setAttribute('width', NODE_WIDTH);
    rect.setAttribute('height', NODE_HEIGHT);
    g.appendChild(rect);

    // Dog-ear fold for body text indicator
    if (hasBodyText(node)) {
        const fold = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fold.setAttribute('class', 'node-dog-ear');
        fold.setAttribute('d', 'M 0 18 L 18 0 L 12 0 Q 0 0 0 12 Z');
        g.appendChild(fold);
    }
}

/**
 * Renders the node title text with truncation and full-text storage.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderNodeTitle(g, node) {
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('class', 'node-title');
    title.setAttribute('x', NODE_CONTENT_PADDING_X);
    title.setAttribute('y', NODE_CONTENT_PADDING_TOP);
    const fullTitle = node.title || 'Untitled';
    title.textContent = truncateText(fullTitle, TITLE_TRUNCATE_LENGTH);
    title.setAttribute('data-full-title', fullTitle);
    g.appendChild(title);
}

/**
 * Renders hashtag pills for the node with color, truncation, and overflow handling.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderNodeHashtags(g, node) {
    if (!node.hashtags || node.hashtags.length === 0) return;

    const hashtagGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hashtagGroup.setAttribute('class', 'node-hashtags-group');

    let xOffset = NODE_HASHTAG_OFFSET_X;
    const y = NODE_HASHTAG_OFFSET_Y;
    const maxWidth = NODE_WIDTH - 16;

    // Filter out hidden hashtags
    const hiddenTagsLower = state.hiddenHashtags.map(t => t.toLowerCase());
    const visibleTags = node.hashtags.filter(tag => !hiddenTagsLower.includes(tag.toLowerCase()));

    for (const tag of visibleTags) {
        const color = getHashtagColor(tag);
        const displayTag = tag.length > HASHTAG_TRUNCATE_LENGTH ? tag.substring(0, HASHTAG_TRUNCATE_LENGTH - 1) + '…' : tag;
        const pillWidth = displayTag.length * HASHTAG_PILL_CHAR_WIDTH + (HASHTAG_PILL_PADDING_X * 2);

        // Stop if we'd overflow the node
        if (xOffset + pillWidth > maxWidth) {
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
        pill.setAttribute('y', y - HASHTAG_PILL_PADDING_Y);
        pill.setAttribute('width', pillWidth);
        pill.setAttribute('height', 16);
        pill.setAttribute('rx', HASHTAG_PILL_RADIUS);
        pill.setAttribute('fill', color);
        hashtagGroup.appendChild(pill);

        // Pill text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', xOffset + HASHTAG_PILL_PADDING_X);
        text.setAttribute('y', y + 1);
        text.setAttribute('class', 'node-hashtag-text');
        text.textContent = displayTag;
        hashtagGroup.appendChild(text);

        xOffset += pillWidth + HASHTAG_PILL_SPACING;
    }

    g.appendChild(hashtagGroup);
}

/**
 * Creates the completion indicator group element.
 * @returns {SVGGElement}
 */
function createCompletionGroup() {
    const comp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    comp.setAttribute('class', 'node-completion');
    comp.setAttribute('data-action', 'cycle-completion');
    return comp;
}

/**
 * Appends background circle for completion indicator.
 * @param {SVGGElement} group - Completion group element
 * @param {Object} position - Position config {offsetX, offsetY}
 */
function appendCompletionBackground(group, position) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', NODE_WIDTH - position.offsetX);
    bg.setAttribute('cy', position.offsetY);
    bg.setAttribute('r', 12);
    bg.setAttribute('class', 'node-completion-bg');
    group.appendChild(bg);
}

/**
 * Appends completion icon (circle or text).
 * @param {SVGGElement} group - Completion group element
 * @param {Object} config - State config
 * @param {Object} position - Position config {offsetX, offsetY}
 */
function appendCompletionIcon(group, config, position) {
    if (config.iconType === 'circle') {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', NODE_WIDTH - position.offsetX);
        circle.setAttribute('cy', position.offsetY);
        circle.setAttribute('r', 7);
        circle.setAttribute('class', `node-completion-circle ${config.cssClass}`);
        group.appendChild(circle);
    } else {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        icon.setAttribute('x', NODE_WIDTH - position.offsetX);
        icon.setAttribute('y', position.offsetY + 6 + (config.iconYOffset || 0));
        icon.setAttribute('text-anchor', 'middle');
        icon.setAttribute('class', `node-completion-icon ${config.cssClass}`);
        icon.textContent = config.icon;
        group.appendChild(icon);
    }
}

/**
 * Renders completion indicator on node.
 * Config-driven implementation using FIRST_CLASS_FIELDS.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderCompletionIndicator(g, node) {
    const completion = getNodeFieldValue(node, 'completion');
    if (!completion) return;
    const config = getCompletionStateConfig(completion);
    if (!config) return;

    const position = FIRST_CLASS_FIELDS.completion.position;
    const comp = createCompletionGroup();
    appendCompletionBackground(comp, position);
    appendCompletionIcon(comp, config, position);
    g.appendChild(comp);
}

/**
 * Creates the priority indicator group element.
 * @returns {SVGGElement}
 */
function createPriorityGroup() {
    const comp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    comp.setAttribute('class', 'node-priority');
    comp.setAttribute('data-action', 'cycle-priority');
    return comp;
}

/**
 * Appends background circle for priority indicator.
 * @param {SVGGElement} group - Priority group element
 * @param {Object} position - Position config {offsetX, offsetY}
 */
function appendPriorityBackground(group, position) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('cx', NODE_WIDTH - position.offsetX);
    bg.setAttribute('cy', NODE_HEIGHT - position.offsetY);
    bg.setAttribute('r', 12);
    bg.setAttribute('class', 'node-priority-bg');
    group.appendChild(bg);
}

/**
 * Appends priority icon (text symbol).
 * @param {SVGGElement} group - Priority group element
 * @param {Object} config - State config
 * @param {Object} position - Position config {offsetX, offsetY}
 */
function appendPriorityIcon(group, config, position) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    icon.setAttribute('x', NODE_WIDTH - position.offsetX);
    icon.setAttribute('y', NODE_HEIGHT - position.offsetY + 5);
    icon.setAttribute('text-anchor', 'middle');
    icon.setAttribute('class', `node-priority-icon ${config.cssClass}`);
    icon.textContent = config.icon;
    group.appendChild(icon);
}

/**
 * Renders priority indicator on node.
 * Config-driven implementation using FIRST_CLASS_FIELDS.
 * @param {SVGGElement} g - The node's SVG group element
 * @param {Object} node - The node object
 */
function renderPriorityIndicator(g, node) {
    const priority = getNodeFieldValue(node, 'priority');
    if (!priority) return;
    const config = getPriorityStateConfig(priority);
    if (!config) return;

    const position = FIRST_CLASS_FIELDS.priority.position;
    const comp = createPriorityGroup();
    appendPriorityBackground(comp, position);
    appendPriorityIcon(comp, config, position);
    g.appendChild(comp);
}

/**
 * Renders all visible nodes to the SVG canvas.
 * Orchestrates node rendering by delegating to specialized helper functions.
 */
function renderNodes() {
    const layer = prepareNodesLayer();
    const sortedNodes = sortNodesByZIndex(state.nodes);

    for (const node of sortedNodes) {
        if (!nodeMatchesFilter(node)) continue;

        const g = createNodeGroup(node);
        renderChildStackIndicators(g, node);
        renderNodeBody(g, node);
        renderNodeTitle(g, node);
        renderNodeHashtags(g, node);
        renderCompletionIndicator(g, node);
        renderPriorityIndicator(g, node);

        layer.appendChild(g);
    }
}

/**
 * Render all edges (connections between nodes) to the SVG canvas.
 * Skips edges where either endpoint is hidden by filters. Creates invisible wider
 * hitbox for easier clicking, and visible edge line. Applies selection styling.
 */
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

/**
 * Render a preview edge line while user is creating a new edge.
 * Shows line from edge start node to current mouse cursor position.
 *
 * @param {number} x - Canvas X coordinate of cursor
 * @param {number} y - Canvas Y coordinate of cursor
 */
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

/**
 * Remove the edge preview line from the canvas.
 * Called when edge creation is cancelled or completed.
 */
function clearEdgePreview() {
    const existing = document.querySelector('.edge-preview');
    if (existing) existing.remove();
}

/**
 * Render the selection box rectangle overlay.
 * Shows visual feedback during drag-to-select. Box style (solid vs dashed border)
 * indicates selection mode (enclosed vs intersecting).
 */
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

/**
 * Clear the selection box from state and remove from canvas.
 * Called when drag-to-select operation completes or is cancelled.
 */
function clearSelectionBox() {
    state.selectionBox = null;
    const overlay = document.getElementById('selection-box-overlay');
    if (overlay) overlay.replaceChildren();
}

/**
 * Render ghost nodes during "Move to Notebook" operation.
 * Shows semi-transparent preview of nodes being moved, following cursor position
 * with relative offsets preserved. Only renders when ghostDragging is active.
 */
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
        title.setAttribute('x', NODE_CONTENT_PADDING_X);
        title.setAttribute('y', NODE_CONTENT_PADDING_TOP);
        title.textContent = truncateText(node.title || 'Untitled', 20);
        g.appendChild(title);

        // Hashtags (reuse shared rendering function)
        renderNodeHashtags(g, node);

        layer.appendChild(g);
    }
}

/**
 * Get all node IDs within the selection box bounds.
 * Respects selection box mode: "enclosed" requires full containment, "intersecting"
 * includes any overlap. Only includes nodes that match current filters.
 *
 * @param {Object} box - Selection box with start, end coordinates and mode
 * @returns {string[]} - Array of node IDs within the selection box
 */
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

/**
 * Update the breadcrumb navigation display.
 * Shows "NotebookName > Root" at top level, or "NotebookName > Root > Parent > Child" when nested.
 * Adds 'active' class when nested (clickable to go back).
 */
function updateBreadcrumbs() {
    const el = document.getElementById('breadcrumbs');

    // Get current project name
    let projectName = 'Notebook';
    if (state.currentProjectId) {
        const projects = getProjectsList();
        const project = projects.find(p => p.id === state.currentProjectId);
        if (project) {
            projectName = truncateText(project.name, BREADCRUMB_TRUNCATE_LENGTH);
        }
    }

    if (state.currentPath.length === 0) {
        el.textContent = projectName + ' > Root';
        el.classList.remove('active');
    } else {
        const names = state.currentPath.map(p => truncateText(p.title || 'Untitled', BREADCRUMB_TRUNCATE_LENGTH));
        el.textContent = projectName + ' > Root > ' + names.join(' > ');
        el.classList.add('active');
    }
}

// ============================================================================
// NODE OPERATIONS
// ============================================================================

/**
 * Create a new node at specified canvas coordinates.
 * Initializes node with default values, adds to state.nodes array, and triggers render.
 *
 * @param {number} x - Canvas X coordinate for new node
 * @param {number} y - Canvas Y coordinate for new node
 * @returns {Object} - The newly created node object
 */
function createNode(x, y) {
    const node = {
        id: generateId(),
        title: '',
        content: '',
        hashtags: [],
        fields: {},  // Unified field storage
        position: { x, y },
        zIndex: 0,
        children: [],
        childEdges: [],
        created: new Date().toISOString(),
        modified: new Date().toISOString()
    };
    // Apply default completion if set
    // Apply default field values from settings
    const fieldDefaults = state.projectSettings.fieldDefaults || {};
    for (const fieldName in fieldDefaults) {
        if (fieldDefaults[fieldName]) {
            node.fields[fieldName] = fieldDefaults[fieldName];
        }
    }
    state.nodes.push(node);
    render();
    return node;
}

/**
 * Create a deep copy of a node with new IDs and optional position offset.
 * Recursively copies children and remaps child edge IDs. Used for duplicate and
 * move-to-notebook operations. Creates new timestamps.
 *
 * @param {Object} node - Node to copy
 * @param {number} offsetX - X offset for copied node position
 * @param {number} offsetY - Y offset for copied node position
 * @returns {Object} - Deep copy of node with new IDs
 */
function deepCopyNode(node, offsetX = 0, offsetY = 0) {
    const newNode = {
        id: generateId(),
        title: node.title,
        content: node.content,
        hashtags: [...(node.hashtags || [])],
        fields: { ...(node.fields || {}) },  // Copy all fields
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

/**
 * Delete a node and promote its children to the current level.
 * Children are positioned below the deleted parent with slight vertical stagger.
 * Child edges are promoted to current level. Removes all edges connected to the node.
 * Updates selection state and triggers render.
 *
 * @param {string} nodeId - ID of node to delete
 */
function deleteNode(nodeId) {
    // Find the node being deleted
    const node = state.nodes.find(n => n.id === nodeId);

    // Promote children to current level before deleting
    if (node && node.children && node.children.length > 0) {
        // Offset children positions relative to parent's position
        const offsetX = node.position.x;
        const offsetY = node.position.y + NODE_HEIGHT + CHILD_NODE_VERTICAL_OFFSET; // Place below parent

        node.children.forEach((child, index) => {
            // Adjust position so children appear near where parent was
            child.position.x += offsetX;
            child.position.y += offsetY + (index * CHILD_NODE_STAGGER); // Slight stagger to avoid overlap
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

/**
 * Select a node, either replacing current selection or adding to it.
 * If addToSelection is true, toggles the node in selection (add if not selected,
 * remove if already selected). Clears edge selection and updates visuals.
 *
 * @param {string} nodeId - ID of node to select
 * @param {boolean} addToSelection - If true, add to selection; if false, replace selection
 */
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

/**
 * Clear all selections (nodes, edges, edge creation mode).
 * Clears edge preview and updates visuals without full render.
 */
function clearSelection() {
    state.selectedNodes = [];
    state.selectedEdge = null;
    state.edgeStartNode = null;
    clearEdgePreview();
    updateSelectionVisuals();
}

/**
 * Update node and edge selection visuals without full re-render.
 * Adds/removes 'selected' class on DOM elements based on current selection state.
 * Updates selection action bar visibility and button states.
 */
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

/**
 * Update the selection action bar (mobile toolbar) visibility and button states.
 * Shows all buttons (connect, duplicate, delete) for node selection, only delete for
 * edge selection, and hides bar when nothing is selected. Automatically shows on mobile
 * when edge is selected.
 */
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

function showActionBar() {
    const actionBar = document.getElementById('selection-action-bar');
    if (!actionBar) return;

    actionBar.classList.remove('hidden');
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
    }, ACTION_BAR_HIDE_DELAY);
}

/**
 * Bring selected node(s) to front (highest zIndex).
 * Finds current max zIndex and sets selected nodes to maxZ + 1.
 * Triggers render to update visual stacking order.
 */
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

/**
 * Send selected node(s) to back (lowest zIndex).
 * Finds current min zIndex and sets selected nodes to minZ - 1.
 * Triggers render to update visual stacking order.
 */
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

/**
 * Gets menu items for node context menu based on selection state.
 * Items vary based on whether single or multiple nodes selected.
 *
 * @param {number} selectionCount - Number of selected nodes
 * @returns {Array<{action: string, text: string}>} - Menu item definitions
 */
function getNodeContextMenuItems(selectionCount) {
    const items = [];

    // Multi-selection specific items
    if (selectionCount > 1) {
        items.push({ action: 'connect-to', text: 'Connect to...' });
    }

    // Common items (always available)
    items.push({ action: 'bring-front', text: 'Bring to Front' });
    items.push({ action: 'send-back', text: 'Send to Back' });
    items.push({ action: 'move-to', text: 'Move to...' });

    return items;
}

/**
 * Creates a context menu item element.
 * Factory pattern for consistent menu item creation.
 *
 * @param {string} action - Action identifier (e.g., 'bring-front')
 * @param {string} text - Display text for menu item
 * @returns {HTMLElement} - Menu item element
 */
function createContextMenuItem(action, text) {
    const div = document.createElement('div');
    div.className = 'context-menu-item';
    div.dataset.action = action;
    div.textContent = text;
    return div;
}

/**
 * Creates the context menu container element with base styles.
 * Container positioned fixed at specified coordinates with proper z-index.
 *
 * @param {string} menuId - ID for the menu element
 * @param {number} x - Initial X coordinate (px)
 * @param {number} y - Initial Y coordinate (px)
 * @returns {HTMLElement} - Menu container element
 */
function createContextMenuContainer(menuId, x, y) {
    const menu = document.createElement('div');
    menu.id = menuId;
    menu.style.position = 'fixed';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.zIndex = CONTEXT_MENU_Z_INDEX;
    return menu;
}

/**
 * Populates context menu with items.
 * Creates menu item elements and appends to container.
 *
 * @param {HTMLElement} menu - Menu container element
 * @param {Array<{action: string, text: string}>} items - Menu item definitions
 */
function populateContextMenu(menu, items) {
    items.forEach(item => {
        const menuItem = createContextMenuItem(item.action, item.text);
        menu.appendChild(menuItem);
    });
}

/**
 * Adjusts context menu position to keep it within viewport bounds.
 * Flips menu to left/top if it would extend beyond right/bottom edges.
 * MUST be called after menu is appended to DOM (requires getBoundingClientRect).
 *
 * @param {HTMLElement} menu - Menu element to adjust
 * @param {number} originalX - Original X coordinate
 * @param {number} originalY - Original Y coordinate
 */
function adjustContextMenuPosition(menu, originalX, originalY) {
    const rect = menu.getBoundingClientRect();

    // Flip to left if extending beyond right edge
    if (rect.right > window.innerWidth) {
        menu.style.left = (originalX - rect.width) + 'px';
    }

    // Flip to top if extending beyond bottom edge
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (originalY - rect.height) + 'px';
    }
}

/**
 * Command: Bring selected nodes to front.
 * Increases z-order of selected nodes.
 */
function commandBringToFront() {
    bringToFront();
}

/**
 * Command: Send selected nodes to back.
 * Decreases z-order of selected nodes.
 */
function commandSendToBack() {
    sendToBack();
}

/**
 * Command: Open move-to modal.
 * Allows moving nodes to different parent/level.
 */
function commandMoveTo() {
    showMoveToModal();
}

/**
 * Command: Start batch connect mode.
 * Initiates edge creation from selected nodes.
 */
function commandConnectTo() {
    startEdgeCreation();
}

/**
 * Executes context menu action based on action identifier.
 * Maps action strings to command functions using Command Pattern.
 *
 * @param {string} action - Action identifier from menu item
 */
function executeContextMenuAction(action) {
    const commands = {
        'bring-front': commandBringToFront,
        'send-back': commandSendToBack,
        'move-to': commandMoveTo,
        'connect-to': commandConnectTo
    };

    const command = commands[action];
    if (command) {
        command();
    }
}

/**
 * Attaches click handler to context menu.
 * Handles action execution and menu cleanup.
 *
 * @param {HTMLElement} menu - Menu element
 * @param {Function} onAction - Callback for action execution
 */
function attachContextMenuHandler(menu, onAction) {
    menu.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        const action = e.target.dataset.action;
        if (action) {
            onAction(action);
            hideNodeContextMenu();
        }
    });
}

/**
 * Shows node context menu at specified screen coordinates.
 * Menu items vary based on selection count (multi-select adds "Connect to...").
 * Position adjusted to keep menu within viewport bounds.
 *
 * @param {string} nodeId - ID of node (currently unused, for future features)
 * @param {number} x - Screen X coordinate for menu position
 * @param {number} y - Screen Y coordinate for menu position
 */
function showNodeContextMenu(nodeId, x, y) {
    hideNodeContextMenu(); // Guard: cleanup existing menu

    // 1. Get menu configuration based on selection state
    const items = getNodeContextMenuItems(state.selectedNodes.length);

    // 2. Create menu structure
    const menu = createContextMenuContainer('node-context-menu', x, y);
    populateContextMenu(menu, items);

    // 3. Add to DOM (required for position adjustment)
    document.body.appendChild(menu);

    // 4. Adjust position to prevent off-screen rendering
    adjustContextMenuPosition(menu, x, y);

    // 5. Attach event handler
    attachContextMenuHandler(menu, executeContextMenuAction);
}

function hideNodeContextMenu() {
    const menu = document.getElementById('node-context-menu');
    if (menu) menu.remove();
}

// ============================================================================
// EDGE OPERATIONS
// ============================================================================

/**
 * Start edge creation mode from a node or batch of selected nodes.
 * If nodeId provided, starts single-edge mode from that node. Otherwise, uses current
 * selection for batch connect mode (multiple sources to one target).
 *
 * @param {string} nodeId - Optional ID of starting node; if omitted, uses selection
 */
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

/**
 * Complete edge creation by connecting to target node.
 * In batch mode, creates edges from all source nodes to target. Toggles edges (removes
 * if exists, creates if not). Prevents self-connections. Clears edge creation state
 * and triggers render.
 *
 * @param {string} targetNodeId - ID of node to connect to
 */
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

/**
 * Navigate into a node to view/edit its children (nested graph).
 * Saves current level state to parent node, pushes node to navigation path, loads
 * node's children and edges, clears selection and filters, resets viewport.
 *
 * @param {string} nodeId - ID of node to enter
 */
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

/**
 * Navigate back up one level in the node hierarchy.
 * Saves current level state to node, pops from path, restores parent level (or root),
 * clears selection and filters, resets viewport, schedules auto-save.
 */
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

/**
 * Open the editor modal for a single node or batch of selected nodes.
 * In batch mode, disables title field and shows aggregate tag counts. In single mode,
 * shows full node content. Snapshots state for cancel/revert, updates UI based on
 * node content (children count, completion status, hashtags).
 *
 * @param {string} nodeId - ID of node to edit (ignored in batch mode)
 */
/**
 * Prepares the editor session by clearing state and hiding UI elements.
 */
function prepareEditorSession() {
    state.removedTagsInSession.clear();
    hideActionBar();
}

/**
 * Gets all DOM elements needed for the editor modal.
 * @returns {Object} Object containing editor DOM elements
 */
function getEditorElements() {
    return {
        modal: document.getElementById('editor-modal'),
        titleInput: document.getElementById('note-title'),
        textarea: document.getElementById('note-text'),
        enterBtn: document.getElementById('editor-enter')
    };
}

/**
 * Opens the editor in batch mode for editing multiple nodes.
 * @param {Array} nodes - Array of node objects to edit
 */
function openBatchEditor(nodes) {
    if (nodes.length === 0) return;

    // Snapshot all nodes for cancel/revert
    const snapshots = nodes.map(node => {
        const snapshot = {
            id: node.id,
            hashtags: [...(node.hashtags || [])],
            fields: { ...(node.fields || {}) }  // Copy all fields
        };
        return snapshot;
    });
    state.editorSnapshot = { batchMode: true, nodes: snapshots };

    const elements = getEditorElements();

    // Configure title input (disabled in batch mode)
    elements.titleInput.disabled = true;
    elements.titleInput.value = '';
    elements.titleInput.placeholder = `Editing ${nodes.length} notes`;

    // Configure textarea for tag entry
    elements.textarea.disabled = false;
    elements.textarea.value = '';
    elements.textarea.placeholder = 'Type tags to add (e.g., #urgent #review)';

    // Disable enter button
    elements.enterBtn.disabled = true;
    elements.enterBtn.textContent = 'Step into note';
    elements.enterBtn.classList.remove('has-children');

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
            return tagCounts[b] - tagCounts[a];
        }
        return a.localeCompare(b);
    });

    updateHashtagDisplay(allTags, true, nodes.length, tagCounts);

    // Load First-Class field values (show value if all same, otherwise clear)
    for (const fieldName in FIRST_CLASS_FIELDS) {
        const values = nodes.map(n => getNodeFieldValue(n, fieldName));
        const allSame = values.every(v => v === values[0]);
        setFieldButtons(fieldName, allSame ? (values[0] || '') : '');
    }

    // Render and load Second-Class custom fields
    renderCustomFieldsInEditor(null, nodes, true);

    // Show modal and focus textarea
    elements.modal.classList.remove('hidden');
    elements.modal.dataset.batchMode = 'true';
    elements.textarea.focus();
}

/**
 * Opens the editor in single mode for editing one node.
 * @param {Object} node - The node object to edit
 * @param {string} nodeId - The node's ID
 */
function openSingleEditor(node, nodeId) {
    if (!node) return;

    // Snapshot current state for cancel/revert
    const snapshot = {
        batchMode: false,
        title: node.title || '',
        content: node.content || '',
        hashtags: [...(node.hashtags || [])],
        fields: { ...(node.fields || {}) }  // Copy all fields
    };
    state.editorSnapshot = snapshot;

    const elements = getEditorElements();

    // Enable all fields
    elements.titleInput.disabled = false;
    elements.textarea.disabled = false;
    elements.enterBtn.disabled = false;

    // Load node data
    elements.titleInput.value = node.title || '';
    elements.titleInput.placeholder = '';
    elements.textarea.value = node.content || '';
    elements.textarea.placeholder = '';

    updateHashtagDisplay(node.hashtags || [], false, 1, {});

    // Load First-Class field values into editor
    loadAllFieldValues(node);

    // Render and load Second-Class custom fields
    renderCustomFieldsInEditor(node, null, false);

    // Update enter button based on whether node has children
    if (node.children && node.children.length > 0) {
        const count = node.children.length;
        elements.enterBtn.textContent = `View ${count} nested ${count === 1 ? 'note' : 'notes'}`;
        elements.enterBtn.classList.add('has-children');
    } else {
        elements.enterBtn.textContent = 'Step into note';
        elements.enterBtn.classList.remove('has-children');
    }

    // Show modal and focus title
    elements.modal.classList.remove('hidden');
    elements.modal.dataset.nodeId = nodeId;
    elements.titleInput.focus();
    elements.titleInput.setSelectionRange(0, 0);
    elements.titleInput.scrollLeft = 0;
}

// ============================================================================
// CUSTOM FIELDS RENDERING (Editor Integration)
// ============================================================================

/**
 * Append "Create custom field..." control to the custom fields container.
 * Shows different text based on whether fields exist.
 * @param {HTMLElement} container - The custom fields container element
 * @param {boolean} hasExistingFields - Whether any custom fields are defined
 */
function appendCreateFieldControl(container, hasExistingFields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'create-field-control';

    const link = document.createElement('button');
    link.className = 'create-field-link';
    link.type = 'button';

    if (hasExistingFields) {
        link.textContent = '+ Create custom field...';
    } else {
        link.textContent = 'No custom fields defined. Create custom field...';
    }

    link.addEventListener('click', (e) => {
        e.preventDefault();
        openFieldEditorFromEditor();
    });

    wrapper.appendChild(link);
    container.appendChild(wrapper);
}

/**
 * Render all custom fields in the editor based on project settings.
 * Called when opening editor (single or batch mode).
 * @param {Object} node - The node being edited (null in batch mode)
 * @param {Array} nodes - Array of nodes (batch mode only)
 * @param {boolean} isBatchMode - Whether in batch editing mode
 */
function renderCustomFieldsInEditor(node, nodes, isBatchMode) {
    const container = document.getElementById('custom-fields-container');
    container.replaceChildren(); // Clear existing fields

    const customFields = state.projectSettings.customFields || [];
    const hasExistingFields = customFields.length > 0;

    // Render existing custom fields
    customFields.forEach(fieldDef => {
        const renderer = FIELD_TYPE_RENDERERS[fieldDef.type];
        if (!renderer) {
            console.warn(`No renderer for field type: ${fieldDef.type}`);
            return;
        }

        // Render the field control
        const fieldControl = renderer.render(fieldDef);
        container.appendChild(fieldControl);

        // Load current value(s) into the control
        if (isBatchMode) {
            renderer.load(fieldDef, nodes, true);
        } else {
            renderer.load(fieldDef, node, false);
        }
    });

    // Always append "Create custom field..." control
    appendCreateFieldControl(container, hasExistingFields);
}

/**
 * Save all custom field values from editor controls to node(s).
 * Called when saving editor.
 * @param {Object} node - The node being saved (null in batch mode)
 * @param {Array} nodes - Array of nodes (batch mode only)
 * @param {boolean} isBatchMode - Whether in batch editing mode
 */
function saveCustomFieldsFromEditor(node, nodes, isBatchMode) {
    const customFields = state.projectSettings.customFields || [];

    customFields.forEach(fieldDef => {
        const renderer = FIELD_TYPE_RENDERERS[fieldDef.type];
        if (!renderer) return;

        if (isBatchMode) {
            renderer.save(fieldDef, nodes, true);
        } else {
            renderer.save(fieldDef, node, false);
        }
    });
}

// ----------------------------------------------------------------------------
// Single-Select Field Type
// ----------------------------------------------------------------------------

/**
 * Render a single-select field control (dropdown, one choice).
 * @param {Object} fieldDef - Field definition from settings
 * @returns {HTMLElement} - The field control container
 */
function renderSingleSelectField(fieldDef) {
    const control = document.createElement('div');
    control.className = 'custom-field-control';
    control.dataset.fieldName = fieldDef.name;
    control.dataset.fieldType = 'single-select';

    // Label
    const label = document.createElement('span');
    label.className = 'custom-field-label';
    label.textContent = `${fieldDef.label || fieldDef.name}:`;
    control.appendChild(label);

    // Dropdown select
    const select = document.createElement('select');
    select.className = 'custom-field-select';
    select.dataset.fieldName = fieldDef.name;

    // None option
    const noneOption = document.createElement('option');
    noneOption.value = '';
    noneOption.textContent = 'None';
    select.appendChild(noneOption);

    // Field options
    (fieldDef.options || []).forEach(option => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        select.appendChild(optionEl);
    });

    // Add new option
    const addNewOption = document.createElement('option');
    addNewOption.value = '__ADD_NEW__';
    addNewOption.textContent = '(add new...)';
    select.appendChild(addNewOption);

    // Handle selection change
    select.addEventListener('change', async (e) => {
        if (e.target.value === '__ADD_NEW__') {
            const newOption = await addNewFieldOption(fieldDef);
            if (newOption) {
                // Set the select to the new option
                e.target.value = newOption;
            } else {
                // User cancelled, reset to None
                e.target.value = '';
            }
        }
    });

    control.appendChild(select);
    return control;
}

/**
 * Load value into single-select field control.
 * @param {Object} fieldDef - Field definition
 * @param {Object|Array} nodeOrNodes - Node or array of nodes
 * @param {boolean} isBatchMode - Batch mode flag
 */
function loadSingleSelectFieldValue(fieldDef, nodeOrNodes, isBatchMode) {
    const select = document.querySelector(`.custom-field-select[data-field-name="${fieldDef.name}"]`);
    if (!select) return;

    let valueToShow = null;

    if (isBatchMode) {
        // Batch mode: show value if unanimous, otherwise show nothing
        const values = nodeOrNodes.map(n => getNodeFieldValue(n, fieldDef.name));
        const uniqueValues = [...new Set(values)];
        if (uniqueValues.length === 1) {
            valueToShow = uniqueValues[0];
        }
        // If mixed, set to empty (None)
    } else {
        // Single mode: show node's current value
        valueToShow = getNodeFieldValue(nodeOrNodes, fieldDef.name);
    }

    // Set dropdown value
    select.value = valueToShow || '';
}

/**
 * Save value from single-select field control to node(s).
 * @param {Object} fieldDef - Field definition
 * @param {Object|Array} nodeOrNodes - Node or array of nodes
 * @param {boolean} isBatchMode - Batch mode flag
 */
function saveSingleSelectFieldValue(fieldDef, nodeOrNodes, isBatchMode) {
    const select = document.querySelector(`.custom-field-select[data-field-name="${fieldDef.name}"]`);
    if (!select) return;

    const value = select.value || null;

    if (isBatchMode) {
        // In batch mode: always save (user explicitly chose a value from dropdown)
        nodeOrNodes.forEach(node => {
            setNodeFieldValue(node, fieldDef.name, value);
        });
    } else {
        // Single mode: always save the value
        setNodeFieldValue(nodeOrNodes, fieldDef.name, value);
    }
}

// ----------------------------------------------------------------------------
// Multi-Select Field Type
// ----------------------------------------------------------------------------

/**
 * Render a multi-select field control (dropdown with checkboxes).
 * @param {Object} fieldDef - Field definition from settings
 * @returns {HTMLElement} - The field control container
 */
function renderMultiSelectField(fieldDef) {
    const control = document.createElement('div');
    control.className = 'custom-field-control';
    control.dataset.fieldName = fieldDef.name;
    control.dataset.fieldType = 'multi-select';

    // Label
    const label = document.createElement('span');
    label.className = 'custom-field-label';
    label.textContent = `${fieldDef.label || fieldDef.name}:`;
    control.appendChild(label);

    // Dropdown wrapper
    const dropdownWrapper = document.createElement('div');
    dropdownWrapper.className = 'multi-select-dropdown';
    dropdownWrapper.dataset.fieldName = fieldDef.name;

    // Display button (shows selected items)
    const displayBtn = document.createElement('button');
    displayBtn.type = 'button';
    displayBtn.className = 'multi-select-display';
    displayBtn.textContent = 'None';
    dropdownWrapper.appendChild(displayBtn);

    // Dropdown menu (contains checkboxes)
    const menu = document.createElement('div');
    menu.className = 'multi-select-menu hidden';

    // Add checkbox for each option
    (fieldDef.options || []).forEach(option => {
        const item = document.createElement('label');
        item.className = 'multi-select-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = option;
        checkbox.dataset.fieldName = fieldDef.name;

        const span = document.createElement('span');
        span.textContent = option;

        item.appendChild(checkbox);
        item.appendChild(span);
        menu.appendChild(item);

        // Update display when checkbox changes
        checkbox.addEventListener('change', () => {
            updateMultiSelectDisplay(fieldDef.name);
        });
    });

    // Add "add new" option
    const addNewItem = document.createElement('div');
    addNewItem.className = 'multi-select-item multi-select-add-new';
    addNewItem.textContent = '(add new...)';
    addNewItem.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newOption = await addNewFieldOption(fieldDef);
        if (newOption) {
            // Keep menu open and check the new option
            // (The field will be re-rendered by addNewFieldOption)
        }
    });
    menu.appendChild(addNewItem);

    dropdownWrapper.appendChild(menu);
    control.appendChild(dropdownWrapper);

    // Toggle dropdown on button click
    displayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Close other dropdowns
        document.querySelectorAll('.multi-select-menu').forEach(m => {
            if (m !== menu) m.classList.add('hidden');
        });
        menu.classList.toggle('hidden');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    return control;
}

/**
 * Update the display text for a multi-select dropdown.
 * @param {string} fieldName - Field name
 */
function updateMultiSelectDisplay(fieldName) {
    const wrapper = document.querySelector(`.multi-select-dropdown[data-field-name="${fieldName}"]`);
    if (!wrapper) return;

    const displayBtn = wrapper.querySelector('.multi-select-display');
    const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]:checked');

    if (checkboxes.length === 0) {
        displayBtn.textContent = 'None';
    } else {
        const selected = Array.from(checkboxes).map(cb => cb.value);
        displayBtn.textContent = selected.join(', ');
    }
}

/**
 * Load values into multi-select field control.
 * @param {Object} fieldDef - Field definition
 * @param {Object|Array} nodeOrNodes - Node or array of nodes
 * @param {boolean} isBatchMode - Batch mode flag
 */
function loadMultiSelectFieldValue(fieldDef, nodeOrNodes, isBatchMode) {
    const wrapper = document.querySelector(`.multi-select-dropdown[data-field-name="${fieldDef.name}"]`);
    if (!wrapper) return;

    let valuesToShow = [];

    if (isBatchMode) {
        // Batch mode: show values only if unanimous across all nodes
        const allValues = nodeOrNodes.map(n => {
            const val = getNodeFieldValue(n, fieldDef.name);
            return Array.isArray(val) ? val : [];
        });

        // Check if all nodes have the same set of values
        const firstSet = JSON.stringify(allValues[0].sort());
        const allSame = allValues.every(vals => JSON.stringify(vals.sort()) === firstSet);

        if (allSame) {
            valuesToShow = allValues[0];
        }
        // If mixed, leave all checkboxes unchecked
    } else {
        // Single mode: show node's current values
        const val = getNodeFieldValue(nodeOrNodes, fieldDef.name);
        valuesToShow = Array.isArray(val) ? val : [];
    }

    // Check the checkboxes matching the values
    const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = valuesToShow.includes(checkbox.value);
    });

    updateMultiSelectDisplay(fieldDef.name);
}

/**
 * Save values from multi-select field control to node(s).
 * @param {Object} fieldDef - Field definition
 * @param {Object|Array} nodeOrNodes - Node or array of nodes
 * @param {boolean} isBatchMode - Batch mode flag
 */
function saveMultiSelectFieldValue(fieldDef, nodeOrNodes, isBatchMode) {
    const wrapper = document.querySelector(`.multi-select-dropdown[data-field-name="${fieldDef.name}"]`);
    if (!wrapper) return;

    const checkedBoxes = wrapper.querySelectorAll('input[type="checkbox"]:checked');
    const values = Array.from(checkedBoxes).map(cb => cb.value);

    const finalValue = values.length > 0 ? values : null;

    if (isBatchMode) {
        // In batch mode: always save (user explicitly interacted with dropdown)
        nodeOrNodes.forEach(node => {
            setNodeFieldValue(node, fieldDef.name, finalValue);
        });
    } else {
        // Single mode: always save the values
        setNodeFieldValue(nodeOrNodes, fieldDef.name, finalValue);
    }
}

/**
 * Add a new option to a field definition.
 * Prompts user for new option, validates, adds to field definition, and re-renders.
 * @param {Object} fieldDef - Field definition to add option to
 * @returns {Promise<string|null>} - The new option value, or null if cancelled
 */
async function addNewFieldOption(fieldDef) {
    // Prompt for new option
    const newOption = await showPrompt(
        `Add new option to "${fieldDef.label || fieldDef.name}":`,
        ''
    );

    if (!newOption || !newOption.trim()) {
        return null;
    }

    const trimmedOption = newOption.trim();

    // Check if option already exists
    if (fieldDef.options && fieldDef.options.includes(trimmedOption)) {
        await showAlert('This option already exists.', 'Error');
        return null;
    }

    // Add option to field definition
    if (!fieldDef.options) {
        fieldDef.options = [];
    }
    fieldDef.options.push(trimmedOption);

    // Save to project settings
    scheduleAutoSave();

    // Get current editor mode to preserve values
    const { isBatchMode, nodes, node } = getEditorMode();

    // Re-render custom fields to show new option
    renderCustomFieldsInEditor(node, nodes, isBatchMode);

    return trimmedOption;
}

/**
 * Field type renderer registry.
 * Each field type has render, load, and save functions.
 * Defined after all renderer functions to avoid hoisting issues.
 */
const FIELD_TYPE_RENDERERS = {
    'single-select': {
        render: renderSingleSelectField,
        load: loadSingleSelectFieldValue,
        save: saveSingleSelectFieldValue
    },
    'multi-select': {
        render: renderMultiSelectField,
        load: loadMultiSelectFieldValue,
        save: saveMultiSelectFieldValue
    }
    // Future: 'text', 'number', 'date', 'checkbox', 'url'
};

// ============================================================================
// EDITOR
// ============================================================================

/**
 * Opens the note editor modal.
 * Supports both single node and batch editing modes based on selection state.
 * @param {string} nodeId - The ID of the node to edit (used in single mode)
 */
function openEditor(nodeId) {
    const isBatchMode = state.selectedNodes.length > 1;
    prepareEditorSession();

    if (isBatchMode) {
        const nodes = state.selectedNodes
            .map(id => state.nodes.find(n => n.id === id))
            .filter(Boolean);
        openBatchEditor(nodes);
    } else {
        const node = state.nodes.find(n => n.id === nodeId);
        openSingleEditor(node, nodeId);
    }
}

function closeEditor() {
    hideAutocomplete();
    cleanupHashtagPillHandlers();
    const modal = document.getElementById('editor-modal');
    modal.classList.add('hidden');
    delete modal.dataset.nodeId;
    delete modal.dataset.batchMode;
    state.removedTagsInSession.clear();
}

/**
 * Cancel editor and revert all changes.
 * In batch mode, restores hashtags and all First Class Fields for all edited nodes.
 * In single mode, restores node to snapshot state and deletes empty nodes (never filled in).
 * Closes editor and triggers render.
 */
function cancelEditor() {
    const modal = document.getElementById('editor-modal');

    if (state.editorSnapshot && state.editorSnapshot.batchMode) {
        // Batch mode: restore all nodes from snapshot
        state.editorSnapshot.nodes.forEach(snapshot => {
            const node = state.nodes.find(n => n.id === snapshot.id);
            if (node) {
                node.hashtags = snapshot.hashtags;
                // Restore all fields from snapshot
                node.fields = { ...snapshot.fields };
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
            // Restore all fields from snapshot
            node.fields = { ...state.editorSnapshot.fields };
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

/**
 * Gets the editor mode and associated nodes.
 * @returns {Object} Object with isBatchMode flag and relevant nodes
 */
function getEditorMode() {
    const modal = document.getElementById('editor-modal');
    const isBatchMode = modal.dataset.batchMode === 'true';

    if (isBatchMode) {
        const nodes = state.selectedNodes
            .map(id => state.nodes.find(n => n.id === id))
            .filter(Boolean);
        return { isBatchMode, nodes, node: null };
    } else {
        const nodeId = modal.dataset.nodeId;
        const node = state.nodes.find(n => n.id === nodeId);
        return { isBatchMode, nodes: null, node, nodeId };
    }
}

/**
 * Gets form data from the editor inputs.
 * @returns {Object} Object containing form values
 */
function getEditorFormData() {
    const titleInput = document.getElementById('note-title');
    const textarea = document.getElementById('note-text');
    const newTags = parseHashtags(textarea.value);
    const fieldValues = getAllFieldValues(); // Gets all fields dynamically

    return {
        titleInput: titleInput.value,
        textarea: textarea.value,
        newTags,
        ...fieldValues  // Spreads completion, priority, and any future fields
    };
}

/**
 * Removes specified tags from nodes in batch mode.
 * @param {Array} nodes - Array of node objects
 * @param {Set} tagsToRemove - Set of tag strings to remove
 */
function removeBatchTags(nodes, tagsToRemove) {
    if (tagsToRemove.size === 0) return;

    nodes.forEach(node => {
        tagsToRemove.forEach(tag => {
            // Remove from hashtags array
            node.hashtags = node.hashtags.filter(t => t !== tag);
            // Remove from content text
            const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escapedTag + '\\s?', 'gi');
            node.content = node.content.replace(regex, '').trim();
            // Clean up multiple spaces
            node.content = node.content.replace(/\s+/g, ' ');
        });
    });
}

/**
 * Adds specified tags to nodes in batch mode.
 * @param {Array} nodes - Array of node objects
 * @param {Array} tagsToAdd - Array of tag strings to add
 */
function addBatchTags(nodes, tagsToAdd) {
    if (tagsToAdd.length === 0) return;

    nodes.forEach(node => {
        tagsToAdd.forEach(tag => {
            if (!node.hashtags.includes(tag)) {
                node.hashtags.push(tag);
            }
        });

        // Update content to include new tags
        const existingContent = node.content.trim();
        const missingTags = tagsToAdd.filter(tag => !node.content.includes(tag));
        if (missingTags.length > 0) {
            node.content = existingContent + (existingContent ? ' ' : '') + missingTags.join(' ');
            node.hashtags = parseHashtags(node.content);
        }
    });
}

/**
 * Updates modified timestamps for nodes in batch mode.
 * @param {Array} nodes - Array of node objects
 */
function updateBatchTimestamps(nodes) {
    const timestamp = new Date().toISOString();
    nodes.forEach(node => {
        node.modified = timestamp;
    });
}

/**
 * Validates single node input with soft limits and confirmation dialogs.
 * @param {string} titleValue - Title input value
 * @param {string} contentValue - Content textarea value
 * @returns {Promise<boolean>} True if validation passes, false otherwise
 */
async function validateSingleNodeInput(titleValue, contentValue) {
    // Validate title length (soft limit)
    if (titleValue.length > TITLE_SOFT_LIMIT) {
        const confirmed = await showConfirmation(
            `Warning: Title is ${titleValue.length} characters (recommended max: ${TITLE_SOFT_LIMIT}). Save anyway?`
        );
        if (!confirmed) return false;
    }

    // Validate content length (soft limit)
    if (contentValue.length > CONTENT_SOFT_LIMIT) {
        const confirmed = await showConfirmation(
            `Warning: Content is ${contentValue.length} characters (recommended max: ${CONTENT_SOFT_LIMIT.toLocaleString()}). Save anyway?`
        );
        if (!confirmed) return false;
    }

    return true;
}

/**
 * Saves single node data from editor inputs.
 * @param {Object} node - The node object to update
 * @param {string} nodeId - The node's ID
 * @param {string} titleValue - Title input value
 * @param {string} contentValue - Content textarea value
 * @param {Object} fieldValues - Object with all field values (First-Class and Second-Class)
 */
function saveSingleNode(node, nodeId, titleValue, contentValue, fieldValues) {
    if (!node) return;

    node.title = titleValue;
    node.content = contentValue;
    node.hashtags = parseHashtags(contentValue);
    node.modified = new Date().toISOString();

    // Update all fields (First-Class and Second-Class)
    updateNodeFields(node, fieldValues);

    // Delete empty nodes (created but never filled in)
    if (!node.title.trim() && !node.content.trim()) {
        deleteNode(nodeId);
    }
}

/**
 * Cleans up editor state and closes the editor.
 */
function cleanupEditorState() {
    state.editorSnapshot = null;
    closeEditor();
    render();
}

/**
 * Save editor changes and close.
 * In batch mode, adds/removes hashtags and updates all fields for all selected nodes.
 * In single mode, validates and saves title/content/hashtags/fields. Updates modified timestamp,
 * deletes empty nodes, closes editor, and triggers render.
 * @returns {Promise<void>}
 */
async function saveEditor() {
    const { isBatchMode, nodes, node, nodeId } = getEditorMode();
    const formData = getEditorFormData();

    if (isBatchMode) {
        removeBatchTags(nodes, state.removedTagsInSession);
        addBatchTags(nodes, formData.newTags);

        // Update all First-Class fields in batch (only if user made a selection)
        for (const fieldName in FIRST_CLASS_FIELDS) {
            if (hasFieldSelection(fieldName)) {
                // User selected something (including "None")
                const value = formData[fieldName];
                nodes.forEach(node => {
                    setNodeFieldValue(node, fieldName, value);
                });
            }
        }

        // Save all Second-Class custom fields from editor
        saveCustomFieldsFromEditor(null, nodes, true);

        updateBatchTimestamps(nodes);
    } else {
        if (!await validateSingleNodeInput(formData.titleInput, formData.textarea)) return;

        // formData already contains all field values from getAllFieldValues()
        saveSingleNode(node, nodeId, formData.titleInput, formData.textarea, formData);

        // Save all Second-Class custom fields from editor
        saveCustomFieldsFromEditor(node, null, false);
    }

    cleanupEditorState();
}

/**
 * Calculates badge text for hashtag pill in batch edit mode.
 * Shows count format "(n/total)" where n is nodes with this tag.
 * Removed tags show as "(0/total)".
 *
 * @param {string} tag - Hashtag to get badge for
 * @param {boolean} isBatchMode - Whether in batch edit mode
 * @param {boolean} isRemoved - Whether tag is marked for removal
 * @param {Object} tagCounts - Map of tag to count (may be null/undefined)
 * @param {number} totalNodes - Total number of nodes being edited
 * @returns {string} - Badge text (empty string if not batch mode)
 */
function getHashtagBadgeText(tag, isBatchMode, isRemoved, tagCounts, totalNodes) {
    if (!isBatchMode) return '';
    const count = isRemoved ? 0 : (tagCounts?.[tag] || 0);
    return ` (${count}/${totalNodes})`;
}

/**
 * Applies styling to hashtag pill element.
 * Solid pills: colored background, white text (normal state)
 * Outlined pills: transparent background, colored border (removed state)
 *
 * @param {HTMLElement} element - Pill element to style
 * @param {string} color - Color to apply
 * @param {boolean} isRemoved - Whether tag is in removed state
 */
function applyHashtagPillStyle(element, color, isRemoved) {
    if (isRemoved) {
        // Outlined pill: transparent background, colored border
        element.style.background = 'transparent';
        element.style.border = `2px solid ${color}`;
        element.style.color = '#fff';
    } else {
        // Solid pill: background color, white text
        element.style.background = color;
        element.style.color = '#fff';
    }
}

/**
 * Creates a hashtag pill element with styling.
 * Factory pattern for consistent pill creation.
 *
 * @param {string} tag - Hashtag text
 * @param {string} badge - Badge text (e.g., " (3/5)")
 * @param {string} color - Pill color
 * @param {boolean} isRemoved - Whether tag is in removed state
 * @returns {HTMLElement} - Complete pill element
 */
function createHashtagPill(tag, badge, color, isRemoved) {
    const span = document.createElement('span');
    span.className = 'hashtag editor-hashtag';
    span.dataset.tag = tag;
    span.textContent = tag + badge;
    applyHashtagPillStyle(span, color, isRemoved);
    return span;
}

/**
 * Saves current cursor position in textarea.
 *
 * @param {HTMLTextAreaElement} textarea - Textarea element
 * @returns {number} - Cursor position (selectionStart)
 */
function saveCursorPosition(textarea) {
    return textarea.selectionStart;
}

/**
 * Restores cursor position in textarea.
 * Clamps position to valid range (0 to content length).
 *
 * @param {HTMLTextAreaElement} textarea - Textarea element
 * @param {number} position - Desired cursor position
 */
function restoreCursorPosition(textarea, position) {
    const newPos = Math.min(position, textarea.value.length);
    textarea.setSelectionRange(newPos, newPos);
}

/**
 * Re-adds a previously removed tag to both state and textarea content.
 * Removes from removed set and appends tag to content.
 *
 * @param {string} tag - Hashtag to re-add
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function reAddRemovedTag(tag, textarea) {
    state.removedTagsInSession.delete(tag);
    const currentContent = textarea.value.trim();
    textarea.value = currentContent + (currentContent ? ' ' : '') + tag;
}

/**
 * Marks tag as removed in both state and content.
 * Adds to removed set and calls removeTagFromContent helper.
 *
 * @param {string} tag - Hashtag to remove
 */
function markTagAsRemoved(tag) {
    state.removedTagsInSession.add(tag);
    removeTagFromContent(tag);
}

/**
 * Triggers synthetic input event on textarea without showing autocomplete.
 * Sets suppression flag before dispatching event to prevent dropdown.
 *
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function triggerInputWithoutAutocomplete(textarea) {
    autocomplete.suppress = true;
    textarea.dispatchEvent(new Event('input'));
}

/**
 * Attaches click handler to hashtag display using event delegation.
 * Single handler on parent container delegates to child pills.
 * More efficient than individual handlers on each pill.
 * Uses AbortController for clean listener management.
 *
 * @param {HTMLElement} display - Hashtag display container
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
function attachHashtagPillHandlers(display, textarea) {
    // Abort previous listener if exists (prevents duplicates on re-render)
    if (display._abortController) {
        display._abortController.abort();
    }

    // Create new AbortController for this listener
    const abortController = new AbortController();
    display._abortController = abortController;

    // Create delegated handler
    const handler = (e) => {
        // Check if clicked element is a pill
        const pill = e.target.closest('.editor-hashtag');
        if (!pill) return; // Not a pill, ignore

        const tag = pill.dataset.tag;
        const isRemoved = state.removedTagsInSession.has(tag);
        const cursorPos = saveCursorPosition(textarea);

        if (isRemoved) {
            reAddRemovedTag(tag, textarea);
        } else {
            markTagAsRemoved(tag);
        }

        triggerInputWithoutAutocomplete(textarea);
        restoreCursorPosition(textarea, cursorPos);

        // Return focus to textarea for better editing flow
        textarea.focus();
    };

    // Attach listener with abort signal
    display.addEventListener('click', handler, { signal: abortController.signal });
}

/**
 * Cleans up hashtag pill click handlers.
 * Called when editor modal closes to prevent memory leaks.
 * Uses AbortController to remove event listener.
 */
function cleanupHashtagPillHandlers() {
    const display = document.getElementById('hashtag-display');
    if (display?._abortController) {
        display._abortController.abort();
        display._abortController = null;
    }
}

/**
 * Update the hashtag pill display in the editor.
 * In batch mode, shows counts (e.g., "(3/5)" for tag in 3 of 5 nodes). Removed tags
 * shown with outlined style. Click handlers toggle add/remove state. Suppresses
 * autocomplete during synthetic updates.
 *
 * @param {string[]} hashtags - Array of hashtags to display
 * @param {boolean} isBatchMode - If true, show tag counts
 * @param {number} totalNodes - Total number of nodes being edited (batch mode)
 * @param {Object} tagCounts - Map of tag to count (how many nodes have it)
 */
function updateHashtagDisplay(hashtags, isBatchMode = false, totalNodes = 1, tagCounts = {}) {
    const display = document.getElementById('hashtag-display');
    const textarea = document.getElementById('note-text');

    display.replaceChildren();

    hashtags.forEach(tag => {
        const color = getHashtagColor(tag, false);
        const isRemoved = state.removedTagsInSession.has(tag);
        const badge = getHashtagBadgeText(tag, isBatchMode, isRemoved, tagCounts, totalNodes);
        const pill = createHashtagPill(tag, badge, color, isRemoved);
        display.appendChild(pill);
    });

    attachHashtagPillHandlers(display, textarea);
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

// ============================================================================
// HASHTAG AUTOCOMPLETE
// ============================================================================

/**
 * Get autocomplete suggestions for a hashtag query.
 * Filters existing tags by query prefix, sorts by usage count (descending) then
 * alphabetically, limits to 20 results. Returns objects with tag, color, and count.
 *
 * @param {string} query - Query text after '#' (without the hash)
 * @returns {Object[]} - Array of suggestion objects with tag, color, count
 */
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
        .slice(0, AUTOCOMPLETE_MAX_RESULTS);
    return filtered.map(tag => ({
        tag,
        color: getHashtagColor(tag, false), // Don't auto-assign colors during autocomplete typing
        count: counts[tag]
    }));
}

/**
 * Updates autocomplete state with suggestions and target input.
 * Resets selection index and marks autocomplete as active.
 *
 * @param {Object[]} suggestions - Array of autocomplete suggestions
 * @param {HTMLElement} inputElement - Input element that triggered autocomplete
 */
function updateAutocompleteState(suggestions, inputElement) {
    autocomplete.items = suggestions;
    autocomplete.selectedIndex = -1;
    autocomplete.active = true;
    autocomplete.targetInput = inputElement;
}

/**
 * Creates an empty state element for autocomplete dropdown.
 * Shown when no tags match the current query.
 *
 * @returns {HTMLElement} - Empty state div element
 */
function renderEmptyAutocomplete() {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'autocomplete-empty';
    emptyDiv.textContent = 'No matching tags';
    return emptyDiv;
}

/**
 * Creates a single autocomplete item element with pill, tag, and count.
 * Uses Factory Pattern to encapsulate element creation logic.
 *
 * @param {Object} suggestion - Suggestion object with tag, color, and count
 * @param {number} index - Index of item in suggestions array
 * @returns {HTMLElement} - Complete autocomplete item div
 */
function createAutocompleteItem(suggestion, index) {
    const div = document.createElement('div');
    div.className = 'autocomplete-item';
    div.dataset.index = index;

    const pill = document.createElement('span');
    pill.className = 'ac-pill';
    pill.style.background = suggestion.color;

    const tag = document.createElement('span');
    tag.className = 'ac-tag';
    tag.textContent = suggestion.tag;

    const count = document.createElement('span');
    count.className = 'ac-count';
    count.textContent = suggestion.count;

    div.appendChild(pill);
    div.appendChild(tag);
    div.appendChild(count);

    return div;
}

/**
 * Attaches mousedown event handler to autocomplete item.
 * Prevents input blur and triggers item selection.
 *
 * @param {HTMLElement} itemElement - Autocomplete item element
 * @param {number} index - Index of item to select
 */
function attachAutocompleteItemHandler(itemElement, index) {
    itemElement.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent input blur
        selectAutocompleteItem(index);
    });
}

/**
 * Populates autocomplete list with suggestions or empty state.
 * Clears existing list and creates new item elements with event handlers.
 *
 * @param {Object[]} suggestions - Array of autocomplete suggestions
 */
function populateAutocompleteList(suggestions) {
    const list = document.getElementById('hashtag-autocomplete-list');

    if (suggestions.length === 0) {
        list.replaceChildren(renderEmptyAutocomplete());
        return;
    }

    list.replaceChildren();
    suggestions.forEach((suggestion, index) => {
        const item = createAutocompleteItem(suggestion, index);
        attachAutocompleteItemHandler(item, index);
        list.appendChild(item);
    });
}

/**
 * Displays the autocomplete dropdown.
 * Positions dropdown relative to input and makes it visible.
 *
 * @param {HTMLElement} inputElement - Input element to position relative to
 */
function displayAutocompleteDropdown(inputElement) {
    const dropdown = document.getElementById('hashtag-autocomplete');
    positionAutocomplete(inputElement);
    dropdown.classList.remove('hidden');
}

/**
 * Display the autocomplete dropdown with hashtag suggestions.
 * Creates list items with colored pills, tag text, and usage counts. Positions
 * dropdown relative to input element. Sets up click handlers for item selection.
 *
 * @param {HTMLElement} inputElement - Input or textarea element to attach autocomplete to
 */
function showAutocomplete(inputElement) {
    const suggestions = getAutocompleteSuggestions(autocomplete.query);

    updateAutocompleteState(suggestions, inputElement);
    populateAutocompleteList(suggestions);
    displayAutocompleteDropdown(inputElement);
}

/**
 * Position the autocomplete dropdown relative to input element.
 * For filter input, positions below. For textarea, positions near caret using
 * coordinate calculation. Clamps to viewport bounds to prevent off-screen rendering.
 *
 * @param {HTMLElement} inputElement - Input or textarea element
 */
function positionAutocomplete(inputElement) {
    const dropdown = document.getElementById('hashtag-autocomplete');
    const isTextarea = inputElement.id === 'note-text';

    if (!isTextarea) {
        // Filter input: position below the input
        const rect = inputElement.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.width = Math.max(rect.width, AUTOCOMPLETE_DROPDOWN_MIN_WIDTH) + 'px';
    } else {
        // Textarea: position near caret
        const rect = inputElement.getBoundingClientRect();
        const coords = getTextareaCaretCoords(inputElement, autocomplete.hashStart);
        let top = rect.top + coords.top + AUTOCOMPLETE_DROPDOWN_OFFSET_Y; // below caret line
        let left = rect.left + coords.left;

        // Viewport clamping
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (left + AUTOCOMPLETE_DROPDOWN_MIN_WIDTH > vw) left = vw - AUTOCOMPLETE_DROPDOWN_FLIP_OFFSET;
        if (left < AUTOCOMPLETE_VIEWPORT_MARGIN) left = AUTOCOMPLETE_VIEWPORT_MARGIN;
        if (top + AUTOCOMPLETE_DROPDOWN_ESTIMATED_HEIGHT > vh) top = rect.top + coords.top - AUTOCOMPLETE_DROPDOWN_FLIP_OFFSET; // flip above

        dropdown.style.top = top + 'px';
        dropdown.style.left = left + 'px';
        dropdown.style.width = AUTOCOMPLETE_DROPDOWN_WIDTH + 'px';
    }
}

/**
 * Calculate pixel coordinates of caret position in textarea.
 * Creates hidden mirror div with same styling, measures caret position using DOM layout.
 * Used to position autocomplete dropdown near caret in multi-line text.
 *
 * @param {HTMLTextAreaElement} textarea - Textarea element
 * @param {number} position - Character position (index) in textarea value
 * @returns {Object} - Object with top and left pixel coordinates
 */
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

/**
 * Hide the autocomplete dropdown and reset autocomplete state.
 * Clears query, hash position, items, and selection index.
 */
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

/**
 * Insert selected autocomplete suggestion into input at cursor position.
 * Replaces text from hash start to end of current word with selected tag plus space.
 * Auto-assigns color to tag when committed. Triggers input event and hides autocomplete.
 *
 * @param {number} index - Index of selected item in autocomplete.items
 */
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

/**
 * Update autocomplete dropdown based on current input value and cursor position.
 * Scans backwards from cursor to find '#' at word boundary, extracts query, and shows
 * suggestions. Hides autocomplete if no valid hashtag context found. Respects suppress
 * flag for synthetic events.
 *
 * @param {HTMLElement} inputElement - Input or textarea element
 */
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

/**
 * Handle keyboard navigation in autocomplete dropdown.
 * ArrowDown/Up navigates items, Enter/Tab selects highlighted item or auto-selects if
 * only one suggestion, Escape closes. Returns true if event was handled.
 *
 * @param {KeyboardEvent} e - Keyboard event
 * @returns {boolean} - True if autocomplete handled the event
 */
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

/**
 * Shows the help/keyboard shortcuts modal.
 *
 * @returns {void}
 */
function showHelp() {
    document.getElementById('help-modal').classList.remove('hidden');
}

/**
 * Hides the help/keyboard shortcuts modal.
 *
 * @returns {void}
 */
function hideHelp() {
    document.getElementById('help-modal').classList.add('hidden');
}

// ============================================================================
// MOVE TO NOTEBOOK MODAL
// ============================================================================

/**
 * Display the "Move to Notebook" modal with list of destination notebooks.
 * Shows all projects except current one. Displays toast if no other notebooks exist.
 * Populates list with project names and note counts.
 */
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

/**
 * Hide the "Move to Notebook" modal.
 */
function hideMoveToModal() {
    const modal = document.getElementById('move-to-modal');
    modal.classList.add('hidden');
}

/**
 * Create deep copies of nodes with new IDs and build ID mapping.
 *
 * @param {string[]} selectedNodeIds - IDs of nodes to copy
 * @param {Object[]} allNodes - All nodes in current level
 * @returns {{nodes: Object[], idMapping: Object}} Copied nodes and ID mapping
 */
function createNodeCopiesWithMapping(selectedNodeIds, allNodes) {
    const idMapping = {};
    const nodes = selectedNodeIds.map(id => {
        const node = allNodes.find(n => n.id === id);
        const copy = deepCopyNode(node);
        idMapping[id] = copy.id;
        return copy;
    });
    return { nodes, idMapping };
}

/**
 * Filter edges between selected nodes and remap to new IDs.
 *
 * @param {Array} edges - All edges in current level
 * @param {Object} idMapping - Map from old IDs to new IDs
 * @param {string[]} selectedNodeIds - IDs of selected nodes
 * @returns {Array} Edges with remapped IDs
 */
function filterAndRemapEdges(edges, idMapping, selectedNodeIds) {
    return edges
        .filter(edge =>
            selectedNodeIds.includes(edge[0]) &&
            selectedNodeIds.includes(edge[1])
        )
        .map(edge => [idMapping[edge[0]], idMapping[edge[1]]]);
}

/**
 * Calculate bounding box and center point for a set of nodes.
 *
 * @param {Object[]} nodes - Nodes to calculate bounds for
 * @returns {{minX: number, minY: number, maxX: number, maxY: number, centerX: number, centerY: number}}
 */
function calculateBoundingBox(nodes) {
    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxX = Math.max(...nodes.map(n => n.position.x + NODE_WIDTH));
    const maxY = Math.max(...nodes.map(n => n.position.y + NODE_HEIGHT));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return { minX, minY, maxX, maxY, centerX, centerY };
}

/**
 * Calculate relative offset from center for each node.
 *
 * @param {Object[]} nodes - Nodes to calculate offsets for
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {Object} Map of node ID to {dx, dy} offset
 */
function calculateRelativeOffsets(nodes, centerX, centerY) {
    const offsets = {};
    nodes.forEach(node => {
        offsets[node.id] = {
            dx: node.position.x - centerX,
            dy: node.position.y - centerY
        };
    });
    return offsets;
}

/**
 * Get project name by ID.
 *
 * @param {string} projectId - Project ID to look up
 * @param {Object[]} projectsList - List of all projects
 * @returns {string} Project name or 'Unknown'
 */
function getSourceProjectName(projectId, projectsList) {
    const project = projectsList.find(p => p.id === projectId);
    return project ? project.name : 'Unknown';
}

/**
 * Build complete move package structure.
 *
 * @param {Object} data - All data needed for move package
 * @returns {Object} Complete move package
 */
function buildMovePackage(data) {
    return {
        sourceProjectId: data.sourceProjectId,
        sourceProjectName: data.sourceProjectName,
        originalIds: data.originalIds,
        nodes: data.nodes,
        edges: data.edges,
        boundingBox: data.boundingBox,
        relativeOffsets: data.relativeOffsets,
        sourceCustomFields: state.projectSettings.customFields || []
    };
}

/**
 * Store pending move data in sessionStorage.
 *
 * @param {Object} movePackage - Complete move package to store
 */
function storePendingMove(movePackage) {
    sessionStorage.setItem(MOVE_STORAGE_KEY, JSON.stringify(movePackage));
}

/**
 * Initiate move operation to transfer selected nodes to another notebook.
 * Creates deep copies with new IDs, preserves edges between moved nodes, calculates
 * bounding box and relative offsets for cursor following, stores pending move in
 * sessionStorage, and switches to target project.
 *
 * @param {string} targetProjectId - ID of destination notebook
 * @returns {Promise<void>}
 */
/**
 * Validate all preconditions for move operation.
 * @param {string} targetProjectId - Target project ID
 * @returns {{valid: boolean, projectsList: Array|null}} Validation result and projects list
 */
function validateMoveOperation(targetProjectId) {
    if (!targetProjectId) {
        console.error('No target project ID provided');
        return { valid: false, projectsList: null };
    }

    if (!state.currentProjectId) {
        console.error('No current project open');
        return { valid: false, projectsList: null };
    }

    if (state.selectedNodes.length === 0) {
        console.error('No nodes selected to move');
        return { valid: false, projectsList: null };
    }

    const projectsList = getProjectsList();
    const targetExists = projectsList.some(p => p.id === targetProjectId);
    if (!targetExists) {
        console.error('Target project does not exist');
        return { valid: false, projectsList: null };
    }

    return { valid: true, projectsList };
}

/**
 * Prepare all data needed for move operation.
 * @param {Object[]} projectsList - List of all projects
 * @returns {Object} Complete data package for move
 */
function prepareMoveData(projectsList) {
    // Data transformation
    const originalIds = [...state.selectedNodes];
    const { nodes, idMapping } = createNodeCopiesWithMapping(
        state.selectedNodes,
        state.nodes
    );
    const edges = filterAndRemapEdges(
        state.edges,
        idMapping,
        state.selectedNodes
    );

    // Geometric calculations
    const boundingBox = calculateBoundingBox(nodes);
    const relativeOffsets = calculateRelativeOffsets(
        nodes,
        boundingBox.centerX,
        boundingBox.centerY
    );

    // Metadata
    const sourceProjectName = getSourceProjectName(
        state.currentProjectId,
        projectsList
    );

    return {
        sourceProjectId: state.currentProjectId,
        sourceProjectName,
        originalIds,
        nodes,
        edges,
        boundingBox: {
            centerX: boundingBox.centerX,
            centerY: boundingBox.centerY
        },
        relativeOffsets
    };
}

/**
 * Initiate move operation to transfer selected nodes to another notebook.
 * Creates deep copies with new IDs, preserves edges between moved nodes, calculates
 * bounding box and relative offsets for cursor following, stores pending move in
 * sessionStorage, and switches to target project.
 *
 * @param {string} targetProjectId - ID of destination notebook
 * @returns {Promise<void>}
 */
async function initiateMoveToNotebook(targetProjectId) {
    // Validate all preconditions
    const { valid, projectsList } = validateMoveOperation(targetProjectId);
    if (!valid) return;

    // Prepare move data (transformation, calculations, metadata)
    const moveData = prepareMoveData(projectsList);
    const movePackage = buildMovePackage(moveData);

    // Execute move: store and navigate
    storePendingMove(movePackage);
    await openProject(targetProjectId);
}

/**
 * Check for pending move operation in sessionStorage on project open.
 * Restores ghost nodes and move state, sets up ghost drag mode, shows toast notification,
 * and renders ghosts. Called when opening a project after initiating move.
 */
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

/**
 * Place ghost nodes into current project and complete move operation.
 * Integrates nodes/edges, removes from source, shows feedback, and triggers save.
 */
async function placeGhostNodes() {
    // Step 1: Validate (guard clauses with logging)
    if (!state.ghostDragging) {
        console.warn('placeGhostNodes: not in ghost drag mode');
        return;
    }

    if (state.ghostNodes.length === 0) {
        console.warn('placeGhostNodes: no ghost nodes to place');
        return;
    }

    // Step 2: Extract source info before clearing state
    const sourceProjectId = state.pendingMove?.sourceProjectId;
    const sourceProjectName = state.pendingMove?.sourceProjectName;
    const originalNodeIds = state.pendingMove?.originalIds || [];
    const nodeCount = state.ghostNodes.length;

    // Step 2b: Check for custom field conflicts and resolve if needed
    const sourceFields = state.pendingMove?.sourceCustomFields || [];
    const targetFields = state.projectSettings.customFields || [];

    // Get target notebook name
    let targetProjectName = 'Current Notebook';
    if (state.currentProjectId) {
        const projects = getProjectsList();
        const project = projects.find(p => p.id === state.currentProjectId);
        if (project) {
            targetProjectName = project.name;
        }
    }

    if (sourceFields.length > 0) {
        const { merged, conflicts } = mergeCustomFieldDefinitions(targetFields, sourceFields);

        // Resolve conflicts if any
        if (conflicts.length > 0) {
            try {
                const resolutions = await resolveFieldConflicts(conflicts, targetProjectName, sourceProjectName);

                // Apply conflict resolutions to merged array
                for (const [fieldName, chosenDef] of Object.entries(resolutions)) {
                    const index = merged.findIndex(f => f.name === fieldName);
                    if (index !== -1) {
                        merged[index] = chosenDef;
                    }
                }

                // Update target notebook's custom field definitions
                state.projectSettings.customFields = merged;
            } catch (err) {
                if (err.message === 'User cancelled import') {
                    // User cancelled - abort the move
                    cancelGhostDrag();
                    return;
                }
                throw err;
            }
        } else {
            // No conflicts, just merge (add new fields from source)
            state.projectSettings.customFields = merged;
        }
    }

    // Step 3: Integrate nodes and edges into current project
    const placedNodeIds = integrateGhostNodes();

    // Step 4: Select the newly placed nodes
    selectPlacedNodes(placedNodeIds);

    // Step 5: Sync source project (remove moved nodes)
    if (sourceProjectId && originalNodeIds.length > 0) {
        syncSourceAfterMove(sourceProjectId, originalNodeIds);
    }

    // Step 6: Show feedback toast
    const message = `Moved ${nodeCount} note${nodeCount > 1 ? 's' : ''} from ${sourceProjectName || 'source'}`;
    showMoveToast(message, sourceProjectId, sourceProjectName);

    // Step 7: Clear all ghost state
    clearGhostState(true); // Clear selection box too

    // Step 8: Render and save
    render();
    queueTargetProjectSave();
}

/**
 * Cancel ghost drag operation without placing nodes.
 * Clears ghost state, removes drag cursor, shows toast with return link to source.
 */
function cancelGhostDrag() {
    // Guard clause: validate we're in ghost drag mode
    if (!state.ghostDragging) {
        console.warn('cancelGhostDrag: not in ghost drag mode');
        return;
    }

    // Step 1: Extract source info before clearing state
    const sourceProjectId = state.pendingMove?.sourceProjectId;
    const sourceProjectName = state.pendingMove?.sourceProjectName;

    // Step 2: Clear ghost state (don't clear selection box - not placing)
    clearGhostState(false);

    // Step 3: Show cancellation feedback
    showMoveToast('Move cancelled', sourceProjectId, sourceProjectName);

    // Step 4: Render to update UI
    render();
}

/**
 * Remove moved nodes from source notebook after successful move.
 * Loads source project data, filters out moved nodes and their edges, saves back to
 * localStorage, and updates note count in projects index.
 *
 * @param {string} sourceProjectId - ID of source notebook
 * @param {string[]} nodeIds - Array of original node IDs to remove
 */
/**
 * Clear all ghost node state and remove drag cursor.
 * @param {boolean} clearSelectionBox - Whether to also clear selection box (default: true)
 */
function clearGhostState(clearSelectionBox = true) {
    state.ghostNodes = [];
    state.ghostDragging = false;
    state.pendingMove = null;

    if (clearSelectionBox) {
        state.selectionBox = null;
    }

    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.classList.remove('ghost-drag-mode');
    }
}

/**
 * Show toast notification with return link to source project.
 * @param {string} message - Toast message to display
 * @param {string|null} sourceProjectId - Source project ID for return link
 * @param {string|null} sourceProjectName - Source project name for display
 */
function showMoveToast(message, sourceProjectId, sourceProjectName) {
    if (sourceProjectId && sourceProjectName) {
        showToast(message, {
            linkText: `Return to ${sourceProjectName}`,
            linkOnClick: async () => await openProject(sourceProjectId)
        });
    } else {
        showToast(message);
    }
}

/**
 * Integrate ghost nodes and edges into current project state.
 * @returns {string[]} - Array of newly integrated node IDs
 */
function integrateGhostNodes() {
    // Guard clause: validate ghost nodes exist
    if (!state.ghostNodes || state.ghostNodes.length === 0) {
        console.warn('integrateGhostNodes: no ghost nodes to integrate');
        return [];
    }

    // Add ghost nodes to current notebook as real nodes
    state.ghostNodes.forEach(node => {
        state.nodes.push(node);
    });

    // Add edges if present
    if (state.pendingMove && state.pendingMove.edges) {
        state.pendingMove.edges.forEach(edge => {
            state.edges.push(edge);
        });
    }

    // Return IDs for selection
    return state.ghostNodes.map(n => n.id);
}

/**
 * Select the newly placed nodes after integration.
 * @param {string[]} nodeIds - Array of node IDs to select
 */
function selectPlacedNodes(nodeIds) {
    state.selectedNodes = nodeIds;
}

/**
 * Remove moved nodes from source project and update note count.
 * @param {string} sourceProjectId - Source project ID
 * @param {string[]} originalNodeIds - Original node IDs to remove
 * @returns {boolean} - True if successful, false otherwise
 */
function syncSourceAfterMove(sourceProjectId, originalNodeIds) {
    // Guard clause: validate parameters
    if (!sourceProjectId) {
        console.warn('syncSourceAfterMove: missing sourceProjectId');
        return false;
    }

    if (!originalNodeIds || originalNodeIds.length === 0) {
        console.warn('syncSourceAfterMove: no node IDs to remove');
        return false;
    }

    // Delegate to existing function
    removeNodesFromSourceNotebook(sourceProjectId, originalNodeIds);
    return true;
}

/**
 * Queue immediate save of target project after move operation.
 */
function queueTargetProjectSave() {
    state.saveQueue.push({
        timestamp: Date.now(),
        projectId: state.currentProjectId
    });
    processSaveQueue(); // Start immediately but don't await
}

/**
 * Update note count for a project in the projects index.
 * @param {string} projectId - Project ID to update
 * @param {Array} nodes - Current nodes array to count
 */
function updateProjectNoteCount(projectId, nodes) {
    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    if (project) {
        project.noteCount = countNotes(nodes);
        saveProjectsIndex(projects);
    }
}

/**
 * Recursively removes nodes by ID from a node array and all nested children.
 * Processes both the current level and all descendant levels.
 *
 * @param {Array} nodes - Array of nodes to filter
 * @param {Array} nodeIdsToRemove - IDs of nodes to remove
 * @returns {Array} Filtered nodes with removed IDs excluded at all levels
 */
function removeNodesRecursively(nodes, nodeIdsToRemove) {
    return nodes
        .filter(node => !nodeIdsToRemove.includes(node.id))
        .map(node => {
            // If node has children, recursively remove from children too
            if (node.children && node.children.length > 0) {
                node.children = removeNodesRecursively(node.children, nodeIdsToRemove);
            }
            return node;
        });
}

/**
 * Removes nodes from source notebook after they've been moved.
 * Searches recursively at all nesting levels to find and remove nodes.
 * Also removes edges that reference the removed nodes.
 * Updates note count in projects index after removal.
 *
 * @param {string} sourceProjectId - ID of source project to remove nodes from
 * @param {string[]} nodeIds - Array of node IDs to remove
 * @returns {boolean} - True if successful, false otherwise
 */
function removeNodesFromSourceNotebook(sourceProjectId, nodeIds) {
    // Guard clause: validate parameters
    if (!sourceProjectId) {
        console.error('removeNodesFromSourceNotebook: missing sourceProjectId');
        return false;
    }

    if (!nodeIds || nodeIds.length === 0) {
        console.warn('removeNodesFromSourceNotebook: no node IDs to remove');
        return false;
    }

    // Load source project data
    const sourceData = localStorage.getItem(STORAGE_KEY_PREFIX + sourceProjectId);
    if (!sourceData) {
        console.error('removeNodesFromSourceNotebook: source project not found:', sourceProjectId);
        return false;
    }

    try {
        const project = JSON.parse(sourceData);

        // Remove nodes by ID recursively (searches all nesting levels)
        project.nodes = removeNodesRecursively(project.nodes, nodeIds);

        // Remove edges that reference removed nodes
        project.edges = project.edges.filter(edge =>
            !nodeIds.includes(edge[0]) && !nodeIds.includes(edge[1])
        );

        // Save back to localStorage
        localStorage.setItem(STORAGE_KEY_PREFIX + sourceProjectId, JSON.stringify(project));

        // Update note count in projects index
        updateProjectNoteCount(sourceProjectId, project.nodes);

        return true;
    } catch (e) {
        console.error('removeNodesFromSourceNotebook: error removing nodes:', e);
        return false;
    }
}

/**
 * Display a toast notification with optional link.
 * Positioned at top center, auto-removes after duration (4s default, 6s with link).
 * Supports ESC key to dismiss. Link enables pointer events and cancels auto-remove
 * for certain messages.
 *
 * @param {string} message - Notification message text
 * @param {Object} options - Optional config: linkText, linkOnClick, duration, hasLink
 */
/**
 * Creates the base toast notification element with message.
 * @param {string} message - Notification message text
 * @returns {HTMLDivElement} Toast element
 */
function createToastElement(message) {
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.textContent = message;
    return toast;
}

/**
 * Appends an interactive link to the toast notification.
 * Link dismisses toast and executes provided callback.
 * @param {HTMLDivElement} toast - Toast element
 * @param {string} linkText - Link text to display
 * @param {Function} linkOnClick - Callback to execute on click
 */
function appendToastLink(toast, linkText, linkOnClick) {
    toast.appendChild(document.createElement('br'));
    const link = document.createElement('a');
    link.href = '#';
    link.style.cssText = 'color: var(--highlight); text-decoration: underline; cursor: pointer;';
    link.textContent = linkText;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        toast.remove();
        linkOnClick();
    });
    toast.appendChild(link);
}

/**
 * Applies CSS styling to the toast notification.
 * Sets positioning, appearance, and pointer events based on link presence.
 * @param {HTMLDivElement} toast - Toast element to style
 * @param {boolean} hasLink - Whether toast has an interactive link
 */
function styleToastElement(toast, hasLink) {
    const pointerEvents = hasLink ? 'auto' : 'none';
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        color: var(--text-primary);
        padding: 12px 24px;
        border-radius: 8px;
        z-index: 1000;
        font-size: 14px;
        pointer-events: ${pointerEvents};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        text-align: center;
    `;
}

/**
 * Sets up ESC key handler to dismiss toast.
 * Handler removes itself after execution.
 * @param {HTMLDivElement} toast - Toast element to dismiss
 * @returns {Function} ESC key handler for cleanup
 */
function setupToastKeyboardHandler(toast) {
    const escHandler = (e) => {
        if (e.key === 'Escape' && document.getElementById('toast-notification')) {
            toast.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
    return escHandler;
}

/**
 * Sets up auto-removal timer for toast notification.
 * Duration based on options, skips timer for "Click to place" messages.
 * @param {HTMLDivElement} toast - Toast element to remove
 * @param {string} message - Toast message (checked for "Click to place")
 * @param {Object} options - Options object with duration/hasLink
 * @param {Function} escHandler - ESC key handler to cleanup
 * @returns {number|null} Timer ID or null if skipped
 */
function setupToastAutoRemove(toast, message, options, escHandler) {
    const duration = options.duration || (options.hasLink ? TOAST_DURATION_WITH_LINK : TOAST_DURATION_DEFAULT);
    const autoRemoveTimer = !message.includes('Click to place') ? setTimeout(() => {
        toast.remove();
        document.removeEventListener('keydown', escHandler);
    }, duration) : null;
    return autoRemoveTimer;
}

/**
 * Display a toast notification with optional link.
 * Positioned at top center, auto-removes after duration (4s default, 6s with link).
 * Supports ESC key to dismiss. Link enables pointer events and cancels auto-remove
 * for certain messages.
 *
 * @param {string} message - Notification message text
 * @param {Object} options - Optional config: linkText, linkOnClick, duration, hasLink
 */
function showToast(message, options = {}) {
    // Remove any existing toast
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();

    // Create and configure toast element
    const toast = createToastElement(message);
    const hasLink = !!(options.linkText && options.linkOnClick);

    if (hasLink) {
        appendToastLink(toast, options.linkText, options.linkOnClick);
    }

    styleToastElement(toast, hasLink);
    document.body.appendChild(toast);

    // Setup keyboard and auto-removal handlers
    const escHandler = setupToastKeyboardHandler(toast);
    const autoRemoveTimer = setupToastAutoRemove(toast, message, options, escHandler);

    // Override toast.remove to clean up listeners and timer
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

/**
 * Gets the settings object for a project (from memory or storage).
 * @param {string} projectId - Project ID
 * @returns {Object} - Settings object with fieldDefaults and customFields
 */
function getProjectSettings(projectId) {
    if (projectId === state.currentProjectId) {
        return state.projectSettings;
    } else {
        const data = loadProjectFromStorage(projectId);
        const settings = (data && data.settings) || {};
        // Ensure structure exists
        if (!settings.fieldDefaults) {
            settings.fieldDefaults = { completion: null, priority: null };
        }
        // Migrate legacy defaultCompletion
        if (settings.defaultCompletion !== undefined) {
            settings.fieldDefaults.completion = settings.defaultCompletion;
        }
        return settings;
    }
}

/**
 * Display the settings modal for a project.
 * Loads settings for target project (current or from context menu), updates
 * dropdown selects to reflect current field default values.
 *
 * @param {string} projectId - ID of project to show settings for
 */
function showSettings(projectId) {
    const modal = document.getElementById('settings-modal');
    const completionSelect = document.getElementById('settings-completion-default');
    const prioritySelect = document.getElementById('settings-priority-default');

    const targetId = projectId || state.currentProjectId;
    modal.dataset.projectId = targetId;

    const settings = getProjectSettings(targetId);
    const fieldDefaults = settings.fieldDefaults || {};

    // Set dropdown values
    completionSelect.value = fieldDefaults.completion || '';
    prioritySelect.value = fieldDefaults.priority || '';

    // Render custom fields list
    renderCustomFieldsList();

    modal.classList.remove('hidden');
}

/**
 * Hide the settings modal and clear project ID.
 */
function hideSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('hidden');
    delete modal.dataset.projectId;
}

/**
 * Handle change to a field default setting.
 * Updates in-memory settings for current project or directly in localStorage for
 * non-open project.
 * @param {string} fieldName - Field name (e.g., 'completion', 'priority')
 * @param {string} value - New default value (empty string for null)
 */
function updateFieldDefault(fieldName, value) {
    const modal = document.getElementById('settings-modal');
    const targetId = modal.dataset.projectId;
    const newValue = value || null;

    if (targetId === state.currentProjectId) {
        // Update in-memory settings for the currently open project
        if (!state.projectSettings.fieldDefaults) {
            state.projectSettings.fieldDefaults = {};
        }
        state.projectSettings.fieldDefaults[fieldName] = newValue;
        scheduleAutoSave();
    } else {
        // Update localStorage directly for a non-open project
        const data = loadProjectFromStorage(targetId);
        if (data) {
            if (!data.settings) data.settings = {};
            if (!data.settings.fieldDefaults) data.settings.fieldDefaults = {};
            data.settings.fieldDefaults[fieldName] = newValue;
            // Clean up legacy field if present
            delete data.settings.defaultCompletion;
            localStorage.setItem(STORAGE_KEY_PREFIX + targetId, JSON.stringify(data));
        }
    }
}

/**
 * Switch between settings tabs (General / Custom Fields).
 * @param {string} tabName - Tab name ('general' or 'custom-fields')
 */
function switchSettingsTab(tabName) {
    // Update tab buttons
    const tabs = document.querySelectorAll('.settings-tab');
    tabs.forEach(tab => {
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    // Update tab panels
    const panels = document.querySelectorAll('.settings-tab-panel');
    panels.forEach(panel => {
        if (panel.id === `settings-tab-${tabName}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}

/**
 * Render the list of custom fields in the settings modal.
 * Reads from the current project settings and displays each field as a card.
 */
function renderCustomFieldsList() {
    const modal = document.getElementById('settings-modal');
    const targetId = modal.dataset.projectId;
    const settings = getProjectSettings(targetId);
    const customFields = settings.customFields || [];

    const container = document.getElementById('settings-custom-fields-list');
    container.replaceChildren(); // Clear existing content

    if (customFields.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'settings-description';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.marginTop = '20px';
        emptyMsg.textContent = 'No custom fields defined yet.';
        container.appendChild(emptyMsg);
        return;
    }

    customFields.forEach((field, index) => {
        const card = document.createElement('div');
        card.className = 'custom-field-card';

        // Header with name and actions
        const header = document.createElement('div');
        header.className = 'custom-field-header';

        const name = document.createElement('div');
        name.className = 'custom-field-name';
        name.textContent = field.label || field.name;

        const actions = document.createElement('div');
        actions.className = 'custom-field-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'custom-field-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => editCustomField(index));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'custom-field-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteCustomField(index));

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        header.appendChild(name);
        header.appendChild(actions);

        // Details
        const details = document.createElement('div');
        details.className = 'custom-field-details';

        const typeLine = document.createElement('div');
        const typeLabel = document.createElement('span');
        typeLabel.className = 'custom-field-type';
        typeLabel.textContent = 'Type: ';
        typeLine.appendChild(typeLabel);
        typeLine.appendChild(document.createTextNode(formatFieldType(field.type)));
        details.appendChild(typeLine);

        // Show options for select types
        if ((field.type === 'single-select' || field.type === 'multi-select') && field.options && field.options.length > 0) {
            const optionsLine = document.createElement('div');
            optionsLine.textContent = `Options: ${field.options.join(', ')}`;
            details.appendChild(optionsLine);
        }

        card.appendChild(header);
        card.appendChild(details);
        container.appendChild(card);
    });
}

/**
 * Format field type for display.
 * @param {string} type - Field type (e.g., 'single-select')
 * @returns {string} - Human-readable type name
 */
function formatFieldType(type) {
    const typeMap = {
        'single-select': 'Single-select',
        'multi-select': 'Multi-select',
        'text': 'Text',
        'number': 'Number',
        'date': 'Date',
        'checkbox': 'Checkbox',
        'url': 'URL'
    };
    return typeMap[type] || type;
}

/**
 * Add a new custom field to the project settings.
 * Opens the field editor modal in "add" mode.
 */
function addCustomField() {
    openFieldEditorModal('add', null, null);
}

/**
 * Open the field editor modal.
 * @param {string} mode - 'add' or 'edit'
 * @param {number|null} fieldIndex - Index of field being edited (null for add)
 * @param {Object|null} fieldData - Existing field data (null for add)
 */
/**
 * Opens the field editor modal from the note editor context.
 * Preserves editor state and re-renders after field creation.
 */
function openFieldEditorFromEditor() {
    // Get current editor state before opening modal
    const editorMode = getEditorMode();

    // Store editor context for restoration
    state.editorContext = {
        mode: editorMode,
        preserveAfterFieldCreation: true
    };

    // Open field editor in "add" mode
    openFieldEditorModal('add', null, null);
}

function openFieldEditorModal(mode, fieldIndex, fieldData) {
    const modal = document.getElementById('field-editor-modal');
    const title = document.getElementById('field-editor-title');
    const nameInput = document.getElementById('field-editor-name');
    const labelInput = document.getElementById('field-editor-label');
    const typeSelect = document.getElementById('field-editor-type');
    const optionsTextarea = document.getElementById('field-editor-options');

    // Set title
    title.textContent = mode === 'add' ? 'Add Custom Field' : 'Edit Custom Field';

    // Populate form
    if (mode === 'edit' && fieldData) {
        nameInput.value = fieldData.name;
        nameInput.disabled = true; // Can't change name in edit mode
        labelInput.value = fieldData.label || fieldData.name;
        typeSelect.value = fieldData.type || 'single-select';
        optionsTextarea.value = (fieldData.options || []).join('\n');
    } else {
        nameInput.value = '';
        nameInput.disabled = false;
        labelInput.value = '';
        typeSelect.value = 'single-select';
        optionsTextarea.value = 'low\nmedium\nhigh';
    }

    // Store mode and index in modal dataset
    modal.dataset.mode = mode;
    if (fieldIndex !== null) {
        modal.dataset.fieldIndex = fieldIndex;
    } else {
        delete modal.dataset.fieldIndex;
    }

    // Show modal
    modal.classList.remove('hidden');
    nameInput.focus();
}

/**
 * Close the field editor modal.
 */
function closeFieldEditorModal() {
    const modal = document.getElementById('field-editor-modal');
    modal.classList.add('hidden');
}

/**
 * Save the field from the field editor modal.
 */
async function saveFieldFromModal() {
    const modal = document.getElementById('field-editor-modal');
    const settingsModal = document.getElementById('settings-modal');
    const mode = modal.dataset.mode;
    const fieldIndex = modal.dataset.fieldIndex ? parseInt(modal.dataset.fieldIndex) : null;

    // Get form values
    const name = document.getElementById('field-editor-name').value.trim();
    const label = document.getElementById('field-editor-label').value.trim();
    const type = document.getElementById('field-editor-type').value;
    const optionsText = document.getElementById('field-editor-options').value.trim();

    // Validate name
    if (!name) {
        await showAlert('Field name is required.', 'Error');
        return;
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        await showAlert('Invalid field name. Use letters, numbers, and underscores only.', 'Error');
        return;
    }

    // Check reserved names (only in add mode)
    if (mode === 'add' && (name === 'completion' || name === 'priority')) {
        await showAlert('This field name is reserved.', 'Error');
        return;
    }

    // Validate label
    if (!label) {
        await showAlert('Display label is required.', 'Error');
        return;
    }

    // Parse options
    const options = optionsText
        .split(/[\n,]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    if (options.length === 0) {
        await showAlert('At least one option is required.', 'Error');
        return;
    }

    // Get target project and settings
    // When called from editor, settingsModal.dataset.projectId is undefined, use current project
    const targetId = settingsModal.dataset.projectId || state.currentProjectId;
    const settings = getProjectSettings(targetId);
    const customFields = settings.customFields || [];

    if (mode === 'add') {
        // Check for duplicates
        if (customFields.some(f => f.name === name)) {
            await showAlert('A field with this name already exists.', 'Error');
            return;
        }

        // Create new field
        const newField = {
            id: `field-${Date.now()}`,
            name: name,
            label: label,
            type: type,
            options: options
        };

        // Add to settings
        if (targetId === state.currentProjectId) {
            if (!state.projectSettings.customFields) {
                state.projectSettings.customFields = [];
            }
            state.projectSettings.customFields.push(newField);
            scheduleAutoSave();
        } else {
            const data = loadProjectFromStorage(targetId);
            if (data) {
                if (!data.settings) data.settings = {};
                if (!data.settings.customFields) data.settings.customFields = [];
                data.settings.customFields.push(newField);
                localStorage.setItem(STORAGE_KEY_PREFIX + targetId, JSON.stringify(data));
            }
        }
    } else if (mode === 'edit' && fieldIndex !== null) {
        // Update existing field
        const field = customFields[fieldIndex];
        if (!field) return;

        // Check if type changed
        const typeChanged = field.type !== type;
        if (typeChanged) {
            const confirmed = await showConfirmation(
                'Change field type?\n\nChanging the field type may affect existing note values. Single-select stores one value, multi-select stores an array.'
            );
            if (!confirmed) return;
        }

        // Update field
        field.label = label;
        field.type = type;
        field.options = options;

        // Save changes
        if (targetId === state.currentProjectId) {
            scheduleAutoSave();
        } else {
            const data = loadProjectFromStorage(targetId);
            if (data) {
                localStorage.setItem(STORAGE_KEY_PREFIX + targetId, JSON.stringify(data));
            }
        }
    }

    // If called from note editor, re-render custom fields
    if (state.editorContext?.preserveAfterFieldCreation) {
        const { mode } = state.editorContext;

        if (mode.isBatchMode) {
            renderCustomFieldsInEditor(null, mode.nodes, true);
        } else {
            renderCustomFieldsInEditor(mode.node, null, false);
        }

        // Clear context
        state.editorContext = null;
    }

    closeFieldEditorModal();
    renderCustomFieldsList();
}

/**
 * Edit an existing custom field.
 * @param {number} index - Index of field in customFields array
 */
function editCustomField(index) {
    const modal = document.getElementById('settings-modal');
    const targetId = modal.dataset.projectId;
    const settings = getProjectSettings(targetId);
    const customFields = settings.customFields || [];
    const field = customFields[index];

    if (!field) return;

    openFieldEditorModal('edit', index, field);
}

/**
 * Delete a custom field from the project settings.
 * @param {number} index - Index of field in customFields array
 */
async function deleteCustomField(index) {
    const modal = document.getElementById('settings-modal');
    const targetId = modal.dataset.projectId;
    const settings = getProjectSettings(targetId);
    const customFields = settings.customFields || [];
    const field = customFields[index];

    if (!field) return;

    const confirmed = await showConfirmation(
        `Delete field "${field.label || field.name}"?\n\nThis will remove the field definition. Existing field values in notes will remain but will no longer be editable.`
    );

    if (!confirmed) return;

    // Remove field
    customFields.splice(index, 1);

    // Save changes
    if (targetId === state.currentProjectId) {
        scheduleAutoSave();
    } else {
        const data = loadProjectFromStorage(targetId);
        if (data) {
            localStorage.setItem(STORAGE_KEY_PREFIX + targetId, JSON.stringify(data));
        }
    }

    renderCustomFieldsList();
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Fallback download function using data URL for browsers without File System Access API.
 * Creates blob from JSON data, generates temporary URL, triggers download via anchor click.
 *
 * @param {string} filename - Suggested filename for download
 * @param {Object} data - Data object to serialize to JSON
 */
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

/**
 * Export current project to JSON file.
 * Captures root state, creates export data with version/name/nodes/edges/colors/settings,
 * uses File System Access API if available, otherwise falls back to data URL download.
 */
async function exportToFile() {
    if (!state.currentProjectId) {
        await showAlert('No notebook open to export', 'Error');
        return;
    }

    // Ensure root state is captured
    saveRootState();

    // Get project name for filename
    const projects = getProjectsList();
    const project = projects.find(p => p.id === state.currentProjectId);
    const filename = ((project ? project.name : 'knotebook-notes').slice(0, FILENAME_MAX_LENGTH)) + '.json';

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
                await showAlert('Failed to export: ' + err.message, 'Export Error');
            }
        }
    } else {
        // Fallback for mobile/unsupported browsers
        downloadAsFile(filename, data);
    }
}

/**
 * Export a specific project from the project menu (not currently open).
 * Loads project from storage, creates export data, uses File System Access API if
 * available, otherwise falls back to data URL download.
 *
 * @param {string} projectId - ID of project to export
 */
async function exportProjectToFile(projectId) {
    const data = loadProjectFromStorage(projectId);
    if (!data) {
        await showAlert('Notebook not found', 'Error');
        return;
    }

    const projects = getProjectsList();
    const project = projects.find(p => p.id === projectId);
    const filename = ((project ? project.name : 'knotebook-notes').slice(0, FILENAME_MAX_LENGTH)) + '.json';

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
                await showAlert('Failed to export: ' + err.message, 'Export Error');
            }
        }
    } else {
        // Fallback for mobile/unsupported browsers
        downloadAsFile(filename, exportData);
    }
}

/**
 * Get files using File System Access API (modern browsers).
 * Supports multiple file selection.
 * @returns {Promise<File[]>} - Selected files or empty array if cancelled
 * @throws {Error} - If file selection fails
 */
async function getFilesViaPicker() {
    const handles = await window.showOpenFilePicker({
        types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
        }],
        multiple: true
    });
    const files = [];
    for (const handle of handles) {
        files.push(await handle.getFile());
    }
    return files;
}

/**
 * Get files using legacy file input (fallback for mobile/unsupported browsers).
 * Supports multiple file selection.
 * @returns {Promise<File[]>} - Selected files or empty array if cancelled
 */
function getFilesViaInput() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.multiple = true;

        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            resolve(files);
        });

        input.click();
    });
}

/**
 * Read file contents and parse as JSON.
 * @param {File} file - File object to read
 * @returns {Promise<Object>} - Parsed JSON data
 * @throws {Error} - If file read fails or JSON is invalid
 */
async function readAndParseJsonFile(file) {
    // Guard clause: empty file
    if (!file) throw new Error('No file provided');

    const text = await file.text();

    // Guard clause: empty content
    if (!text || text.trim() === '') {
        throw new Error('File is empty');
    }

    return JSON.parse(text);
}

/**
 * Validate imported data structure matches expected format.
 * @param {Object} data - Imported data to validate
 * @throws {Error} - If data structure is invalid
 */
function validateImportData(data) {
    // Guard clauses for required fields
    if (!data || typeof data !== 'object') {
        throw new Error('Invalid data format');
    }

    if (!data.name || typeof data.name !== 'string') {
        throw new Error('Missing or invalid project name');
    }

    if (!Array.isArray(data.nodes)) {
        throw new Error('Missing or invalid nodes array');
    }

    if (!Array.isArray(data.edges)) {
        throw new Error('Missing or invalid edges array');
    }

    // Optional fields with defaults
    if (data.hashtagColors && typeof data.hashtagColors !== 'object') {
        throw new Error('Invalid hashtagColors format');
    }

    if (data.settings && typeof data.settings !== 'object') {
        throw new Error('Invalid settings format');
    }

    if (data.hiddenHashtags && !Array.isArray(data.hiddenHashtags)) {
        throw new Error('Invalid hiddenHashtags format');
    }
}

/**
 * Import one or more notebook files.
 * Supports multi-file selection. Each file is imported as a new notebook.
 * Shows toast with count and names of imported notebooks.
 */
async function importFromFile() {
    try {
        // Step 1: Select files (supports multiple)
        const files = window.showOpenFilePicker
            ? await getFilesViaPicker()
            : await getFilesViaInput();

        // Guard clause: user cancelled
        if (!files || files.length === 0) return;

        // Step 2: Import each file as new notebook
        const importedNames = [];
        const failedFiles = [];

        for (const file of files) {
            try {
                // Read and parse
                const data = await readAndParseJsonFile(file);

                // Validate
                validateImportData(data);

                // Import as new notebook
                const notebookName = data.name || file.name.replace('.json', '');
                const projectId = await createProject(notebookName);

                // Save imported data
                const importedSettings = data.settings || {};
                // Migrate legacy defaultCompletion if present
                if (importedSettings.defaultCompletion !== undefined && !importedSettings.fieldDefaults) {
                    importedSettings.fieldDefaults = { completion: importedSettings.defaultCompletion, priority: null };
                    delete importedSettings.defaultCompletion;
                }
                const projectData = {
                    version: 1,
                    nodes: data.nodes || [],
                    edges: data.edges || [],
                    hashtagColors: data.hashtagColors || {},
                    settings: importedSettings,
                    hiddenHashtags: data.hiddenHashtags || [],
                    theme: data.theme || getCurrentTheme()
                };
                localStorage.setItem(STORAGE_KEY_PREFIX + projectId, JSON.stringify(projectData));

                // Update note count
                const projects = getProjectsList();
                const project = projects.find(p => p.id === projectId);
                if (project) {
                    project.noteCount = countNotes(projectData.nodes);
                    await saveProjectsIndex(projects);
                }

                importedNames.push(notebookName);
            } catch (err) {
                console.error(`Failed to import ${file.name}:`, err);
                failedFiles.push({ name: file.name, error: err.message });
            }
        }

        // Step 3: Refresh project list
        if (importedNames.length > 0) {
            populateProjectsList();
        }

        if (failedFiles.length > 0) {
            const errorMsg = failedFiles.map(f => `${f.name}: ${f.error}`).join('\n');
            await showAlert(`Failed to import some files:\n\n${errorMsg}`, 'Import Error');
        }

    } catch (err) {
        // Guard clause: ignore user cancellation
        if (err.name === 'AbortError') return;

        console.error('Import failed:', err);
        await showAlert('Failed to import: ' + err.message, 'Import Error');
    }
}

/**
 * Creates a radio button option for field definition choice in conflict resolution.
 * @param {string} fieldName - Field name
 * @param {string} value - Radio value ('existing' or 'imported')
 * @param {string} label - Display label
 * @param {Object} fieldDef - Field definition
 * @param {boolean} checked - Whether to select by default
 * @returns {HTMLElement} - Radio option element
 */
function createFieldOptionRadio(fieldName, value, label, fieldDef, checked) {
    const wrapper = document.createElement('label');
    wrapper.className = 'conflict-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = `conflict-${fieldName}`;
    radio.value = value;
    radio.checked = checked;
    wrapper.appendChild(radio);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'conflict-option-label';
    labelSpan.textContent = label;
    wrapper.appendChild(labelSpan);

    const details = document.createElement('div');
    details.className = 'conflict-option-details';
    details.textContent = formatFieldDefinition(fieldDef);
    wrapper.appendChild(details);

    return wrapper;
}

/**
 * Creates DOM element for a single field conflict.
 * @param {Object} conflict - Conflict object with name, existing, imported
 * @param {string} targetNotebookName - Name of target notebook
 * @param {string} sourceNotebookName - Name of source notebook
 * @returns {HTMLElement} - Conflict display element
 */
function createConflictElement(conflict, targetNotebookName, sourceNotebookName) {
    const container = document.createElement('div');
    container.className = 'conflict-item';

    const title = document.createElement('h4');
    title.textContent = `Field: ${conflict.name}`;
    container.appendChild(title);

    // Existing definition option (default selected)
    const existingOption = createFieldOptionRadio(
        conflict.name,
        'existing',
        `Keep "${targetNotebookName}"`,
        conflict.existing,
        true
    );
    container.appendChild(existingOption);

    // Imported definition option
    const importedOption = createFieldOptionRadio(
        conflict.name,
        'imported',
        `Use "${sourceNotebookName}"`,
        conflict.imported,
        false
    );
    container.appendChild(importedOption);

    return container;
}

/**
 * Shows conflict resolution modal for custom field definitions.
 * Returns a Promise that resolves to a map of field names to chosen definitions.
 * @param {Array} conflicts - Array of conflict objects
 * @param {string} targetNotebookName - Name of target notebook (current)
 * @param {string} sourceNotebookName - Name of source notebook (moving from)
 * @returns {Promise<Object>} - Map of field names to chosen definitions
 */
async function resolveFieldConflicts(conflicts, targetNotebookName, sourceNotebookName) {
    return new Promise((resolve, reject) => {
        const modal = document.getElementById('field-conflict-modal');
        const list = document.getElementById('conflict-list');
        const resolveBtn = document.getElementById('conflict-resolve-btn');
        const cancelBtn = document.getElementById('conflict-cancel-btn');
        const keepAllBtn = document.getElementById('conflict-keep-all');
        const useAllBtn = document.getElementById('conflict-use-all');

        // Update batch button labels with notebook names
        keepAllBtn.textContent = `Keep All "${targetNotebookName}"`;
        useAllBtn.textContent = `Use All "${sourceNotebookName}"`;

        // Clear previous conflicts
        list.replaceChildren();

        // Render each conflict
        for (const conflict of conflicts) {
            const conflictEl = createConflictElement(conflict, targetNotebookName, sourceNotebookName);
            list.appendChild(conflictEl);
        }

        // Show modal
        modal.classList.remove('hidden');

        // Batch action: Keep all current
        keepAllBtn.onclick = () => {
            conflicts.forEach(conflict => {
                const radio = document.querySelector(
                    `input[name="conflict-${conflict.name}"][value="existing"]`
                );
                if (radio) radio.checked = true;
            });
        };

        // Batch action: Use all imported
        useAllBtn.onclick = () => {
            conflicts.forEach(conflict => {
                const radio = document.querySelector(
                    `input[name="conflict-${conflict.name}"][value="imported"]`
                );
                if (radio) radio.checked = true;
            });
        };

        // Handle resolution
        resolveBtn.onclick = () => {
            const resolutions = {};
            let allResolved = true;

            for (const conflict of conflicts) {
                const selected = document.querySelector(
                    `input[name="conflict-${conflict.name}"]:checked`
                );
                if (!selected) {
                    showAlert('Please choose a definition for all fields', 'Error');
                    allResolved = false;
                    break;
                }
                resolutions[conflict.name] = selected.value === 'existing'
                    ? conflict.existing
                    : conflict.imported;
            }

            if (allResolved) {
                modal.classList.add('hidden');
                resolve(resolutions);
            }
        };

        // Handle cancellation
        cancelBtn.onclick = () => {
            modal.classList.add('hidden');
            reject(new Error('User cancelled import'));
        };
    });
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
                    const current = getNodeFieldValue(node, 'completion');
                    setNodeFieldValue(node, 'completion', cycleCompletion(current));
                    node.modified = new Date().toISOString();
                    render();
                    scheduleAutoSave();
                }
                return;
            }

            // Click on priority indicator - cycle state
            if (target.closest('.node-priority')) {
                const node = state.nodes.find(n => n.id === nodeId);
                if (node) {
                    const current = getNodeFieldValue(node, 'priority');
                    setNodeFieldValue(node, 'priority', cyclePriority(current));
                    node.modified = new Date().toISOString();
                    render();
                    scheduleAutoSave();
                }
                return;
            }

            if (e.shiftKey) {
                // Shift+click: start/complete edge creation from the clicked node
                if (state.edgeStartNode) {
                    // Complete edge creation to this target
                    completeEdgeCreation(nodeId);
                } else {
                    // Start edge creation from the clicked node
                    startEdgeCreation(nodeId);
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
                if (distance >= SELECTION_MODE_LOCK_DISTANCE) {
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
                    const edgesToAdd = [];
                    state.edges.forEach(edge => {
                        const [srcId, dstId] = edge;
                        if (idMapping[srcId] && idMapping[dstId]) {
                            edgesToAdd.push([idMapping[srcId], idMapping[dstId]]);
                        }
                    });
                    state.edges.push(...edgesToAdd);

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
                    const current = getNodeFieldValue(node, 'completion');
                    setNodeFieldValue(node, 'completion', cycleCompletion(current));
                    node.modified = new Date().toISOString();
                    render();
                    scheduleAutoSave();
                }
                return;
            }

            // Touch on priority indicator - cycle state
            if (target?.closest('.node-priority')) {
                const node = state.nodes.find(n => n.id === nodeId);
                if (node) {
                    const current = getNodeFieldValue(node, 'priority');
                    setNodeFieldValue(node, 'priority', cyclePriority(current));
                    node.modified = new Date().toISOString();
                    render();
                    scheduleAutoSave();
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
            }, LONG_PRESS_DURATION); // 500ms for long press
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
            const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MOBILE_MAX, pinchStartZoom * scale));

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
            const isDoubleTap = (now - lastTapTime < DOUBLE_TAP_THRESHOLD) && (lastTapNode === touchStartNode);

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
            const btn = document.getElementById('save-btn');
            if (btn) {
                btn.classList.add('loading');
                exportToFile().finally(() => btn.classList.remove('loading'));
            } else {
                exportToFile();
            }
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
            const x = canvasPos.x - NODE_WIDTH / 2 + (Math.random() - 0.5) * NODE_CREATE_RANDOM_OFFSET;
            const y = canvasPos.y - NODE_HEIGHT / 2 + (Math.random() - 0.5) * NODE_CREATE_RANDOM_OFFSET;
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
            zoomAtPoint(-NODE_CREATE_RANDOM_OFFSET, rect.left + rect.width / 2, rect.top + rect.height / 2);
        }

        // - - Zoom out
        if (e.key === '-') {
            e.preventDefault();
            const rect = container.getBoundingClientRect();
            zoomAtPoint(NODE_CREATE_RANDOM_OFFSET, rect.left + rect.width / 2, rect.top + rect.height / 2);
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

            const alertModal = document.getElementById('alert-modal');
            const promptModal = document.getElementById('prompt-modal');
            const overwriteSelectModal = document.getElementById('overwrite-select-modal');
            const editorModal = document.getElementById('editor-modal');
            const helpModal = document.getElementById('help-modal');
            const settingsModal = document.getElementById('settings-modal');
            const moveToModal = document.getElementById('move-to-modal');

            // Alert, prompt, and overwrite select modals handle Escape in their own handlers
            if (!alertModal.classList.contains('hidden') || !promptModal.classList.contains('hidden') || !overwriteSelectModal.classList.contains('hidden')) {
                return; // Let modal's own handler deal with it
            }

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
    document.getElementById('settings-completion-default').addEventListener('change', (e) => {
        updateFieldDefault('completion', e.target.value);
    });
    document.getElementById('settings-priority-default').addEventListener('change', (e) => {
        updateFieldDefault('priority', e.target.value);
    });
    document.getElementById('settings-modal').addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') {
            hideSettings();
        }
    });

    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            switchSettingsTab(e.target.dataset.tab);
        });
    });

    // Custom fields
    document.getElementById('settings-add-field').addEventListener('click', addCustomField);

    // Field editor modal
    document.getElementById('field-editor-cancel').addEventListener('click', closeFieldEditorModal);
    document.getElementById('field-editor-save').addEventListener('click', saveFieldFromModal);
    document.getElementById('field-editor-modal').addEventListener('click', (e) => {
        if (e.target.id === 'field-editor-modal') {
            closeFieldEditorModal();
        }
    });

    document.getElementById('save-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-btn');
        btn.classList.add('loading');
        try {
            await exportToFile();
        } finally {
            btn.classList.remove('loading');
        }
    });

    // Move to modal buttons
    document.getElementById('move-to-cancel').addEventListener('click', hideMoveToModal);
    document.getElementById('move-to-modal').addEventListener('click', (e) => {
        if (e.target.id === 'move-to-modal') {
            hideMoveToModal();
        }
    });
    document.getElementById('move-to-list').addEventListener('click', async (e) => {
        const item = e.target.closest('.move-to-item');
        if (item) {
            const targetProjectId = item.dataset.projectId;
            hideMoveToModal();
            await initiateMoveToNotebook(targetProjectId);
        }
    });

    // Landing page buttons
    document.getElementById('new-project-btn').addEventListener('click', newProject);

    // Debug tools (show with Ctrl+Shift+D on landing page)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'D' && document.getElementById('landing-page').style.display !== 'none') {
            const debugTools = document.getElementById('debug-tools');
            debugTools.classList.toggle('hidden');
        }
    });
    document.getElementById('import-project-btn').addEventListener('click', async () => {
        const btn = document.getElementById('import-project-btn');
        btn.classList.add('loading');
        try {
            await importFromFile();
        } finally {
            btn.classList.remove('loading');
        }
    });

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

            // Update all First Class Fields
            const fieldValues = getAllFieldValues();
            updateNodeFields(node, fieldValues);
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
        if (e.key === 'Enter' && !e.shiftKey && !isMobileDevice()) {
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

    // Initialize all First Class Field button handlers
    initializeFieldButtons();

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
            const edgesToAdd = [];
            state.edges.forEach(edge => {
                const [srcId, dstId] = edge;
                if (idMapping[srcId] && idMapping[dstId]) {
                    edgesToAdd.push([idMapping[srcId], idMapping[dstId]]);
                }
            });
            state.edges.push(...edgesToAdd);

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
        saveStatus.addEventListener('click', async () => {
            if (state.saveStatus === 'error' && state.lastSaveError) {
                await showAlert(`Save failed: ${state.lastSaveError}\n\nConsider exporting your work to avoid data loss.`, 'Save Failed');
            }
        });
    }

    // Debug tools buttons
    document.getElementById('debug-fill-storage')?.addEventListener('click', () => {
        const output = document.getElementById('debug-output');
        output.textContent = 'Filling localStorage...\n';
        const CHUNK_SIZE = 100000; // 100KB chunks
        const testKey = 'test-filler-';
        let i = 0;
        let totalSize = 0;

        try {
            while (true) {
                const data = 'x'.repeat(CHUNK_SIZE);
                localStorage.setItem(testKey + i, data);
                totalSize += CHUNK_SIZE;
                i++;
                output.textContent += `Added chunk ${i} (${(totalSize / 1024 / 1024).toFixed(2)} MB total)\n`;
            }
        } catch (e) {
            output.textContent += `\n✅ Filled localStorage successfully!\n`;
            output.textContent += `Total: ${i} chunks (${(totalSize / 1024 / 1024).toFixed(2)} MB)\n`;
            output.textContent += `Error: ${e.message}\n\n`;
            output.textContent += 'Now try making a change to trigger auto-save.';
        }
    });

    document.getElementById('debug-clear-test-data')?.addEventListener('click', () => {
        const output = document.getElementById('debug-output');
        output.textContent = 'Cleaning up test data...\n';
        let count = 0;
        const keys = Object.keys(localStorage);

        for (const key of keys) {
            if (key.startsWith('test-filler-')) {
                localStorage.removeItem(key);
                count++;
            }
        }

        output.textContent += `✅ Removed ${count} test chunks\n`;
        output.textContent += 'localStorage freed up successfully';
    });

    document.getElementById('debug-check-usage')?.addEventListener('click', () => {
        const output = document.getElementById('debug-output');
        let total = 0;
        for (const key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        output.textContent = `Current localStorage usage: ${(total / 1024 / 1024).toFixed(2)} MB\n`;
        output.textContent += `Percentage used: ${((total / (10 * 1024 * 1024)) * 100).toFixed(2)}%`;
    });

    // Error recovery modal buttons
    const errorExport = document.getElementById('error-export');
    const errorReload = document.getElementById('error-reload');
    const errorContinue = document.getElementById('error-continue');

    if (errorExport) {
        errorExport.addEventListener('click', () => {
            exportCurrentDataForRecovery();
        });
    }

    if (errorReload) {
        errorReload.addEventListener('click', () => {
            window.location.reload();
        });
    }

    if (errorContinue) {
        errorContinue.addEventListener('click', () => {
            hideErrorRecoveryUI();
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the application.
 * Checks localStorage availability, clears stale session data, loads saved theme,
 * initializes theme selector and event listeners, and shows landing page. Catches
 * and handles initialization errors with recovery UI.
 */
function init() {
    try {
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
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showErrorRecoveryUI(error);
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    try {
        init();
    } catch (error) {
        console.error('Critical error during initialization:', error);
        showErrorRecoveryUI(error);
    }
});

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
