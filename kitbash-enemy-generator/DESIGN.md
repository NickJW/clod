# KITBASH — Procedural Enemy Generator for Unity (Synty-based)

> **Audience:** the Claude agent connected to the Unity Editor over MCP, which will build this system.
> **Status:** design spec v1. Treat it as a strong starting point, not a contract. Where the real
> project differs (Unity version, render pipeline, combat system, which Synty packs are imported),
> adapt the design and write each change into `KITBASH_DECISIONS.md` (§17).

---

## 0. TL;DR

At runtime the game asks for a new enemy ("a level-6 skirmisher for the swamp biome"). The system:

1. **Designs a concept with a purpose**: a one-line pitch (how it hunts, how the player beats
   it), then the anatomy that pitch needs, chosen from ~40 body plans plus a body grammar that
   invents new ones. Recorded as a seeded `EnemyGenome` (pure data).
2. **Kitbashes a body**: builds a procedural skeleton for that body plan, then fills every slot
   with *any* mesh from the Synty library whose **shape** fits. Human arms become spider legs, a
   barrel becomes a torso, a row of swords becomes a spine, a lantern becomes an eye.
3. **Animates it procedurally**: IK legs, spine chains, hover, wheels, tentacles and springs,
   all in Burst jobs. No authored animation clips are needed, so any body plan can move.
4. **Gives it verbs**: attacks and movement come from the parts it was built from (a cannon-shaped
   part shoots, a long blade part sweeps, many legs let it leap), shaped by its combat role and
   balanced against a threat budget.
5. **Critiques and tests it**: a final art-direction pass checks material, palette, shape language, mass
   hierarchy, silhouette and that every part has a purpose. Then a fast simulated test run
   checks movement, attacks, VFX and SFX (§13.2). Slapped-together or broken results are
   repaired or rejected.
6. **Caches it as a species** so later spawns of the same species are cheap pooled instances
   with small individual variations. At scale, parts render as shared instanced meshes, so new
   species cost no extra memory or draw calls (§14).

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

### No AI models anywhere in the game
- The shipped game uses **no LLM, no ML model and no network calls**. Generation is seeded
  randomness + rules + measured checks: plain C#, a few milliseconds per species, free to run
  millions of times, and it works offline.
- "AI" elsewhere in this doc means ordinary **game AI** (utility scoring for enemy decisions),
  which is just code.
- The only places a language model *may* be used are **optional development-time tools** (the
  vision critic in §13.1 and the sampled clip review in §13.2). Both can be switched off or
  replaced by a human pressing thumbs up/down in the Gallery. Nothing depends on them.

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

### 5.1 Body plans are built from a grammar, not picked from a fixed list
A fixed list of templates runs out quickly. Instead, a body plan is **composed from topology
primitives**, and named plans are just saved, tuned compositions of them:

| Primitive | What it adds | Parameters |
|---|---|---|
| `Core` | a mass that other parts hang from | size, count (1 = one body, 2–3 = thorax/abdomen chain) |
| `Chain` | a jointed line: spine, neck, tail, tentacle, worm body | links, stiffness, taper, follow mode |
| `LimbPair` / `LimbRing` | legs/arms, mirrored or radial | count, segments (2–5), knee direction, foot type |
| `Stack` | parts piled vertically (totem, tower) | layers, wobble |
| `Orbit` | parts floating around a point | rings, count, radius, formation set |
| `Appendage` | a single special limb (claw arm, stinger, cannon mount) | which socket, size class |
| `Shell` | a cover over a core (carapace, hood, house, barrel) | coverage, can open/close |
| `Hang` | a suspension link: strings, chains, a rope from above | anchor (crossbar/ceiling/flyer), length |
| `Host` | another full body plan used as a mount or a parasite's host | rider plan, attach socket |

A **body grammar** (weighted production rules with size and count limits) expands a start
symbol into a primitive graph. For example:
```
Creature   → Core Locomotor Head? Appendage{0..2} Ornament*
Locomotor  → LimbPair{1..5} | LimbRing{3..8} | Chain(ground) | Orbit | Wheel{1..6} | Hover | Hang | Stack(hop)
Head       → Core(small) | Chain(neck) Core(small) | Head{2..5}(hydra) | none(face on core)
```
Rules carry **conditions** (a `Hang` locomotor requires an anchor; a `Stack` can't have more than
4 layers in a Small size class) and **weights per role and biome**. Named plans become
"favourite expansions" with tuned weights, and the grammar can still invent combinations nobody
listed.

