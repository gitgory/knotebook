# Portals and Dynamic Search Zones Roadmap

Created: 2026-09-21
Status: Implementation underway. The edge foundation is implemented and
manually validated; portal-definition configuration is implemented pending
browser validation. Dynamic-search-zone work has not started.

## Purpose

Extend Knotebook's nested graph model without giving up the clarity of a
canonical hierarchy. A note keeps one primary home, but may be displayed in
additional contexts through query-backed portals. Dynamic search zones are the
same feature rendered directly on a canvas at a larger scale.

This is an architectural roadmap, not a commitment to remove nesting. The
existing nested-notebook format remains the foundation.

## Current Status (2026-09-22)

Completed and manually validated:

- Version 2 has one project-level explicit-edge registry, with import
  migration from legacy nested edge storage.
- Invalid, duplicate, missing-endpoint, and self edges are filtered during
  migration; save and export retain the global registry.
- The system-architecture fixture renders normal direct edges, labelled
  boundary continuations, and distinct rolled-up summaries. Boundary
  activations navigate to the remote canonical note and rolled-up summaries
  disclose their source edges.
- The legacy, system-architecture, media-recommendations, and invalid-edge
  fixture checks all passed.
- Automated regressions confirm that parent deletion preserves promoted-child
  remote edges, subtree duplication remaps only internal edges, and a
  cross-notebook move retains only moved-subtree edges.

Deferred edge-foundation follow-up:

Cross-context edge creation is deliberately deferred. The existing local
connect gesture and contextual renderers remain sufficient for the portal
phases; a future interaction should preserve the canvas-first mental model
rather than requiring a global graph picker.

Invalid imported edges are normalized or discarded quietly. Edges never span
notebooks: moving notes between notebooks retains edges whose two endpoints
move together and removes edges to notes left behind, without a separate
warning or confirmation.

Portal definitions now normalize on load/import and persist through
save/export/import. The single-note editor can add, edit, remove, validate,
and preview notebook-scope portal queries. Portal query-result rendering,
expanded zones, overlap layout, and drop-to-update behavior remain
unimplemented.

## Core Decisions

### 1. Every note has a canonical home

Each note has one canonical parent and one canonical position within that
parent's child view. This is the note's stable place in the hierarchy.

Additional appearances never copy, move, or take ownership of the source note.
They are contextual renderings of the same note.

### 2. Every note can be a portal

Portal capability is optional but available on every note; there is no separate
"portal note" type. A note may simultaneously have:

- normal note content and fields;
- native children;
- edges to any other note;
- one or more portal queries; and
- appearances inside other notes' portals or zones.

### 3. Portal results add to native children

Entering a note shows its native children and its portal results together.
Portal results do not replace the child view.

A source note is rendered no more than once in one view. If a native child also
matches a portal query, it remains one card and can receive a subtle shared-
membership indicator.

### 4. A dynamic search zone is an expanded portal definition

Each named portal definition has two presentations, with identical query,
membership, editing, and edge semantics:

| Presentation | Behaviour |
| --- | --- |
| Collapsed portal | The note renders as one ordinary card. Entering it shows native children plus the union of its portal-definition results. |
| Expanded portal / dynamic search zone | Renders one selected portal definition and the note's native children directly in a resizable region on the current canvas. |

Each definition expands independently, so a note with several definitions can
have several zones. Expanding or collapsing changes presentation only. It never
changes source notes, canonical homes, fields, or relationships. A zone is
therefore persisted with its portal definition rather than as a parallel
feature that can drift away from portals.

### 5. Portal configuration belongs in the note editor

The editor gains a **Portals** section. An initial portal definition includes:

- a user-facing name;
- an existing Knotebook query; and
- optional drop behaviour (see below).

The first implementation should reuse the current tag/field/boolean query
parser rather than introducing a second query language or visual query builder.

### 6. Portal results use automatic layout initially

Portal and zone results are automatically arranged in their local context.
Manual per-portal positioning is deferred until there is evidence it is needed.

