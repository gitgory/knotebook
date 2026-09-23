# Portals and Dynamic Search Zones: Implementation Plan

Created: 2026-09-21
Status: In progress. Phase 0 is complete; the Phase 1 edge-registry
foundation and Phase 2 contextual edge views are implemented and manually
validated. Phase 3 portal-definition configuration is implemented pending
browser validation; search-zone phases have not started.

## Relationship to the Design Roadmap

This plan implements the decisions in
[Portals and Dynamic Search Zones Roadmap](portals-and-search-zones-roadmap.md).
It deliberately extends the current nested data model; it does **not** begin
the separate class/GraphQL architecture described in `knotebook-v2-design.md`.
The existing boolean tag/field query language is the portal query language for
the first release.

## Current Status (2026-09-22)

| Area | Status | Notes |
| --- | --- | --- |
| Phase 0: fixtures and compatibility baseline | Complete | Import fixtures and schema documentation were added; the legacy, system-architecture, media-recommendations, and invalid-edge fixtures were manually checked. |
| Phase 1: global edge registry | Complete | Version 2 stores explicit edges once at project root and migrates legacy child-edge data. Deletion, duplication, moves, undo, save, export, and import use the registry; focused destructive-operation regressions pass. |
| Phase 2: contextual edge rendering | Implemented and manually validated | Direct edges, labelled boundary continuations, and inspectable rolled-up summaries render from the global registry. Boundary endpoints navigate to the canonical note; rolled-up summaries disclose their contributing source edges. |
| Phase 3: portal query model and editor | Implemented; browser validation pending | Portal definitions normalize on load/import, persist through save/export/import, and can be edited with query validation and a notebook-scope match preview. Batch editing leaves portals unavailable. |
| Phases 4–6: portal views, zones, and drop updates | Not started | No query-result rendering, zones, or drop mutations have been added. |

The user manually verified the system-architecture and media-recommendations
fixtures, including clickable boundary and rolled-up edge affordances. All
tests performed for those fixtures passed.

## Outcome

After the phased work is complete, a user can:

1. keep each note in one canonical nested home;
2. create edges between any two notes in a notebook, regardless of nesting;
3. configure a note's portal queries in the note editor;
4. see query-matching notes beside that note's native children, without copies;
5. expand that portal note into a resizable dynamic search zone on its parent
   canvas; and
6. optionally drop a note into a zone to make a safe, reversible field/tag
   update defined by that zone.

## Non-goals for This Plan

- Flattening every notebook or removing nested navigation.
- GraphQL, classes, reference fields, or typed edge schemas.
- A new query parser, visual query builder, or arbitrary query inversion.
- Manually positioning portal-result instances in version one.
- Replacing the existing import/export format without migration support.

## Current-Code Constraints

The current implementation is a vanilla-JavaScript, immediate-mode SVG app.
Relevant existing code is concentrated in `scripts/app.js`:

- `state.nodes` represents the canonical nodes in the currently entered level.
- `state.projectEdges` is the project-wide explicit-edge registry; `state.edges`
  is a compatibility alias used by current render and interaction code.
- `enterNode()` and `goBack()` swap the current-level arrays.
- `renderNodes()` and `renderEdges()` assume every rendered node is a native
  node in `state.nodes` and every edge has both endpoints there.
- `state.nodeIndex` indexes only the current level.
- `buildProjectNodeContext()` currently derives recursive source-note and
  parent maps for edge rendering and boundary navigation; a persistent project
  index remains a portal-performance improvement, not a prerequisite already
  present in state.
- Notebook open and file import reject missing or duplicate canonical note IDs
  with a user-visible error, because a project-wide source ID must be unique.
- `parseExpression()` and `evaluateAST()` already implement the required
  tag/text/field/AND/OR/NOT matching.
- Import/load already uses explicit migration helpers for field and edge
  format changes.

The plan therefore introduces a project-wide identity/index layer and a
render-only view-model layer before adding portals or zones.

## Target Persistence Model

### Project data

New notebooks should ultimately store all explicit edges in one project-level
registry:

