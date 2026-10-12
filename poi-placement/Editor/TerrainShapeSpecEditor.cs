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

    // ------------------------------------------------------------------ Backup / restore

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

            // Channels carve down and always win over plateaus.
            foreach (var ch in channels)
            {
                float d = DistanceToPolyline(p, ch.pts);
                float half = ch.src.bedWidth * 0.5f;
                if (d > half + ch.src.bankWidth) continue;
                float k = d <= half ? 0f : Mathf.Clamp01((d - half) / Mathf.Max(0.01f, ch.src.bankWidth));
                float carved = Mathf.Lerp(ch.src.bedHeight, y, Smooth(k));
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
            if (ch.src.bedHeight >= spec.lavaSurfaceHeight)
                Err($"{ch.src.name}: bed ({ch.src.bedHeight} m) is not below the lava surface ({spec.lavaSurfaceHeight} m).");
            for (int i = 0; i < ch.pts.Count; i++)
            {
                var p = ch.pts[i];
                float y = H(new Vector3(p.x, 0, p.y));
                if (y > spec.lavaSurfaceHeight) Err($"{ch.src.name}: point {i} is at {y:0.##} m, above the lava; the channel is not carved there (blocked or outside the terrain).");
            }
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
        foreach (var c in ValidChannels(spec)) Grow(c.pts, c.src.bedWidth * 0.5f + c.src.bankWidth + 2f);
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

    static float DistanceToPolyline(Vector2 p, List<Vector2> line)
    {
        float d = float.MaxValue;
        for (int i = 0; i < line.Count - 1; i++) d = Mathf.Min(d, DistanceToSegment(p, line[i], line[i + 1]));
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
