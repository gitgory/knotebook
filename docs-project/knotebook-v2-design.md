# knotebook v2 - Design Document

## Core Concept

Everything is a class instance. Notes are objects with fields, queries, and actions defined by their class.

**Inspiration:** "Python's everything-is-an-object, but for notes."

This approach solves transclusion by allowing notes to read, display, and interact with other notes based on their relationships. Fields become native attributes. Class definition notes interact with their instances to perform summaries and manipulations.

---

## Class Notes

- **Definition lives in the note body** - schema is the content itself
- **Single inheritance** - base `Note` class at root, user-defined hierarchy below
- **Live in their own canvas space** - not the main canvas, but have displayable content (dashboards of instances)
- **Define:**
  - Fields (schema)
  - Queries (saved searches, transcluded results)
  - Actions (generate outputs like mailto links)
- **Schema changes propagate** - add a field to class, all instances get it

### Example Classes
- PersonNote
- RecommendationNote
- JournalNote
- MediaSourceNote
  - BookNote
  - MovieNote

---

## Instance Notes

- Live on main canvas
- Linked to class via internal property
- Inherit structure and behavior from class
- Ctrl+Drag on a class note creates an instance

---

## Fields

### Types
- text
- date
- number
- boolean
- reference (single link to another note)
- reference[] (list of links)

### Connection Handles
- Reference fields become **connection handles** on nodes
- When dragging an edge to a node, available handles appear
- User chooses which field to connect to
- Example: Dragging "Dune" (BookNote) to "Alice" (PersonNote) shows handles for `recommends`, `howIKnowThem`, etc.

### Constraints (Optional)
- Fields can optionally constrain accepted classes
- Example: `siblings: PersonNote[]` only accepts PersonNote instances
- Default: any note can connect to any reference field

---

## Edges

- **Emerge from reference fields** - no separate edge-type system
- Edges are visualizations of field connections
- The field *is* the relationship type

---

## Queries

### Syntax
- **GraphQL** - well-documented, battle-tested, field selection built-in
- Implementation TBD: real GraphQL server vs. interpreted syntax

### Execution Context
- Defined on class, executed per-instance
- `this` refers to the instance running the query
- Class-level queries use `_instances` to query all instances

### Transclusion
- Query results are transcluded into the note
- Class notes become **living dashboards** of their instances
- Instance notes display related data inline

### Example Queries

**Instance-level (on PersonNote):**
```graphql
# Books this person recommends
recommends(where: { _class: "BookNote" }) {
  title
  author
  dateCompleted
}

# Siblings with birthdays this month
siblings(where: { birthday_month: $currentMonth }) {
  name
  birthday
}

# Reverse lookup: who recommends this person
_incoming(field: "recommends") {
  name
  _class
}
```

**Class-level (on BookNote class):**
```graphql
# All unread books
_instances(where: { dateCompleted: null }) {
  title
  author
  recommender: _incoming(field: "recommends") {
    name
  }
}
```

---

## Actions

- Generate outputs beyond query results
- Example: `emailLink` generates `mailto:{this.email}`
- More action types TBD

---

## UI

### What Changes
- Class browser in sidebar showing inheritance tree
- Connection handles visible when dragging edges to nodes
- Class notes have their own canvas space (dashboard view)

### What Stays
- Most of current knotebook UI can be kept
- Canvas-based graph visualization
- Node/edge interaction patterns
- Nesting model

---

## Open Questions

1. **GraphQL implementation** - real server vs. interpreted syntax? (Can defer)
2. **How do you create a class?** - UI flow for defining a new class
3. **How do you edit a class schema?** - UI for adding/removing fields, queries
4. **Multiple inheritance?** - Currently single inheritance. Multiple is powerful but complex.

---

## Visual Example

**Alice (PersonNote instance):**

```
+-----------------------------------------+
| Alice                      [PersonNote] |
+-----------------------------------------+
| name: Alice Chen                        |
| email: alice@email.com                  |
| birthday: March 15                      |
| relationship: friend                    |
+-----------------------------------------+
| [Email Alice] (mailto link)             |
+-----------------------------------------+
| > Siblings (2)                          |
|   - Bob                                 |
|   - Carol                               |
+-----------------------------------------+
| > Books Recommended (3)                 |
|   - Dune                                |
|   - Neuromancer                         |
|   - Snow Crash                          |
+-----------------------------------------+
```

Bottom sections are live queries. The mailto link is an action output.

---

## Conceptual Model Summary

```
Class Note
+-- Extends: [Parent Class]
+-- Fields
|   +-- name (text)
|   +-- email (text)
|   +-- birthday (date)
|   +-- recommends (reference[])
|   +-- siblings (PersonNote[])
+-- Queries
|   +-- booksRecommended: recommends where _class = BookNote
|   +-- siblingsThisMonth: siblings where birthday.month = current
|   +-- whoRecommendsMe: _incoming(field: "recommends")
+-- Actions
    +-- emailLink: "mailto:{this.email}"
```

---

## Comparisons

This model draws from:
- **Notion databases** - typed properties, templates, rollups
- **Roam** - block references, queries
- **Smalltalk** - "everything is an object"
- **Airtable** - field types, rollups, formulas
- **Entity-Component systems** - composition over inheritance

But differs by:
- Graph-native (edges are first-class, not just table relations)
- User-defined class hierarchy (not predefined database types)
- Queries transclude directly into notes (not separate views)
