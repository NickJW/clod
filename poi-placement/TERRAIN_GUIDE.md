# Terrain Guide: shaping terrain around a POI to match concept art

> **For:** the Claude agent connected to Unity over MCP.
> **Short version:** don't sculpt with brushes. Describe the shapes as numbers and points, let
> `TerrainShapeSpec` apply them from a backup, check the result with **Validate**, then dress the
> edges with Synty rock and cliff prefabs.

## Why this approach
Brush sculpting through MCP goes badly: you can't feel the brush, strokes stack up, and results
are hard to judge or undo. Shapes defined as data are **exact, repeatable and reversible**:
- Plateaus = an outline + a top height + an edge blend width.
- Lava channels = a centre line + bed width + bed height + bank width.
- Bridges = two end points + the longest span the bridge prefab can cover.
Every Apply starts from the untouched backup, so you can move a point and re-apply as often as
you like without damage building up.

## Setup
1. Put `TerrainShapeSpec.cs` in `Assets/` (**not** an `Editor/` folder) and
   `Editor/TerrainShapeSpecEditor.cs` in an `Editor/` folder.
2. Create an empty GameObject `POI_<Name>_Terrain`, add `TerrainShapeSpec`, assign the Terrain.
3. Press **1. Back Up Terrain** before anything else.
4. Create child empty GameObjects for the points (`Plateau_A_01…`, `Lava_01_01…`, `Bridge_1_A/B`)
   and assign them in the component's lists. They show as coloured lines in the Scene view
   (green = plateaus, orange = channels, cyan = bridges).

## Workflow
1. **Get the numbers.** Use the terrain sheet from the concept art (see
   `CONCEPT_ART_BRIEF_FOR_CHATGPT.md`). It gives plateau outlines, heights, channel paths and
   widths, bridge positions, and an origin. Place an `Origin` empty at the site's origin and make
   the point objects children of it, so the sheet's coordinates can be typed in directly as local
   positions.
2. **Measure the bridge prefab first.** Find its usable span in Unity (end to end, minus the
   parts that need to rest on ground). Set `maxSpan` on each bridge. **Design the channel width
   at each crossing to fit the bridge,** not the other way round. If the art's gap is wider than
   any bridge, narrow the channel at the crossing (a "pinch point" looks natural) or chain
   pieces with a support pillar in the lava.
3. **Apply → Validate → adjust → re-apply** until Validate shows 0 errors:
   - plateau tops are flat (within 10 cm) where the fortress will stand
   - every channel point is below the lava surface
   - every bridge span fits, and both ends sit on solid ground at similar heights
4. **Paint Textures** (set the layer indices first): plateau tops, cliffs by slope, lava bed.
5. **Fit Lava Surface:** add a Plane with a lava material and press the button. It sits below the
   plateau tops, so it only shows in the channels. Add glow (emissive material, a few point
   lights or light probes) and heat or ember FX along the channels.
6. **Dress the edges with prefabs.** Heightmap terrain can't make vertical cliffs or overhangs,
   so it will look smooth and blobby on its own. Line the plateau edges and channel banks with
   Synty cliff, rock and rubble prefabs, sunk slightly into the slope, to give the dramatic
   silhouette the art shows. This is how Synty's own demo scenes are built.
7. **Place bridges** on the bridge end points, then build the fortress on the plateau tops using
   `POI_PLACEMENT_GUIDE.md`. Run its audit afterwards (prefab rocks count as Structure or Free).
8. **Bake the NavMesh** (if the project uses one) and check that the plateaus connect **only**
   by bridges, and that nothing walkable leads down into the lava unless intended.

## Rules of thumb
- **Big shapes come from terrain; detail and drama come from prefabs.**
- Keep `edgeWidth` and `bankWidth` at least 2 heightmap samples wide (the tool warns you).
  Steeper than that turns jagged; use cliff prefabs instead.
- Keep lava depth readable: bed about 1–2 m below the lava surface, and the lava surface
  well below the plateau tops (at least 4–8 m for drama).
- Leave room: about 1–2 m of flat ground between the fortress walls and a plateau edge, and flat
  landings at each bridge end.
- Only shape the area around the POI. Don't touch terrain far outside it.
- If the terrain is split into several tiles, run the tool once per tile, with a spec that
  covers that tile's part.
- If something looks wrong, **Restore Terrain From Backup** puts everything back.

## What to put in the POI log
Origin position, bridge prefab and measured span, every number you changed from the sheet and
why, the final Validate result, and before/after screenshots from the concept art's viewpoint.
