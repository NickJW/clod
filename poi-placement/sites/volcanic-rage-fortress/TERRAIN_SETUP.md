# Volcanic Rage Fortress: terrain setup

> **For:** the Unity Claude. Read `TERRAIN_GUIDE.md` first; this file gives the exact values for
> this site. The source is `terrain-spec.json` from the handoff zip and `terrain-plan.png` in
> this folder.
> **Review result:** the geometry is consistent (plateau areas, building buffers, bridge end
> points and spans, channel clearances all re-checked). There is **one build hold: the bridge
> prefab** (§1). Resolve it before applying the terrain.

---

## 1. Build hold: the bridge prefab doesn't fit as-is

The spec names `SM_Bld_Drawbridge_01` (PolygonDarkFortress), with native bounds
**11.49 m wide × 19.33 m long**. The crossings are designed for a deck **10 m long × 6 m wide**:
a 6 m open gap plus 2 m resting on each bank, with 4 × 6 m landings.

At native size, centred on the crossing, the deck is 19.33 m long. It overhangs 4.7 m at each
end and runs into **R02** (B1, north end) and into **W1 and R08** (B2, both ends).

**The deck that fits:** usable length **10–14 m** (14 m reaches the building walls), width
**4–6 m**.

Measure first: the *usable walkable deck* in Unity, not just the mesh bounds (a drawbridge mesh
may include hinge or chain parts). Then choose, in this order:
1. **A different bridge or walkway prefab** from the packs we own whose deck is 10–14 m × 4–6 m.
   Best result, no scaling.
2. **Uniform-scale the drawbridge to about 0.52** (gives about 10.1 m × 6.0 m; the valid range is
   only 0.517–0.522). Check the planks don't look toy-sized next to the fortress, and record the
   scale in the POI log (the placement audit will flag it as a warning).
3. **Build the bridge from smaller pieces** (planks, beams, walkway sections) to 10 × 6 m.

Don't change the terrain to fit the native drawbridge. That would mean moving R02 and R08.

Set each bridge's `maxSpan` in the tool to the **measured usable deck length** (§3).

---

## 2. Coordinates and heights

- Sheet coordinates: metres from the site's south-west corner, X east, Z north.
- Sheet heights are relative to the surrounding ground (0). The tool uses **world** heights.
- **Easiest setup:** put the site so its ground is at **world Y = 0**. Then world heights equal the
  sheet heights and nothing needs converting.
- Create an empty `VRF_Origin` at the site's south-west corner (world `(X0, 0, Z0)`). Make every
  point object a child of it with **local position = (sheet x, 0, sheet z)**.
- If the ground must be at another world height **G**: add G to every height below, and put the
  terrain at Y = G − 8.

### Terrain object
From the spec: Y origin **−8**, height size **32** (so it can dig down to −8 and rise to +24),
heightmap resolution **1025**.
- If this is a **new terrain made for this POI**: size at least 144 × 128 m (bigger is fine for
  surroundings), position `(X0, −8, Z0)`, height 32. Set `flattenHeight = 0` and press
  **0. Flatten Whole Terrain**, then **1. Back Up Terrain**.
- If it's an **existing terrain**: check the ground across the site is at about world Y = 0 and the
  terrain's base is at or below −8 there. If not, stop and ask before changing it.

---

## 3. Values for `TerrainShapeSpec`

Common settings: `lavaSurfaceHeight = -2`, `removeTreesBelowLava = true`.

### Plateaus (topHeight 8, edgeWidth 1.5)
`edgeWidth` 1.5 m gives near-vertical cliffs (matching the section drawings) without jagged
steps at this resolution. The cliff faces get dressed with rock prefabs (§5).

| Name | Outline points (x, z), in order |
|---|---|
| P1 Southern approach | (8,12) (44,12) (44,40) (8,40) (8,35) (2,35) (2,29) (8,29) |
| P2 Western service fortress | (20,46) (54,46) (54,38) (72,38) (72,80) (64,88) (20,88) (14,78) |
| P3 Eastern boss fortress | (78,38) (120,38) (124,42) (124,100) (120,104) (82,104) (78,100) |

