# Phase 0 Fixture Validation

Date tested: 2026-09-21

This report records the manual validation completed before changing Knotebook's
edge persistence model. The fixture files are in this directory.

| Fixture | Result | Observed behavior |
| --- | --- | --- |
| `media-recommendations.json` | Pass | Six recommendations, custom fields, completion indicators, and the combined show/Hulu/todo query behaved as expected. |
| `system-architecture-baseline.json` | Pass | Root User/UI/Server overview and nested UI, Server, and User child views rendered as expected. The intentionally unsupported cross-parent edges were absent. |
| `legacy-nested-edges.json` | Pass | Legacy array-format root and child edges imported and rendered at their native levels. |
| `invalid-edge-endpoints.json` | Observed / baseline recorded | Imported successfully, created no phantom notes, rendered no malformed edges, and remained usable. No warning was shown. |

## Media recommendation query result

The query below returned exactly `The Bear` and `Reservation Dogs`:

```text
media=show AND location=Hulu AND completion=todo
```

## Phase 1 implication

The invalid-edge observation is not a final acceptance criterion. Current
behavior appears to hide unresolved edges at render time rather than validate
or remove them at import. The global edge migration must instead validate,
report, and deterministically drop invalid edges before saving migrated data.
