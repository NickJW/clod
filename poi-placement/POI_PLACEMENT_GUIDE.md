# POI Building Guide: from concept art to placed Synty prefabs

> **For:** the Claude agent connected to Unity over MCP, building points of interest (POIs) from
> concept art (an exterior view plus every interior room). The art was made with knowledge of our
> Synty library, so most objects in it map to a real prefab.
>
> **How to use this guide:** Part A is how to *think*: the concept art is the goal and you are the
> set dresser. Part B is the workflow. Part C is the checks that catch the common mistakes.
> The rules are there to stop mechanical errors (floating, clipping, gaps), not to stop you making
> good calls. When a rule and the concept art disagree, follow §A3.

---

## Part A: Principles

### A1. The concept art is the brief, not a suggestion
- Match **layout, composition and mood first**, then exact objects. Where the main pieces sit,
  what the eye sees first from the entrance, how full or empty each area is, and the overall
  silhouette matter more than whether a crate is 30 cm to the left.
- Every object you can identify in the art should exist in the scene, unless you log why
  not (§B6).
- **Don't add things the art doesn't show**, except what's needed for the space to work
  (§A3) or to fill an area the art clearly shows as "busy" but doesn't show in detail.

### A2. Think like a set dresser: everything is held up by something
Every object either rests on something, hangs from something, or is fixed to something. Before
placing anything, decide its **anchor**:

| Anchor | Examples | Must be |
|---|---|---|
| **Grounded** | furniture, crates, barrels, rugs, plants, characters' props | resting on the floor, terrain or another surface: no gap, not sunk in |
| **On-surface** | cups, books, candles, tools, plates | resting on a table, shelf or counter, inside its edges |
| **Wall** | paintings, wall shelves, torches, sconces, banners, signs, mounted weapons | backing flush against a wall, at a believable height |
| **Ceiling / hanging** | chandeliers, hanging lanterns, hanging plants, ropes | attached at the top (directly, or by a chain/rope that reaches the ceiling or a beam) |
| **Structure** | modular floors, walls, roofs, stairs, doors, windows, pillars | snapped to the modular grid, no gaps or overlaps between pieces |
| **Free** | intentionally floating things (magic orbs, dust, VFX) | only when the concept art clearly shows it |

### A3. When you need to use judgement
The art is a 2D picture of a 3D space. It will sometimes be impossible, ambiguous or unplayable.
You may deviate when:
- **It can't physically work.** The art implies overlapping objects, an impossible perspective,
  or a prefab that doesn't fit. Keep the *intent* and log the change.
- **The player has to fit.** Doorways, stairs and main paths must be walkable (see C2). Keep the
  look, but nudge furniture so paths stay clear.
- **There's no exact prefab.** Pick the closest match by *silhouette and size* first, then
  material and colour. You can kitbash two prefabs if the result clearly reads as the object in
  the art. Log the substitution.
- **The art doesn't show a part of the room.** Fill it in a style consistent with what *is*
  shown, at the same density.
Every deviation goes in the room's log (§B6) with a one-line reason.

### A4. Things that make a space look hand-built (do these)
- **Rotation variety for loose props:** rotate crates, barrels, chairs, books and bottles by a
  few to ±15° so nothing looks stamped. Don't do this for modular structure, which stays on 90°.
- **Clusters, not scatter:** group props in purposeful clusters (a desk with its chair, papers,
  candle and inkwell). Evenly spread clutter looks generated.
- **Logic of use:** chairs face their tables; beds against walls; tools near workbenches; light
  sources where people would need light.
- **Repetition with variation:** if 6 identical prefabs are visible together, swap some for
  variants or change rotation and scale slightly (uniform scale only, about ±5%).

---

## Part B: Workflow (per POI)

### B0. Measure, don't assume
Synty prefabs don't all share the same pivot or size. Before placing a type of prefab for the
first time, read its **renderer bounds** and **pivot position** (is the pivot at the bottom
centre, the bottom corner, or the middle?). Write the modular grid size you find (wall width,
floor tile size, storey height) at the top of the POI's log. Don't guess "it's probably 5 m".

### B1. Read the art and write a placement manifest *before* placing anything
If the art came with **room sheets** (see `CONCEPT_ART_BRIEF_FOR_CHATGPT.md`), start from them:
the sheet is the source of truth for **what** goes **where** (prefab names, counts, positions,
anchors), and the image is the source of truth for **how it looks** (composition, density, mood).
When they disagree, follow the sheet for positions and the image for look, and log it.

Either way, for each image (exterior and every room), write a short manifest in the POI's log:
```
Room: Tavern main hall   (art: tavern_interior_01.png)
Size estimate: ~12 x 8 m, one storey (door height ≈ 2.2 m used as scale reference)
Focal point: bar counter along the back wall with shelves of bottles behind
Zones: entrance (front-left) | bar (back) | seating (centre, 4 round tables) | fireplace (right wall)
Objects:
  - Bar counter        SM_Prop_Bar_Counter_01     Grounded   back wall, centre, ~6 m long (3 pieces)
  - Wall shelves ×3    SM_Prop_Shelf_Wall_02      Wall       behind bar, 1.4 m and 2.0 m high
  - Round table ×4     SM_Prop_Table_Round_01     Grounded   centre, loose 2×2 grid
  - Chandelier         SM_Prop_Chandelier_01      Ceiling    above centre
  ...
Open questions: right side of the art is cropped; I will extend the seating area.
```
- **Scale:** use a known object to set the scale: doors (about 2.0–2.2 m tall), a human figure
  (about 1.8 m), stair steps (about 0.2 m), chairs (seat about 0.45 m). Perspective in concept
  art squashes depth, so rooms are usually **deeper** than they look.