### Ramp
| Name | start (x, z) | end (x, z) | width | startHeight | endHeight | sideBlend |
|---|---|---|---|---|---|---|
| A1 Access ramp | (5, 5) | (5, 29) | 6 | 0 | 8 | 0.5 |

A 1:3 slope (about 18°). It joins P1's west tongue at z = 29.

### Channels (bedHeight −4)
Use the per-point width lists; each list must have the same number of values as there are
points.

| Name | Path points (x, z) | bedWidths | lavaWidths | topWidths |
|---|---|---|---|---|
| C1 Southern approach cut | (4,43) (20,43) (32,43) (44,43) (50,43) (50,30) (75,30) | 2,2,2,2,2,2,2 | 4,4,4,4,4,4,4 | 6,6,6,6,6,6,6 |
| C2 Main inter-plateau channel | (75,8) (75,30) (75,38) (75,100) (75,112) (75,120) | 8,8,2,2,8,8 | 10,10,4,4,10,10 | 14,14,6,6,14,14 |
| C3 Northern and eastern arm | (75,114) (112,114) (136,114) (136,84) (136,30) (138,16) | 6,6,6,6,6,6 | 8,8,8,8,8,8 | 12,12,12,12,12,12 |

Profile: flat bed at −4 → straight up to the lava line (−2) at the lava width → straight up to the
surrounding ground at the top width. Where a channel runs between plateaus, the "surrounding
ground" is the plateau top (+8), which gives the section drawn in the spec: (40, 8) (41, −2)
(42, −4) (44, −4) (45, −2) (46, 8).

### Bridges
| Name | endA (x, z) | endB (x, z) | maxSpan |
|---|---|---|---|
| B1 Outer bone causeway | (32, 38) | (32, 48) | measured usable deck length |
| B2 Inner rib crossing | (70, 45) | (80, 45) | measured usable deck length |

Validate compares `maxSpan` with the end-to-end distance (10 m), so it passes only when the
usable deck is at least 10 m. The open gap is 6 m and each end rests 2 m on its bank.

### Texture painting
Set the layer indices to the scorched/ash ground (plateau tops), dark cliff rock (slopes, using
`cliffAngle` 35) and cooled lava crust (channel beds) layers.

---

## 4. Order of work
1. Resolve the bridge (§1). Record the choice and measurements in the POI log.
2. Set up the terrain (§2), flatten if new, then back up.
3. Create `VRF_Origin` and the point children; fill in the values (§3).
4. **Apply → Validate.** Expected: **0 errors**. Expected warnings: none about edges at this
   resolution (spacing is about 0.14 m), possibly a ramp note. Fix anything else.
5. **Paint Textures**, then **Fit Lava Surface** with a lava material on a Plane (emissive; add
   a few warm point lights and ember/heat FX along the channels).
6. Dress every cliff face and bank with rock and cliff prefabs (§5).
7. Place the bridges, then build the rooms (R02–R10) and the W1 walkway following
   `POI_PLACEMENT_GUIDE.md` and the room sheets. Run the placement audit.
8. If the project uses a NavMesh: bake it and confirm the plateaus connect **only** through B1,
   B2 and the A1 ramp. The 8 m cliffs must not be walkable.

---

## 5. What the spec doesn't say (use judgement, log it)
- **Outer cliff faces:** the plateau edges that face open ground drop 8 m to ground level. Line
  them with Synty cliff and rock prefabs. Sink them slightly into the slope and leave no gaps
  where the terrain shows through as smooth slopes.
- **Ground strips:** there are thin strips of ground at 0 between some plateaus and channels
  (for example P3's east edge at x 124 and C3's bank at x 130). Dress them with rubble and
  scorched rocks so they read as volcanic ledges, not lawn.
- **Lava ends:** C2's south end (75, 8) and C3's south end (138, 16) stop in open ground. Add rock
  piles or a lava fall so they don't end as a plain round cap.
