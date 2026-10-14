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
