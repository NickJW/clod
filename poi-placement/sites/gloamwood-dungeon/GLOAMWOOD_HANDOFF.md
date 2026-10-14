# Gloamwood First Dungeon: handoff for the Unity Claude

> One file with everything you need, alongside the ChatGPT handoff zip.
> Sort it out like this:
> 1. Save the scripts in Part 3 as real files (paths given), let Unity compile, and fix any
>    compile errors. They were written outside Unity and have **never been compiled**.
> 2. Follow the guide in Part 2.
> 3. Part 4 (terrain) only applies if the dungeon has an outdoor entrance that needs the ground
>    reshaped. If it's all interior or underground, ignore Part 4.

---

## Part 1: The task

Build the Gloamwood first dungeon from the ChatGPT handoff zip.

1. Save and compile the scripts (Part 3). Fix any compile errors.
2. Follow the guide (Part 2), doing **steps B0–B1 only** first:
   - measure the modular pieces (grid size, wall height, pivots)
   - check that every prefab named in the room sheets exists in the project
   - write the manifests, substitutions and open questions into `POI_Gloamwood_LOG.md`
3. **Stop and show the log to the user before placing anything.**
4. When the user approves, build room by room (B2 onwards), and run the audit
   (Tools → POI → Audit Selected POI) after each room. The goal is 0 errors, with warnings
   explained in the log.

Not part of this task: the enemy generator spec (`DESIGN.md`) and the volcanic fortress files.

---

## Part 2: The guide

## POI Building Guide: from concept art to placed Synty prefabs

> **For:** the Claude agent connected to Unity over MCP, building points of interest (POIs) from
> concept art (an exterior view plus every interior room). The art was made with knowledge of our
> Synty library, so most objects in it map to a real prefab.
>
> **How to use this guide:** Part A is how to *think*: the concept art is the goal and you are the
> set dresser. Part B is the workflow. Part C is the checks that catch the common mistakes.
> The rules are there to stop mechanical errors (floating, clipping, gaps), not to stop you making
> good calls. When a rule and the concept art disagree, follow §A3.

---

### Part A: Principles

#### A1. The concept art is the brief, not a suggestion
- Match **layout, composition and mood first**, then exact objects. Where the main pieces sit,
  what the eye sees first from the entrance, how full or empty each area is, and the overall
  silhouette matter more than whether a crate is 30 cm to the left.
- Every object you can identify in the art should exist in the scene, unless you log why
  not (§B6).
- **Don't add things the art doesn't show**, except what's needed for the space to work
  (§A3) or to fill an area the art clearly shows as "busy" but doesn't show in detail.

#### A2. Think like a set dresser: everything is held up by something
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

#### A3. When you need to use judgement
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

#### A4. Things that make a space look hand-built (do these)
- **Rotation variety for loose props:** rotate crates, barrels, chairs, books and bottles by a
  few to ±15° so nothing looks stamped. Don't do this for modular structure, which stays on 90°.
- **Clusters, not scatter:** group props in purposeful clusters (a desk with its chair, papers,
  candle and inkwell). Evenly spread clutter looks generated.
- **Logic of use:** chairs face their tables; beds against walls; tools near workbenches; light
  sources where people would need light.
- **Repetition with variation:** if 6 identical prefabs are visible together, swap some for
  variants or change rotation and scale slightly (uniform scale only, about ±5%).

---

### Part B: Workflow (per POI)

#### B0. Measure, don't assume
Synty prefabs don't all share the same pivot or size. Before placing a type of prefab for the
first time, read its **renderer bounds** and **pivot position** (is the pivot at the bottom
centre, the bottom corner, or the middle?). Write the modular grid size you find (wall width,
floor tile size, storey height) at the top of the POI's log. Don't guess "it's probably 5 m".

#### B1. Read the art and write a placement manifest *before* placing anything
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

#### B1b. Terrain first, if the POI needs it
If the site needs plateaus, valleys, channels or cliffs, follow `TERRAIN_GUIDE.md` **before**
placing any structure. Don't sculpt with brushes; use the terrain sheet and `TerrainShapeSpec`.

#### B2. Build in passes, big to small
1. **Structure** (floors, walls, roof, stairs, doors, windows) on the grid. Check for gaps.
2. **Large furniture and focal pieces**: the things that define the layout.
3. **Medium props**: chairs, barrels, crates, shelves, wall items.
4. **Small dressing**: on-surface items, clutter, rugs.
5. **Lights and FX**: fit them to light sources in the art (fireplaces, lanterns, windows).
Run the audit (Part C) after passes 1, 3 and 4. Fixing problems early is much cheaper.

#### B3. Place by snapping, not by typing numbers
- **Grounded / On-surface:** position it roughly, then **drop it**. Cast a ray down from above the
  object and set its lowest bound to the hit point (take the pivot offset into account). Never
  type a Y value from memory.
- **Wall:** cast a ray from the object towards the wall, then set the object so its back face
  touches the hit point, rotated to face along the wall's normal.
- **Ceiling:** cast upwards and attach the top of the object (or the top of its chain) to the hit.
- **Structure:** position = a multiple of the grid size measured in B0; Y rotation = multiple of 90°.
- The included `PoiPlacementAudit.cs` has a **Snap Selected** command that does the drop and wall
  snap for you (§C1).

#### B4. Organise the hierarchy
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

#### B5. Compare with the art, side by side
For each room: put the Scene camera at roughly the concept art's viewpoint (height, angle,
field of view) and take a screenshot. Then compare:
- Are the **focal point** and the **main masses** in the same place on screen?
- Is the **density** similar (full vs empty areas)?
- Are the **light sources** in the same places?
- List the **3 biggest differences** and fix them, or log why not. Repeat once.

