# Plan: Second-Class Fields Implementation

## Goal

Implement user-defined, per-notebook custom fields (Second-Class Fields) that share as much infrastructure as possible with First-Class Fields.

## Key Principle: Maximum Generalization

**Treat all fields uniformly wherever possible.** First-Class and Second-Class fields should:
- Use the same save/load/snapshot logic
- Use similar editor UI patterns
- Share field helper functions
- Use the same storage pattern (`node.fields.{fieldName}`)
- Only differ where necessary (rendering on node, global vs per-notebook)

## Key Decisions

1. **Multi-select support** - Include as a field type for Second-Class fields
2. **Unified storage** - Move First-Class fields from top-level to `node.fields.{fieldName}` for symmetry
3. **Hybrid options** - Pre-defined options + auto-collected from existing values (like hashtags)
4. **Field ordering** - Drag-to-reorder in settings
5. **Batch mode** - Show value if unanimous, empty if mixed (no placeholder)
6. **Deferred** - Required fields, default values (see Future Tasks)

---

## Architecture Overview

### Unified Field System

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED FIELD HELPERS                         │
│  getFieldValue(), setFieldButtons(), getAllFieldValues(), etc.  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────┬──────────────────────────────────┐
│     FIRST-CLASS FIELDS       │     SECOND-CLASS FIELDS          │
├──────────────────────────────┼──────────────────────────────────┤
│ Source: FIRST_CLASS_FIELDS   │ Source: state.projectSettings    │
│         (global constant)    │         .customFields[]          │
├──────────────────────────────┼──────────────────────────────────┤
│ Storage: node.fields.{}      │ Storage: node.fields.{}          │
│ (UNIFIED - same location)    │ (UNIFIED - same location)        │
├──────────────────────────────┼──────────────────────────────────┤
│ Render: On node canvas       │ Render: Editor only              │
│ (special visual treatment)   │ (generic input controls)         │
├──────────────────────────────┼──────────────────────────────────┤
│ Types: Single-select only    │ Types: Single-select, multi-     │
│ (button-based UI)            │ select, text, number, date,      │
│                              │ checkbox                         │
└──────────────────────────────┴──────────────────────────────────┘
```

### Data Model Changes

**Node Structure (Before):**
```javascript
{
  id: "node-123",
  title: "My Note",
  content: "...",
  hashtags: [...],
  completion: "yes",     // First-Class Field (top-level)
  priority: "high",      // First-Class Field (top-level)
  // ... other properties
}
```

**Node Structure (After):**
```javascript
{
  id: "node-123",
  title: "My Note",
  content: "...",
  hashtags: [...],
  fields: {              // UNIFIED: All fields in one object
    completion: "yes",   // First-Class Field
    priority: "high",    // First-Class Field
    effort: "medium",    // Second-Class Field
    author: "Gene Kim",  // Second-Class Field
    rating: 5,           // Second-Class Field
    technologies: ["React", "Node"]  // Multi-select field
  }
}
```

**Migration:** On load, migrate `node.completion` and `node.priority` to `node.fields.{}`

**Project Settings (Before):**
```javascript
projectSettings: {
  defaultCompletion: null
}
```

**Project Settings (After):**
```javascript
projectSettings: {
  defaultCompletion: null,
  customFields: [        // NEW: Field definitions
    {
      id: "field-1",
      name: "effort",
      label: "Effort",
      type: "single-select",
      options: ["low", "medium", "high"],
      default: null,
      required: false
    },
    {
      id: "field-2",
      name: "author",
      label: "Author",
      type: "text",
      maxLength: 100,
      default: "",
      required: false
    },
    // ... more field definitions
  ]
}
```

---

## Implementation Phases

### Phase 1: Generalize Field Infrastructure
**Goal:** Make existing helpers work for both First-Class and Second-Class fields

**Changes to existing functions:**

1. **getAllFieldValues() → getAllFieldValues(includeCustom = true)**
   - Loops over FIRST_CLASS_FIELDS (as now)
   - NEW: Also loops over state.projectSettings.customFields
   - Returns unified object with both field types

2. **loadAllFieldValues(node) → loadAllFieldValues(node, includeCustom = true)**
   - Loads First-Class fields into buttons (as now)
   - NEW: Also loads Second-Class fields into their inputs

3. **updateNodeFields(node, fieldValues) → updateNodeFields(node, fieldValues, includeCustom = true)**
   - Updates First-Class fields on node (as now)
   - NEW: Also updates node.customFields for Second-Class fields

4. **Snapshot/Restore functions**
   - Include customFields in snapshot structure
   - Restore both field types on cancel

**New helper functions:**

```javascript
/**
 * Gets all field definitions (First + Second Class combined).
 * @param {boolean} includeFirstClass - Include First Class Fields
 * @param {boolean} includeSecondClass - Include Second Class Fields
 * @returns {Array} - Array of field definition objects
 */