```js
{
  version: 2,
  name: "Notebook Name",
  nodes: [/* nested canonical tree */],
  edges: [
    { from: "note-a", to: "note-b", directed: true }
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
  hashtagColors: {},
  settings: {}
}
```

The `nodes` tree remains the canonical containment structure. `childEdges` is
legacy input only after migration; new saves must not recreate it.

### Note data

All notes retain their current data. Portal-capable notes gain optional data:

```js
{
  id: "note-ui",
  title: "UI",
  content: "",
  fields: {},
  hashtags: [],
  position: { x: 200, y: 100 },
  children: [],
  portals: [
    {
      id: "portal-ui-related",
      name: "UI-related notes",
      query: "#UI",
      scope: "notebook",
      dropBehavior: {
        type: "addTag",
        tag: "#UI"
      },
      presentation: {
        mode: "collapsed",
        position: { x: 200, y: 100 },
        width: 620,
        height: 420
      }
    }
  ]
}
```

Rules:

- `portals` defaults to `[]`; old notebooks need no prompt or data rewrite
  beyond defaults at load time.
- Every portal definition has an optional `presentation`, which defaults to
  `collapsed`; there is no note-level zone presentation.
- `presentation.position`, `width`, and `height` matter only for that
  definition's expanded zone. `node.position` remains the canonical position
  of the collapsed note and is never changed by zone move/resize gestures.
- On first expansion, initialize `presentation.position` from `node.position`.
  Thereafter that zone reopens at its last presentation position, while
  collapsing it restores the ordinary note at its unchanged canonical position.
- A note may store multiple portal definitions. In version one their results
  are unioned only in the entered note view while preserving membership
  provenance. An expanded zone belongs to one selected definition, so its
  query and drop behaviour are always unambiguous.
- Portal membership is computed, never persisted as copies of source notes.

### Portal scopes

Use explicit scopes so query reach is never surprising:

| Scope | Candidate source notes |
| --- | --- |
| `notebook` | Every canonical note in the open notebook, recursively. Default for portals. |
| `children` | Direct canonical children only. |
| `descendants` | All descendants of the portal note. |

The initial UI may expose only `notebook`; the persistence model supports the
others without a future schema migration.

## Core Runtime Structures

Do not mutate source notes to make a portal appearance. Instead add derived
structures for each render.

```js
state.projectEdges     // all explicit project edges
state.projectNodeIndex // Map<sourceNoteId, source note>, recursive
state.parentIndex      // Map<sourceNoteId, parent note ID | null>
state.currentView      // derived ViewModel, rebuilt before render
```

`currentView` should contain independent rendered instances:

```js
{
  contextNodeId: "note-ui",       // null for root
  instances: [
    {
      instanceId: "native:note-request-job",
      sourceId: "note-request-job",
      role: "native",             // native | portal
      contextId: "canvas:root",   // ordinary canvas | zone:<portal-note-id>:<portal-id>
      portalIds: ["portal-ui-related"],
      position: { x: 80, y: 100 }
    }
  ],
  boundaryEndpoints: [],
  rolledUpEdges: []
}
```

`sourceId` is the stable identity used for editing, fields, and explicit
edges. `instanceId` is view-local identity used only by rendering and pointer
interaction. A source note may have multiple instances in separate zones, but
only one instance in a single ordinary child/portal view.

### Edge-instance resolution

Explicit edges remain pairs of `sourceId` values; instances do not create or
own edges. Resolve each source edge to at most one visual representation in a
view:

1. Gather local contexts in which each endpoint has an instance. An ordinary
   canvas uses `canvas:<contextNodeId|root>` and each expanded zone uses
   `zone:<portal-note-id>:<portal-id>`.
2. If the endpoints share one or more contexts, draw one direct edge in the
   ordinary canvas when available; otherwise draw it in the lexicographically
   first shared zone context. Use that context's two instances.
3. If both endpoints are visible but share no context, choose one stable
   primary instance for each endpoint (native first, then lexicographically
   first zone ID) and draw a paired cross-context continuation labelled with
   the remote source note. It behaves like the existing boundary affordance;
   it is not a direct line spanning zones.
4. If exactly one endpoint is visible, render the existing single boundary
   continuation from that endpoint's stable primary instance. If neither is
   visible, use the existing rolled-up rule.

