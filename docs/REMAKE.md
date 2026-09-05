# KOAN.hang — REMAKE spec (2026-09-05)

**Decision (owner, 2026-09-05):** remake KOAN.hang on the Messenger pattern. Not a patch: a new shell built the
way Messenger is built, then the room, the hang rules and the files moved in unchanged.

Reference: **Messenger** by Abeto, https://messenger.abeto.co/ ("It's a small planet, but someone's gotta
make the deliveries"). Everything said about it below is **PROVEN** by reading its shipped files
(`webgl-*.js` entry, `App3D-*.js` 1.9 MB chunk, its network log) on 2026-09-05. Nothing is guessed from its name.

Every line below is **PROVEN** (read from their build or ours), **PLAN** (what we build), or **OPEN** (his call).

---

## 1. How Messenger is built (PROVEN)

| layer | Messenger | evidence |
|---|---|---|
| build | Vite. One entry module, one 1.9 MB app chunk, workers as separate chunks, modulepreload | `index.html`, chunk names |
| world | three.js **r180**, WebGLRenderer (WebGPU probed, not used) | `REVISION="180"`, 34 WebGLRenderer refs, 1 WebGPURenderer |
| UI | **Svelte 5** draws the HTML layer. Tweakpane for the debug panel | Svelte 5 mount runtime in the entry, `.tp-dfwv` css |
| embed API | `window.__webgl.start({cnt, interactionNode, relativePath})`: the whole game mounts into any container | entry module |
| workers | 8: draco, geometry, charactergeo, collision, bitmap, exr, glyph, msdf. Decode and collision off the main thread | `new Worker(...)` list |
| geometry | every mesh Draco `.drc`, streamed per scene folder (`planets/intro/`, `planets/present/`) | 173 `.drc` refs, network log |
| textures | every image **KTX2 / Basis** (`.ktx2`), transcoded in wasm | 75 ktx2 refs, `basis_transcoder.wasm` |
| batching | InstancedMesh (25) and **BatchedMesh** (41): many objects, few draw calls | counts |
| materials | 118 ShaderMaterial, 7 RawShaderMaterial, a few Standard/Toon. Looks are shaders | counts |
| effects in shaders | clouds, water, waterfall, terrain, galaxies = noise textures (`clouds_noise_64/512`, `water-noises`, `noises-terrain`) + shader, not meshes | network log |
| post | EffectComposer: RenderPass, ShaderPass, depth texture, **LUT grade** (`lut.ktx2`), outline, dither, SMAA | 280 `lut`, 104 `outline`, 55 `dither`, 19 SMAA |
| collision | **three-mesh-bvh** + capsule character controller. No physics engine | 15 MeshBVH, 23 Capsule, no rapier/cannon/ammo |
| text | MSDF glyphs, built in a worker | msdf/glyph workers |
| audio | WebAudio, positional, driven by events | `webgl_play_positional` |
| glue | one **event bus**: `webgl_play_audio`, `npc_dialog_open`, `ui_show_sideicons`, `switch_to_present_scene`, `toggle_loader`, `resize`, `visibility_change`... World and UI never call each other, they emit | 131 `events.emit` |
| scheduling | own `createDelayedCall`, one render loop, `render_active` gate when hidden | counts |
| world-anchored HTML | side buttons, dialog button, emoji bubbles are absolutely positioned divs moved each frame to 3D anchors | DOM |
| quality | `QUALITY` tiers, `setPixelRatio` by tier, `matchMedia` probes | counts |
| talk | characters speak in emoji, no strings to translate | `character_emoji_display` |

**Owner, 2026-09-05: "use everything they're using."** The whole stack above is ours. What we do NOT copy: planets, gravity, quests, NPCs, the game itself.

---

## 2. Our remake, the shape (PLAN)

Their stack, whole: Vite, three.js r180, Svelte 5, Tweakpane, three-mesh-bvh, Draco, KTX2, workers, composer, MSDF, WebAudio, embed API.

