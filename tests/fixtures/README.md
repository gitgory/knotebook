# Portal and Edge Migration Fixtures

These fixtures support Phase 0 of the portals and dynamic-search-zones plan.
They are intentionally small enough to inspect and import by hand.

`node tests/global-edge-regressions.js` additionally checks the destructive
project-wide-edge cases without requiring a browser.

`node tests/portal-definition-regressions.js` checks portal-definition
normalization without requiring a browser.

## Files

| File | Purpose | Current import expectation |
| --- | --- | --- |
| `legacy-nested-edges.json` | Existing v1 nested notes with legacy array-format root and child edges. | Imports successfully; legacy edges render at their native level. |
| `system-architecture-baseline.json` | The User, UI, and Server example. UI and Server are separate parent notes with their own children. | Imports successfully with global cross-parent edges and renders their boundary/rolled-up representations outside a shared view. |
| `media-recommendations.json` | A separate recommendation-database notebook with custom fields for media, location, and recommender. | Imports successfully. It provides future portal/zone query examples. |
| `invalid-edge-endpoints.json` | Deliberately contains edges to missing note IDs. | Must never silently create phantom notes. Phase 1 should report/drop invalid edges predictably. |
| `duplicate-note-ids.json` | Deliberately contains two canonical notes with the same ID. | Import must reject it with a clear duplicate-ID error; it must not create a notebook. |

## System Architecture Scenario

`system-architecture-baseline.json` has three root-level notes: `User`, `UI`,
and `Server`. `UI` contains `Read`, `Write`, `Modify`, and `Request Job`.
`Server` contains `Step A`, `Step B`, `Step C`, and `Return Results`.

The intended future explicit edges are:

```text
Request Job -> Step A
Return Results -> Results for User
```

They are stored in the version-2 project-wide edge registry. Current rendering
shows boundary continuations when one endpoint is visible and inspectable
rolled-up summaries at overview level when neither endpoint is directly
visible.

## Recommendation Queries for Later Phases

After portal/zone support exists, use these example queries with
`media-recommendations.json`:

```text
media=show
location=Hulu
completion=todo
media=show AND location=Hulu AND completion=todo
recommendedBy=Sarah AND completion=todo
```

The first three queries are intended as three overlapping dynamic search zones.
Their geometric triple overlap should contain only notes matching the final
three-condition query.