This ranking is deterministic, so unrelated zone movement and the presence of
additional portal appearances cannot duplicate an edge or make pointer
interaction target an arbitrary instance.

## Phase 0 — Safety Baseline and Fixtures

### Deliverables

- Add a `tests/` manual test plan for this feature family; the repository has
  no automated test framework.
- Create importable JSON fixtures for:
  - a deeply nested legacy notebook with root and child edges;
  - the User/UI/Server architecture scenario;
  - a recommendation notebook with show/location/completion fields; and
  - malformed/duplicate/missing edge endpoints.
- Record an export of a real existing notebook before any migration work.
- Update `docs-app/json-schema.md` to accurately describe the current v1
  schema before documenting v2 additions.

### Exit criteria

- A reviewer can import fixtures and verify the current application still
  renders them before code changes begin.

## Phase 1 — Global Identity and Edge Registry

### Goal

Allow an explicit edge between any two source notes while preserving old
notebooks and existing same-level behavior.

### Implementation steps

1. Add `buildProjectIndexes(rootNodes)`.
   - Recursively visit every canonical note once.
   - Populate `projectNodeIndex` and `parentIndex`.
   - Reject or recover from duplicate note IDs with a clear import error;
     silently choosing one would corrupt edges.
2. Add `collectLegacyEdges(rootEdges, rootNodes)`.
   - Normalize root `edges` and every legacy `childEdges` using the existing
     `normalizeEdge()` helper.
   - Merge them into a project-level list.
   - Deduplicate equal undirected pairs and exact directed pairs.
   - Report/drop edges whose endpoint does not exist; do not create dangling
     source records.
3. Add `migrateProjectEdges(projectData)` during load/import.
   - If `projectData.version < 2`, collect legacy edge locations into
     `projectData.edges`, remove migrated `childEdges`, and set version 2.
   - Preserve a deep backup only in memory until the next successful save.
   - Ensure reloading a v2 file is idempotent: no duplicate collection.
4. Replace current-level edge writes in edge creation, deletion, duplication,
   move-between-notebook, and undo code with operations on
   `state.projectEdges`.
5. Retain a derived `getEdgesForNativeContext(contextNodeId)` adapter while
   existing screens are being converted. It returns project edges whose two
   endpoints are direct visible native children of that context.
6. Replace the current-level-only node index with project indexes. Keep a
   separate map for current rendered instances when needed.
7. Update save/export/import and `getCurrentProjectData()` so all project
   edges are exported once at the project root.

### Delivered

- Added a version 2 project-level edge registry and idempotent migration of
  root and legacy child edges.
- Normalized and de-duplicated imported edges; invalid, missing-endpoint, and
  self edges are omitted rather than creating phantom notes.
- Rejects notebook data with missing or duplicate canonical note IDs instead of
  silently overwriting a source record in a project index.
- Updated persistence and common edge-affecting operations to use the global
  registry, including save/export/import, undo, subtree duplication, deletion,
  and move cleanup.
- Added fixtures for legacy nested edges, the system-architecture example, the
  media-recommendations example, malformed edges, and Phase 0 validation.

### Deferred follow-up

Cross-context edge creation is deferred and does not block portal work. If it
is added later, prefer a contextual action that searches canonical paths over
making the canvas connect gesture a global graph picker.

Invalid imported edges are normalized or discarded quietly. Edges are
notebook-local: when notes move to another notebook, edges whose two endpoints
move together are retained there, while edges to notes left behind are removed
without a separate warning or confirmation.

### Important regression cases

- Deleting a note removes every project edge touching it, including edges from
  descendants and remote branches as defined by the deletion policy.
- Promoting native children after parent deletion retains their valid edges.
- Duplicating a subtree remaps only edges whose two endpoints were duplicated;
  it must not accidentally connect copied nodes to the originals.
- Moving nodes between notebooks retains edges whose two endpoints move
  together and removes every edge to a note left behind. Edges never span
  notebooks, and the operation does not require a separate warning or
  confirmation.

### Exit criteria

