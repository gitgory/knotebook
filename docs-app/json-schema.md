# JSON Schema

This document describes Knotebook's current version-2 notebook format. Import
also accepts a few older shapes and normalizes them when a notebook opens.

Project File Structure (used for JSON export/import):
{
  "version": 2,
  "name": "Notebook Name",
  "created": "2026-01-21T12:00:00Z",
  "nodes": [ /* array of root-level notes */ ],
  "edges": [ /* array of { from, to, directed } edge objects */ ],
  "hashtagColors": {              // hashtag → hex color assignments
    "#hashtag-name": "#3b82f6"
  },
  "settings": {                   // per-notebook settings
    "fieldDefaults": { "completion": null, "priority": null },
    "customFields": []
  },
  "hiddenHashtags": []
}
Note Structure:
{
  "id": "note-1737489600000-1",
  "title": "Note Title",
  "content": "Note text content here with #hashtags",
  "hashtags": ["#hashtags"],      // parsed from content, sorted alphabetically
  "fields": {                     // unified first-class and custom field storage
    "completion": "todo",        // todo | partial | done | cancelled
    "priority": "high"
  },
  "position": { "x": 100, "y": 200 },
  "zIndex": 0,
  "children": [ /* nested note objects (same structure, recursive) */ ],
  "childEdges": [ /* edges between children: { from, to, directed } objects */ ],
  "created": "2026-01-21T12:00:00Z",
  "modified": "2026-01-21T12:00:00Z"
}

## Project properties

`nodes` is the root of the canonical nested note tree. In version 2, `edges`
is one project-wide registry: either endpoint may be any note in the nested
tree. `hashtagColors` maps normalized hashtags to hex colors.
`hiddenHashtags` hides tags from cards without removing them from data.

Browser localStorage additionally persists a `theme` string and a `viewport`
object (`{ x, y, zoom }`). They are honored on load but are not currently
included in portable JSON export.

## Edge format and legacy compatibility

The normalized edge form is:

```json
{ "from": "note-a", "to": "note-b", "directed": true }
```

`directed: true` renders an arrow from `from` to `to`; `false` is undirected.
Import also accepts the older array form below and migrates it to an
undirected object edge:

```json
["note-a", "note-b"]
```

Older notebooks may also store `completion` or `priority` directly on a note.
Those values migrate to `node.fields`; legacy completion values `no` and `yes`
migrate to `todo` and `done`.

## Settings

`settings.fieldDefaults` supplies values for newly created notes.
`settings.customFields` contains notebook-specific definitions with `id`,
`name`, `label`, `type`, and (where applicable) `options`. Supported current
UI types include text, single-select, and multi-select.

## Migration and import validation

Import validates the top-level project container. During version-1-to-version-2
migration, Knotebook recursively collects root edges and legacy `childEdges`,
normalizes/deduplicates them, and drops edges whose endpoint is missing or
self-referential. New saves and exports use only the root project-wide edge
registry; `childEdges` are removed from migrated notes.
