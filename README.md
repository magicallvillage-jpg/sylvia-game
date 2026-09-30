# Sylvia 🐾 – 3D virtual pet (Part 1)

React 18 + Vite + TypeScript, three / @react-three/fiber / drei, zustand (persisted), Web Audio (all sounds synthesised), English + Persian (RTL).

## Run

```bash
npm install
# put your model at:  public/models/sylvia.glb
npm run dev          # http://localhost:5173  (also reachable from your phone on the same Wi-Fi)
npm run build        # -> dist/
npm run preview      # test the production build locally
npm run typecheck    # optional strict TypeScript check
```

**No `sylvia.glb` yet?** The game still runs: a procedural chibi kitten is used as a fallback (with the same animation system), and the console tells you so.
`texture_0.png` is only needed if your GLB references it as an *external* file; Meshy exports normally embed it inside the `.glb`. If yours doesn't, keep both files in `public/models/`.

## Deploy

The app is a static site with no router, so any static host works.

| Host | Steps |
|---|---|
| **Netlify** | New site from Git → build command `npm run build`, publish directory `dist`. Nothing else. |
| **Vercel** | Import the repo → framework "Vite" (auto-detected). |
| **GitHub Pages** | Build with the repo name as base: `VITE_BASE=/your-repo/ npm run build`, then publish `dist/` (e.g. `npx gh-pages -d dist`, or a Pages workflow that uploads `dist`). |

`vite.config.ts` reads `VITE_BASE` (default `./`, which works at a domain root). Model URLs use `import.meta.env.BASE_URL`, so they follow the base automatically.

## Controls

| | Touch | Desktop |
|---|---|---|
| Pet | drag over her head/body (purr + hearts) | same with the mouse |
| Boop / poke | tap (ears, head, tail, body react differently) | click |
| Hop | double-tap | `Space` |
| Hug | long-press | Hug button |
| Feed | Kitchen → Fridge → tap a food, or drag it to her mouth | `E` opens the fridge |
| Bath | Bathroom → Bath → soap (drag) → shower (toggle) → towel (drag) | same |
| Sleep | Bedroom → Sleep, or tap the lamp | `E` |
| Rooms | bottom bar | `←` `→` / `A` `D` |
| Menu | ⚙️ | `Esc` |
| Debug panel | – | `F2` (dev builds only) |

Too many quick pokes make her grumpy (comedic puff + sulk); a hug forgives her.

## Tuning the model (`src/config/modelConfig.ts`)

I could not see your GLB, so the first run may need small adjustments. Press **F2** in `npm run dev` for the debug panel: it lists the bones / meshes / morph targets / clips found in your file, which nodes were mapped, and gives live sliders. **Copy config JSON** prints the values to paste back into the config.

- **Name mapping** – `clipMap` (animation clip names), `boneMap` (bone / part names, case- and punctuation-insensitive substrings), `morphMap` (expression blendshapes). Add your own names to the arrays.
- **Facing** – if she looks away from the camera, set `yawOffset` (e.g. `Math.PI`) or use the yaw slider.
- **Size** – `targetHeight`, `stageScale` (baby / kid / teen / adult).
- **Bone axes** – if a rig's ears / tail rotate around the wrong axis, change `nodeAxes` (e.g. `ear: [1, 0, 0]`), or set a gain to `0` to disable that part.
- **Face overlay** – used only when the GLB has no expression morph targets. The plane is placed automatically by ray-casting at `face.yRatio` of her height, then follows the head bone. Fine-tune with the x/y/z/scale/rotate sliders. `face.showOnNormal: false` keeps your painted face for the normal state and only draws the overlay for other expressions (happy, sad, sleepy…); set it to `true` to always use the drawn anime face. `face.mask` paints a soft skin patch behind the drawn features so the painted face underneath is hidden.
- **Touch regions** – `regions` (ratios of her height) decide what counts as ear / head / cheek / body / belly / tail.