- Check that every prefab named in the manifest actually exists in the project before you start.

### B2. Build in passes, big to small
1. **Structure** (floors, walls, roof, stairs, doors, windows) on the grid. Check for gaps.
2. **Large furniture and focal pieces**: the things that define the layout.
3. **Medium props**: chairs, barrels, crates, shelves, wall items.
4. **Small dressing**: on-surface items, clutter, rugs.
5. **Lights and FX**: fit them to light sources in the art (fireplaces, lanterns, windows).
Run the audit (Part C) after passes 1, 3 and 4. Fixing problems early is much cheaper.

### B3. Place by snapping, not by typing numbers
- **Grounded / On-surface:** position it roughly, then **drop it**. Cast a ray down from above the
  object and set its lowest bound to the hit point (take the pivot offset into account). Never
  type a Y value from memory.
- **Wall:** cast a ray from the object towards the wall, then set the object so its back face
  touches the hit point, rotated to face along the wall's normal.
- **Ceiling:** cast upwards and attach the top of the object (or the top of its chain) to the hit.
- **Structure:** position = a multiple of the grid size measured in B0; Y rotation = multiple of 90°.
- The included `PoiPlacementAudit.cs` has a **Snap Selected** command that does the drop and wall
  snap for you (§C1).

### B4. Organise the hierarchy
```
POI_Tavern
  ├─ Exterior
  ├─ Room_MainHall
  │    ├─ Structure
  │    ├─ Furniture
  │    ├─ Props
  │    └─ Lights
  └─ Room_Cellar ...
```
Use prefab instances (not unpacked meshes) so they can be updated later.

### B5. Compare with the art, side by side
For each room: put the Scene camera at roughly the concept art's viewpoint (height, angle,
field of view) and take a screenshot. Then compare:
- Are the **focal point** and the **main masses** in the same place on screen?
- Is the **density** similar (full vs empty areas)?
- Are the **light sources** in the same places?
- List the **3 biggest differences** and fix them, or log why not. Repeat once.

### B6. Keep a log for each POI (`POI_<Name>_LOG.md`)
Grid measurements, the manifests, substitutions ("art shows a harp; no harp prefab, used
SM_Prop_Lute_01 on a stand"), intentional deviations, and the final audit result. It's short,
and it lets the next session continue without re-reading everything.

---

## Part C: Checks (the common mistakes and how to catch them)

### C1. Run the audit tool
Install: put `PoiAnchorTag.cs` anywhere in `Assets/` (**not** in an `Editor/` folder, because it
goes on scene objects), and `Editor/PoiPlacementAudit.cs` in any `Editor/` folder. First run
**Tools → POI → Set Grid Size From Selected Piece** with one modular wall piece selected. It adds:
- **Tools → POI → Audit Selected POI**: checks everything under the selected root and prints a
  report to the Console, grouped by problem, and selects the offending objects.
- **Tools → POI → Snap Selected (Ground/Wall/Ceiling)**: snaps the selected objects according to
  their anchor (Undo works).
- **Tools → POI → Mark Anchor ▸ …**: sets an object's anchor explicitly when the automatic guess
  (by name and size) is wrong. Add `Free` for things that are *meant* to float.

The goal is **zero errors**. Warnings are allowed when the log explains them. The report is also
written to `Logs/POI_Audit_<root name>.md` in the project folder, so you can read it directly.
The checks use temporary colliders and simple raycasts, so treat them as a strong hint, not
absolute truth: if a result looks wrong, look at the object, and if the check is wrong, tag the
object (`Mark Anchor`) or note it in the log rather than moving a correctly placed object.

### C2. Mistakes the audit catches
| Problem | Check |
|---|---|
| Floating objects | gap between a grounded object's bottom and the surface below > 2 cm |
| Sunk objects | object sunk into the surface below by > 5 cm (rugs and flat items are allowed less) |
| Wall items not touching the wall | gap to the nearest wall > 3 cm, or no wall within 50 cm |
| Hanging items not attached | no ceiling or beam above within 3 m |
| Objects passing through each other | penetration between two placed objects > 5 cm |
| Duplicates | two copies of the same prefab in nearly the same spot (a very common AI mistake) |
| Off-grid structure | modular pieces not on the measured grid, or Y rotation not a multiple of 90° |
| Odd scale | non-uniform scale, or uniform scale outside 0.8–1.25 (allowed but must be logged) |
| Unpacked meshes | placed objects that aren't prefab instances |

### C3. Mistakes to check yourself (the audit can't see these)
- **Facing direction:** chairs facing away from tables, beds facing into walls, wall items
  facing the wall, doors opening into a wall, signs readable from the street.
- **Blocked paths:** doors, stairs and corridors must have at least 1 m clear. If the project
  has a NavMesh, bake it and confirm every room is reachable.
- **Gaps in the shell:** light leaking through wall or roof seams; look from outside and
  inside with a dark sky.
- **Height sanity:** wall items at believable heights (paintings around eye height, about
  1.5–1.7 m centre; torches about 1.8–2.2 m); shelves reachable.
- **Interior and exterior match:** windows and doors in the same places from both sides, and the
  interior fits inside the exterior shell.
- **Lighting:** every lamp or fireplace has a light; nothing glows without a reason.

### C4. Final checklist for each room
- [ ] Manifest written; every identifiable object from the art placed or logged
- [ ] Audit: 0 errors; warnings explained in the log
- [ ] Side-by-side screenshot compared; top 3 differences fixed or logged
- [ ] Paths clear; doors and stairs usable
- [ ] Loose props have rotation variety; clusters make sense
- [ ] Log updated