```
web/
  index.html                one container, one entry
  src/
    main.ts                 boot: mount UI, start world, wire the bus. Nothing else
    bus.ts                  the event bus. The only way world and UI talk
    world/                  three.js only. Never touches the DOM
      renderer.ts           renderer, composer, quality tier, resize, render_active
      loader.ts             fetch → worker decode → GPU upload. Every asset goes through it
      workers/              bitmap.worker.ts (images → ImageBitmap), ktx2 via three's KTX2Loader worker pool, draco pool
      room/                 the level built from level.json + objects.json (today's level.ts, moved)
      art/                  ArtSystem (today's art.ts, moved): library, hold, plan, hang, select, files
      walk.ts               capsule walker on a BVH of the room (today's walk.ts, collisions via three-mesh-bvh)
      looks/                lut.ts, sky.ts, plants.ts, glass.ts, surface.ts (shaders, §4)
      anchors.ts            world points the UI may follow (HANG widget, hung-work labels)
    ui/                     Svelte 5 only. Never touches three.js
      App.svelte, Cards (Inventory, Hang, File), Hud, Widget (HANG), Keys, Debug (Tweakpane)
    text/                   MSDF font atlas + glyph worker, labels in the world
    audio/                  WebAudio, positional, driven by bus events
    embed.ts                window.__koanHang.start({cnt, relativePath}): mounts the room into any container
  public/data/              level, textures (ktx2), art index, font atlas
```

Rules of the shape:
1. `world/` never imports `ui/`, `ui/` never imports `world/`. Both import `bus.ts`.
2. The main thread draws. Decoding (images, ktx2, draco) happens in workers.
3. One render loop, paused when the tab is hidden (`render_active`), never a second timer.
4. Looks come from shaders and one LUT, not bigger images.
5. Highest quality is the default. Lower tiers are visible dials, never chosen for him ([[highest-quality-default]]).

**UI layer: Svelte 5** (owner, 2026-09-05). Today's hand DOM (`ui.ts`, 129 lines) is rewritten as Svelte components. Same cards, same words, same KOAN bible chrome (one var contract, mono, drawn icons) expressed as component CSS. Tweakpane debug panel: off by default, backtick opens it, never in the shipped look.

---

## 3. Loader pipeline (PLAN)

Today (PROVEN): `TextureLoader().load()` of 12 jpg tiles (0.5 to 1.2 MB each, about 8 MB), art images as data URLs decoded on the main thread, the level built in the browser from JSON, no GLB shipped.

Remake:
| asset | today | remake |
|---|---|---|
| level geometry | built from `level.json` in the browser | same. It is ours, it is small, Draco buys nothing here |
| texture tiles | jpg, main-thread decode | **KTX2** (UASTC for the wall-white and concrete, ETC1S for the rest), `textures/make_tiles.py` grows a `toktx` step. Transcoded in three's KTX2Loader worker pool |
| sky | one jpg (P3) | KTX2 + the sky shader (§4) |
| art images | data URL in IndexedDB, decoded on the main thread on every rebuild | `bitmap.worker.ts`: `createImageBitmap` off-thread, cached per work, one upload |
| yard, plants | geometry | sprites + shader (§4) |
| scan | never shipped | never shipped |

Loader contract: `load(kind, url|blob) → Promise<GPU-ready thing>`, one queue, priorities (room first, then art, then sky, then yard), a `toggle_loader` event for the HUD bar.

---

## 4. Looks (PLAN, owner's list 2026-09-05)

In his order:
1. **LUT grade**: one 3D LUT texture, one ShaderPass at the end of the composer. One film look for the whole frame. LUT authored on his side (a `.cube` from any grading tool → `lut.ktx2`). Neutral LUT ships first so the room looks as today.
2. **Sky shader**: a dome, noise texture (64 and 512, like theirs), clouds drift with time, Tokyo tint from the LUT. No cloud meshes. The jpg sky stays as the fallback dial.
3. **Workers**: §3.
4. **Draco + KTX2**: KTX2 for every texture. Draco only if a mesh ever ships (sculptures, gate 2 of ART, may).
5. **Plants**: card sprites, wind shader (vertex sway by noise), instanced.
6. **Glass**: fresnel shader for the street windows, tinted reflection of the sky dome, no reflection geometry.

7. **Outline** (toon edges) and **dither**, theirs: yes (owner). Each a visible dial, on by default.

Post stack order: render (depth texture) → outline → dither → LUT → SMAA. All on by default (highest quality), dials to turn off.

