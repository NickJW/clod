# KITBASH — Procedural Enemy Generator for Unity (Synty-based)

> **Audience:** the Claude agent connected to the Unity Editor over MCP, which will build this system.
> **Status:** design spec v1. Treat it as a strong starting point, not a contract. Where the real
> project differs (Unity version, render pipeline, combat system, which Synty packs are imported),
> adapt the design and write each change into `KITBASH_DECISIONS.md` (§17).

---

## 0. TL;DR

At runtime the game asks for a new enemy ("a level-6 skirmisher for the swamp biome"). The system:

1. **Designs a concept**: body plan + combat role + theme + one twist, written as a seeded
   `EnemyGenome` (pure data).
2. **Kitbashes a body**: builds a procedural skeleton for that body plan, then fills every slot
   with *any* mesh from the Synty library whose **shape** fits. Human arms become spider legs, a
   barrel becomes a torso, a row of swords becomes a spine, a lantern becomes an eye.
3. **Animates it procedurally**: IK legs, spine chains, hover, wheels, tentacles and springs,
   all in Burst jobs. No authored animation clips are needed, so any body plan can move.
4. **Gives it verbs**: attacks and movement come from the parts it was built from (a cannon-shaped
   part shoots, a long blade part sweeps, many legs let it leap), shaped by its combat role and
   balanced against a threat budget.
5. **Caches it as a species** so later spawns of the same species are cheap pooled instances
   with small individual variations.

---

## 1. Goals, non-goals, budgets

### Goals
- **Any body plan**: bipeds and quadrupeds, plus N-legged crawlers, serpents, floaters, wheeled
  things, rooted turrets, tentacled radials, swarms, flying things, and floating "constructs"
  whose parts orbit a core.
- **Any mesh is a candidate part.** Character limbs, weapons, props, furniture, vehicles,
  buildings, rocks, plants and FX meshes are all eligible. Parts are picked by shape and
  function. What the mesh *is* only matters for theming.
- **Readable and good-looking**: clear silhouettes, telegraphed attacks, a coherent palette, and
  one strong idea per enemy, never a random pile.
- **Fast**: generating a new species costs ≤ 2 ms per frame, spread over frames. Spawning an
  instance of a cached species costs ≤ 0.3 ms. 60+ active enemies on a mid-range PC.
- **Deterministic**: the same seed and the same part library always give the same enemy, so
  enemies can be saved, shared, recorded in a bestiary and reproduced as bugs.

### Non-goals (v1)
- Mesh deformation or blending between parts (we place rigid parts; no CSG or remeshing).
- Learned or ML generation. Everything is rules plus weighted randomness plus validation.
- Networking (keep it deterministic so it can be added later).

### Performance budgets (tune per platform)
| Item | Budget |
|---|---|
| Parts per enemy (before merge) | 6–40 |
| Draw calls per enemy after merge | 1–4 (one per atlas/material) |
| Triangles per enemy, LOD0 | ≤ 15k (bosses ≤ 40k) |
| Procedural-animation bones per enemy | ≤ 48 |
| Species generation (main thread, per frame) | ≤ 2 ms, time-sliced |
| Instance spawn from pool | ≤ 0.3 ms |
| Animation update, 60 enemies | ≤ 1.0 ms (Burst jobs) |

---

## 2. Architecture

```
 EDITOR TIME                                  RUNTIME
 ┌────────────────────┐   PartLibrary.asset   ┌──────────────────────────────────────────┐
 │ 1. Part Ingestion   │ ────────────────────▶ │ 3. ConceptGenerator   (seed → Genome)     │
 │  scan Synty packs   │                       │ 4. BodyAssembler      (Genome → Blueprint)│
 │  split skinned limbs│                       │ 5. AbilityComposer    (Blueprint → Kit)   │
 │  shape-analyse      │                       │ 6. Validator          (reject / repair)   │
 │  auto-socket        │                       │ 7. SpeciesBuilder     (Blueprint → Prefab-│
 │  tag & classify     │                       │                        like template)     │
 └────────────────────┘                       │ 8. SpawnService       (pool → instance)   │
 ┌────────────────────┐                       │ 9. ProcAnim (Burst)   / 10. Brain (AI)    │
 │ 2. Gallery/Debug    │                       │ 11. EnemyDirector     (what to spawn when)│
 │  bake & preview     │                       └──────────────────────────────────────────┘
 └────────────────────┘
```

Rules:
- **Steps 3–6 are pure C#** (no `UnityEngine.Object` access) and work on IDs and structs, so
  they can run on a worker thread or in a job and are easy to unit-test.
- **Steps 7–8 touch the scene** and are time-sliced on the main thread.
- **Species and Individual are separate.** A *species* is generated once (genome → baked
  template: merged meshes, skeleton, abilities). An *individual* is a pooled copy with small
  variations (scale ±8%, tint shift, one optional part swapped, stat roll).