Editing a portal appearance opens the underlying source note, not a copy.

### 7. Zones are live views and optional spatial editors

Changing a zone's bounds or moving/resizing it changes only its presentation.
An expanded zone has its own persisted canvas position; it does not reuse or
update the portal note's canonical card position. On first expansion, its
presentation position is initialized from that card position as a convenient
starting location.
Changing a note's data changes zone membership immediately.

Dropping a note into a zone is a distinct, intentional action: it may update
the source note so it matches the zone. This makes spatial organization useful
for direct manipulation, such as moving a recommendation from `Status: Not
Started` to `Status: Completed`.

Queries alone are not always reversible. A zone must therefore declare an
explicit optional **drop behaviour**, rather than infer mutations from arbitrary
queries.

Examples:

| Zone query | Drop behaviour |
| --- | --- |
| `completion=yes` | Set completion to `yes` |
| `#UI` | Add tag `#UI` |
| `priority=high` | Set priority to `high` |
| `location=Hulu` | Set location to `Hulu` |
| `status=done OR priority=high` | No automatic mutation; ambiguous |

Every data-changing drop must provide an Undo action. A drop into an overlap
applies each compatible zone's explicit mutation. Conflicting mutations (for
example two values for the same single-value field) require a user choice.

### 8. Overlapping zones have Venn semantics

The total visible population across zones is a union: a note may match any
zone. The physical overlap of zones is an intersection: it contains only notes
matching all of the overlapping zones' queries.

A note that matches a single zone appears in that zone's exclusive area. A note
matching several physically overlapping zones appears once in their shared
area. A note matching zones that do not overlap can appear as a portal instance
in each relevant zone.

If a geometric intersection is too small or obstructed to hold its qualifying
notes, render those notes once in a dedicated **intersection overflow strip**
anchored to that intersection and labelled with the participating zones. Never
fall back to placing them in an exclusive area. This preserves the Venn meaning
while making constrained layouts usable.

Example: three overlapping zones with `media=show`, `location=Hulu`, and
`completion=notcomplete` reveal, in their triple overlap, unfinished Hulu shows.

### 9. Edges are global; views decide how to render them

An edge connects two real source-note IDs regardless of their canonical parents,
their depth in the hierarchy, or portal appearances. Cross-branch connections
are first-class; nesting must not restrict them.

Render rules:

| Endpoint visibility in a view | Rendering |
| --- | --- |
| Both selected instances share a local context | Draw the real edge normally in that context. |
| Both notes are visible only in different local contexts | Draw one paired cross-context continuation, not a line between every portal instance. |
| One note is visible | Draw to a labelled boundary endpoint, such as `Server / Step A`. Clicking it reveals or navigates to the remote source note. |
| Only descendant relationships are visible at a higher level | Draw a derived rolled-up edge between containers, with count and disclosure of the real links. |

An explicit user-created edge and a rolled-up edge must look different. A
rolled-up edge is a summary only; it must show its provenance rather than imply
that the containers themselves were explicitly connected.

An explicit edge is rendered no more than once per view, even when either
source note has several portal instances. Each portal instance has a local
context (the ordinary canvas or one expanded zone). For an edge, prefer a
shared local context in this order: the ordinary canvas, then the
lexicographically first shared zone ID. If no shared context exists, select one
stable primary instance per endpoint (native first, then the lexicographically
first zone ID) and render paired labelled continuations there. This makes an
edge inspectable without introducing ambiguous many-to-many edge lines.

Current implementation: the global registry, direct rendering, boundary
navigation, and rolled-up edge disclosure are complete and manually tested.

## Reference Scenarios

### System architecture

At root level, show an understandable overview:

```text
User -> UI -> Server -> User
```

