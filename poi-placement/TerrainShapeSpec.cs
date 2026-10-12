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