- Existing local same-level edges look and behave unchanged.
- A child can connect directly to a note under a different parent.
- Export/import retains that cross-context edge exactly once.

## Phase 2 — Context-Aware Edge Rendering

### Goal

Make global edges understandable in nested views before portal results are
introduced.

### Implementation steps

1. Build `getNativeView(contextNodeId)` from direct canonical children.
2. Build `classifyEdgesForView(view)` using source IDs:
   - **direct**: both endpoints have an instance in the view;
   - **boundary**: exactly one endpoint has an instance;
   - **rolled-up**: neither endpoint is directly visible but their canonical
     ancestor containers are visible in the current overview.
3. Refactor `renderEdges()` into dedicated renderers:
   - `renderDirectEdges(view)` retains the current SVG line/arrow behavior;
   - `renderBoundaryEndpoints(view)` draws a labelled endpoint at the closest
     canvas boundary or beside the source node, with a direction indicator;
   - `renderRolledUpEdges(view)` groups descendant edges by visible container
     pair and direction, then shows a count/disclosure affordance.
4. Add `revealRemoteEndpoint(sourceId)` as the first boundary interaction.
   Start with a clear navigation action to the canonical location. Defer
   popovers and temporary reveal portals until the underlying model is stable.
5. Make rolled-up edges inspectable: the user can see the actual source-to-
   source edge list. Never allow a rolled-up edge to masquerade as an explicit
   user-created edge.
6. Update selection and deletion semantics: selecting a boundary or rolled-up
   visualization must not make it possible to delete unrelated explicit edges
   without an explicit drill-in action.

### Delivered

- Classified global edges per current view and preserved normal rendering when
  both endpoints are visible.
- Added dashed, labelled boundary continuations with a larger pointer target;
  activating one navigates to the remote note's canonical context.
- Added visually distinct rolled-up container summaries with a count and an
  inspectable list of contributing source edges.
- Confirmed boundary and rolled-up affordances are clickable in the manual
  fixture tests.

### Exit criteria

- `Request Job -> Step A` is direct when both appear, boundary-rendered when
  only one appears, and represented as an inspectable `UI -> Server` summary
  in the root overview.
- Filters hide or reveal edge representations consistently with the visible
  source instances.

## Phase 3 — Portal Query Model and Editor

### Goal

Let any note define portal queries while changing no canvas presentation yet.

### Implementation steps

1. Add `migrateNodePortals(nodes)` to normalize `portals` and each portal
   definition's `presentation` defaults recursively on load/import.
2. Add portal validation helpers:
   - trim name and query;
   - parse through `parseExpression()`;
   - reject empty/invalid saved queries with inline editor feedback;
   - normalize hashtag literals to the same lower-case form as existing
     searches.
3. Add a **Portals** section to the existing single-note editor:
   - list portal definitions;
   - add, rename, edit a notebook-scope query, and delete;
   - preserve the existing batch editor by disabling portal edits in batch
     mode for version one;
   - make Cancel restore portal changes using the existing editor snapshot.
4. Store portal data through the existing `saveSingleNode()` and auto-save
   queue. Update import/export validation accordingly.
5. Add query-preview text, such as `12 matching notes`, using the project node
   index. This preview must exclude the portal note itself unless a later
   explicit option permits self-matching.

### Exit criteria

- An old notebook opens without visible change.
- A user can configure `#UI` or `completion=done AND location=Hulu` in a note
  editor, save, reload, and export/import it without data loss.

### Delivered

- Added recursive portal-definition normalization with unique local IDs,
  notebook scope, normalized hashtag literals, and per-definition collapsed
  presentation defaults.
- Added a single-note **Portals** editor section with add, edit, remove, query
  validation, and a self-excluding notebook match preview.
- Preserved portal definitions during save, import, export, duplication, undo,
  and editor cancel. Batch editing intentionally does not expose portal edits.

## Phase 4 — Collapsed Portal Views

### Goal

When entering a portal-capable note, show its direct native children plus
deduplicated query results.

### Implementation steps

1. Build `getPortalMatches(contextNode, portalDefinition)`.
   - Choose candidates from the configured scope using `projectNodeIndex`.
   - Evaluate the existing AST against each candidate.
   - Exclude the context note itself in version one.
