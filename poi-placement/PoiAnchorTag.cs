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