### 5.2 Named starting plans (~40)
Each one is a data asset over the primitives above. Build them in tiers so that each tier
reuses the motor modules from §10.

**Tier A: core set (needs LegIK, Chain, Hover, Orbit, Wheel)**
| Plan | Locomotion | Kitbash example |
|---|---|---|
| Biped (plantigrade) | 2-leg IK | knight torso, barrel chest, sword forearms |
| Digitigrade / Raptor | 2-leg IK, back-bent knees, tail for balance | crate body, scythe legs, spear tail |
| Quadruped | 4-leg trot/gallop | wagon body, four human legs, skull head |
| Knuckle-walker | 4 limbs, long front arms | boulder torso, huge gauntlet arms |
| Arachnid (6–10) | wave/tripod gait | cauldron thorax, 8 human arms as legs |
| Crab | sideways gait, two big claws | upturned shield shell, anvil claws |
| Scorpion | 8 legs + overhead stinger chain | coffin body, dagger stinger |
| Mantis | 4 walking legs + 2 raised scythe arms | lantern head, two sickles |
| Centipede | many segments, legs on each | 12 shields as segments, sword ribs |
| Serpent / Worm | segment chain, slither or burrow | pipes and barrels, bucket head |
| Floater / Eye | hover, bob, tilt | lantern core, orbiting books |
| Construct / Orbiter | core with orbiting parts | crystal core, ring of swords and rocks |
| Wheeled | wheel sim | mine-cart body, cannon head |
| Monowheel / Hoop | one big wheel, rider inside | cartwheel ring, skeleton rider |
| Rooted / Turret | rotates, may relocate by burrowing | tree stump, cannon, tentacles |
| Swarm | boids | 20 floating teeth, coins, skulls |

**Tier B: needs one extra motor each**
| Plan | Extra motor | Kitbash example |
|---|---|---|
| Hand-walker | fingers as legs (5-leg wave gait) | giant gauntlet, finger = sword legs |
| Tripod / Stilt-walker | very long 3-leg IK, slow sway | tiny cabin body on tower legs |
| Pogo / Hopper | spring jump, one or two legs | barrel on a single huge leg |
| Roller | rolls into a ball between moves | armadillo of shields |
| Inchworm | bend-and-extend chain | ladder-like body of planks |
| Gastropod / Snail | sliding foot + shell, leaves trail | house or chest shell, slime path |
| Jellyfish | pulse thrust, trailing tentacles | bell or lampshade, chain tentacles |
| Starfish / Radial walker | radial limbs, spins to turn | cart wheel with 5 arms |
| Tentacle-puller | tentacle tips anchor and drag the body | bell body, 6 rope tentacles |
| Flyer (wings) | flap + banking | crow head, sail wings, spear tail |
| Glider / Manta | slow glide, swoop | big flat plate body, banner fins |
| Bat / Wing-walker | walks on wing knuckles, then flies | cloak wings, skull head |
| Ceiling hanger | hangs from a ceiling or a chain, swings | chandelier body, dangling arms |
| Marionette | hangs from strings off a floating crossbar | doll made of furniture, strings to a beam |
| Wall-crawler | surface-aligned LegIK on walls/ceilings | flat body, 6 thin legs |
| Totem / Stack | stack of parts that hops and topples | 4 stacked heads or barrels |
| Ooze / Amalgam | soft jiggle body with parts embedded | blob of mixed props and limbs |

**Tier C: compound (built from two plans)**
| Plan | Composition | Kitbash example |
|---|---|---|
| Taur | Quadruped + Biped torso | horse-ish legs, knight upper body |
| Hydra | Core + 2–5 neck chains with heads | five lantern heads on chain necks |
| Rider / Mounted | Host + small rider with its own brain | goblin on a crab made of shields |
| Parasite | small creature attached to a host; detaches when hurt | tick on a centipede |
| Twin / Conjoined | two cores sharing legs, two brains | two barrels, one set of 6 legs |
| Hive-carrier | any locomotor + spawner shell | snail whose shell spawns swarm units |
| Colossus (boss) | slow LegIK + climbable weak points | building body, tower legs |
| Siege engine | Wheeled + catapult/turret appendage | cart, trebuchet arm, skull ammo |

### 5.3 Hybrids
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

