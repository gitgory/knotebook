================================================================================
JSON SCHEMA
================================================================================

Project File Structure (used for JSON export/import):
{
  "version": 1,
  "name": "Notebook Name",
  "created": "2026-01-21T12:00:00Z",
  "nodes": [ /* array of root-level notes */ ],
  "edges": [ /* array of [nodeId, nodeId] pairs */ ],
  "hashtagColors": {              // hashtag → hex color assignments
    "#hashtag-name": "#3b82f6"
  },
  "settings": {                   // per-notebook settings
    "defaultCompletion": null     // null (no default) | "no" (new notes default to To do)
  }
}
Note Structure:
{
  "id": "note-1737489600000-1",
  "title": "Note Title",
  "content": "Note text content here with #hashtags",
  "hashtags": ["#hashtags"],      // parsed from content, sorted alphabetically
  "completion": null,             // null | "no" (To do) | "yes" (Done) | "partial"
  "position": { "x": 100, "y": 200 },
  "children": [ /* nested note objects (same structure, recursive) */ ],
  "childEdges": [ /* edges between children: [[id, id], ...] */ ],
  "created": "2026-01-21T12:00:00Z",
  "modified": "2026-01-21T12:00:00Z"
}