Suggested folders and assemblies:
```
Assets/_Kitbash/
  Runtime/   Kitbash.Runtime.asmdef      (Genome, Assembler, Abilities, ProcAnim, Brain, Spawn)
  Editor/    Kitbash.Editor.asmdef       (Ingestion, Gallery, Inspectors)
  Data/      PartLibrary.asset, BodyPlans/*.asset, Themes/*.asset, Roles/*.asset, AbilityAtoms/*.asset
  Shaders/   KitbashPalette.shadergraph, Dissolve.shadergraph
  Tests/     Kitbash.Tests.asmdef        (EditMode determinism + validation tests)
```
Packages: Burst, Collections, Mathematics, AI Navigation; Animation Rigging is optional (we
write our own IK jobs so we don't depend on Animator).

---

## 3. The core principle: shape over meaning

This is the most important section.

A mesh does not get a role because of what it is. It gets **affordances** from its geometry.
A forearm is a *long, thin, tapered rigid segment*, so it can be a spider leg, a tail segment,
a horn, a mandible or a tentacle link. A barrel is a *round, chunky, hollow-ish volume*, so it
can be a torso, a head or a cannon housing.

### 3.1 Shape descriptors (computed at ingestion)
For every candidate mesh, compute and store:

| Descriptor | How | Used for |
|---|---|---|
| `extents` (sorted a ≥ b ≥ c) | PCA / OBB of the vertices | proportions |
| `elongation` = a / b | | limbs, spikes, tails, barrels |
| `flatness` = b / c | | wings, plates, fins, shields |
| `compactness` = volume / OBB volume | voxel or convex-hull estimate | cores, heads |
| `taper` | ratio of cross-section width at the two ends of the main axis | claws, horns, spikes (tip end) |
| `hollowness` | ray-cast from the centroid outwards; % that escape through an opening | muzzles, mouths, cockpits |
| `symmetry` | mirror error across the best plane | heads, cores, paired parts |
| `curvature` | bend of the main-axis centreline | tusks, ribs, mandibles, scythes |
| `triCount`, `bounds`, `material/atlas` | | budgets, batching |
| `principalAxis`, `tipEnd`, `rootEnd` | PCA axis plus taper direction | where it attaches, where it points |

### 3.2 Affordance tags (derived from the descriptors, editable by hand)
```
Segment       elongation > 2.5, compactness > 0.35     → leg/arm/tail/neck link, tentacle link
Spike         Segment + taper > 2                        → horn, claw, stinger, spine, leg tip
Blade         elongation > 3, flatness > 3               → scythe-arm, fin, leg tip, mandible
Plate         flatness > 4                               → armour, wing panel, shield, frill
Core          elongation < 1.6, compactness > 0.5        → torso, thorax, abdomen, hub
Head          Core + symmetry high + size small          → head, sensor pod
Tube          hollowness > 0.3, elongation > 1.5         → cannon, exhaust, mouth, siphon
Orb           elongation < 1.2, compactness > 0.6        → eye, weak point, energy node
Cluster       many disconnected islands                  → swarm body, debris shell
Curved        curvature high                             → rib, tusk, mandible, wing spar
Organic/Hard  material/atlas heuristic + pack + manual   → theme only, never function
```
A part can carry several tags. The `SemanticTag` (what it really is: "Arm_Human", "Barrel",
"Sword", "Chair") is only used for **theme matching** and **naming**, never to filter function.

### 3.3 Using skinned character limbs as rigid parts (the "human arms → spider legs" trick)
Synty characters are skinned meshes (`SK_Chr_*`). At ingestion, the **LimbSplitter**:
1. Bakes the character in its bind pose (`SkinnedMeshRenderer.BakeMesh`).
2. Gives each triangle the bone with the highest total weight across its three vertices.
3. Groups triangles by bone into sub-meshes: `UpperArm_L`, `LowerArm_L`, `Hand_L`, `Thigh`,
   `Calf`, `Head`, `Spine_02`, and so on.
4. Optionally merges chains (`UpperArm + LowerArm + Hand` → one "full arm" part with **internal
   joints** recorded as sockets, so it can bend as a 3-segment IK leg).
5. Caps the open seams: fill each boundary loop with a fan polygon, or tag the end as
   `NeedsCap` so the assembler hides it inside a joint ball, a ring, a bolt or a pauldron.
6. Writes each result as a `PartDefinition` with a generated mesh asset.

Do the same for Synty modular/Sidekick character parts and for any static `SM_Chr_*` attachments.
The result is hundreds of limbs, heads, hands and torsos that can go anywhere.

### 3.4 Joint "glue" parts
Cross-pack kitbashing looks broken where two parts meet. Keep a small **Connector** category:
balls, rings, bolts, chains, ropes, cloth wraps, rock clusters, pipes, pauldrons, gears. Pull
them from every pack, tag them `Connector`, and let the assembler drop one at every joint whose
seam is visible or whose sizes don't match. This one rule does more for "well executed" than
anything else.

---

## 4. Part Library (editor-time ingestion)

### 4.1 Discovery (MCP agent tasks)
1. Search the project for Synty packs. They usually live under `Assets/Synty/<Pack>/`,
   `Assets/Polygon<Name>/` or similar. List every folder with `Prefabs/`, `Models/`, `Materials/`.
2. Index by Synty's naming conventions (check them per pack, they vary):
   - `SM_Chr_*`, `SK_Chr_*` characters and attachments
   - `SM_Wep_*` weapons
   - `SM_Prop_*` props
   - `SM_Env_*`, `SM_Bld_*` environment/buildings (large; useful as bosses and constructs,
     usually rescaled)
   - `SM_Veh_*` vehicles (wheels, turrets, panels)
   - `FX_*` particle prefabs (attack and ability VFX)
   - `*_Mat_*` / atlas textures (usually one shared atlas material per pack)
3. Write `KitbashPackManifest.json`: pack → material(s) → atlas texture → theme hints.

### 4.2 `PartDefinition` (ScriptableObject or a struct inside a big `PartLibrary` asset)
```csharp
[Serializable] public struct PartDefinition {
    public int    id;                 // stable hash of GUID + sub-mesh name
    public string sourceGuid;         // original asset
    public string semanticTag;        // "Arm_Human", "Barrel", "Sword" (theme/naming only)
    public string pack;               // "PolygonDungeon"
    public Mesh   mesh;               // possibly generated by LimbSplitter
    public int    materialId;         // index into library material table (atlas)
    public ShapeDescriptor shape;     // §3.1
    public Affordance affordances;    // [Flags] enum, §3.2
    public ThemeTags themes;          // [Flags] Organic, Undead, Mech, Arcane, Nature, Pirate, SciFi, Junk...
    public Socket[] sockets;          // §4.3
    public float  massEstimate;       // volume * density by material class
    public int    tris;
    public byte   rarity;             // 0 common … 3 signature
}
```
Keep the library as **struct arrays plus ID lookups** (and build `NativeArray` copies at load),
so generation never touches `UnityEngine.Object`. Pre-filter into `NativeMultiHashMap<Affordance,
int>` buckets and size buckets for fast queries.

### 4.3 Sockets
A socket is a local transform plus metadata: `{position, rotation, kind (Root|Tip|Side|Mount|
Joint), radius, mirrorPairId}`.
- **Automatic sockets**: `Root` at `rootEnd`, `Tip` at `tipEnd`, `Joint` from LimbSplitter bones,
  `Side`/`Mount` sockets from sampling the convex hull (pick points with large flat-ish normals;
  for Cores use the 6 OBB faces plus a ring of N points).
- **Hand fixes**: the Gallery (§15) lets you drag sockets on a part and saves an override asset.
  Ingestion keeps overrides when it re-runs.

### 4.4 Ingestion pipeline (Editor menu `Kitbash/Rebuild Part Library`)
```
for each prefab/mesh in packs:
   skip if tris > maxTris or bounds too small/huge (configurable)
   if skinned character → LimbSplitter → many parts
   else if prefab has multiple MeshFilters → each child mesh is also a candidate part
   compute ShapeDescriptor (Burst job over vertices)
   derive Affordances; apply override file if present
   auto-generate sockets
   write into PartLibrary.asset
log stats: parts per affordance, per pack, per theme → KitbashLibraryReport.md
```
Run it once after importing packs and again when packs change. It is incremental, keyed on asset
GUID plus modification hash.

---

## 5. Body plans (morphology)

A **BodyPlan** is a ScriptableObject describing a **skeleton graph template** plus how it moves.
Each node is a *slot* that needs parts with certain affordances. Each edge is a *joint* with
constraints.

```csharp
public class BodyPlan : ScriptableObject {
    public string id;                  // "Arachnid"
    public SlotTemplate[] slots;       // node templates with counts/ranges
    public JointTemplate[] joints;
    public LocomotionKind locomotion;  // LegIK, Serpent, Hover, Wheel, Rooted, Orbit, Swarm, Flyer, Burrow
    public Vector2Int legCount;        // e.g. (6,10) for Arachnid
    public SymmetryMode symmetry;      // Bilateral, Radial(n), None
    public float[] sizeClassWeights;   // Tiny, Small, Medium, Large, Huge
}
public struct SlotTemplate {
    public string name;               // "Thorax", "LegSegmentUpper", "Head", "Weapon"
    public Affordance required;       // must have ALL of these
    public Affordance preferred;      // scoring bonus
    public Vector2 relativeSize;      // size relative to core, min..max
    public int minCount, maxCount;
    public bool optional;
}
```

### 5.1 Starter set (aim for ~12; each one is mostly data)
| BodyPlan | Locomotion | Kitbash example |
|---|---|---|
| **Biped** | LegIK, 2 legs, upright spine | knight torso, barrel chest, sword forearms |
| **Quadruped** | LegIK, trot/gallop | wagon-cart body, four human legs, skull head |
| **Arachnid** (6–10 legs) | LegIK, wave/tripod gait | cauldron thorax, 8 human arms as legs |
| **Centipede / Serpent** | segment chain follows the head | 12 shields as segments, sword ribs |
| **Floater / Eye** | hover with bob and tilt | lantern core, orbiting books, tentacle chains |
| **Construct / Orbiter** | core hovers, parts orbit on springs | crystal core, ring of floating swords and rocks |
| **Wheeled / Tracked** | wheel/track sim on raycasts | mine-cart body, cannon head, spoked wheel |
| **Rooted / Turret** | none (rotates), may burrow or relocate | tree stump, cannon, tentacle arms |
| **Radial / Tentacle** | pulls itself with 3–8 tentacles | upturned bell as body, rope/chain tentacles |
| **Flyer** | wing flap oscillator + banking | crow head, sail/plate wings, spear tail |
| **Swarm** | many tiny boids sharing one brain | 20 floating teeth, coins, skulls |
| **Colossus** (boss) | slow LegIK with weak points | building chunk body, tower legs, catapult arm |

### 5.2 Hybrids
Allow at most one **graft** per enemy: take a sub-graph from a second body plan (a serpent tail
on a biped, a turret on an arachnid, wings on a quadruped). One graft keeps things surprising
while staying readable.

---

## 6. The genome

```csharp
[Serializable] public struct EnemyGenome {
    public uint   seed;
    public int    libraryVersion;      // re-roll if the library changes
    public string bodyPlanId;
    public string graftPlanId;         // optional
    public string roleId;              // Brute, Skirmisher, Artillery, Controller, Swarm, Summoner, Tank, Assassin
    public string themeId;             // e.g. "DrownedPirate", "ClockworkUndead", "JunkGolem"
    public string twistId;             // one memorable gimmick (§7.3)
    public SizeClass size;
    public int    threatBudget;        // from level/difficulty
    public float  limbCountT, proportionT, asymmetryT, ornamentT; // 0..1 knobs
    public uint   partSelectionSeed, abilitySeed, colourSeed;     // sub-seeds
}
```
Use `Unity.Mathematics.Random` seeded per stage, so changing one stage doesn't reshuffle the
others. Store genomes as JSON for the bestiary, saves and bug reports.

---

## 7. Concept generation (the "designer")

The aim is a *concept* with an identity. Not "random parts".

### 7.1 Inputs
`SpawnRequest { biome, level, desiredRole?, encounterContext (melee-heavy party? open field?),
noveltyBias, excludeSpecies[] }`

### 7.2 Steps
1. **Role**: from the request or weighted by encounter needs. Roles carry stat profiles, a
   movement style and ability preferences (§9.4).
2. **Body plan**: weighted by `role × biome × size`. Swamp suits serpents and floaters, a
   crypt suits arachnids and constructs.
3. **Theme**: a ScriptableObject that sets:
   - allowed/preferred `ThemeTags` and packs (a *pirate-undead* theme pulls from Pirates +
     Dungeon packs)
   - a palette (3–5 colours plus one emissive accent)
   - an element (Fire/Frost/Poison/Lightning/Void/Physical) for VFX and damage types
   - naming fragments
   - an **"oddness" allowance**: the share of off-theme parts (default 15–25%) that gives the
     kitbash charm, such as one chair leg among bone legs
4. **Twist**: exactly one, from a list. Each twist is a data rule that changes body or behaviour:
   - *Mimic*: looks like a prop (chest, barrel, statue) until the player gets close
   - *Shell-shedding*: armour plates fall off at 50% HP and it gets faster
   - *Split*: dies into 2–3 smaller copies (reuses its own species at a smaller size)
   - *Weak point*: one glowing Orb part takes ×3 damage and is protected by orbiters
   - *Carrier*: spawns swarm units from a Tube part
   - *Burrower*: hides underground between attacks
   - *Reassembling*: parts scatter on "death" and rebuild once unless the core is destroyed
   - *Mounted*: a small biped rides a larger body; two brains, can be dismounted
   - *Lopsided*: one huge limb, and its attacks and gait reflect it
5. **Name**: `[theme adjective] [semantic noun of the most visible part] [body-plan noun]`, then
   cleaned up ("Barnacled Cauldron Crawler", "Clockwork Bell Drifter"). Simple and readable.
6. **Threat budget split**: HP, damage, speed and ability slots all spend points from
   `threatBudget`, weighted by role. This keeps level-N enemies fair whatever their shape.

### 7.3 Coherence rules (reject or re-roll)
- One **dominant material family** (≥ 60% of visible surface): bone, metal, wood, flesh, stone
  or cloth. Off-theme parts are allowed up to the oddness allowance.
- The silhouette has **one focal feature** (a big head, a huge claw or a glowing core), chosen
  as the "signature" part with the highest rarity score.
- No more than 2 different atlases per enemy (draw calls, and visual consistency).

---

## 8. Body assembly

### 8.1 Algorithm (pure data → `Blueprint`)
```
Blueprint Assemble(genome, plan, library):
  skeleton = InstantiateSkeleton(plan, genome)        // concrete slot graph with counts and sizes
  core     = PickPart(slot=Core, size=genome.size)     // pick the core first; it sets the scale
  for slot in skeleton in BFS order:
      if slot.mirrorOf != null: copy the mirrored choice (with ~asymmetryT chance to differ)
      candidates = library.Query(slot.required, theme, sizeRange)
      part = WeightedPick(candidates, Score(part, slot, theme, alreadyChosen))
      transform = FitToSocket(part, parentSocket, slot.relativeSize)
      if seam visible or size mismatch > 35%: AddConnector(joint)
  AddOrnaments(ornamentT)                  // spikes, plates, chains on Mount sockets, capped by tri budget
  ResolveOverlaps()                        // push apart or swap parts whose bounds penetrate > 20%
  return blueprint (part ids + local transforms + joint graph + socket roles)
```

### 8.2 Scoring a candidate part
```
score = w1*affordanceMatch + w2*themeMatch + w3*sizeFit + w4*proportionFit
      + w5*familyConsistency(alreadyChosen)  // reuse the same family across a limb set
      + w6*noveltyBonus(not used by recent species)
      - w7*triCost - w8*newAtlasPenalty
```
**Repetition is good for limbs**: all legs of an arachnid should normally be the same part
(mirrored or rotated) so it reads as one creature. Variety goes into *categories*: legs, body,
head and weapons each come from a different source object.

### 8.3 Fitting a part to a slot
- Line up the part's **principal axis** with the slot's bone direction, root end at the parent
  socket and tip pointing outwards.
- Scale so that its length matches the slot length. Allow **non-uniform scale up to ±25%** on
  the minor axes to fix proportions. Beyond that it looks stretched.
- Roll it around its axis to put the "nicest" side (largest flat face, or the face with eyes)
  outwards or forwards.
- Leg tips: if the part has a Spike/Blade tip, use that as the foot contact point.

### 8.4 Collision and physics shapes
Don't use mesh colliders. Generate **capsules per segment** and **one box/sphere per core**, all
on one kinematic Rigidbody root with child colliders. Mark weak-point colliders with a
`Hitzone` component (multiplier, armour, which part it belongs to).

---

## 9. Abilities and attacks

### 9.1 Parts imply verbs
Each affordance unlocks **ability atoms**. The attack comes *from* the part, and the VFX and
hitbox spawn at that part's sockets. That is why it looks intentional.

| Part affordance on an attack-capable slot | Unlocks |
|---|---|
| Blade / Spike on a limb | Sweep, Stab, Multi-slash, Spin |
| Core with mass + legs | Charge, Body-slam, Leap-slam |
| Tube (front-facing) | Projectile, Spray/cone, Beam, Lob (mortar), Spawn (carrier) |
| Head with Hollow (mouth) | Bite, Grab-and-throw, Breath (cone) |
| Orb | Beam, Pulse (radial), Shield aura, Weak-point |
| Plate | Block/Guard, Reflect, Shield-bash |
| Segment chain (tail/tentacle) | Whip (long reach), Constrict/grab, Tail-sweep |
| Many legs | Wall-hop/leap, Burrow, Skitter-dodge |
| Wings | Dive, Wind gust (knockback), Hover-strafe |

### 9.2 An ability is composed from atoms
```
Ability = Trigger + Telegraph + Delivery + Shape + Payload + Recovery (+ Modifiers)

Trigger   : InRange(min,max) | Cooldown | OnHit | HP<x | AllyDied | PlayerBehind
Telegraph : windup time, pose offset, glow on source part, ground decal, audio cue
Delivery  : Melee(hitbox follows part), Projectile(speed, arc), Beam(width, sweep),
            GroundAoE(delay), Dash(path), Summon(speciesRef), Grab
Shape     : Box/Sphere/Cone/Line/Ring (sizes come from the part's bounds × role scale)
Payload   : damage(type, amount), knockback, status(slow, burn, poison, root), pull
Recovery  : vulnerable window (a must: this is the player's opening)
Modifiers : x3 burst, spread, homing, ricochet, leaves hazard, chained
```
Stored as `[Serializable]` structs, so abilities are data. One `AbilityRunner` executes them all.

### 9.3 Composition rules
- 1 **primary** (spammable, short telegraph), 1 **secondary** (stronger, longer telegraph), and
  optionally 1 **signature** (from the twist or the signature part). Bosses get 3–5.
- Damage, cooldown and telegraph time are paid from the threat budget. **Telegraph ≥ 0.35 s**
  for anything that does more than 15% of player HP.
- Range must match the body. The validator checks that melee reach really equals the part tip
  reach from the root position (computed from the blueprint), so a short-limbed enemy never gets
  a 4 m "melee".
- Element and VFX come from the theme. Pick Synty `FX_*` prefabs by element tag, tinted with
  the palette accent.

### 9.4 Roles (movement and behaviour defaults)
| Role | Preferred range | Movement style | Ability bias |
|---|---|---|---|
| Brute | melee | slow approach, charge to close the gap | heavy telegraphs, knockback |
| Skirmisher | melee/close | strafe, dash in and out | fast multi-hits, dodges |
| Artillery | long | keep distance, reposition when approached | lobs, ground AoE |
| Controller | mid | circle | slows, pulls, zones, hazards |
| Tank | melee | slow, faces the player, guards allies | block, taunt, shield aura |
| Assassin | melee | flank, stealth/burrow, attack from behind | burst, retreat |
| Summoner | long | flee, hide behind summons | spawn swarm/minions |
| Swarm | melee | boids, surround | weak individual hits, numbers |

---

## 10. Procedural animation (the part that makes anything move)

No Animator. One **ProcAnimSystem** runs every enemy's skeleton in Burst jobs with
`TransformAccessArray`. Each body plan registers *motor modules*:

### 10.1 Modules
- **LegIK** (2- or 3-segment analytic IK; FABRIK for longer chains)
  - Each foot has a *rest target* relative to the body. When the foot is more than `stepDist`
    from its target (scaled by speed), it starts a step: a parabolic arc over `stepTime`.
  - **Gait groups** stop all legs stepping at once: bipeds alternate, quadrupeds trot (diagonal
    pairs), hexapods use a tripod gait, 8+ legs use a wave gait. Only a leg whose group is
    "open" may step.
  - Ground found with batched `RaycastCommand`s (one per foot per tick, async).
  - Body height and tilt come from the average foot height and the plane fitted to the feet.
    This alone makes kitbashed spiders look alive.
- **SpineChain / Serpent**: follow-the-leader. Each segment keeps a fixed distance from the
  previous one along the head's path history, plus a sine wave sideways for slithering.
- **Hover**: spring-damper to the target height, bob noise, tilt into acceleration, small
  random roll.
- **Orbit** (constructs): parts on orbit rings with phase offsets. During attacks orbiters snap
  into formation (a spear line, a shield wall, a spinning saw).
- **Wheel/Track**: suspension raycasts, wheel spin from speed, body pitch and roll from the
  suspension.
- **Tentacle**: verlet chain with stiffness that falls off along its length, and a tip IK target
  used for attacks and pulling the body along.
- **Wings**: flap oscillator whose frequency and amplitude depend on vertical intent, plus
  banking.
- **Secondary motion**: spring "jiggle" on ornaments, chains, plates and heads. Cheap,
  and it sells the kitbash.
- **LookAt**: head and sensor parts track the target, with limited angles and a lag.

### 10.2 Attack posing without clips
Abilities drive **pose targets**, not clips:
- `Windup`: pull the source limb's IK target back along the attack axis, lower the body, glow.
- `Strike`: send the IK target through the attack path with an easing curve (fast in, overshoot).
- `Recover`: spring back to rest; this is the vulnerable window.
Store these as `AnimationCurve` presets per delivery type (Sweep, Stab, Slam, Bite, Whip),
baked into sampled arrays for Burst.

### 10.3 Bipeds that *are* Synty humanoids
If a biped's core and limbs all come from one Synty character, there is a fast path: keep the
original skinned mesh and the Humanoid Animator (Synty or Mixamo locomotion), and only kitbash
*attachments* onto bones. Use procedural IK for attacks if no clips exist. This is optional;
the generic LegIK path also works for bipeds.

### 10.4 Performance
- Data-oriented: one `NativeArray<BoneState>` for all enemies. Jobs: `GroundProbeJob`
  → `GaitJob` → `IKJob` → `SpringJob` → `WriteTransformsJob` (`IJobParallelForTransform`).
- **Animation LOD by distance and visibility**: full rate under 20 m; half rate at 20–40 m;
  quarter rate beyond, plus no secondary motion; off-screen, only the root moves.

---

## 11. Movement and AI ("Brain")

- **Navigation**: Unity AI Navigation with 3–4 **agent types by size class** (Small/Medium/
  Large/Huge). The root follows the NavMeshAgent (with `updateRotation` and `updatePosition`
  handled by us); the procedural body follows the root.
  - Flyers and floaters: a separate 3D steering layer above the NavMesh (raycast avoidance,
    height band).
  - Burrowers: navigate on the NavMesh while "underground" (body hidden, dirt-trail VFX).
  - Swarms: one NavMeshAgent for the swarm centre plus boids (separation, alignment,
    cohesion, target pull) in a job.
- **Decision making**: a small **utility AI** (score each available action every 0.2–0.5 s,
  pick the best with hysteresis). Actions: Approach, Strafe, Retreat, Reposition, UseAbility(i),
  Guard, Idle/Patrol. Role weights set the personality; the genome adds a little noise so
  individuals differ.
- **Locomotion matches the body**: max speed, acceleration and turn rate come from the blueprint
  (leg length × leg count, mass, wheels or hover). A 10-legged thing turns fast; a colossus
  turns slowly. This makes movement *feel* tied to the shape.
- **Tick rate LOD**: brains near the player think more often. Distant ones think every second.

---

## 12. Visual identity and polish

1. **Palette shader** (Shader Graph, URP): Synty atlases are flat colour swatches, so remap them.
   A material property `_PaletteTex` (a 1×N gradient from the theme) and a mode that tints by
   swatch luminance. This makes parts from different packs share one colour story, the biggest
   visual win for cross-pack kitbash. Use `MaterialPropertyBlock` / SRP Batcher-compatible
   properties for per-individual tint.
2. **Emissive accent** on the signature part, eyes (Orbs) and weak points, pulsing during
   telegraphs.
3. **Silhouette check** (§13): render the blueprint's convex hulls to a small offscreen mask
   from the gameplay camera angle and reject ugly blobs (too round, too thin, no protrusions).
4. **Spawn reveal**: a dissolve-in, or parts flying in and snapping together (the "assembling"
   fantasy). Either one also hides the first-frame assembly cost.
5. **Death**: the kitbash falls apart. Detach rigid parts with physics impulses (they are
   already separate segments), then fade or pool them. It's cheap and it fits the theme.
6. **Hit feedback**: flash, a small squash on the hit segment's spring, part-specific sparks
   (metal → sparks, wood → splinters, bone → dust; from the material family).
7. **Decals and wear**: an optional dirt/grime overlay in the shader to unify parts.

---

## 13. Validation (generate → test → repair or re-roll)

Every blueprint goes through the validator before it is accepted. Up to N=6 re-rolls (each
re-roll changes only the failing stage's sub-seed); otherwise fall back to a cached
known-good species.

| Check | Fail condition | Repair |
|---|---|---|
| Grounded | rest pose feet not reachable on flat ground | rescale legs / change leg part |
| Stability | centre of mass outside the support polygon (LegIK plans) | move core, widen stance |
| Nav fit | bounds radius > agent type radius | bump size class / scale down |
| Reach | melee ability range > actual reach + 10% | shrink range / pick a ranged atom |
| Budget | tris / draw calls / bones over budget | drop ornaments, merge, swap parts |
| Overlap | parts penetrating > 20% bounds | nudge / swap |
| Silhouette | mask too blob-like / thin / tiny | add protrusions or re-pick the signature part |
| Readability | no telegraph on a big hit; same-colour weak point | fix data |
| Threat | computed DPS × EHP outside ±15% of budget | rebalance stats |

Write every rejection reason to a ring buffer and show it in the Gallery. This is how the
generator gets tuned.

---

## 14. Runtime performance and spawning

1. **Species bake** (time-sliced coroutine/`Awaitable`, ~2 ms per frame):
   - Build the GameObject hierarchy: one GameObject per *moving segment*, not per part.
   - **Merge static parts per segment and per atlas** (`Mesh.CombineMeshes` or the MeshData API
     on a worker thread with `Mesh.AllocateWritableMeshData`).
   - Generate LOD1 (fewer ornaments, merged further) and LOD2 (whole body as one mesh, no
     secondary motion) into a `LODGroup`.
   - Build colliders, the ability runner and the brain; register the skeleton with ProcAnim.
   - Disable it and store it as a **species template** in a `SpeciesCache` (LRU, e.g. 24
     species).
2. **Spawning**: `ObjectPool<EnemyInstance>` per species, pre-warmed with the expected count
   during loading or quiet moments. Instance variation through property blocks, root scale and
   an optional ornament toggle. No mesh rebuilds.
3. **Pre-generation**: the `EnemyDirector` generates the *next* encounter's species in the
   background while the player fights the current one.
4. **Memory**: generated meshes are owned by the species and destroyed when it is evicted.
   Track it in a `KitbashStats` overlay.
5. **GC**: no LINQ or allocation in Update paths; Native containers for jobs; strings only at
   bake time.
6. **Rendering**: SRP Batcher compatible shader; GPU instancing for Swarm members (one mesh
   each, `Graphics.RenderMeshInstanced` instead of GameObjects for large swarms).

---

## 15. Tooling (build this early; it makes everything else faster)

- **Kitbash Gallery** (Editor window and a play-mode scene):
  - a grid of 16–64 generated species from a seed range, turntable, regenerate button
  - lock and re-roll individual stages (keep the body, re-roll abilities)
  - pin or ban a part; edit the sockets of a part with handles
  - show the genome JSON, the score breakdown per slot, validation failures, tris and draw calls
  - "Fight it" button: spawn the enemy in an arena with a dummy player
- **Library Report**: affordance coverage per theme (e.g. "Theme JunkGolem has 0 Wing-capable
  parts"), so gaps in the library are visible.
- **Determinism test**: EditMode test that generates 200 seeds twice and compares blueprint hashes.
- **Soak test**: play-mode scene that spawns or despawns 500 species and logs frame-time spikes
  and leaks.

---

## 16. Implementation plan for the Unity agent

Do this in phases. Each phase ends with something that runs and an acceptance check. Commit or
checkpoint after each phase and write any design changes in `KITBASH_DECISIONS.md`.

**Phase 0: Recon (read-only)**
- Report the Unity version, the render pipeline, the installed packages and whether there is an
  existing combat/health/damage system and a player controller. Report which Synty packs are
  imported and their folder layout.
- ✅ `KITBASH_RECON.md` exists, and the integration points (damage interface, team/faction,
  player target) are named.

**Phase 1: Part library**
- `PartDefinition`, `ShapeDescriptor` job, affordance classifier, auto-sockets, `LimbSplitter`,
  the `Kitbash/Rebuild Part Library` menu and the library report.
- ✅ The library has ≥ 300 parts across ≥ 3 packs; split human limbs exist as `Segment` parts
  with joint sockets; the report shows every affordance populated.

**Phase 2: Assembler + Gallery (static)**
- `BodyPlan` assets for Biped, Quadruped, Arachnid, Floater and Construct; genome; assembler
  with scoring and fitting; connectors; simple palette shader; Gallery grid.
- ✅ 64 random seeds give recognisable bodies, with no floating or penetrating parts in at least
  90% of them; an arachnid with human-arm legs can be produced.

**Phase 3: Procedural animation**
- ProcAnim jobs: LegIK with gait groups, Hover, Orbit, Spine follow, springs, LookAt.
- ✅ A hexapod walks across uneven terrain with a tripod gait, without foot sliding; 60 enemies
  animate in ≤ 1 ms.

**Phase 4: Brain + navigation**
- Size-class agent types, a utility AI, role profiles, flyer steering.
- ✅ Each role behaves visibly differently in the arena.

**Phase 5: Abilities**
- Ability atoms, the runner, telegraph posing, hitboxes from part sockets, VFX hookup and
  integration with the game's damage system.
- ✅ Every generated enemy has ≥ 2 working attacks that come from its parts, and every big hit
  is telegraphed.

**Phase 6: Concept layer**
- Themes, twists, naming, threat budget, coherence and validation, re-roll and repair.
- ✅ 100 seeds: ≥ 95% pass validation within 6 re-rolls; names read naturally.

**Phase 7: Performance and production**
- Species cache, pooling, mesh merge, LODs, time-sliced bake, pre-generation, death
  break-apart, spawn reveal, the remaining body plans (Serpent, Wheeled, Rooted, Tentacle,
  Flyer, Swarm, Colossus).
- ✅ The soak test runs clean; no frame over budget while species bake.

**Phase 8: Director**
- `EnemyDirector`: picks role mixes for encounters, novelty vs familiarity (bring back known
  species so players learn them, introduce one new species per encounter), bestiary saving.

---

## 17. Things to tune, and where the agent should use judgement

- **Thresholds** in §3.2 are first guesses. Tune them from the library report and the Gallery.
- **Oddness allowance**: start at 20%. Lower it if the enemies look like junk piles, raise it
  if they look boring.
- **Pack mixing**: if the palette shader doesn't unify the packs well enough, limit each theme
  to 1–2 packs that already look alike.
- **Integration first**: if the game already has an AI, health or ability system, *use it* and
  make Kitbash produce data for it instead of duplicating systems.
- **Bad results**: when the Gallery shows a bad enemy, fix the *rule* (score weight, affordance
  threshold, validator), not just that seed.
- Write every deviation from this spec in `KITBASH_DECISIONS.md` with a one-line reason.

---

## Appendix A: Key interfaces (sketch)

```csharp
public interface IConceptGenerator { EnemyGenome Design(in SpawnRequest req, uint seed); }
public interface IBodyAssembler    { bool TryAssemble(in EnemyGenome g, PartLibraryData lib, out Blueprint bp, out ValidationReport r); }
public interface IAbilityComposer  { AbilityKit Compose(in EnemyGenome g, in Blueprint bp, PartLibraryData lib); }
public interface ISpeciesBuilder   { Awaitable<SpeciesTemplate> BakeAsync(Blueprint bp, AbilityKit kit, CancellationToken ct); }
public interface ISpawnService     { EnemyInstance Spawn(SpeciesId id, Vector3 pos, Quaternion rot, uint individualSeed); void Despawn(EnemyInstance e); }

public struct Blueprint {
    public NativeArray<PlacedPart> parts;     // partId, segmentIndex, localPos, localRot, localScale
    public NativeArray<Segment>    segments;  // parent, joint type, limits, motor module, length
    public NativeArray<SocketRef>  attackSockets;
    public float3 boundsExtents; public float mass; public SizeClass size;
}
```

## Appendix B: Example output

```
Seed 0x5A17C0DE → "Barnacled Cauldron Crawler"
  Plan: Arachnid (8 legs)         Role: Controller        Theme: DrownedPirate  Twist: Carrier
  Core:  SM_Prop_Cauldron (Dungeon)                      → thorax
  Legs:  8× split LowerArm+Hand (SK_Chr_Pirate) mirrored → 3-joint IK legs, hand = foot
  Head:  SM_Prop_Lantern (Pirates), emissive green       → sensor head, signature part
  Orbs:  3× SM_Prop_Bottle_Glass                         → weak points on the back
  Glue:  rope wraps + iron rings at every leg root
  Abilities: Primary  "Brine Lob"   (Tube = cauldron mouth → arcing projectile, slow pool)
             Secondary "Leg Sweep"  (front leg pair, 0.5 s telegraph, knockback)
             Signature "Hatchlings" (spawns 4 Swarm "Bottle Mites" from the cauldron)
  Move:  wave gait, keeps 8–12 m away, skitter-dodges sideways when approached
```