### 7.4 Purpose first: every enemy starts as an idea, not a pile of parts
The order of decisions is what keeps this from being a hodgepodge. Parts come **last**:

```
Pitch  →  Anatomy  →  Parts  →  Look  →  Critic (§13.1)
```

1. **Pitch** (one sentence, generated from data): *what it is, how it hunts, what the player
   must do about it.*
   Example: "A cautious ambusher that hides as a barrel and snaps shut on anyone who gets
   close; you beat it by baiting the snap and hitting the exposed core."
   A pitch is built from: role (§9.4) + twist (§7.2) + a **hunting strategy** (ambush, chase,
   siege, swarm, guard, lure, harass) + a **counterplay** (what the player exploits: a slow
   turn, an exposed back, a long recovery, a weak point, fragile legs).
2. **Anatomy follows the pitch.** Each pitch element turns into anatomy requirements:
   - "snaps shut" → a `Shell` that opens, plus a `Mouth`/`Blade` inside
   - "exposed core" → an `Orb` weak point that is only visible during recovery
   - "slow turn" → a heavy `Core` with long, wide legs (the turn rate comes from the body, §11)
   - "chases" → long legs or wheels, a light core
   The body plan and the grammar are chosen to satisfy these requirements, not at random.
3. **Every part must justify itself.** Each slot in the blueprint stores a `purpose`:
   `Locomotion`, `Attack(abilityId)`, `Defence`, `Sense` (eyes, antennae), `WeakPoint`,
   `Signature`, `Connector` or `Ornament`. Rules:
   - **No orphan parts.** A part without a purpose is removed.
   - **Ornaments are capped** (default ≤ 25% of visible surface) and must follow the
     shape language (§13.1).
   - Every **ability** points to the part that performs it, and every **Attack** part has an
     ability. If a part looks like a weapon (a big Tube or Blade), it has to *be* one, or it
     gets swapped out. Players read big weapons as threats, so a fake one is a lie.
4. **Look** (palette, emissives, wear) is applied to support the pitch: the weak point glows,
   the threatening part is the focal point, ambushers use muted colours.

This means two enemies built from the same parts can be completely different creatures,
because the *idea* is different.

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

### 8.5 Proportion play and uncanny creatures (without breaking anything)
Uncanny creatures come from **familiar things in the wrong number, place, proportion or timing**:
human hands as feet, a face on a belly, a neck that is a little too long, four elbows, a body
that is perfectly still and then snaps. The system supports this on purpose, with guard rails.

**Distort the skeleton, not the meshes.**
- Proportion knobs live on the *skeleton*: limb length ×0.5–×3, neck length, segment count per
  limb (2–5 joints), head-to-body ratio, stance width, knee direction, body height.
- A long limb is made by **adding segments** (three forearms chained with connectors), never by
  stretching one mesh ×3. Mesh stretch stays within the limits in §8.3, so the low-poly detail
  density stays consistent and nothing looks smeared.
- Every derived value is **recomputed after distortion**: IK reach, stride length, step time,
  body height, centre of mass, support polygon, turn rate, NavMesh agent size, melee reach.
  Gait and speed are always *computed from* the skeleton, so a creature with 3 m legs simply
  takes long, slow steps. It can't "break" the animation, because nothing is hand-authored.

**Uncanny levers (pick 1–2 per creature, from the `UncannyBudget`)**
| Lever | Example |
|---|---|
| Wrong count | 4-jointed arms, 3 eyes in a row, 7 legs (deliberately odd) |
| Wrong placement | hands as feet, a face on the abdomen, mouths on limbs |
| Wrong proportion | tiny head on a huge body, very long thin neck, oversized hands |
| Wrong orientation | backward knees on a human-like body, an upside-down head |
| Wrong motion | head stabilised in space while the body moves (chicken head), stillness then a snap, legs slightly out of phase, too-smooth gliding while the legs walk |
| Wrong material | a human body part made of wood or metal; flesh parts on a machine |

**Guard rails**
- `UncannyBudget` by theme and role: 0 for comedic or cute themes, 1–2 for horror, and
  more only for bosses. Too many levers turn creepy into noise.
- Keep **one anchor of familiarity**. If the legs are wrong, the torso is normal. Uncanny
  needs something recognisable to be wrong *against*.
- Distortions that change readability (attack reach, hitbox size) are shown honestly: a longer
  arm *does* reach further, and its telegraph scales with it.