2. Build `buildCombinedView(contextNodeId)`.
   - Start with native child instances at canonical positions.
   - Add matching portal source notes not already represented.
   - If a native child matches, merge portal IDs into its existing instance;
     never render it twice.
3. Add a deterministic automatic layout for portal-only instances.
   - Preserve native child positions.
   - Place portal-only notes in a grid/ring outside the native-child bounding
     box with stable sorting by title/ID to minimize visual jumping.
   - Do not persist these calculated positions in version one.
4. Refactor `renderNodes()` to accept instances and resolve each source note
   through `projectNodeIndex`.
5. Add a subtle portal-membership marker only after the combined view works.
   The marker must not obscure existing completion, priority, child-stack, or
   tag indicators.
6. Use the same combined view for direct-edge classification so a real edge is
   shown normally whenever both source notes have instances in the same local
   context. Apply edge-instance resolution for every other visibility case.

### Exit criteria

- Entering `UI` shows its native children and remote notes matching `#UI`.
- A native child that matches `#UI` appears exactly once.
- Editing any portal instance edits its canonical source note.
- Leaving/re-entering a view produces stable automatic placement for unchanged
  data.

## Phase 5 — Expanded Portal Notes as Dynamic Search Zones

### Goal

Render one selected portal definition and the note's native children directly
on the parent canvas.

### Implementation steps

1. Add a portal-definition action: **Expand on canvas** / **Collapse to
   node**. When a note has multiple definitions, the menu names each one and
   expands/collapses that definition independently.
2. Add SVG zone layers in a deliberate z-order:
   - zone backgrounds;
   - zone labels and resize handles;
   - edges;
   - note instances;
   - selection and interaction overlays.
3. Render an expanded portal definition as a resizable region using its
   `presentation.position`, `.width`, and `.height`. Initialize that position
   from the portal note's canonical `position` the first time it is expanded.
   Its title remains visible; its ordinary collapsed node is not rendered
   separately in that parent view.
4. Reuse the native-child layout plus `getPortalMatches()` for the selected
   definition inside the zone, and transform the result into zone-local bounds.
5. Implement move and resize gestures for the zone itself. These update only
   the definition's `presentation.position` and its size; they never update
   the portal note's canonical `position` or portal-member notes.
6. Extend edge rendering with edge-instance resolution. Draw an explicit edge
   once in its selected shared context; otherwise render paired cross-context
   continuations. Never create an edge per portal-instance pair.
7. Support overlap in the layout engine:
   - calculate each instance's matching zone set;
   - place notes matching all overlapping zones in their geometric shared
     area when it has usable space;
   - when a shared area has no usable space, place each qualifying note once
     in a labelled intersection overflow strip rather than an exclusive area;
   - retain separate portal instances only for zones that do not geometrically
     overlap;
   - use collision avoidance and a clear empty-state message when an
     intersection has no qualifying notes.
8. Recalculate membership and layout after source field/tag edits, portal
   query edits, and zone geometry changes. Debounce expensive recomputation
   during continuous resize/drag events.

### Exit criteria

- Expanding a portal definition shows the note's native children plus exactly
  that definition's matching source-note set. For a note with one definition,
  this is the same source-note set as entering the note.
- Collapsing it hides only the expanded presentation and restores the
  unchanged canonical card position; no source note, edge, or canonical
  membership changes.
- Overlapping `media=show`, `location=Hulu`, and `completion=todo` zones show
  only triple-matching notes in their shared area.

## Phase 6 — Configured Drop-to-Update

### Goal

Make zones optional spatial editors without trying to reverse arbitrary query
syntax.

### Supported v1 drop behaviours

```js
{ type: "setField", field: "completion", value: "done" }
{ type: "addTag", tag: "#UI" }
{ type: "removeTag", tag: "#inbox" }
```

Do not infer these from the query. A query such as `status=done OR
priority=high` has no default drop behaviour until the user configures one.

### Implementation steps

1. Extend portal editor rows with an optional drop-behaviour control.
2. Add drag-intent detection that distinguishes:
   - moving a normal/native card in its canonical view;
   - repositioning a zone; and
   - dropping a source/portal instance into a configured zone.