#### B6. Keep a log for each POI (`POI_<Name>_LOG.md`)
Grid measurements, the manifests, substitutions ("art shows a harp; no harp prefab, used
SM_Prop_Lute_01 on a stand"), intentional deviations, and the final audit result. It's short,
and it lets the next session continue without re-reading everything.

---

### Part C: Checks (the common mistakes and how to catch them)

#### C1. Run the audit tool
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

#### C2. Mistakes the audit catches
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

#### C3. Mistakes to check yourself (the audit can't see these)
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

#### C4. Final checklist for each room
- [ ] Manifest written; every identifiable object from the art placed or logged
- [ ] Audit: 0 errors; warnings explained in the log
- [ ] Side-by-side screenshot compared; top 3 differences fixed or logged
- [ ] Paths clear; doors and stairs usable
- [ ] Loose props have rotation variety; clusters make sense
- [ ] Log updated

---

## Part 3: Scripts (save as files, then compile)

### `Assets/<any folder, NOT Editor>/PoiAnchorTag.cs`

```csharp
using UnityEngine;

// How a placed object is held up. Used by PoiPlacementAudit (Editor) to pick the right check.
public enum PoiAnchor { Auto, Grounded, OnSurface, Wall, Ceiling, Structure, Free }

// Optional: put this on a placed object when the automatic guess (by name and size) is wrong,
// or to mark something as intentionally floating (Free). Keep this file OUTSIDE any Editor folder.
[DisallowMultipleComponent]
public class PoiAnchorTag : MonoBehaviour
{
    public PoiAnchor anchor = PoiAnchor.Auto;

    [Tooltip("Why this object is allowed to break a rule. Shown in the audit report.")]
    public string note;
}
```

### `Assets/<any folder>/Editor/PoiPlacementAudit.cs`

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;
using Object = UnityEngine.Object;

// POI placement audit: measures the common set-dressing mistakes (floating, sunk, off-wall,
// unattached hanging items, objects passing through each other, duplicates, off-grid structure,
// odd scale, unpacked meshes) for everything under the selected POI root.
//
// Menu: Tools > POI > ...
// Temporary MeshColliders are added to collider-less meshes near the POI while measuring and are
// removed again afterwards, so results don't depend on which prefabs ship with colliders.
public static class PoiPlacementAudit
{
    // ---- Tolerances (metres). Tune here, and note changes in the POI log. ----
    const float FloatTolerance = 0.02f;       // gap under a grounded object
    const float SinkTolerance = 0.05f;        // sunk into the surface below
    const float FlatSinkTolerance = 0.01f;    // for rugs and other flat items
    const float FlatHeight = 0.06f;           // objects thinner than this count as flat
    const float WallGapTolerance = 0.03f;     // gap between a wall item and its wall
    const float WallSearch = 0.5f;            // how far to look for a wall
    const float CeilingSearch = 3f;           // how far up to look for a ceiling or beam
    const float CeilingGapTolerance = 0.03f;
    const float PenetrationTolerance = 0.05f; // two objects passing through each other
    const float DuplicateDistance = 0.05f;
    const float SmallObjectSize = 0.35f;      // largest dimension below this → OnSurface by default
    const string GridPrefKey = "PoiAudit.GridSize";

    static readonly string[] CeilingWords = { "Chandelier", "Hanging", "Hang_", "Ceiling_Light", "CeilingLight", "Pendant" };
    static readonly string[] WallWords = { "Painting", "Picture", "Frame", "Shelf_Wall", "Wall_Shelf", "Torch_Wall", "Wall_Torch",
        "Sconce", "Banner", "Sign", "Mirror", "Plaque", "Mounted", "Trophy", "Wall_Lamp", "Wall_Light", "Clock_Wall",
        "Poster", "Tapestry", "Wall_Hook", "Wall_Rack", "Weapon_Rack_Wall" };
    static readonly string[] StructureWords = { "Wall", "Floor", "Roof", "Stair", "Door", "Window", "Pillar", "Column",
        "Beam", "Foundation", "Ceiling", "Railing", "Balcony" };

    enum Severity { Error, Warning, Info }

    class Issue
    {
        public Severity severity; public string category; public string message; public GameObject target;
    }

    class Placeable
    {
        public GameObject go; public string sourceName; public PoiAnchor anchor; public Bounds bounds;
        public HashSet<Collider> colliders; public bool isPrefab; public string note;
    }

    // ------------------------------------------------------------------ Menu

    [MenuItem("Tools/POI/Audit Selected POI")]
    static void AuditMenu()
    {
        var root = Selection.activeGameObject;
        if (root == null) { Debug.LogWarning("[POI Audit] Select the POI root GameObject first."); return; }
        Audit(root, writeReport: true);
    }

    [MenuItem("Tools/POI/Snap Selected (Ground, Wall, Ceiling)")]
    static void SnapMenu()
    {
        var targets = new List<GameObject>();
        foreach (var go in Selection.gameObjects) targets.Add(OutermostPlaceable(go));
        if (targets.Count == 0) { Debug.LogWarning("[POI Audit] Select the objects to snap."); return; }

        var area = CombinedBounds(targets);
        using (new TempColliders(area))
        {
            foreach (var go in targets)
            {
                var p = MakePlaceable(go);
                if (p == null) continue;
                Undo.RecordObject(go.transform, "POI Snap");
                switch (p.anchor)
                {
                    case PoiAnchor.Grounded:
                    case PoiAnchor.OnSurface:
                        if (TryGroundGap(p, out float g, out _)) go.transform.position += Vector3.down * g;
                        break;
                    case PoiAnchor.Wall:
                        if (TryWallGap(p, out float w, out Vector3 dir)) go.transform.position += dir * w;
                        break;
                    case PoiAnchor.Ceiling:
                        if (TryCeilingGap(p, out float c)) go.transform.position += Vector3.up * c;
                        break;
                    default:
                        Debug.Log($"[POI Audit] {go.name}: anchor {p.anchor} is not snapped automatically.", go);
                        break;
                }
                Physics.SyncTransforms();
            }
        }
    }

    [MenuItem("Tools/POI/Set Grid Size From Selected Piece")]
    static void SetGridMenu()
    {
        var go = Selection.activeGameObject;
        if (go == null) { Debug.LogWarning("[POI Audit] Select one modular wall or floor piece."); return; }
        var b = RendererBounds(go);
        float size = Mathf.Round(Mathf.Max(b.size.x, b.size.z) * 100f) / 100f;
        EditorPrefs.SetFloat(GridPrefKey, size);
        Debug.Log($"[POI Audit] Grid size set to {size} m (from {go.name}). Record this in the POI log.");
    }

    [MenuItem("Tools/POI/Clear Grid Size")]
    static void ClearGridMenu() { EditorPrefs.DeleteKey(GridPrefKey); Debug.Log("[POI Audit] Grid check disabled."); }

    [MenuItem("Tools/POI/Mark Anchor/Auto")] static void MarkAuto() => Mark(PoiAnchor.Auto);
    [MenuItem("Tools/POI/Mark Anchor/Grounded")] static void MarkGrounded() => Mark(PoiAnchor.Grounded);
    [MenuItem("Tools/POI/Mark Anchor/On Surface")] static void MarkSurface() => Mark(PoiAnchor.OnSurface);
    [MenuItem("Tools/POI/Mark Anchor/Wall")] static void MarkWall() => Mark(PoiAnchor.Wall);
    [MenuItem("Tools/POI/Mark Anchor/Ceiling")] static void MarkCeiling() => Mark(PoiAnchor.Ceiling);
    [MenuItem("Tools/POI/Mark Anchor/Structure")] static void MarkStructure() => Mark(PoiAnchor.Structure);
    [MenuItem("Tools/POI/Mark Anchor/Free (intentionally floating)")] static void MarkFree() => Mark(PoiAnchor.Free);

    static void Mark(PoiAnchor anchor)
    {
        foreach (var sel in Selection.gameObjects)
        {
            var go = OutermostPlaceable(sel);
            var tag = go.GetComponent<PoiAnchorTag>();
            if (tag == null) tag = Undo.AddComponent<PoiAnchorTag>(go); // explicit null check: Unity objects don't work with ??
            Undo.RecordObject(tag, "POI Mark Anchor");
            tag.anchor = anchor;
        }
    }

    // ------------------------------------------------------------------ Audit

    /// <summary>Audits everything under <paramref name="root"/>. Returns the number of errors.</summary>
    public static int Audit(GameObject root, bool writeReport)
    {
        var placeables = new List<Placeable>();
        Collect(root.transform, placeables);
        var issues = new List<Issue>();
        float grid = EditorPrefs.GetFloat(GridPrefKey, 0f);

        var area = RendererBounds(root);
        area.Expand(10f);

        using (new TempColliders(area))
        {
            // Colliders are only known after the temporary ones exist.
            foreach (var p in placeables) p.colliders = new HashSet<Collider>(p.go.GetComponentsInChildren<Collider>(false));

            foreach (var p in placeables)
            {
                CheckAnchor(p, issues);
                CheckScale(p, issues);
                if (p.anchor == PoiAnchor.Structure) CheckGrid(p, root.transform, grid, issues);
                if (!p.isPrefab)
                    Add(issues, Severity.Info, "Unpacked mesh", p.go, "not a prefab instance (harder to update later)");
            }
            CheckPairs(placeables, issues);
        }

        Report(root, placeables.Count, issues, writeReport);
        int errors = 0;
        foreach (var i in issues) if (i.severity == Severity.Error) errors++;
        return errors;
    }

    static void CheckAnchor(Placeable p, List<Issue> issues)
    {
        switch (p.anchor)
        {
            case PoiAnchor.Grounded:
            case PoiAnchor.OnSurface:
            {
                if (!TryGroundGap(p, out float gap, out bool onTerrain))
                {
                    Add(issues, Severity.Error, "Floating", p.go, "nothing underneath it within 3 m");
                    break;
                }
                float sinkTol = p.bounds.size.y < FlatHeight ? FlatSinkTolerance : SinkTolerance;
                if (gap > FloatTolerance)
                    Add(issues, Severity.Error, "Floating", p.go, $"{gap * 100f:0.#} cm above the surface below");
                else if (gap < -sinkTol)
                    Add(issues, onTerrain ? Severity.Warning : Severity.Error, "Sunk", p.go,
                        $"{-gap * 100f:0.#} cm into the surface below{(onTerrain ? " (terrain; may be fine on a slope)" : "")}");
                break;
            }
            case PoiAnchor.Wall:
            {
                if (!TryWallGap(p, out float gap, out _))
                    Add(issues, Severity.Error, "Off wall", p.go, $"no wall within {WallSearch * 100f:0} cm");
                else if (gap > WallGapTolerance)
                    Add(issues, Severity.Error, "Off wall", p.go, $"{gap * 100f:0.#} cm away from the wall");
                else if (gap < -PenetrationTolerance)
                    Add(issues, Severity.Warning, "Into wall", p.go, $"{-gap * 100f:0.#} cm into the wall");
                break;
            }
            case PoiAnchor.Ceiling:
            {
                if (!TryCeilingGap(p, out float gap))
                    Add(issues, Severity.Error, "Unattached", p.go, $"nothing above to hang from within {CeilingSearch} m");
                else if (gap > CeilingGapTolerance)
                    Add(issues, Severity.Warning, "Unattached", p.go,
                        $"top is {gap * 100f:0.#} cm below the ceiling; fine only if a chain or rope reaches it");
                break;
            }
            case PoiAnchor.Structure:
            case PoiAnchor.Free:
            case PoiAnchor.Auto:
                break;
        }
    }

    static void CheckScale(Placeable p, List<Issue> issues)
    {
        var s = p.go.transform.lossyScale;
        float max = Mathf.Max(Mathf.Abs(s.x), Mathf.Abs(s.y), Mathf.Abs(s.z));
        float min = Mathf.Min(Mathf.Abs(s.x), Mathf.Abs(s.y), Mathf.Abs(s.z));
        if (min <= 0f) { Add(issues, Severity.Error, "Scale", p.go, "zero scale"); return; }
        if (max / min > 1.01f)
            Add(issues, Severity.Warning, "Scale", p.go, $"non-uniform scale {s}; stretches the low-poly detail");
        else if (max < 0.8f || max > 1.25f)
            Add(issues, Severity.Warning, "Scale", p.go, $"scaled to {max:0.##}x; log the reason if intended");
        if (s.x < 0f || s.y < 0f || s.z < 0f)
            Add(issues, Severity.Warning, "Scale", p.go, "negative (mirrored) scale; check lighting and normals");
    }

    static void CheckGrid(Placeable p, Transform root, float grid, List<Issue> issues)
    {
        var e = (Quaternion.Inverse(root.rotation) * p.go.transform.rotation).eulerAngles;
        if (Mathf.Abs(Mathf.DeltaAngle(e.y, Mathf.Round(e.y / 90f) * 90f)) > 0.5f)
            Add(issues, Severity.Error, "Off grid", p.go, $"Y rotation {e.y:0.#}° is not a multiple of 90°");
        if (Mathf.Abs(Mathf.DeltaAngle(e.x, 0f)) > 0.5f || Mathf.Abs(Mathf.DeltaAngle(e.z, 0f)) > 0.5f)
            Add(issues, Severity.Warning, "Off grid", p.go, $"tilted (X {e.x:0.#}°, Z {e.z:0.#}°)");
        if (grid <= 0f) return;

        var local = root.InverseTransformPoint(p.go.transform.position);
        float offX = Mathf.Abs(local.x - Mathf.Round(local.x / grid) * grid);
        float offZ = Mathf.Abs(local.z - Mathf.Round(local.z / grid) * grid);
        // Accept pieces on the grid or on half-grid steps (corners and centred pivots).
        float half = grid * 0.5f;
        bool onX = offX < 0.01f || Mathf.Abs(offX - half) < 0.01f;
        bool onZ = offZ < 0.01f || Mathf.Abs(offZ - half) < 0.01f;
        if (!onX || !onZ)
            Add(issues, Severity.Error, "Off grid", p.go, $"position {local} is not on the {grid} m grid");
    }

    static void CheckPairs(List<Placeable> placeables, List<Issue> issues)
    {
        for (int i = 0; i < placeables.Count; i++)
        {
            var a = placeables[i];
            for (int j = i + 1; j < placeables.Count; j++)
            {
                var b = placeables[j];

                // Duplicates: same source, same spot.
                if (a.sourceName == b.sourceName &&
                    Vector3.Distance(a.go.transform.position, b.go.transform.position) < DuplicateDistance &&
                    Quaternion.Angle(a.go.transform.rotation, b.go.transform.rotation) < 5f)
                {
                    Add(issues, Severity.Error, "Duplicate", b.go, $"same prefab in the same spot as {a.go.name}");
                    continue;
                }

                if (a.anchor == PoiAnchor.Free || b.anchor == PoiAnchor.Free) continue;
                if (a.anchor == PoiAnchor.Structure && b.anchor == PoiAnchor.Structure) continue; // modular seams overlap by design
                if (!a.bounds.Intersects(b.bounds)) continue;

                float depth = MaxPenetration(a, b, out Vector3 dir);
                if (depth <= PenetrationTolerance) continue;
                // Vertical overlap with a floor is already covered by the Sunk check.
                bool structurePair = a.anchor == PoiAnchor.Structure || b.anchor == PoiAnchor.Structure;
                if (structurePair && Mathf.Abs(dir.y) > 0.7f) continue;

                Add(issues, Severity.Error, "Intersecting", b.go, $"passes {depth * 100f:0.#} cm into {a.go.name}");
            }
        }
    }

    // ------------------------------------------------------------------ Measurements

    // Signed gap between the object's lowest point and the nearest surface below it.
    // Positive = floating, negative = sunk. Samples the centre and four inset corners and uses the
    // best-supported point, so objects on uneven ground or with legs measure sensibly.
    static bool TryGroundGap(Placeable p, out float gap, out bool onTerrain)
    {
        var b = p.bounds;
        float lift = Mathf.Max(0.1f, Mathf.Min(b.size.y * 0.5f, 0.5f));
        var e = b.extents * 0.6f;
        var samples = new[]
        {
            new Vector3(b.center.x, 0, b.center.z),
            new Vector3(b.center.x + e.x, 0, b.center.z + e.z), new Vector3(b.center.x - e.x, 0, b.center.z + e.z),
            new Vector3(b.center.x + e.x, 0, b.center.z - e.z), new Vector3(b.center.x - e.x, 0, b.center.z - e.z),
        };

        gap = float.MaxValue; onTerrain = false; bool found = false;
        foreach (var s in samples)
        {
            var origin = new Vector3(s.x, b.min.y + lift, s.z);
            if (!Cast(origin, Vector3.down, lift + 3f, p.colliders, out var hit)) continue;
            float g = b.min.y - hit.point.y;
            if (g < gap) { gap = g; onTerrain = hit.collider is TerrainCollider; }
            found = true;
        }
        return found;
    }

    // Gap between the object's side and the nearest wall, checking the four horizontal directions.
    static bool TryWallGap(Placeable p, out float gap, out Vector3 dirToWall)
    {
        var b = p.bounds;
        var t = p.go.transform;
        var f = Vector3.ProjectOnPlane(t.forward, Vector3.up).normalized;
        var r = Vector3.ProjectOnPlane(t.right, Vector3.up).normalized;
        if (f == Vector3.zero) f = Vector3.forward;
        if (r == Vector3.zero) r = Vector3.right;

        gap = float.MaxValue; dirToWall = Vector3.zero; bool found = false;
        foreach (var d in new[] { -f, f, r, -r })
        {
            float extent = Mathf.Abs(d.x) * b.extents.x + Mathf.Abs(d.z) * b.extents.z;
            if (!Cast(b.center, d, extent + WallSearch, p.colliders, out var hit)) continue;
            float g = hit.distance - extent;
            if (g < gap) { gap = g; dirToWall = d; found = true; }
        }
        return found;
    }

    static bool TryCeilingGap(Placeable p, out float gap)
    {
        var b = p.bounds;
        var origin = new Vector3(b.center.x, b.max.y - 0.05f, b.center.z);
        gap = 0f;
        if (!Cast(origin, Vector3.up, CeilingSearch + 0.05f, p.colliders, out var hit)) return false;
        gap = hit.point.y - b.max.y;
        return true;
    }

    static bool Cast(Vector3 origin, Vector3 dir, float distance, HashSet<Collider> ignore, out RaycastHit best)
    {
        best = default;
        float bestDistance = float.MaxValue;
        bool found = false;
        foreach (var h in Physics.RaycastAll(origin, dir, distance, ~0, QueryTriggerInteraction.Ignore))
        {
            if (ignore != null && ignore.Contains(h.collider)) continue;
            if (h.distance < bestDistance) { bestDistance = h.distance; best = h; found = true; }
        }
        return found;
    }

    // PhysX can't compute penetration between two non-convex meshes, so the smaller object's
    // mesh colliders are made convex for the test and restored afterwards.
    static float MaxPenetration(Placeable a, Placeable b, out Vector3 direction)
    {
        var small = a.bounds.size.sqrMagnitude <= b.bounds.size.sqrMagnitude ? a : b;
        var big = small == a ? b : a;
        var restore = new List<MeshCollider>();
        float max = 0f;
        direction = Vector3.zero;
        try
        {
            foreach (var c in small.colliders)
                if (c is MeshCollider mc && !mc.convex && mc.sharedMesh != null) { mc.convex = true; restore.Add(mc); }

            foreach (var ca in small.colliders)
            foreach (var cb in big.colliders)
            {
                if (ca == null || cb == null || !ca.enabled || !cb.enabled || ca.isTrigger || cb.isTrigger) continue;
                if (!ca.bounds.Intersects(cb.bounds)) continue;
                if (cb is MeshCollider bm && !bm.convex && !(ca is MeshCollider am && am.convex) && !(ca is BoxCollider || ca is SphereCollider || ca is CapsuleCollider))
                    continue;
                if (Physics.ComputePenetration(ca, ca.transform.position, ca.transform.rotation,
                        cb, cb.transform.position, cb.transform.rotation, out var dir, out float d) && d > max)
                {
                    max = d; direction = dir;
                }
            }
        }
        finally
        {
            foreach (var mc in restore) if (mc != null) mc.convex = false;
        }
        return max;
    }

    // ------------------------------------------------------------------ Collection & classification

    static void Collect(Transform t, List<Placeable> into)
    {
        foreach (Transform child in t)
        {
            if (!child.gameObject.activeInHierarchy) continue;
            var go = child.gameObject;
            bool isPlaceable = go.GetComponent<PoiAnchorTag>() != null
                               || PrefabUtility.IsAnyPrefabInstanceRoot(go)
                               || go.GetComponent<MeshRenderer>() != null;
            if (isPlaceable)
            {
                var p = MakePlaceable(go);
                if (p != null) into.Add(p);
            }
            else Collect(child, into); // an empty group: look inside
        }
    }

    static Placeable MakePlaceable(GameObject go)
    {
        var bounds = RendererBounds(go);
        if (bounds.size == Vector3.zero) return null;
        var source = PrefabUtility.GetCorrespondingObjectFromOriginalSource(go);
        var tag = go.GetComponent<PoiAnchorTag>();
        var p = new Placeable
        {
            go = go,
            sourceName = source != null ? source.name : go.name,
            bounds = bounds,
            isPrefab = PrefabUtility.IsPartOfPrefabInstance(go),
            note = tag != null ? tag.note : null,
            colliders = new HashSet<Collider>(go.GetComponentsInChildren<Collider>(false)),
        };
        p.anchor = tag != null && tag.anchor != PoiAnchor.Auto ? tag.anchor : GuessAnchor(p.sourceName, bounds);
        return p;
    }

    static PoiAnchor GuessAnchor(string name, Bounds b)
    {
        if (ContainsAny(name, CeilingWords)) return PoiAnchor.Ceiling;
        if (ContainsAny(name, WallWords)) return PoiAnchor.Wall;
        if (name.StartsWith("SM_Bld_", StringComparison.OrdinalIgnoreCase) || ContainsAny(name, StructureWords))
            return PoiAnchor.Structure;
        float largest = Mathf.Max(b.size.x, b.size.y, b.size.z);
        return largest < SmallObjectSize ? PoiAnchor.OnSurface : PoiAnchor.Grounded;
    }

    static bool ContainsAny(string s, string[] words)
    {
        foreach (var w in words) if (s.IndexOf(w, StringComparison.OrdinalIgnoreCase) >= 0) return true;
        return false;
    }

    static GameObject OutermostPlaceable(GameObject go)
    {
        // Nearest, not outermost: the whole POI may itself be saved as a prefab.
        var root = PrefabUtility.GetNearestPrefabInstanceRoot(go);
        return root != null ? root : go;
    }

    static Bounds RendererBounds(GameObject go)
    {
        bool has = false;
        var b = new Bounds(go.transform.position, Vector3.zero);
        foreach (var r in go.GetComponentsInChildren<Renderer>(false))
        {
            if (!(r is MeshRenderer || r is SkinnedMeshRenderer)) continue; // skip particles, lines, etc.
            if (!has) { b = r.bounds; has = true; } else b.Encapsulate(r.bounds);
        }
        return b;
    }

    static Bounds CombinedBounds(List<GameObject> gos)
    {
        var b = RendererBounds(gos[0]);
        for (int i = 1; i < gos.Count; i++) b.Encapsulate(RendererBounds(gos[i]));
        b.Expand(10f);
        return b;
    }

    // ------------------------------------------------------------------ Reporting

    static void Add(List<Issue> issues, Severity s, string category, GameObject go, string message) =>
        issues.Add(new Issue { severity = s, category = category, target = go, message = message });

    static void Report(GameObject root, int count, List<Issue> issues, bool writeFile)
    {
        issues.Sort((x, y) => x.severity != y.severity ? x.severity.CompareTo(y.severity) : string.CompareOrdinal(x.category, y.category));
        int errors = 0, warnings = 0, infos = 0;
        var sb = new StringBuilder();
        sb.AppendLine($"# POI audit: {root.name}");
        sb.AppendLine($"Checked {count} placed objects. Grid: {(EditorPrefs.GetFloat(GridPrefKey, 0f) > 0f ? EditorPrefs.GetFloat(GridPrefKey) + " m" : "not set")}");
        sb.AppendLine();

        foreach (var i in issues)
        {
            var tag = i.target != null ? i.target.GetComponent<PoiAnchorTag>() : null;
            string note = tag != null && !string.IsNullOrEmpty(tag.note) ? $" (note: {tag.note})" : "";
            string line = $"[{i.severity}] {i.category}: {HierarchyPath(i.target)} — {i.message}{note}";
            sb.AppendLine("- " + line);
            switch (i.severity)
            {
                case Severity.Error: errors++; Debug.LogError("[POI Audit] " + line, i.target); break;
                case Severity.Warning: warnings++; Debug.LogWarning("[POI Audit] " + line, i.target); break;
                default: infos++; Debug.Log("[POI Audit] " + line, i.target); break;
            }
        }

        string summary = $"[POI Audit] {root.name}: {errors} errors, {warnings} warnings, {infos} info ({count} objects).";
        sb.Insert(0, summary.Replace("[POI Audit] ", "") + "\n\n");
        Debug.Log(summary, root);

        if (writeFile)
        {
            Directory.CreateDirectory("Logs");
            var file = Path.Combine("Logs", $"POI_Audit_{root.name}.md");
            File.WriteAllText(file, sb.ToString());
            Debug.Log($"[POI Audit] Report written to {Path.GetFullPath(file)}");
        }
    }

    static string HierarchyPath(GameObject go)
    {
        if (go == null) return "(missing)";
        var t = go.transform; var s = t.name;
        while (t.parent != null) { t = t.parent; s = t.name + "/" + s; }
        return s;
    }

    // ------------------------------------------------------------------ Temporary colliders

    // Adds MeshColliders to collider-less meshes inside an area for the duration of a measurement.
    sealed class TempColliders : IDisposable
    {
        readonly List<MeshCollider> added = new List<MeshCollider>();

        public TempColliders(Bounds area)
        {
#if UNITY_2022_2_OR_NEWER
            var filters = Object.FindObjectsByType<MeshFilter>(FindObjectsInactive.Exclude, FindObjectsSortMode.None);
#else
            var filters = Object.FindObjectsOfType<MeshFilter>();
#endif
            foreach (var mf in filters)
            {
                if (mf.sharedMesh == null || mf.GetComponent<Collider>() != null) continue;
                var r = mf.GetComponent<Renderer>();
                if (r == null || !area.Intersects(r.bounds)) continue;
                var mc = mf.gameObject.AddComponent<MeshCollider>();
                mc.hideFlags = HideFlags.DontSave | HideFlags.HideInInspector;
                mc.sharedMesh = mf.sharedMesh;
                added.Add(mc);
            }
            Physics.SyncTransforms();
        }

        public void Dispose()
        {
            foreach (var mc in added) if (mc != null) Object.DestroyImmediate(mc);
            Physics.SyncTransforms();
        }
    }
}
```

---

## Part 4: Terrain (only if the entrance needs the ground reshaped)

### Terrain Guide: shaping terrain around a POI to match concept art

> **For:** the Claude agent connected to Unity over MCP.
> **Short version:** don't sculpt with brushes. Describe the shapes as numbers and points, let
> `TerrainShapeSpec` apply them from a backup, check the result with **Validate**, then dress the
> edges with Synty rock and cliff prefabs.

#### Why this approach
Brush sculpting through MCP goes badly: you can't feel the brush, strokes stack up, and results
are hard to judge or undo. Shapes defined as data are **exact, repeatable and reversible**:
- Plateaus = an outline + a top height + an edge blend width.
- Lava channels = a centre line + bed width + bed height + bank width.
- Bridges = two end points + the longest span the bridge prefab can cover.
Every Apply starts from the untouched backup, so you can move a point and re-apply as often as
you like without damage building up.

#### Setup
1. Put `TerrainShapeSpec.cs` in `Assets/` (**not** an `Editor/` folder) and
   `Editor/TerrainShapeSpecEditor.cs` in an `Editor/` folder.
2. Create an empty GameObject `POI_<Name>_Terrain`, add `TerrainShapeSpec`, assign the Terrain.
3. Press **1. Back Up Terrain** before anything else.
4. Create child empty GameObjects for the points (`Plateau_A_01…`, `Lava_01_01…`, `Bridge_1_A/B`)
   and assign them in the component's lists. They show as coloured lines in the Scene view
   (green = plateaus, orange = channels, cyan = bridges).

#### Workflow
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

#### Rules of thumb
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

#### What to put in the POI log
Origin position, bridge prefab and measured span, every number you changed from the sheet and
why, the final Validate result, and before/after screenshots from the concept art's viewpoint.

### `Assets/<any folder, NOT Editor>/TerrainShapeSpec.cs`

```csharp
using System;
using UnityEngine;

// Describes terrain shapes (flat plateaus, carved lava channels, bridge crossings) as data, using
// child Transforms as points you can see and drag in the Scene view. The editor tool
// (Editor/TerrainShapeSpecEditor.cs) applies them to the Terrain from a backup, so re-applying
// after a tweak never stacks changes. Keep this file OUTSIDE any Editor folder.
[ExecuteAlways]
public class TerrainShapeSpec : MonoBehaviour
{
    [Serializable]
    public class Plateau
    {
        public string name = "Plateau";
        [Tooltip("Outline points (at least 3), in order around the edge. Only X/Z are used.")]
        public Transform[] outline = new Transform[0];
        [Tooltip("World height of the flat top.")]
        public float topHeight = 20f;
        [Tooltip("Horizontal distance over which the top blends down into the surrounding terrain.")]
        public float edgeWidth = 6f;
    }

    [Serializable]
    public class Channel
    {
        public string name = "Lava channel";
        [Tooltip("Points along the middle of the channel, in order. Only X/Z are used.")]
        public Transform[] path = new Transform[0];
        [Tooltip("Width of the flat channel bed.")]
        public float bedWidth = 8f;
        [Tooltip("World height of the channel bed (below the lava surface).")]
        public float bedHeight = 4f;
        [Tooltip("Horizontal width of each bank, from the bed up to the surrounding terrain.")]
        public float bankWidth = 4f;

        [Header("Optional: widths per path point (overrides bedWidth/bankWidth)")]
        [Tooltip("Full width of the flat bed at each path point. Leave empty to use bedWidth.")]
        public float[] bedWidths = new float[0];
        [Tooltip("Full width at the lava surface at each path point. Leave empty to skip the lava step.")]
        public float[] lavaWidths = new float[0];
        [Tooltip("Full width at the top of the banks at each path point. Leave empty to use bedWidth + 2 x bankWidth.")]
        public float[] topWidths = new float[0];
    }

    [Serializable]
    public class Ramp
    {
        public string name = "Ramp";
        [Tooltip("Centre of the low end of the ramp.")]
        public Transform start;
        [Tooltip("Centre of the high end of the ramp.")]
        public Transform end;
        public float width = 6f;
        [Tooltip("World height at the start point.")]
        public float startHeight = 0f;
        [Tooltip("World height at the end point.")]
        public float endHeight = 8f;
        [Tooltip("Horizontal distance over which the ramp's sides blend into the surrounding terrain (0 = hard edge).")]
        public float sideBlend = 1f;
    }

    [Serializable]
    public class Bridge
    {
        public string name = "Bridge";
        public Transform endA;
        public Transform endB;
        [Tooltip("Longest gap the chosen bridge prefab (or chain of pieces) can span, measured in Unity.")]
        public float maxSpan = 12f;
        [Tooltip("Optional: the bridge prefab instance, for reference in the report.")]
        public GameObject bridgeObject;
    }

    public Terrain terrain;
    [Tooltip("Untouched copy of the terrain heights. Created by 'Back Up Terrain'. Every Apply starts from this.")]
    public TerrainData backup;

    public Plateau[] plateaus = new Plateau[0];
    public Ramp[] ramps = new Ramp[0];
    public Channel[] channels = new Channel[0];
    public Bridge[] bridges = new Bridge[0];

    [Header("New terrain only")]
    [Tooltip("World height that 'Flatten Whole Terrain' sets everywhere. Use only on a terrain made for this POI.")]
    public float flattenHeight = 0f;

    [Header("Lava")]
    public float lavaSurfaceHeight = 6f;
    [Tooltip("Optional flat mesh for the lava surface; 'Fit Lava Surface' sizes and places it.")]
    public Transform lavaSurface;
    public bool removeTreesBelowLava = true;

    [Header("Texture painting (terrain layer indices, -1 = skip)")]
    public int topLayer = -1;
    public int cliffLayer = -1;
    public int channelLayer = -1;
    [Range(10f, 80f)] public float cliffAngle = 35f;

#if UNITY_EDITOR
    void OnDrawGizmos()
    {
        Gizmos.color = new Color(0.3f, 0.9f, 0.3f);
        foreach (var p in plateaus) DrawLine(p.outline, true, p.topHeight);
        Gizmos.color = new Color(1f, 0.4f, 0.1f);
        foreach (var c in channels) DrawLine(c.path, false, c.bedHeight);
        Gizmos.color = Color.yellow;
        foreach (var r in ramps)
            if (r.start != null && r.end != null)
                Gizmos.DrawLine(new Vector3(r.start.position.x, r.startHeight, r.start.position.z),
                                new Vector3(r.end.position.x, r.endHeight, r.end.position.z));
        Gizmos.color = Color.cyan;
        foreach (var b in bridges)
            if (b.endA != null && b.endB != null) Gizmos.DrawLine(b.endA.position, b.endB.position);
    }

    static void DrawLine(Transform[] pts, bool closed, float y)
    {
        if (pts == null) return;
        for (int i = 0; i < pts.Length; i++)
        {
            int j = i + 1;
            if (j == pts.Length) { if (!closed) break; j = 0; }
            if (pts[i] == null || pts[j] == null) continue;
            var a = pts[i].position; var b = pts[j].position;
            Gizmos.DrawLine(new Vector3(a.x, y, a.z), new Vector3(b.x, y, b.z));
        }
    }
#endif
}
```

### `Assets/<any folder>/Editor/TerrainShapeSpecEditor.cs`

```csharp
using System.Collections.Generic;
using System.IO;
using System.Text;
using UnityEditor;
using UnityEngine;

// Inspector buttons for TerrainShapeSpec: back up, apply shapes, paint textures, fit the lava
// surface, restore, and validate (plateau flatness, channel depth, bridge spans).
[CustomEditor(typeof(TerrainShapeSpec))]
public class TerrainShapeSpecEditor : Editor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();
        var spec = (TerrainShapeSpec)target;
        EditorGUILayout.Space();

        using (new EditorGUI.DisabledScope(spec.terrain == null))
        {
            if (GUILayout.Button("0. Flatten Whole Terrain (new terrain only)") &&
                EditorUtility.DisplayDialog("Flatten terrain", $"Set the whole terrain to {spec.flattenHeight} m? Only do this on a terrain made for this POI.", "Flatten", "Cancel"))
                Flatten(spec);
            if (GUILayout.Button("1. Back Up Terrain")) BackUp(spec);
            using (new EditorGUI.DisabledScope(spec.backup == null))
            {
                if (GUILayout.Button("2. Apply Shapes (from backup)")) Apply(spec);
                if (GUILayout.Button("3. Paint Textures")) Paint(spec);
                if (GUILayout.Button("4. Fit Lava Surface")) FitLava(spec);
                if (GUILayout.Button("5. Validate")) Validate(spec, true);
                EditorGUILayout.Space();
                if (GUILayout.Button("Restore Terrain From Backup")) Restore(spec);
            }
        }
        if (spec.terrain == null) EditorGUILayout.HelpBox("Assign the Terrain first.", MessageType.Info);
    }

    // ------------------------------------------------------------------ Flatten / backup / restore

    public static void Flatten(TerrainShapeSpec spec)
    {
        var data = spec.terrain.terrainData;
        int r = data.heightmapResolution;
        float v = Mathf.Clamp01((spec.flattenHeight - spec.terrain.transform.position.y) / data.size.y);
        var h = new float[r, r];
        for (int z = 0; z < r; z++) for (int x = 0; x < r; x++) h[z, x] = v;
        Undo.RegisterCompleteObjectUndo(data, "Flatten Terrain");
        data.SetHeights(0, 0, h);
        Debug.Log($"[Terrain] Whole terrain set to {spec.flattenHeight} m. Now press Back Up Terrain.");
    }

    public static void BackUp(TerrainShapeSpec spec)
    {
        var data = spec.terrain.terrainData;
        string src = AssetDatabase.GetAssetPath(data);
        if (string.IsNullOrEmpty(src)) { Debug.LogError("[Terrain] TerrainData is not an asset; save the scene/terrain first."); return; }
        string dst = AssetDatabase.GenerateUniqueAssetPath(Path.Combine(Path.GetDirectoryName(src), data.name + "_Backup.asset"));
        if (!AssetDatabase.CopyAsset(src, dst)) { Debug.LogError("[Terrain] Could not copy " + src); return; }
        Undo.RecordObject(spec, "Back Up Terrain");
        spec.backup = AssetDatabase.LoadAssetAtPath<TerrainData>(dst);
        EditorUtility.SetDirty(spec);
        Debug.Log($"[Terrain] Backup saved to {dst}. Every Apply starts from this copy.");
    }

    public static void Restore(TerrainShapeSpec spec)
    {
        var data = spec.terrain.terrainData;
        if (!SameResolution(spec)) return;
        Undo.RegisterCompleteObjectUndo(data, "Restore Terrain");
        int r = data.heightmapResolution;
        data.SetHeights(0, 0, spec.backup.GetHeights(0, 0, r, r));
        data.treeInstances = spec.backup.treeInstances;
        Debug.Log("[Terrain] Heights and trees restored from backup.");
    }

    static bool SameResolution(TerrainShapeSpec spec)
    {
        if (spec.backup.heightmapResolution == spec.terrain.terrainData.heightmapResolution &&
            spec.backup.size == spec.terrain.terrainData.size) return true;
        Debug.LogError("[Terrain] Backup resolution or size differs from the terrain. Make a new backup.");
        return false;
    }

    // ------------------------------------------------------------------ Apply

    public static void Apply(TerrainShapeSpec spec)
    {
        if (!SameResolution(spec)) return;
        var t = spec.terrain; var data = t.terrainData;
        int res = data.heightmapResolution;
        var size = data.size; var origin = t.transform.position;

        var region = ShapeRegion(spec, out bool any);
        if (!any) { Debug.LogWarning("[Terrain] No plateaus or channels with valid points."); return; }
        HeightRect(t, region, out int x0, out int z0, out int w, out int h);
        if (w <= 0 || h <= 0) { Debug.LogWarning("[Terrain] Shapes are outside the terrain."); return; }

        var heights = spec.backup.GetHeights(x0, z0, w, h); // always start from the untouched copy
        var plateaus = ValidPlateaus(spec);
        var channels = ValidChannels(spec);
        var ramps = ValidRamps(spec);

        for (int z = 0; z < h; z++)
        for (int x = 0; x < w; x++)
        {
            float wx = origin.x + (x0 + x) / (float)(res - 1) * size.x;
            float wz = origin.z + (z0 + z) / (float)(res - 1) * size.z;
            var p = new Vector2(wx, wz);
            float y = origin.y + heights[z, x] * size.y;

            // Plateaus: blend towards the flat top, strongest wins.
            float bestW = 0f, bestTop = 0f;
            foreach (var pl in plateaus)
            {
                float d = SignedDistanceToPolygon(p, pl.pts);
                float wgt = d <= 0f ? 1f : 1f - Mathf.Clamp01(d / Mathf.Max(0.01f, pl.src.edgeWidth));
                if (wgt > bestW) { bestW = wgt; bestTop = pl.src.topHeight; }
            }
            if (bestW > 0f) y = Mathf.Lerp(y, bestTop, Smooth(bestW));

            // Ramps set an exact slope between their two ends (after plateaus, before channels).
            foreach (var r in ramps)
            {
                var ab = r.b - r.a; float len2 = ab.sqrMagnitude;
                if (len2 <= 0f) continue;
                float tr = Vector2.Dot(p - r.a, ab) / len2;
                if (tr < 0f || tr > 1f) continue;
                float side = Vector2.Distance(p, r.a + ab * tr);
                float halfW = r.src.width * 0.5f;
                if (side > halfW + r.src.sideBlend) continue;
                float rampY = Mathf.Lerp(r.src.startHeight, r.src.endHeight, tr);
                float k = side <= halfW ? 0f : Mathf.Clamp01((side - halfW) / Mathf.Max(0.01f, r.src.sideBlend));
                y = Mathf.Lerp(rampY, y, Smooth(k));
            }

            // Channels carve down and always win over plateaus and ramps.
            foreach (var ch in channels)
            {
                float d = DistanceToPolyline(p, ch.pts, out int seg, out float tt);
                ChannelWidths(ch, seg, tt, out float bedHalf, out float lavaHalf, out float topHalf);
                if (d > topHalf) continue;
                float carved;
                if (d <= bedHalf) carved = ch.src.bedHeight;
                else if (lavaHalf > bedHalf && d <= lavaHalf)
                    carved = Mathf.Lerp(ch.src.bedHeight, spec.lavaSurfaceHeight, (d - bedHalf) / (lavaHalf - bedHalf));
                else
                {
                    float from = lavaHalf > bedHalf ? lavaHalf : bedHalf;
                    float fromY = lavaHalf > bedHalf ? spec.lavaSurfaceHeight : ch.src.bedHeight;
                    float k = Mathf.Clamp01((d - from) / Mathf.Max(0.01f, topHalf - from));
                    // Linear when the lava step is used (matches section drawings), smooth otherwise.
                    carved = Mathf.Lerp(fromY, y, lavaHalf > bedHalf ? k : Smooth(k));
                }
                y = Mathf.Min(y, carved);
            }

            heights[z, x] = Mathf.Clamp01((y - origin.y) / size.y);
        }

        Undo.RegisterCompleteObjectUndo(data, "Apply Terrain Shapes");
        data.SetHeights(x0, z0, heights);

        if (spec.removeTreesBelowLava)
        {
            var kept = new List<TreeInstance>();
            int removed = 0;
            foreach (var tree in spec.backup.treeInstances)
            {
                float worldY = origin.y + data.GetInterpolatedHeight(tree.position.x, tree.position.z);
                if (worldY < spec.lavaSurfaceHeight + 0.5f) { removed++; continue; }
                var tr = tree; tr.position.y = (worldY - origin.y) / size.y; kept.Add(tr);
            }
            data.treeInstances = kept.ToArray();
            if (removed > 0) Debug.Log($"[Terrain] Removed {removed} trees that would sit in lava.");
        }

        float spacing = size.x / (res - 1);
        foreach (var pl in plateaus)
            if (pl.src.edgeWidth < spacing * 2f)
                Debug.LogWarning($"[Terrain] {pl.src.name}: edge width {pl.src.edgeWidth} m is under 2 heightmap samples ({spacing * 2f:0.##} m); edges will look jagged. Widen it and dress the edge with cliff prefabs instead.");
        Debug.Log("[Terrain] Shapes applied. Run Validate next.");
    }

    // ------------------------------------------------------------------ Paint

    public static void Paint(TerrainShapeSpec spec)
    {
        var t = spec.terrain; var data = t.terrainData;
        int layers = data.alphamapLayers;
        if (!ValidLayer(spec.topLayer, layers) && !ValidLayer(spec.cliffLayer, layers) && !ValidLayer(spec.channelLayer, layers))
        { Debug.LogWarning("[Terrain] Set at least one valid layer index (the terrain has " + layers + " layers)."); return; }

        var region = ShapeRegion(spec, out bool any);
        if (!any) return;
        int ares = data.alphamapResolution;
        var size = data.size; var origin = t.transform.position;
        int x0 = Mathf.Clamp(Mathf.FloorToInt((region.xMin - origin.x) / size.x * ares), 0, ares);
        int z0 = Mathf.Clamp(Mathf.FloorToInt((region.yMin - origin.z) / size.z * ares), 0, ares);
        int x1 = Mathf.Clamp(Mathf.CeilToInt((region.xMax - origin.x) / size.x * ares), 0, ares);
        int z1 = Mathf.Clamp(Mathf.CeilToInt((region.yMax - origin.z) / size.z * ares), 0, ares);
        int w = x1 - x0, h = z1 - z0;
        if (w <= 0 || h <= 0) return;

        var maps = data.GetAlphamaps(x0, z0, w, h);
        var plateaus = ValidPlateaus(spec);
        for (int z = 0; z < h; z++)
        for (int x = 0; x < w; x++)
        {
            float nx = (x0 + x + 0.5f) / ares, nz = (z0 + z + 0.5f) / ares;
            float worldY = origin.y + data.GetInterpolatedHeight(nx, nz);
            float steep = data.GetSteepness(nx, nz);
            var p = new Vector2(origin.x + nx * size.x, origin.z + nz * size.z);

            int pick = -1;
            if (ValidLayer(spec.channelLayer, layers) && worldY < spec.lavaSurfaceHeight + 0.75f) pick = spec.channelLayer;
            else if (ValidLayer(spec.cliffLayer, layers) && steep > spec.cliffAngle) pick = spec.cliffLayer;
            else if (ValidLayer(spec.topLayer, layers))
                foreach (var pl in plateaus)
                    if (SignedDistanceToPolygon(p, pl.pts) <= 0f) { pick = spec.topLayer; break; }
            if (pick < 0) continue;

            for (int l = 0; l < layers; l++) maps[z, x, l] = l == pick ? 1f : 0f;
        }
        Undo.RegisterCompleteObjectUndo(data, "Paint Terrain Shapes");
        data.SetAlphamaps(x0, z0, maps);
        Debug.Log("[Terrain] Textures painted (lava bed, cliffs by slope, plateau tops).");
    }

    static bool ValidLayer(int i, int count) => i >= 0 && i < count;

    // ------------------------------------------------------------------ Lava surface

    public static void FitLava(TerrainShapeSpec spec)
    {
        if (spec.lavaSurface == null) { Debug.LogWarning("[Terrain] Assign a Lava Surface object (e.g. a Plane with a lava material)."); return; }
        var region = ShapeRegion(spec, out bool any);
        if (!any) return;
        Undo.RecordObject(spec.lavaSurface, "Fit Lava Surface");
        spec.lavaSurface.position = new Vector3(region.center.x, spec.lavaSurfaceHeight, region.center.y);
        spec.lavaSurface.rotation = Quaternion.identity;
        // Unity's built-in Plane is 10 x 10 units at scale 1; for other meshes, measure and adjust.
        var mf = spec.lavaSurface.GetComponent<MeshFilter>();
        var meshSize = mf != null && mf.sharedMesh != null ? mf.sharedMesh.bounds.size : new Vector3(10, 0, 10);
        spec.lavaSurface.localScale = new Vector3(region.width / Mathf.Max(0.01f, meshSize.x), 1f, region.height / Mathf.Max(0.01f, meshSize.z));
        Debug.Log("[Terrain] Lava surface fitted. It sits under the plateaus, so it only shows in the channels.");
    }

    // ------------------------------------------------------------------ Validate

    public static int Validate(TerrainShapeSpec spec, bool writeReport)
    {
        var t = spec.terrain; var data = t.terrainData; var origin = t.transform.position;
        var issues = new List<string>(); int errors = 0;
        void Err(string s) { issues.Add("[Error] " + s); errors++; }
        void Warn(string s) => issues.Add("[Warning] " + s);
        float H(Vector3 w) => t.SampleHeight(w) + origin.y;

        var plateaus = ValidPlateaus(spec);
        foreach (var pl in plateaus)
        {
            if (pl.src.topHeight <= spec.lavaSurfaceHeight + 1f)
                Err($"{pl.src.name}: top ({pl.src.topHeight} m) is not clearly above the lava ({spec.lavaSurfaceHeight} m).");
            // Flatness: sample a grid inside the outline.
            var b = PolyBounds(pl.pts);
            float min = float.MaxValue, max = float.MinValue; int n = 0;
            for (float x = b.xMin; x <= b.xMax; x += 1f)
            for (float z = b.yMin; z <= b.yMax; z += 1f)
            {
                var p = new Vector2(x, z);
                if (SignedDistanceToPolygon(p, pl.pts) > -1f) continue; // stay 1 m inside the edge
                float y = H(new Vector3(x, 0, z)); min = Mathf.Min(min, y); max = Mathf.Max(max, y); n++;
            }
            if (n == 0) Warn($"{pl.src.name}: outline too small to measure.");
            else if (max - min > 0.1f) Err($"{pl.src.name}: top is not flat ({(max - min) * 100f:0} cm variation); a channel may cut into it.");
        }

        foreach (var ch in ValidChannels(spec))
        {
            int n = ch.pts.Count;
            foreach (var (arr, label) in new[] { (ch.src.bedWidths, "bedWidths"), (ch.src.lavaWidths, "lavaWidths"), (ch.src.topWidths, "topWidths") })
                if (arr != null && arr.Length > 0 && arr.Length != n)
                    Err($"{ch.src.name}: {label} has {arr.Length} values but the path has {n} points; the list is being ignored.");
            if (ch.src.bedHeight >= spec.lavaSurfaceHeight)
                Err($"{ch.src.name}: bed ({ch.src.bedHeight} m) is not below the lava surface ({spec.lavaSurfaceHeight} m).");
            for (int i = 0; i < ch.pts.Count; i++)
            {
                var p = ch.pts[i];
                float y = H(new Vector3(p.x, 0, p.y));
                if (y > spec.lavaSurfaceHeight) Err($"{ch.src.name}: point {i} is at {y:0.##} m, above the lava; the channel is not carved there (blocked or outside the terrain).");
            }
        }

        foreach (var r in ValidRamps(spec))
        {
            float ya = H(r.src.start.position), yb = H(r.src.end.position);
            if (Mathf.Abs(ya - r.src.startHeight) > 0.2f || Mathf.Abs(yb - r.src.endHeight) > 0.2f)
                Err($"{r.src.name}: ends are at {ya:0.##} m and {yb:0.##} m, expected {r.src.startHeight} and {r.src.endHeight} (a channel may cut it).");
            float slope = Mathf.Atan2(Mathf.Abs(r.src.endHeight - r.src.startHeight), Vector2.Distance(r.a, r.b)) * Mathf.Rad2Deg;
            if (slope > 30f) Warn($"{r.src.name}: slope is {slope:0.#}°; check the character controller and NavMesh can climb it.");
        }

        foreach (var br in spec.bridges)
        {
            if (br.endA == null || br.endB == null) { Warn($"{br.name}: missing an end point."); continue; }
            var a = br.endA.position; var b = br.endB.position;
            float span = Vector2.Distance(new Vector2(a.x, a.z), new Vector2(b.x, b.z));
            if (span > br.maxSpan) Err($"{br.name}: gap is {span:0.##} m but the bridge spans at most {br.maxSpan} m. Narrow the channel here or move the ends.");
            float ya = H(a), yb = H(b);
            if (ya < spec.lavaSurfaceHeight + 0.5f || yb < spec.lavaSurfaceHeight + 0.5f)
                Err($"{br.name}: an end is not on solid ground above the lava (ground at {ya:0.##} m and {yb:0.##} m).");
            if (Mathf.Abs(ya - yb) > 1.5f) Warn($"{br.name}: ends differ in height by {Mathf.Abs(ya - yb):0.##} m; the bridge will slope.");
            var mid = (a + b) * 0.5f;
            if (H(mid) > spec.lavaSurfaceHeight) Warn($"{br.name}: the middle of the crossing isn't over lava; is a bridge needed here?");
        }

        var sb = new StringBuilder();
        sb.AppendLine($"# Terrain validation: {spec.name}");
        sb.AppendLine($"{errors} errors, {issues.Count - errors} warnings.");
        foreach (var s in issues) { sb.AppendLine("- " + s); if (s.StartsWith("[Error]")) Debug.LogError("[Terrain] " + s, spec); else Debug.LogWarning("[Terrain] " + s, spec); }
        Debug.Log($"[Terrain] Validate: {errors} errors, {issues.Count - errors} warnings.", spec);
        if (writeReport)
        {
            Directory.CreateDirectory("Logs");
            File.WriteAllText(Path.Combine("Logs", $"Terrain_Validate_{spec.name}.md"), sb.ToString());
        }
        return errors;
    }

    // ------------------------------------------------------------------ Geometry helpers

    class Poly { public TerrainShapeSpec.Plateau src; public List<Vector2> pts; }
    class Line { public TerrainShapeSpec.Channel src; public List<Vector2> pts; }
    class RampSeg { public TerrainShapeSpec.Ramp src; public Vector2 a, b; }

    static List<RampSeg> ValidRamps(TerrainShapeSpec spec)
    {
        var list = new List<RampSeg>();
        foreach (var r in spec.ramps)
            if (r.start != null && r.end != null)
                list.Add(new RampSeg { src = r, a = new Vector2(r.start.position.x, r.start.position.z), b = new Vector2(r.end.position.x, r.end.position.z) });
        return list;
    }

    static bool PerPoint(float[] arr, int count) => arr != null && arr.Length == count;

    // Half-widths at a point along the channel (segment index + position along it).
    static void ChannelWidths(Line ch, int seg, float t, out float bedHalf, out float lavaHalf, out float topHalf)
    {
        var c = ch.src; int n = ch.pts.Count;
        float At(float[] arr, float fallback) => PerPoint(arr, n) ? Mathf.Lerp(arr[seg], arr[Mathf.Min(seg + 1, n - 1)], t) : fallback;
        bedHalf = At(c.bedWidths, c.bedWidth) * 0.5f;
        lavaHalf = PerPoint(c.lavaWidths, n) ? At(c.lavaWidths, 0f) * 0.5f : 0f;
        topHalf = At(c.topWidths, c.bedWidth + 2f * c.bankWidth) * 0.5f;
        topHalf = Mathf.Max(topHalf, bedHalf + 0.01f);
    }

    static float MaxTopHalf(TerrainShapeSpec.Channel c, int n)
    {
        float m = (c.bedWidth + 2f * c.bankWidth) * 0.5f;
        if (PerPoint(c.topWidths, n)) foreach (var w in c.topWidths) m = Mathf.Max(m, w * 0.5f);
        return m;
    }

    static List<Vector2> Points(Transform[] ts)
    {
        var list = new List<Vector2>();
        if (ts != null) foreach (var t in ts) if (t != null) list.Add(new Vector2(t.position.x, t.position.z));
        return list;
    }

    static List<Poly> ValidPlateaus(TerrainShapeSpec spec)
    {
        var list = new List<Poly>();
        foreach (var p in spec.plateaus) { var pts = Points(p.outline); if (pts.Count >= 3) list.Add(new Poly { src = p, pts = pts }); }
        return list;
    }

    static List<Line> ValidChannels(TerrainShapeSpec spec)
    {
        var list = new List<Line>();
        foreach (var c in spec.channels) { var pts = Points(c.path); if (pts.Count >= 2) list.Add(new Line { src = c, pts = pts }); }
        return list;
    }

    // World X/Z rectangle covering every shape plus its blend distance.
    static Rect ShapeRegion(TerrainShapeSpec spec, out bool any)
    {
        any = false;
        float xMin = float.MaxValue, zMin = float.MaxValue, xMax = float.MinValue, zMax = float.MinValue;
        void Grow(List<Vector2> pts, float margin)
        {
            foreach (var p in pts)
            {
                xMin = Mathf.Min(xMin, p.x - margin); xMax = Mathf.Max(xMax, p.x + margin);
                zMin = Mathf.Min(zMin, p.y - margin); zMax = Mathf.Max(zMax, p.y + margin);
            }
            any = true;
        }
        foreach (var p in ValidPlateaus(spec)) Grow(p.pts, p.src.edgeWidth + 2f);
        foreach (var c in ValidChannels(spec)) Grow(c.pts, MaxTopHalf(c.src, c.pts.Count) + 2f);
        foreach (var r in ValidRamps(spec)) Grow(new List<Vector2> { r.a, r.b }, r.src.width * 0.5f + r.src.sideBlend + 2f);
        return any ? Rect.MinMaxRect(xMin, zMin, xMax, zMax) : new Rect();
    }

    static void HeightRect(Terrain t, Rect r, out int x0, out int z0, out int w, out int h)
    {
        var data = t.terrainData; int res = data.heightmapResolution;
        var o = t.transform.position; var s = data.size;
        x0 = Mathf.Clamp(Mathf.FloorToInt((r.xMin - o.x) / s.x * (res - 1)), 0, res - 1);
        z0 = Mathf.Clamp(Mathf.FloorToInt((r.yMin - o.z) / s.z * (res - 1)), 0, res - 1);
        int x1 = Mathf.Clamp(Mathf.CeilToInt((r.xMax - o.x) / s.x * (res - 1)), 0, res - 1);
        int z1 = Mathf.Clamp(Mathf.CeilToInt((r.yMax - o.z) / s.z * (res - 1)), 0, res - 1);
        w = x1 - x0 + 1; h = z1 - z0 + 1;
    }

    static Rect PolyBounds(List<Vector2> pts)
    {
        float xMin = float.MaxValue, zMin = float.MaxValue, xMax = float.MinValue, zMax = float.MinValue;
        foreach (var p in pts) { xMin = Mathf.Min(xMin, p.x); xMax = Mathf.Max(xMax, p.x); zMin = Mathf.Min(zMin, p.y); zMax = Mathf.Max(zMax, p.y); }
        return Rect.MinMaxRect(xMin, zMin, xMax, zMax);
    }

    // Negative inside the polygon, positive outside (distance to the nearest edge).
    static float SignedDistanceToPolygon(Vector2 p, List<Vector2> poly)
    {
        float d = float.MaxValue; bool inside = false;
        for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
        {
            var a = poly[i]; var b = poly[j];
            d = Mathf.Min(d, DistanceToSegment(p, a, b));
            if ((a.y > p.y) != (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
        }
        return inside ? -d : d;
    }

    static float DistanceToPolyline(Vector2 p, List<Vector2> line) => DistanceToPolyline(p, line, out _, out _);

    static float DistanceToPolyline(Vector2 p, List<Vector2> line, out int segment, out float t)
    {
        float d = float.MaxValue; segment = 0; t = 0f;
        for (int i = 0; i < line.Count - 1; i++)
        {
            var a = line[i]; var ab = line[i + 1] - a; float len2 = ab.sqrMagnitude;
            float k = len2 > 0f ? Mathf.Clamp01(Vector2.Dot(p - a, ab) / len2) : 0f;
            float di = Vector2.Distance(p, a + ab * k);
            if (di < d) { d = di; segment = i; t = k; }
        }
        return d;
    }

    static float DistanceToSegment(Vector2 p, Vector2 a, Vector2 b)
    {
        var ab = b - a; float len2 = ab.sqrMagnitude;
        float k = len2 > 0f ? Mathf.Clamp01(Vector2.Dot(p - a, ab) / len2) : 0f;
        return Vector2.Distance(p, a + ab * k);
    }

    static float Smooth(float x) => x * x * (3f - 2f * x);
}
```
