# Concept art brief (paste this into ChatGPT)

> **Why this exists:** the art goes to a Claude agent that builds the POI in Unity from our Synty
> prefabs. Pictures are great for *look and mood* but poor at telling a builder *exact sizes,
> positions and part names*. So every image comes with a written **room sheet**. The sheet is
> the source of truth for *what goes where*; the image is the source of truth for *how it should
> look*.

---

## The brief (copy everything in this box into ChatGPT)

```
You're creating concept art for points of interest (POIs) that a Claude agent will build in
Unity from Synty prefabs. You have access to the Synty dex. Follow these rules so the art can be
built faithfully.

FOR EACH POI, DELIVER:
1. Exterior: one 3/4 view from about 10–15 m away at roughly human eye height (1.7 m) or
   slightly above. Plus a TOP-DOWN FOOTPRINT showing the building outline, door and window
   positions, and the surrounding props, on a square grid labelled in metres.
2. Every interior room: one WIDE SHOT from the main entrance at eye height (1.7 m), showing as
   much of the room as possible. Plus a TOP-DOWN FLOOR PLAN of that room on a grid labelled in
   metres, with every object marked by a NUMBER that matches the room sheet.
3. A ROOM SHEET (text, using the template below) for the exterior and for every room.
4. A short POI overview: list of rooms, which doors connect which rooms, floor levels, stairs.

ART RULES (so the builder can read it):
- Use only parts that exist in the Synty dex, and name them by their exact prefab/asset name in
  the room sheet. If something is kitbashed from several parts, list each part and how they
  combine (e.g. "workbench = SM_Prop_Table_01 + SM_Prop_Vice_01 on top, right end").
- Keep Synty's scale: doors about 2.0–2.2 m tall, a person about 1.8 m. Include a person or a
  door in every view as a scale reference.
- Use a normal lens (about 35–50 mm equivalent). No fisheye, extreme wide angle or tilted
  "dutch" angles; they make distances unreadable.
- Show the whole room. Don't hide areas in heavy fog, darkness, motion blur or depth-of-field
  blur, and don't crop important objects at the image edge.
- Draw objects resting on things: on the floor, on tables, against walls, hanging from beams or
  chains. Nothing floating unless it's meant to (magic), and then say so in the sheet.
- Keep it physically possible: nothing passing through walls or other objects; paths, doors and
  stairs at least 1 m wide and clear.
- Make the exterior and interiors agree: the same doors and windows in the same places, and
  rooms that fit inside the exterior footprint.
- Show where light comes from (windows, fireplaces, lamps, torches) and list them in the sheet.
- Prefer clusters of objects that make sense together (desk + chair + candle + papers) over
  evenly scattered clutter.

ROOM SHEET TEMPLATE (one per room, plain text):

Room: <name>
Image files: <wide shot file>, <floor plan file>
Size: <width> x <depth> m, ceiling height <h> m, floor level <0 = ground>
Modular pieces: walls <prefab name>, floor <prefab name>, roof/ceiling <prefab name>
Doors/windows: <which wall (N/E/S/W), position along the wall in m, prefab name, leads to>
Mood: <2–3 words, e.g. "cosy, smoky, cluttered">
Focal point: <what the eye should see first from the entrance>
Light sources: <list, with positions>
Objects:
  # | Prefab name (exact) | Count | Anchor | Position (x, z in m from the room's south-west corner) | Facing | Notes
  1 | SM_Prop_Bar_Counter_01 | 3 | floor | (4.0–10.0, 7.2) | faces S | one long counter
  2 | SM_Prop_Shelf_Wall_02 | 3 | wall N, 1.4 m and 2.0 m up | (4.5–9.5, 8.0) | faces S | bottles on top
  3 | SM_Prop_Chandelier_01 | 1 | ceiling | (6.0, 4.0) | — | hangs on a chain, about 2.6 m off the floor
  ...
Anchor is one of: floor, on <object #>, wall <N/E/S/W> + height, ceiling, free (intentionally floating).
Notes / alternatives: <anything the builder should know, and acceptable substitutes>
```

---

## Tips for you when reviewing ChatGPT's output
- **Check the prefab names exist** before handing them over. A wrong name is the most common
  breakdown between the two AIs.
- **Floor plans beat perspective images** for positions. If the plan and the wide shot disagree,
  tell Claude to follow the plan for *positions* and the wide shot for *look*.
- **Fewer, better views beat many angles.** One clear wide shot plus a plan per room is enough;
  extra dramatic angles add conflicting information.
- Image generators are not exact about counts and positions. The **sheet's numbers win** over
  what the image appears to show, and Claude's guide (§A3) covers how to handle mismatches.