`UI` canonically contains `Read`, `Write`, `Modify`, and `Request Job`.
`Server` canonically contains `Step A`, `Step B`, `Step C`, and `Return Results`.
The edge `Request Job -> Step A` is a real cross-container edge. It rolls up to
`UI -> Server` at the overview level, becomes a boundary connection when only
one endpoint is in view, and becomes a normal edge whenever a portal/zone makes
both endpoints visible.

### Media recommendations

Recommendation notes can be queried by fields such as media type, streaming
location, completion state, and recommender. Expanded portals support broad,
visual database views without moving the notes out of their canonical homes.

Separate recommendation notes referencing a media note are preferred when more
than one person may recommend the same work; recommender-specific fields then
belong to the recommendation rather than the media record.

## Phased Plan

### Phase 0 — Safety baseline and compatibility groundwork

- Define the compatibility baseline, migration/default behaviour, and fixture
  scenarios.
- Update the JSON schema for the existing format before documenting version-2
  additions.
- Record a manual validation plan and a pre-migration export.

Status: Completed. The schema and import fixtures now cover the compatibility
baseline; manual fixture validation passed.

### Phase 1 — Global identity and edge registry

- Allow edges between notes with different canonical parents.
- Preserve and migrate existing edge data safely.
- Build the project-wide source-note and parent identity indexes.
- Update edge-affecting operations plus save, export, and import to use one
  project-level registry.

The global registry, migration, contextual rendering, and destructive-operation
regressions are complete.

### Phase 2 — Context-aware edge rendering

- Render direct edges, boundary endpoints, and inspectable rolled-up edges
  from the global registry.
- Add canonical navigation for boundary endpoints and provenance disclosure for
  rolled-up summaries.
- Verify sibling, parent/child, and cousin edge contexts.

Status: Completed and manually validated.

### Phase 3 — Portal query model and editor

- Add the Portals editor section and query validation.
- Persist portal definitions and presentation defaults through import, save,
  export, and editor cancel.
- Provide a query-match preview using the project identity index.

### Phase 4 — Collapsed portal views

- Render native children plus deduplicated portal results in a note's view.
- Open the canonical source when a portal appearance is edited.
- Use automatic layout for portal results.

### Phase 5 — Expanded portals / dynamic search zones

- Add expand, collapse, draw, move, and resize interactions.
- Render portal results inside resizable canvas regions.
- Implement overlap/intersection placement and portal-instance handling for
  non-overlapping zones.
- Ensure live query updates do not alter canonical data or layouts.

### Phase 6 — Drop-to-update behaviour

- Add explicit drop-behaviour configuration to portal definitions.
- Preview valid drop effects while dragging.
- Apply compatible mutations atomically, resolve conflicts, and provide Undo.
- Leave zones with ambiguous queries read-only unless configured explicitly.

### Phase 7 — Visual language, hardening, and polish

- Establish a restrained visual distinction for native children, portal
  appearances, boundary endpoints, and rolled-up edges.
- Add portal/zone visibility toggles and accessibility affordances.
- Test dense graphs, deep nesting, mobile interactions, large result sets, and
  import/export round trips.

## Deferred Decisions

- Exact visual treatment for native versus portal membership.
- Whether portal result positions can later be manually pinned per context.
- Query scope across nesting depths and how users control it.
- Boundary-endpoint interaction: reveal in place, navigate, open a popover, or
  offer all three.
- A canvas-first interaction for creating a cross-context edge, if later user
  research shows the need.
- Rules for portal results that themselves contain native children or portals.
- Advanced query builder, saved query library, reference-field semantics, and
  full flat-graph migration.

## Success Criteria

- Nesting stays useful as a stable primary organization system.
- A note can participate in multiple contexts without copying or losing its
  canonical home.
- Users can build architecture overviews and then inspect exact child-level
  relationships.
- A portal definition and its expanded search zone behave identically apart
  from presentation; entering a note combines the results of its definitions.
- Zone overlap provides intelligible Venn-style filtering.
- Dragging into a configured zone offers a safe, reversible way to update note
  data.
- Cross-context edges remain understandable at overview and detail levels.