### Animation layers (all three are active)
1. **Clips** – if the GLB has clips whose names match `clipMap`, they play with cross-fades.
2. **Skeleton** – otherwise head, neck, ears, tail, arms and hair/ahoge/poncho/earring bones are posed procedurally, with damped-spring follow-through.
3. **Whole body** – squash & stretch (volume-preserving), breathing, hops, waddle, tilt and a wobble spring always run, so even a static single-mesh model feels alive. Named separate parts (Ear, Tail…) are animated on their own.

## How to add things

- **A food** – add a row to `src/data/foods.ts` and a `food.<id>` string in `src/i18n/index.ts` (en + fa).
- **A language string** – add the key to both dictionaries in `src/i18n/index.ts`.
- **A room** – add the id to `Room` / `ROOMS` in `src/store/uiStore.ts`, an x position in `src/game/layout.ts`, a component in `src/game/Rooms.tsx` (register it in `BODIES`), a `room.<id>` string, and an icon in `src/ui/HUD.tsx`.
- **A save-schema change** – bump `SAVE_VERSION` in `src/store/gameStore.ts` and add an `if (version < N)` block in `migrateSave`.

## Part 1 – what is implemented

- Project setup, lazy-loaded 3D chunk, cute loading screen, 4 procedural low-poly rooms (living room, kitchen, bathroom, bedroom) with camera slide transitions; aspect-aware camera so she is always fully visible (portrait + landscape, safe-area insets).
- `SylviaCharacter`: GLB load with centring / scale normalisation / feet pivot, toon materials with gradient map + inverted-hull outline (original textures kept), 3-layer animation fallback, 26 procedural poses incl. 8 idle variants, face via morph targets → canvas overlay → floating emotes, automatic blinking, pointer-following eyes, growth stages (scale + head proportion cheat), dev debug panel, procedural fallback character.
- Stores with `persist`, versioned schema + `migrate`, try/catch storage with in-memory fallback, autosave on change + `visibilitychange` / `pagehide`, export / import JSON, reset with confirmation.
- Needs (hunger, hygiene, bladder, energy, happiness, affection) with slow real-time decay, mood → expression / thought bubble, never dies; offline progress (capped, floor at 12) with a "Welcome back" panel; XP / levels to 99 with level-up celebration; coins; growth stages.
- Care loop: feeding (24 foods, 6 categories, favourites / dislikes, overfeeding → burp + sleepy + bladder), toilet (stylised, privacy screen, flush), bath (soap foam → shower → towel → shake-off), sleep (bed, lamp, lullaby, dim room, auto-wake, grumpy wake-up), petting / boop / hug / hop / grumpy pokes, quick play.
- Instanced particles (hearts, sparkles, stars, bubbles, drops, Zzz, crumbs, confetti, anger marks, notes, smell lines, foam, water) with quality-scaled budgets.
- Synthesised audio (meows, chirps, giggles, purr loop, chew, splash, flush, coin, level-up, per-room music, lullaby), volume sliders + mutes, AudioContext unlocked / resumed on gesture and paused when the tab is hidden.
- Day / night from the device clock (lights, sky, stars), graphics Low / Medium / High, reduce motion, text size, colour-blind-friendly bars (patterns + numbers), EN / FA with RTL.

## Coming in the next parts

Garden (pond, weather), shop + wardrobe + photo booth, room decoration, doctor, microphone talking, drag-and-throw roughhouse physics, daily rewards / quests / achievements / album / diary, personality-driven extras, the 8 mini-games, onboarding hatching cutscene and tutorial. Rapier is intentionally not installed yet; it will be added together with the throw physics, where it earns its weight.

## Notes

- Everything per-frame (positions, springs, timers, particles, face texture state) lives in refs / mutable objects and `useFrame`; React state is only used for UI that changes a few times per second or less.
- Geometry / materials / textures created by the character, face overlay and particle system are disposed on unmount or quality change. Room props share a small set of geometries and toon materials for the app's lifetime.
- The outline of a morph-target mesh does not follow its morphs (tiny difference).