- All distortions go through the validator (§13) and the critic (§13.1). The re-roll knob is
  the distortion amount, so a failing creature is pulled back towards normal proportions
  before it is thrown away.

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

### 12.1 Sound and VFX are kitbashed too (so they can be checked)
**Sound**: build each cue from layers instead of picking one clip per enemy:
```
cue = body layer (material family: metal clank, wood knock, bone rattle, flesh thud, stone grind)
    + action layer (whoosh, stab, slam, bite, fire, charge-up hum)
    + size layer (pitch and low-end set by mass: big = lower, slower, longer tail)
    + element layer (fire crackle, frost crack, poison bubble, void hum), from the theme
```
- Footsteps come from the **material of the foot part** (sword legs clink, human feet slap,
  wheels rumble), and their timing comes from the IK step events, so they always match.
- Every ability has 3 cue slots: **windup** (anticipation, the most important for
  readability), **impact**, **recovery**. Missing a windup cue is a QA failure (§13.2).
- Idle "voice": a short loop from the core's material family plus a vocal layer chosen by
  theme, pitched by size. Use a small number of variations with random pitch ±5%.
- Mix rules: per-species voice limit (e.g. max 3 simultaneous sources), mixer groups
  (Enemy/Footsteps, Enemy/Attacks, Enemy/Voice), and loudness pre-normalised at import.

**VFX**: chosen the same way: `FX_*` prefabs tagged by **delivery** (trail, muzzle, impact,
ground AoE, beam, aura) and **element**, then:
- spawned at the part's socket, scaled from the part's bounds (not a fixed size)
- tinted from the palette accent through a property block
- given a particle budget per size class, and pooled

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

### 13.1 Final art-direction pass: the Critic
The validator (§13) checks that a creature *works*. The Critic checks that it *looks designed*.
It runs on the finished blueprint, after assembly and look, and scores it. Below a threshold
the creature is repaired (the worst-scoring part is swapped) or re-rolled.

**Runtime checks (cheap, deterministic, no AI needed)**
| Check | What it measures | Why it matters |
|---|---|---|
| Material family | share of the dominant family (bone/metal/wood/stone/flesh/cloth) | one material story reads as one creature |
| Palette harmony | colour spread of all visible swatches after palette remap (in Oklab), number of distinct hues | stops rainbow kitbash |
| Shape language | variance of angularity across parts (round vs angular vs boxy) | one shape language = one design; mixing reads as a pile |
| Mass hierarchy | volume ratio of the primary, secondary and tertiary masses (target roughly 60/30/10) | classic creature-design rule; flat hierarchies look like a pile |
| Detail density | triangles per m² of each part after scaling, compared with the creature's median | a ×4-scaled part looks blobby next to a detailed one; this is the biggest kitbash tell |
| Rhythm | repeated parts are identical or a planned sequence (big → small along a tail) | repetition reads as anatomy; random variety reads as junk |
| Focal point | exactly one part is clearly biggest/brightest/most unusual | the eye needs somewhere to land |
| Silhouette | from 3 camera angles: readable outline, at least 2 distinct protrusions, not a blob, not a cloud of bits | players recognise enemies by silhouette first |
| Visual noise | edge density inside the silhouette mask | too many small parts = noise at gameplay distance |
| Seams | every joint between different packs or sizes has a connector | hides "glued on" joints |
| Purpose | no orphan parts; weapon-looking parts have abilities (§7.4) | form matches function |