function getFieldDefinitions(includeFirstClass = true, includeSecondClass = true) {
  const fields = [];

  if (includeFirstClass) {
    for (const fieldName in FIRST_CLASS_FIELDS) {
      fields.push({
        name: fieldName,
        label: fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
        type: 'single-select',
        options: Object.keys(FIRST_CLASS_FIELDS[fieldName].states),
        isFirstClass: true,
        config: FIRST_CLASS_FIELDS[fieldName]
      });
    }
  }

  if (includeSecondClass && state.projectSettings.customFields) {
    for (const field of state.projectSettings.customFields) {
      fields.push({
        ...field,
        isFirstClass: false
      });
    }
  }

  return fields;
}

/**
 * Gets a field value from a node (works for both field types).
 * @param {Object} node - Node object
 * @param {string} fieldName - Field name
 * @param {boolean} isFirstClass - Whether field is First Class
 * @returns {*} - Field value or null
 */
function getNodeFieldValue(node, fieldName, isFirstClass) {
  if (isFirstClass) {
    return node[fieldName] || null;
  } else {
    return node.customFields?.[fieldName] || null;
  }
}

/**
 * Sets a field value on a node (works for both field types).
 * @param {Object} node - Node object
 * @param {string} fieldName - Field name
 * @param {*} value - Field value
 * @param {boolean} isFirstClass - Whether field is First Class
 */
function setNodeFieldValue(node, fieldName, value, isFirstClass) {
  if (isFirstClass) {
    node[fieldName] = value || null;
  } else {
    if (!node.customFields) node.customFields = {};
    node.customFields[fieldName] = value || null;
  }
}
```

---

### Phase 2: Settings UI for Field Definitions
**Goal:** Allow users to define custom fields per notebook

**UI Location:** Settings Modal → New "Custom Fields" tab

**New HTML Structure:**
```html
<div id="settings-modal" class="hidden">
  <div id="settings-content">
    <div id="settings-tabs">
      <button class="settings-tab active" data-tab="general">General</button>
      <button class="settings-tab" data-tab="fields">Custom Fields</button>
    </div>

    <!-- General Tab (existing) -->
    <div id="settings-general" class="settings-panel">
      <!-- existing content -->
    </div>

    <!-- Custom Fields Tab (new) -->
    <div id="settings-fields" class="settings-panel hidden">
      <p class="settings-help">Define custom fields for notes in this notebook.</p>
      <button id="add-field-btn">+ Add Field</button>
      <div id="custom-fields-list"></div>
    </div>

    <div id="settings-buttons">
      <button id="settings-close">Close</button>
    </div>
  </div>
</div>
```

**Field Definition Modal:**
```html
<div id="field-editor-modal" class="hidden">
  <div id="field-editor-content">
    <h3>Add Custom Field</h3>
    <label>Field Name: <input type="text" id="field-name"></label>
    <label>Display Label: <input type="text" id="field-label"></label>
    <label>Type:
      <select id="field-type">
        <option value="single-select">Single Select</option>
        <option value="text">Text</option>
        <option value="number">Number</option>
        <option value="date">Date</option>
        <option value="checkbox">Checkbox</option>
      </select>
    </label>
    <div id="field-options-container" class="hidden">
      <label>Options (one per line):</label>
      <textarea id="field-options"></textarea>
    </div>
    <div id="field-editor-buttons">
      <button id="field-save">Save</button>
      <button id="field-cancel">Cancel</button>
    </div>
  </div>