**LUT**: a neutral LUT ships first (owner). He grades later, drops a `.cube` in `textures/`, the tile step makes `lut.ktx2`.

---

## 4b. Text, audio, embed (PLAN, "everything")

- **MSDF text**: one font atlas (the KOAN mono), glyph geometry built in a worker. Used for labels in the world: the hung work's title when looked at, the height readout at the guide line. HTML text stays in the cards.
- **Audio**: WebAudio, positional. Footsteps on concrete and stair, the door. Nothing else unless he names it. `audio_mute_toggle` on the bus, M is taken (map), so the mute lives on the HUD.
- **Embed API**: `window.__koanHang.start({ cnt, relativePath })` mounts the whole room into a container. The KOAN site can carry the gallery on a page.

## 5. UI anchored to the world (PLAN)

Today (PROVEN): the HANG widget and hangTip are fixed HUD elements. Messenger: divs moved each frame to 3D anchors.

Remake: `anchors.ts` publishes named world points (`hang-widget` = above the held work's ghost, `work:<id>` = above each hung work) on the bus every frame; `ui/widget.ts` positions the HANG card at `hang-widget` when a wall is hit, docks it to the HUD otherwise. Hung works get a small label at `work:<id>` when looked at. The cards (INVENTORY, HANG, FILE) stay fixed. The crosshair line stays fixed.

---

## 6. Carried over unchanged (PLAN)

- The room: `level/level.json`, `level/objects.json`, the build, the measurements, the textures list. `level.ts` moves to `world/room/` as is.
- Gate 1 of ART, every rule and key at `c830ca4`: inventory, hold, hang, snap top/centre/bottom/free, gap, refuse over door and work, select 1-9 0 , . [ ], Tab through hung works, 3 m reach, hands view (H), pick up (E), delete, arrows nudge, undo/redo, Esc twice, the prompts.
- Files: `koan-hang-layout/2` format, autosave draft, save/load with images, for Yozo.
- Walk: eye height dial, doors, stairs, minimap and big map. The capsule moves onto a BVH, the feel must match today.
- KOAN bible chrome: one var contract, mono, drawn icons.

Nothing gets a new name, a new key or a new card in the remake. A remake that changes what he sees is a failure.

---

## 7. Gates (PLAN)

Each gate is live on the site and tested before the next. Old app stays live until gate R1 reaches parity.

| gate | builds | done when |
|---|---|---|
| **R1 shell** | the shape (§2), bus, loader with workers (§3), room and walk and ART moved in, KTX2 tiles | he walks and hangs a show, sees no difference except loading. Script tests from gate 1 pass |

**R1 BUILT 2026-09-05** on branch `remake`, not merged, not live. PROVEN by script on localhost (dev and the `vite build` under `/koan-hang/`): room, 278 materials on KTX2 CompressedTexture, 4 bitmap workers, hang, gap, refuse over a work, hands view, reach, select, pick up, undo, file round trip, every card control through the Svelte UI, Esc twice, theme, debug panel on backtick. OPEN: his walk. One departure to decide: the walker still moves on the level's nav data (walls, openings, doors, stairs), as today, so the feel is identical; three-mesh-bvh is used for the room's occlusion ray (a work behind a wall is not looked at). A capsule-on-BVH walker changes how stairs and doors feel, so it waits for his word.
| **R2 looks** | LUT, sky shader, plants, glass, SMAA, dials | he says the room looks right. Screenshots in `docs/sheet/` |
| **R3 anchors** | HANG widget and work labels follow the world | he hangs with the widget on the wall |
| **R4 sculpture** | ART gate 2 from the old plan, on the new loader (Draco if a mesh ships) | his words when we get there |

Where the code lives: **branch** (owner). `web/` on branch `remake`, main stays live, merge at R1 parity. Pages deploys main only, the branch is previewed on localhost until parity.

---

## 8. Answered (owner, 2026-09-05)

1. UI layer: Svelte 5, and everything else they use.
2. Where: branch `remake`.
3. Outline and dither: yes.
4. LUT: neutral first, he grades later.

Nothing open. R1 starts on GO.

---

## 9. Not in the remake

Planets, gravity, NPC dialog, quests, emoji speech. If any is wanted later, it is a new spec line in his words.