**Editor/offline checks (slower, used to tune the rules)**
- **Vision critic**: the Gallery renders a turntable thumbnail of each species, and your Unity
  Claude (it can take screenshots through MCP) rates it against a short rubric ("Does this read
  as one creature? What is the focal point? What looks glued on?") and names the part to fix.
  Its notes are used to tune the Critic's weights and thresholds. It doesn't run at runtime.
- **Human thumbs up/down** in the Gallery. Ratings are stored with the genome and used to
  re-weight scoring (§8.2) and to fill the curated seed bank (§18.3).

No automatic check can promise "exciting". What this setup does is reliably reject the
"slapped together" results and keep improving the rules from human and AI feedback.

### 13.2 Proving Ground: automatic QA for movement, attacks, VFX and SFX
The Critic (§13.1) checks a still creature. The **Proving Ground** checks it *in action*. It is
fast, cheap and deterministic: numbers measured from a short simulation, no AI or humans
needed per creature.

**How it runs**
- An empty arena scene with flat ground, a ramp, steps, a narrow gap, a wall and a scripted
  dummy player (strafes, approaches, retreats, stands still). No rendering needed except for
  the few checks marked 📷.
- Each species runs a fixed **8-second script** at `Time.timeScale = 4–10` with a fixed
  timestep, so it takes about **1–2 s per species** of real time. Batch it in the editor
  (hundreds per hour), or run one quick **1-second dry run** during the runtime bake for new
  species, using the movement and ability timelines only (no physics scene needed).
- Results are a pass/fail list plus numbers, stored with the genome. Failures go back to the
  repair/re-roll loop, like the validator.

**Movement checks**
| Check | Measured as | Fails when |
|---|---|---|
| Foot sliding | foot movement while it is planted | > 2 cm per step on average |
| Ground penetration / floating | foot and body distance to the ground | > 5 cm under, or feet in the air when they should be planted |
| Jitter | body acceleration and jerk spikes, rotation snaps | spikes above a threshold (usually IK flipping or springs exploding) |
| Self-intersection | capsule overlaps between parts during walk and attacks | parts passing through each other |
| Stuck / nav | progress towards the target on the course | stuck > 1 s, falls off the NavMesh, can't climb the steps it should |
| Gait sanity | step frequency vs speed, leg phase pattern | legs stepping in sync when they shouldn't, wild stepping at low speed |
| Turn and speed | measured vs expected from the body (§11) | a 10-ton creature turning like a cat |
| Stability | centre of mass inside the support polygon | tips over while walking |

**Attack checks**
| Check | Measured as | Fails when |
|---|---|---|
| Hit/visual sync | the hitbox's active frames vs the speed peak of the attacking part | hitbox active while the part is still winding up or already recovering |
| Reach honesty | where hits land vs where the part tip actually is | hits from beyond the visible part |
| Telegraph | windup time, glow, cue all present before damage | a big hit with < 0.35 s windup or no cue |
| Can it hit at all | hit rate against the standing and strafing dummy | never hits (useless) or always hits strafing targets (unfair) |
| Whiff in range | attacks started vs attacks that could connect | attacks constantly at nothing |
| Recovery window | time vulnerable after each attack | no opening for the player |
| Balance | measured DPS and time-to-kill vs the threat budget | outside ±15% |
| Projectiles | origin at the muzzle socket, clear line of fire | projectiles spawning inside its own body or wall |

**VFX checks**
| Check | Fails when |
|---|---|
| Anchored | effect spawns more than 10 cm from its socket or doesn't follow a moving part |
| Scale | effect bounds are less than 0.5× or more than 3× the part bounds |
| Budget | live particle count or estimated overdraw over the size-class budget |
| Colour | dominant colour is far from the palette accent (Oklab distance) |
| Lifetime and pooling | effect still alive 5 s after the ability ends, or not returned to the pool |
| 📷 Readability | in a low-res capture from the gameplay camera, the telegraph is not visible or the effect covers the whole creature |

**SFX checks**
| Check | Fails when |
|---|---|
| Coverage | any ability is missing a windup or impact cue; footsteps missing on a legged creature |
| Sync | impact sound more than 50 ms from the hit event; footstep more than 50 ms from the foot plant |
| Material match | the cue's material layer doesn't match the part that makes the sound |
| Loudness | cue loudness outside the target range for its mixer group |
| Spam | more than N sources at once from one creature, or the same clip repeating 3+ times in a row without variation |
| Size match | cue pitch/weight doesn't fit the size class |

**Cost and reliability**
- All checks are plain numbers from deterministic runs, so the same seed always gives the
  same result. They are reliable enough to block a creature automatically.
- The costly part, a visual and motion judgement, is done **only on a small sample**: the
  Gallery records a 3-second clip or a contact sheet of frames for ~5% of species (and every
  species that just barely passes). Your Unity Claude reviews those, names what feels off
  ("legs look weightless", "windup too subtle"), and the answer becomes a **new threshold or a
  new check**, so the cheap checks keep getting better.
- In practice: the numbers catch the broken ones, a sampled AI or human review catches the
  "technically fine but feels wrong" ones, and those lessons become new numbers.

---

## 14. Runtime performance and spawning

Two rendering paths. Start with **Path A** (simpler, fine for tens of enemies). Move to
**Path B** when you need hundreds of enemies or many species at once.

### Path A: GameObjects with merged meshes (v1)
1. **Species bake** (time-sliced `Awaitable`, ~2 ms per frame):
   - One GameObject per *moving segment*, not per part.
   - **Merge static parts per segment and per atlas** using the MeshData API on a worker thread
     (`Mesh.AllocateWritableMeshData`).
   - LOD1 (fewer ornaments) and LOD2 (whole body as one mesh, no secondary motion) in a
     `LODGroup`.
   - Build colliders, the ability runner and the brain; register the skeleton with ProcAnim.
   - Store as a **species template** in a `SpeciesCache` (LRU, e.g. 24 species).
2. **Spawning**: `ObjectPool<EnemyInstance>` per species, pre-warmed. Variation through
   property blocks, root scale and an ornament toggle. No mesh rebuilds.

### Path B: no GameObjects per segment (the scalable path)
Rigid parts on a procedural skeleton have a special property: **every part is just a shared
mesh plus a matrix**. Nothing is skinned. So:
- Render all enemy parts through **`BatchRendererGroup`** (or Entities Graphics if the project
  uses DOTS). Each source part mesh is registered once. Every frame, the ProcAnim job writes
  one matrix per visible part straight into the BRG instance buffer.
- Result: **one instanced draw per unique part mesh per material across all enemies**, no
  per-species mesh merging, and **memory stays flat no matter how many species exist**, because
  species share the library's meshes. Generating a new species costs almost nothing to render.
- Only the brain, hit zones and NavMesh agent need a GameObject (one per enemy), or none at all
  with an ECS brain.
- Frustum culling and LOD selection happen in the same Burst job that writes the matrices.
- Far LOD: switch to **octahedral impostors** baked per species in the background (one quad
  per enemy), which also suits huge swarms.

### Common to both paths
- **Physics without per-part bodies**: hit zones are capsules in the blueprint. Attacks use
  batched `OverlapBoxCommand`/`SpherecastCommand` queries from jobs, and the player's attacks
  check against a compact list of hit zones. A kinematic root per enemy, or none.
- **Dismemberment for free**: hurt or "kill" a part by hiding its matrix (Path B) or its child
  (Path A), and spawn one physics debris copy from a small pool.
- **Pre-generation**: the `EnemyDirector` builds the *next* encounter's species in the background
  while the player fights the current one.
- **Library as a blob**: the part library is baked into one blittable binary (`BlobAsset` or a
  `NativeArray` set) with pre-built query buckets. Generation never touches managed objects.
- **No GC in hot paths**: no LINQ or allocation in Update paths; strings only at bake time.
- **Measure**: the `KitbashStats` overlay shows species count, instance count, draws, part
  matrices per frame, job times and generated-mesh memory.

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
- Grammar primitives (§5.1) and `BodyPlan` assets for Biped, Quadruped, Arachnid, Floater and Construct; genome; assembler
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
- Layered SFX and VFX selection (§12.1); the Proving Ground arena and its checks (§13.2).
- ✅ Every generated enemy has ≥ 2 working attacks that come from its parts, and every big hit
  is telegraphed.
- ✅ 200 seeds through the Proving Ground in under 10 minutes; ≥ 90% pass on the first try and
  every failure names the failing check.

**Phase 6: Concept layer**
- Themes, twists, naming, threat budget, coherence and validation, re-roll and repair.
- Pitch → anatomy (§7.4), the purpose of each part, proportion knobs and the `UncannyBudget` (§8.5),
  the Critic (§13.1) and the vision-critic step in the Gallery.
- ✅ 100 seeds: ≥ 95% pass validation and the Critic within 6 re-rolls; every creature has a pitch
  and no orphan parts; names read naturally.

**Phase 7: Performance and production**
- Species cache, pooling, mesh merge, LODs, time-sliced bake, pre-generation, death
  break-apart, spawn reveal, the rest of Tier A, then Tiers B and C from §5.2 (one new motor
  module at a time).
- Path B rendering (BatchRendererGroup) once Path A works, measured against Path A (§14).
- ✅ The soak test runs clean; no frame over budget while species bake.

**Phase 8: Director**
- `EnemyDirector`: picks role mixes for encounters, novelty vs familiarity (bring back known
  species so players learn them, introduce one new species per encounter), bestiary saving.
- Part damage changes behaviour (§19 item 2).

**Phase 9: Variety and bets**
- MAP-Elites archive and curated seed bank (§18.3); the measured count of filled cells goes into
  `KITBASH_DECISIONS.md`.
- Optional: lineage breeding in the Director (§19 item 7).
- ✅ The archive report lists filled and empty cells; runtime mutations of elites pass the Critic
  at least 90% of the time.

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

## 18. How many meaningfully different enemies?

### 18.1 What counts as "different"
Raw combinations are meaningless (swapping one bolt makes a "new" enemy). A player sees two
enemies as different when at least one of these is different:
1. **Silhouette / topology** (what shape is it?)
2. **Locomotion** (how does it move?)
3. **Behaviour** (role and hunting strategy: how does it fight?)
4. **Signature attack or twist** (what is the trick?)
Theme and material are a *reskin*: it looks new, but you fight it the same way.

### 18.2 Honest estimate
| Axis | Distinct values a player notices |
|---|---|
| Topology (named plans + grammar inventions + one graft) | ~40 named, roughly 80–120 with grammar and grafts |
| Locomotion feel | ~18 motor styles, partly tied to topology |
| Behaviour (role × hunting strategy, valid pairs) | ~30 |
| Signature attack / twist | ~25 |
| Theme / material look | ~15 |

Not every combination makes sense, and many feel alike, so most of the raw product is not
"meaningful". Rough numbers:
- **Distinct ways to fight** (topology × behaviour × signature, after removing invalid and
  look-alike combinations): **in the low thousands**, roughly 2,000–5,000.
- **Visually distinct creatures** (adding theme and proportion/uncanny variation): **tens of
  thousands**.
- **Individuals** (parts, colour, scale): effectively unlimited, but these read as variants of
  the same species, which is what you want for recognisable enemies.

These numbers are estimates. §18.3 shows how to *measure* the real number for your library
instead of guessing.

### 18.3 Measure and guarantee variety: a quality-diversity archive
Use **MAP-Elites**, a quality-diversity search, offline in the editor:
- Pick 3–4 **descriptor axes** that the player perceives: topology class, locomotion class,
  preferred range, size class, silhouette aspect ratio, number of protrusions.
- The archive is a grid over those axes. Run the generator on thousands of seeds overnight.
  Each creature lands in a grid cell. A cell keeps only its **best** creature, scored by the
  Critic (§13.1) + validator + human ratings.
- The number of **filled cells** is your real, measured count of meaningfully different
  enemies. **Empty cells** show what the library or grammar can't make yet ("no fast-moving
  Large artillery"), which tells you what parts or rules to add.
- Ship the archive as a **curated seed bank**. At runtime the Director (a) spawns elites
  directly for guaranteed quality, and (b) **mutates** them (a few genes changed) for novelty
  that stays close to known-good designs.

---

## 19. What is new here, and the bets we are making

Honest prior art: procedural creature animation (Spore, Rain World), modular creatures from
pre-made part sets per archetype (No Man's Sky), part-based generation with stats from parts
(Borderlands weapons), and IK-driven multi-legged walkers are all well established. This design
doesn't claim a brand-new technique. What's unusual is the **combination**, and a few specific
ideas:

1. **Any mesh is anatomy (shape affordances).** Other systems use parts *made* to be creature
   parts. Here every mesh in every pack is classified by shape, so the part library is ~10× larger
   and the results are surprising by default.
2. **Parts are verbs.** Abilities come from parts, so **damaging a part changes behaviour**: shoot
   off the cannon and it can't fire; break two legs and the IK makes it limp and slows it down.
   Dismemberment becomes a combat system without extra authoring.
3. **Physics-honest movement.** Speed, stride, turn rate and stability come from the generated
   body, so the way a creature moves always explains how it's built.
4. **Purpose-first generation with a Critic.** Pitch → anatomy → parts → look → critique, so
   creatures have a reason to exist and slapped-together results get rejected.
5. **Measured variety (MAP-Elites).** You know how many distinct enemies you have and where the
   gaps are, instead of guessing.
6. **Zero-cost species (BRG path).** Because nothing is skinned, a new species costs no extra
   mesh memory and no extra draw calls.
7. **Lineages (optional, run-based games).** The Director **breeds** new species from the ones
   that did well against *this* player (inherit parts and genes, mutate the rest). If the player
   relies on ranged attacks, shields and gap-closers become more common. Players see family
   resemblances across a run, an evolving ecosystem instead of random spawns.

Treat 6 and 7 as bets: prototype them after the core works, and measure them before committing.

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
