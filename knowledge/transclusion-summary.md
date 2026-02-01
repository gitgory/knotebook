# Transclusion Exploration

Date: 2026-01-26

## Key Insight: Persistent Search Zones as Transclusion Mechanism

Persistent Search Zones (from plan-outline, Tier 4 Spatial Organization) and transclusion converge into a single concept.

**The connection:** A zone is defined by search criteria (hashtags, keywords, etc.). Notes matching those criteria automatically appear in the zone. A note matching multiple zones appears in multiple spatial contexts — that's transclusion, driven by criteria rather than manual placement.

**Why this works:**
- **No manual linking.** You don't create references one by one. Define a zone's criteria and matching notes flow in automatically.
- **Venn behavior is free.** Notes matching overlapping zone criteria appear in the intersection. Emergent, no extra logic needed.
- **Hierarchy stays intact.** Notes keep a canonical home in the nesting tree. Zones are a layer on top — a spatial lens, not a replacement for structure. Fits the "hierarchy with exceptions" direction, except the exceptions are automatic.
- **Better design problem.** The challenge shifts from "how do you create a transclusion" (UI gesture) to "how do you define a zone's criteria" (builds on existing search/filter functionality).

**This collapses two planned features into one concept:** transclusion + persistent search zones = criteria-driven transclusion via spatial zones.

## Open Design Questions (for future sessions)

- How do you create/define a zone? (criteria UI, spatial placement)
- How do you visually distinguish a zone-transcluded note from a natively placed note?
- What happens when you interact with a transcluded note? (edit in place vs. navigate to source)
- What happens when a note stops matching a zone's criteria? (disappears from zone?)
- Flat reference vs. full portal?
- How do edges work for transcluded nodes? (independent per context, or shared?)
- How do zones interact with nesting levels? (zone sees only current level, or across depths?)
- Can zones overlap spatially on the canvas? How is that rendered?

## Watch Point

If a note commonly belongs in 5+ places, the "hierarchy with exceptions" model may strain — the exceptions outnumber the rule. Observe whether it's a small set of hub notes that appear everywhere, or whether most notes want multiple homes. That observation should inform the final design.