</div>
```

**Functions:**
- `showFieldEditor(fieldDef = null)` - Open add/edit modal
- `saveFieldDefinition()` - Validate and save field definition
- `deleteFieldDefinition(fieldId)` - Remove field (with confirmation)
- `renderFieldDefinitionsList()` - Update list in settings

---

### Phase 3: Editor Integration
**Goal:** Render Second-Class fields in note editor

**Dynamic Field Rendering:**

```javascript
/**
 * Renders all custom field controls in editor.
 * Called when opening editor.
 */
function renderEditorCustomFields() {
  const container = document.getElementById('custom-fields-container');
  container.replaceChildren(); // Clear existing

  const fields = state.projectSettings.customFields || [];
  if (fields.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  for (const field of fields) {
    const control = createFieldControl(field);
    container.appendChild(control);
  }

  initializeCustomFieldListeners();
}

/**
 * Creates DOM element for a field control based on type.
 * @param {Object} field - Field definition
 * @returns {HTMLElement} - Control element
 */
function createFieldControl(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-field-control';
  wrapper.dataset.fieldName = field.name;

  const label = document.createElement('span');
  label.className = 'field-label';
  label.textContent = field.label + ':';
  wrapper.appendChild(label);

  switch (field.type) {
    case 'single-select':
      // Create button group (like completion/priority)
      const btnGroup = document.createElement('div');
      btnGroup.className = 'field-btn-group';

      // None button
      const noneBtn = document.createElement('button');
      noneBtn.className = `${field.name}-btn`;
      noneBtn.dataset.value = '';
      noneBtn.textContent = 'None';
      btnGroup.appendChild(noneBtn);

      // Option buttons
      for (const option of field.options) {
        const btn = document.createElement('button');
        btn.className = `${field.name}-btn`;
        btn.dataset.value = option;
        btn.textContent = option.charAt(0).toUpperCase() + option.slice(1);
        btnGroup.appendChild(btn);
      }
      wrapper.appendChild(btnGroup);
      break;

    case 'text':
      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'field-input';
      textInput.dataset.fieldName = field.name;
      if (field.maxLength) textInput.maxLength = field.maxLength;
      wrapper.appendChild(textInput);
      break;

    case 'number':
      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.className = 'field-input';
      numInput.dataset.fieldName = field.name;
      if (field.min !== undefined) numInput.min = field.min;
      if (field.max !== undefined) numInput.max = field.max;
      wrapper.appendChild(numInput);
      break;

    case 'date':
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'field-input';
      dateInput.dataset.fieldName = field.name;
      wrapper.appendChild(dateInput);
      break;

    case 'checkbox':
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'field-checkbox';
      checkbox.dataset.fieldName = field.name;
      wrapper.appendChild(checkbox);
      break;
  }

  return wrapper;
}
```

**Modify existing editor functions:**

- `openSingleEditor()` - Call `renderEditorCustomFields()`, load values
- `openBatchEditor()` - Call `renderEditorCustomFields()`, handle mixed state
- `getEditorFormData()` - Include custom field values
- `saveSingleNode()` - Save to node.customFields
- `cancelEditor()` - Restore custom fields from snapshot

---

### Phase 4: Export/Import Compatibility
**Goal:** Include custom fields in JSON export/import

**Changes:**
- Field definitions exported in `settings.customFields`
- Node values exported in `node.customFields`
- Import handles notebooks with different field definitions:
  - Merge: Add new field definitions, keep existing
  - Skip: Ignore imported field definitions

---

## Detailed Phase 1 Implementation

Since we just finished generalizing save/load, Phase 1 builds directly on that work.

### Step 1.1: Add getFieldDefinitions() helper

```javascript
/**
 * Gets all field definitions for the current notebook.
 * Combines First-Class (global) and Second-Class (per-notebook) fields.
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
        options: [null, ...config.cycleOrder], // Include none option
        isFirstClass: true,
        _config: config // Original config for rendering
      });
    }
  }

  if (includeSecondClass) {
    const customFields = state.projectSettings.customFields || [];
    for (const field of customFields) {
      fields.push({
        ...field,
        isFirstClass: false
      });
    }
  }

  return fields;
}
```

### Step 1.2: Add unified get/set value helpers

```javascript
/**
 * Gets a field value from a node.
 * Works for both First-Class (top-level) and Second-Class (nested) fields.
 * @param {Object} node - Node object
 * @param {Object} fieldDef - Field definition (from getFieldDefinitions)
 * @returns {*} - Field value or null
 */
function getNodeFieldValue(node, fieldDef) {
  if (fieldDef.isFirstClass) {
    return node[fieldDef.name] || null;
  } else {
    return node.customFields?.[fieldDef.name] ?? null;
  }
}

/**
 * Sets a field value on a node.
 * Works for both First-Class (top-level) and Second-Class (nested) fields.
 * @param {Object} node - Node object
 * @param {Object} fieldDef - Field definition
 * @param {*} value - Value to set
 */
function setNodeFieldValue(node, fieldDef, value) {
  const normalizedValue = value === '' ? null : value;

  if (fieldDef.isFirstClass) {
    node[fieldDef.name] = normalizedValue;
  } else {
    if (!node.customFields) node.customFields = {};
    if (normalizedValue === null) {
      delete node.customFields[fieldDef.name];
    } else {
      node.customFields[fieldDef.name] = normalizedValue;
    }
  }
}
```

### Step 1.3: Extend existing generic helpers

**getAllFieldValues() - Add custom fields support:**
```javascript
function getAllFieldValues() {
  const values = {};
  const fields = getFieldDefinitions();

  for (const field of fields) {
    if (field.isFirstClass) {
      // Use existing button-based getter
      values[field.name] = getFieldValue(field.name) || null;
    } else {
      // Use new input-based getter
      values[field.name] = getCustomFieldValue(field);
    }
  }

  return values;
}

/**
 * Gets value from a custom field input.
 * @param {Object} fieldDef - Field definition
 * @returns {*} - Field value
 */
function getCustomFieldValue(fieldDef) {
  switch (fieldDef.type) {
    case 'single-select':
      const activeBtn = document.querySelector(`.${fieldDef.name}-btn.active`);
      return activeBtn ? (activeBtn.dataset.value || null) : null;

    case 'text':
    case 'number':
    case 'date':
      const input = document.querySelector(`input[data-field-name="${fieldDef.name}"]`);
      if (!input) return null;
      if (fieldDef.type === 'number') {
        return input.value ? Number(input.value) : null;
      }
      return input.value || null;

    case 'checkbox':
      const checkbox = document.querySelector(`input[data-field-name="${fieldDef.name}"]`);
      return checkbox ? checkbox.checked : false;

    default:
      return null;
  }
}
```

**loadAllFieldValues() - Add custom fields support:**
```javascript
function loadAllFieldValues(node) {
  const fields = getFieldDefinitions();

  for (const field of fields) {
    const value = getNodeFieldValue(node, field);

    if (field.isFirstClass) {
      // Use existing button setter
      setFieldButtons(field.name, value || '');
    } else {
      // Use new input setter
      setCustomFieldValue(field, value);
    }
  }
}

/**
 * Sets value in a custom field input.
 * @param {Object} fieldDef - Field definition
 * @param {*} value - Value to set
 */
function setCustomFieldValue(fieldDef, value) {
  switch (fieldDef.type) {
    case 'single-select':
      setFieldButtons(fieldDef.name, value || '');
      break;

    case 'text':
    case 'number':
    case 'date':
      const input = document.querySelector(`input[data-field-name="${fieldDef.name}"]`);
      if (input) input.value = value ?? '';
      break;

    case 'checkbox':
      const checkbox = document.querySelector(`input[data-field-name="${fieldDef.name}"]`);
      if (checkbox) checkbox.checked = !!value;
      break;
  }
}
```

**updateNodeFields() - Add custom fields support:**
```javascript
function updateNodeFields(node, fieldValues) {
  const fields = getFieldDefinitions();

  for (const field of fields) {
    if (field.name in fieldValues) {
      setNodeFieldValue(node, field, fieldValues[field.name]);
    }
  }
}
```

---

## Summary: Implementation Order

### Phase 1: Generalize Field Infrastructure (~3-4 hours)
1. Add `getFieldDefinitions()` helper
2. Add `getNodeFieldValue()` / `setNodeFieldValue()` helpers
3. Add `getCustomFieldValue()` / `setCustomFieldValue()` helpers
4. Extend `getAllFieldValues()` for both field types
5. Extend `loadAllFieldValues()` for both field types
6. Extend `updateNodeFields()` for both field types
7. Update snapshot structure to include customFields
8. Update cancelEditor() to restore customFields
9. Test with empty customFields (backwards compatible)

### Phase 2: Settings UI for Field Definitions (~4-5 hours)
1. Add tabs to settings modal (General | Custom Fields)
2. Create field definitions list UI
3. Create add/edit field modal
4. Implement CRUD operations for field definitions
5. Field type selector with dynamic options
6. Validation (unique names, valid options)
7. Delete confirmation (affects existing notes)

### Phase 3: Editor Integration (~3-4 hours)
1. Add `#custom-fields-container` to editor HTML
2. Implement `renderEditorCustomFields()`
3. Implement `createFieldControl()` for each type
4. Initialize event listeners for custom field inputs
5. Update `openSingleEditor()` to render/load custom fields
6. Update `openBatchEditor()` to handle mixed state
7. Style custom field controls (CSS)

### Phase 4: Export/Import (~1-2 hours)
1. Include field definitions in export
2. Include node.customFields in export
3. Handle import of different field schemas
4. Backwards compatibility (no customFields = works fine)

**Total Estimated Effort: 11-15 hours**

---

## Testing Plan

### Phase 1 Tests
1. Existing First-Class fields still work (completion, priority)
2. Empty customFields array doesn't break anything
3. Snapshot includes all fields
4. Cancel restores all fields

### Phase 2 Tests
1. Add single-select field with options
2. Add text field
3. Add number field with min/max
4. Edit existing field definition
5. Delete field definition
6. Validate unique field names
7. Settings persist after reload

### Phase 3 Tests
1. Custom fields appear in editor
2. Single-select buttons work
3. Text input saves/loads
4. Number input validates
5. Date picker works
6. Checkbox toggles
7. Batch mode mixed state
8. Cancel reverts all fields

### Phase 4 Tests
1. Export includes field definitions
2. Export includes field values
3. Import notebook with fields
4. Import into notebook with different fields
5. Backwards compatible with old exports

---

## Resolved Decisions

1. **Field ordering** - Drag-to-reorder in settings ✓
2. **Required fields** - Deferred to future ✓
3. **Default values** - Deferred to future ✓
4. **Field-level validation** - Basic validation (type-appropriate), don't block save
5. **Batch mode for non-select fields** - Show if unanimous, empty if mixed ✓
6. **Multi-select** - Include as a field type ✓
7. **Storage unification** - All fields in `node.fields.{}` ✓
8. **Options handling** - Hybrid: pre-defined + auto-collected from existing values ✓

---

## Future Tasks (Deferred)

These features are out of scope for initial implementation but should be added later:

1. **Required fields** - Mark fields as required, show validation errors
2. **Default values** - Set default value for new notes
3. **Field-based filtering** - Filter nodes by field values in sidebar
4. **Hashtag migration tool** - Convert hashtag patterns to fields
5. **Field templates** - Pre-defined field sets for common use cases
