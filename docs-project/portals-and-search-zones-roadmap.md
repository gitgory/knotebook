# Portals and Dynamic Search Zones Roadmap

Created: 2026-09-21
Status: Implementation underway. The edge foundation is implemented and
manually validated; portal and dynamic-search-zone work has not started.

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

Still pending before portals begin:

- A UI gesture for creating an edge to a note outside the active canvas.
- User-visible warning/confirmation for discarded invalid edges and
  cross-notebook move operations that remove edges.
- Regression checks for remote edges during parent deletion/promotion, nested
  subtree duplication, and moving a nested subtree between notebooks.

The Portals editor, portal queries/results, expanded zones, overlap layout,
and drop-to-update behavior remain unimplemented.

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

### 4. A dynamic search zone is an expanded portal

A portal has two presentations, with identical query, membership, editing, and
edge semantics:

| Presentation | Behaviour |
| --- | --- |
| Collapsed portal | Renders as one ordinary note. Entering it shows native children and portal results. |
| Expanded portal / dynamic search zone | Renders the same contents directly in a resizable region on the current canvas. |

Expanding or collapsing changes presentation only. It never changes source
notes, canonical homes, fields, or relationships. A zone therefore should not
be a parallel persisted feature that can drift away from portals.

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

Example: three overlapping zones with `media=show`, `location=Hulu`, and
`completion=notcomplete` reveal, in their triple overlap, unfinished Hulu shows.

### 9. Edges are global; views decide how to render them

An edge connects two real source-note IDs regardless of their canonical parents,
their depth in the hierarchy, or portal appearances. Cross-branch connections
are first-class; nesting must not restrict them.

Render rules:

| Endpoint visibility in a view | Rendering |
| --- | --- |
| Both notes are visible | Draw the real edge normally. |
| One note is visible | Draw to a labelled boundary endpoint, such as `Server / Step A`. Clicking it reveals or navigates to the remote source note. |
| Only descendant relationships are visible at a higher level | Draw a derived rolled-up edge between containers, with count and disclosure of the real links. |

An explicit user-created edge and a rolled-up edge must look different. A
rolled-up edge is a summary only; it must show its provenance rather than imply
that the containers themselves were explicitly connected.

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

### Phase 0 — Design and compatibility groundwork

- Define persisted portal configuration and expanded-presentation data.
- Define migration/default behaviour for existing notebooks.
- Specify query scope (current level versus recursive/global) and result
  de-duplication.
- Update the JSON schema and create fixture notebooks for the reference
  scenarios.

Status: Completed. The schema and import fixtures now cover the compatibility
baseline; manual fixture validation passed.

### Phase 1 — Global note references and cross-context edges

- Allow edges between notes with different canonical parents.
- Preserve and migrate existing edge data safely.
- Render direct edges, boundary endpoints, and inspectable rolled-up edges.
- Add tests for sibling, parent/child, cousin, and portal-context connections.

The storage migration and contextual renderers are complete. Cross-context
edge creation UI, visible destructive-operation feedback, and the remaining
destructive-operation regression cases are still pending.

### Phase 2 — Collapsed portal notes

- Add the Portals editor section and query validation.
- Render native children plus deduplicated portal results in a note's view.
- Open the canonical source when a portal appearance is edited.
- Use automatic layout for portal results.

### Phase 3 — Expanded portals / dynamic search zones

- Add expand, collapse, draw, move, and resize interactions.
- Render portal results inside resizable canvas regions.
- Implement overlap/intersection placement and portal-instance handling for
  non-overlapping zones.
- Ensure live query updates do not alter canonical data or layouts.

### Phase 4 — Drop-to-update behaviour

- Add explicit drop-behaviour configuration to portal definitions.
- Preview valid drop effects while dragging.
- Apply compatible mutations atomically, resolve conflicts, and provide Undo.
- Leave zones with ambiguous queries read-only unless configured explicitly.

### Phase 5 — Visual language and polish

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
- Rules for portal results that themselves contain native children or portals.
- Advanced query builder, saved query library, reference-field semantics, and
  full flat-graph migration.

## Success Criteria

- Nesting stays useful as a stable primary organization system.
- A note can participate in multiple contexts without copying or losing its
  canonical home.
- Users can build architecture overviews and then inspect exact child-level
  relationships.
- A portal note and an expanded search zone behave identically apart from
  presentation.
- Zone overlap provides intelligible Venn-style filtering.
- Dragging into a configured zone offers a safe, reversible way to update note
  data.
- Cross-context edges remain understandable at overview and detail levels.