3. On zone hover, show a non-destructive preview of exact changes. For example:
   `Set completion: todo -> done`.
4. On drop, collect every compatible target-zone mutation. Validate field
   definitions and tag syntax before changing source data.
5. If multiple zones prescribe conflicting values for a single-value field,
   show a choice modal; never silently choose by z-index or drop order.
6. Apply accepted mutations as one transaction, refresh hashtags/field
   indicators/indexes, schedule auto-save, and show an Undo toast.
7. Define Undo as a transaction restoring the prior values for every changed
   field/tag. It must not undo unrelated later edits.
8. Moving a note **out of** a zone does not clear data by default. Zones are
   views, not owners. Removal must be an explicit configured action or editor
   change.

### Exit criteria

- Dropping a note into a configured Completed zone sets completion to `done`.
- The note leaves a Not Started zone and appears in Completed through normal
  live-query recomputation.
- Undo restores its prior state.
- An ambiguous query-only zone never changes data on drop.

## Phase 7 — Hardening, Documentation, and Release

### Manual test matrix

- Legacy import/export round trip with root and child edges.
- Cross-parent edge create, edit direction, delete, duplicate, and delete-
  parent promotion.
- Portal query matching tags, fields, text, `AND`, `OR`, `NOT`, parentheses,
  and no matches.
- Combined native/portal de-duplication.
- One note displayed in two non-overlapping zones.
- Zone intersections, resize/move, collapse/reopen, and zoom/fit-to-view.
- Boundary and rolled-up edge direction/count/disclosure behavior.
- Drop mutation preview, conflict handling, Undo, save/reload, and import/
  export.
- Keyboard-only and touch/mobile interactions.
- Performance trials at 100, 500, and 1,000 notes with repeated query updates.

### Documentation updates

- Update `docs-app/json-schema.md` with version 2 project edges and portal
  fields.
- Update `docs-app/app-controls-reference.md` with portal, zone, boundary-edge,
  and drop interactions.
- Update `docs-project/decision-history.md` after each agreed architectural
  decision is implemented.
- Update `docs-project/ROADMAP.txt` to link this plan and reflect completed
  phases; do not mark design-only phases as implemented.
- Create a user-facing test plan for each releasable phase.

## Release Strategy

Ship as small, import-safe releases:

1. Global edges and boundary/rolled-up rendering.
2. Collapsed portal configuration and combined child view.
3. Expanded dynamic search zones.
4. Configured drop-to-update.

Each release must preserve old notebook imports and JSON exports. Add a visible
format/version notice only if an old client cannot safely reload the newer file.

## Main Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Global edges break deletion, copying, or move-to-notebook behavior | Complete Phase 1 fixtures and regression cases before portal UI. |
| Portal views become visually noisy | Start with automatic layout, de-duplication, one understated marker, and visibility toggles. |
| Query results jump while editing | Use stable ordering and deterministic layout; debounce zone recomputation. |
| Dragging causes surprising data changes | Require configured drop behaviour, show preview, and always offer Undo. |
| Rolled-up edges imply false semantics | Visually distinguish them and expose their real source-edge provenance. |
| Large notebooks render slowly | Maintain indexes, avoid full DOM work during pointer movement, and measure fixtures before polish. |

## Decisions Required Before Coding Each Phase

- **Phase 2:** Confirm whether boundary endpoint activation navigates directly
  first (recommended) or opens an in-place preview.
- **Phase 3:** Confirm whether `notebook` scope is sufficient for the initial
  UI (recommended) or expose all scopes immediately.
- **Phase 5:** Confirm minimum zone dimensions and whether expanded portal
  notes may overlap ordinary collapsed nodes.
- **Phase 6:** Confirm whether drop-to-update needs a modifier key in addition
  to the preview/Undo safeguard.

## Recommended Next Implementation Slice

Begin Phase 4 collapsed portal views after browser validation of the editor.
In parallel or before a release, run the broader manual test matrix. The global
registry and contextual renderers already unlock the User/UI/Server example and
provide the identity/view-model foundation required by portals and zones.
