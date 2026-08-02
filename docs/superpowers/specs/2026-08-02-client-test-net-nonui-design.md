# Plan: Complete the client unit-test net (non-UI), as parallelizable vertical slices

## Context

The Unbound client (`packages/client`, a Discord mobile mod run under `bun test`) has a unit-test net
for its metro module-search engine, cache, base `Manager`, `Addons` lifecycle, and the `utils`
package. Coverage of the tested files is high (filters/state/cache/base ~100%), but whole layers have
**zero** tests: `api/storage`, `api/assets`, `api/toasts`, the concrete managers
(`plugins`/`themes`/`fonts`/`icons`), the three zustand `stores/`, `lib/loader`, `lib/force-render`,
plus real gaps inside `metro/index.ts` and `managers/addons.ts`.

This plan extends the net to **all remaining non-UI, non-React-rendering logic**. UI components
(`ui/**`), builtins (`builtins/**`), and top-level bootstrap (`entry.ts`, `index.ts`,
`preinitialize.ts`, `shims.ts`) are out of scope. `api/patcher.ts` / `possess` internals stay excluded
per the earlier scope decision.

It is delivered as **independent vertical slices (tracer bullets)** so multiple agents can work
concurrently: each slice owns its own test file(s), declares its own substrate, and is verifiable
alone. The document is written so any agent can pick up a single slice section and execute it without
reading the others.

### Locked decisions

- **Include the metro/addons gaps** (Slice E, F).
- **Depth: every meaningful branch** (happy path, guards, error/degrade, twins) on each tested file.
- **Discord-fact-dependent parts** (Fonts' `Constants.Fonts` grouping, Icons' `Assets` rewrite) are
  tested against a **synthetic Discord shape** that a dedicated fixture explicitly owns and flags.
  This is a deliberate departure from the metro suite's "zero Discord bundle facts" rule, confined to
  `discord-fixture.ts`.
- **Both** `lib/loader.ts` and `lib/force-render.ts` are in scope.
- One phased effort on the current branch (`test/client-runtime-primitives`), each slice its own commit.

## Governing conventions (every slice follows these)

Derived from the existing suite — match them exactly.

- **Harness:** `mock.module(...)` the RN-backed deps + install globals **before** a dynamic
  `await import()` of the unit under test. Static imports hoist above the mocks and run side effects
  against `undefined`. See `packages/client/tests/reload.test.ts` and `tests/metro/find.test.ts`.
- **`bun test --isolate`** for any slice that installs globals (bun shares globals across files in one
  run). `packages/client/package.json`'s `test` script is already `bun test --isolate`.
- **Reuse `tests/helpers/metro-fixture.ts`** (`installMetroGlobals` / `installCacheGlobals` /
  `installSubstrateMocks` / `makeModule` / `defineGlobal`). Extend, don't fork.
- **No `as any` / `as unknown` casts** in tests (`ast-grep` `no-double-type-assertion` blocks
  `x as unknown as T`). Route host-global writes through the one typed `defineGlobal<T>` boundary.
- **Comments:** only non-obvious *why*. No narration, no restating the test title. Hyphens, not
  em-dashes. New helper files carry a header stating the contract they own and what they don't model.
- **Test by varying an option over a fixed input** — no tautologies (don't plant a module and assert
  it comes back). Each assertion must exercise a distinct branch.
- **Bugs are reported, not fixed.** A slice that finds a bug lands a test documenting the *current*
  behaviour, titled with the existing `FINDING:` / `MUTATION PROBE:` prefix and a comment stating what
  correct behaviour would be. **No source file is modified by any slice.**

## Verified substrate facts (read before writing fixtures)

- `~/api/native` calls `alert()` at import when `UnboundNative` is absent; `~/api/fs` reads
  `FileManager.DocumentsDirPath` at import. Both are neutralised by `installSubstrateMocks`. **Any slice
  importing `~/api/fs`, `~/lib/cache`, `~/managers/base`, or a manager must stub them.**
- `~/api/metro/common` eagerly reads `window.ReactNative` / `window.React` at import (plain snapshots,
  not proxies); the rest (`Assets`, `Constants`, …) are `lazy(() => require('~/api/metro').findByProps(...))`
  proxies that resolve — and walk the whole registry — on **first property access of any kind**. Slices
  touching them must `mock.module('~/api/metro/common', …)`.
- `~/api/storage` snapshots `globalThis.UNBOUND_SETTINGS` into a module-level `const settings` at eval,
  and registers `Events.on('changed', debounce(persist, 100))` at eval. No immediate fs write on import.
  Define the global **before** the dynamic import; control the 100ms timer with `jest.useFakeTimers()`.
- `~/lib/loader.ts` runs `globalThis.window ??= globalThis` at import, imports only
  `@unbound-app/logger` (no RN). `deferredCalls`/`unpatches` are module singletons — needs `--isolate`.
- `~/lib/force-render.ts` imports real `react` (present devDep), no RN.
- `themes.ts` / `plugins.ts` / `fonts.ts` / `icons.ts` construct a module-level singleton at import
  (`export const themes = new Themes()`), which calls `storage.getStore` + `createPatcher` — so the
  storage mock must be in place before the import even when the test uses a fresh instance.
- `zustand` v5 `create()`/`getState`/`setState` work headless, no shims.
- `possess`' `createPatcher` works headless (already proven by `lifecycle.test.ts`).

## Shared helpers & the collision rule

`tests/helpers/metro-fixture.ts` is the hottest merge point. **It is FROZEN for all slices except E**,
which may edit it only additively. Every other slice that needs new substrate creates a **new helper
file it exclusively owns**:

| Helper (new file) | Owner | Consumed by |
|---|---|---|
| `tests/helpers/store-fixture.ts` — typed `resetStore<T>(store): () => void` (zustand replace-mode) | A | A, C, G |
| `tests/helpers/storage-fixture.ts` — `installStorageGlobals(seed)` + `installFsRecorder()` | B | B |
| `tests/helpers/fetch-fixture.ts` — `installFetchMock(routes)` returning `{ calls, restore }` | F | F |
| `tests/helpers/discord-fixture.ts` — synthetic `Constants.Fonts`/`Assets` + `installCommonMock` **(flagged)** | I | I |

### Phase 0 (blocking, ~5 min, one agent, before all others)

In `tests/helpers/metro-fixture.ts`: `export` the existing `defineGlobal<T>` and add it to the default
export object. Zero behaviour change. Gate: existing suite still `0 fail`. This is the **only** shared
edit needed before parallel work; slices I/J/K import `defineGlobal` from it.

### Touch matrix

- **Only writers of `metro-fixture.ts`:** Phase 0 (the export), then E (additive, likely no edit —
  `ModuleSpec.factory` already covers throwing modules).
- **Create a brand-new helper (conflict-free):** A, B, F, I.
- **Own test files only:** C, D, G, H, J, K.
- **Ordering:** C and G land after A (import `store-fixture.ts`). Everything else is independent.

## Slices

Each slice = one agent's brief. Land as its own commit (`test(client): <scope>`).

### Slice A — Stores (zustand)
- **New:** `tests/stores/stores.test.ts`, `tests/helpers/store-fixture.ts`.
- **Substrate:** none (stores import graph is RN-free). Reset via `store-fixture.ts` in `beforeEach`.
- **Depends on:** — . **Blocks:** C, G.
- **Branches:** `ToastStore.addToast` `date ??=` (supplied survives / absent stamped); handle
  `update`→`updateToastWithOptions` merge; `close`→`closing:true`; same-id overwrite; different-ids keep
  both + immutability (new object identity); `updateToastWithOptions` unknown id returns `prev` **by
  identity**; `SettingsStore.registerSection` add/replace; `removeSection` present/absent (always copies);
  `ThemeStore.setApplied(id,theme)` / `(null,null)` twin.

### Slice B — Storage core
- **New:** `tests/api/storage.test.ts`, `tests/helpers/storage-fixture.ts`.
- **Substrate:** `installStorageGlobals(seed)` (define `UNBOUND_SETTINGS` before import) +
  `installFsRecorder()` (`mock.module('~/api/fs')`), then `await import('~/api/storage')`. Fake timers
  for the debounced `persist`.
- **Depends on:** Phase 0. **Blocks:** — .
- **Branches:** `get` shallow/nested/missing-leaf/missing-intermediate/missing-store/through-primitive;
  `set` create-store/deep-intermediate/overwrite-leaf/emit order (`changed` then `set`); overwrite object
  leaf with primitive then deep-set (degrade probe); `toggle` false→true / true→false / non-boolean
  coercion + `toggled` payload; `remove` present + emit order + drop-empty-store + **falsy-value guard
  (`false`/`0`/`''` can't be removed — BUG, report)** + **absent-store TypeError (report)**; `clear`
  present/absent + events; `addListener` predicate gating + unsub + `removeListener` by identity + no-op +
  **double-register same-callback leak (report)**; `getStore` name-binding isolation + store-scoped
  `addListener` filter; `persist` path + payload round-trip; debounce collapses 3 sets → 1 write.
- **Exclude (note in header):** `useSettingsStore` (React hook).

### Slice C — Toasts API
- **New:** `tests/api/toasts.test.ts`. **Substrate:** none; reset `ToastStore` via A's helper.
- **Depends on:** A. **Blocks:** — .
- **Branches:** supplied `id` used verbatim; absent → generated uuid (string, len 30, two calls distinct);
  returned `ToastHandle` wired to store (`update`/`close`); passthrough fields land; caller `date` survives.

### Slice D — Assets (two files — import-time discovery is path-exclusive)
- **New:** `tests/api/assets-discovery.test.ts` (cold), `tests/api/assets-cached.test.ts` (warm).
- **Substrate:** `installMetroGlobals` (read-only) + `mock.module('~/api/metro/common')` with a
  controllable `Assets.getAssetByID`. **Registry + mocks in place before the dynamic import** — the
  registry contents are the input.
- **Depends on:** Phase 0. **Blocks:** — .
- **Cold (D1):** number export + asset → registered under the **exported number**, `addAssetToCache`
  called with the **module id** (assert the asymmetry); non-number skipped; `getAssetByID` null skipped;
  init-fail skipped.
- **Warm (D2):** seed `UNBOUND_SETTINGS['unbound::cache'].assets`; cached ids walked, non-cached qualifier
  absent; stale `null` skipped; init-fail skipped; **type-mismatch probe** — warm path has no
  `typeof !== 'number'` guard, seed an object-export cached id and assert what lands (BUG, report).
- **Lookups (D1):** `find` first/none; `getByName` png default vs svg twin; png-asked-for svg-only →
  undefined; `getByID` hit/miss; `getIDByName` hit/default/miss; `getAll` length; `Icons.X` proxy →
  `getIDByName` png default; `Icons.Nonexistent` undefined.

### Slice E — Metro gaps (**sole post-Phase-0 writer of `metro-fixture.ts`, additive only**)
- **New:** `tests/metro/lazy-proxy.test.ts`, `tests/metro/search-dispatch.test.ts`,
  `tests/metro/initialize-module.test.ts`. **Substrate:** `installMetroGlobals`.
- **Depends on:** Phase 0. **Blocks:** — .
- **lazy-proxy:** `{lazy:true}` returns un-resolved proxy (init counter 0); first access resolves once,
  second reuses (counter 1); `module` prop via getter + trap branch; **reading `__METRO_LAZY__` forces
  resolution (report if unintended)**; non-string/empty prop → undefined without resolving; miss →
  `null`, `proxy.x` undefined no-throw; `set` trap on hit lands on module, on miss lost to throwaway
  (report); **`Object.assign(options,{lazy:false})` mutation probe**.
- **search-dispatch:** `findByProps(...,{bulk:true})` with `params` bags → aligned bulk; array-payload
  bulk branch (`interop:true` default); per-item `interop:false` honoured; absent `params` → zero-arg
  filter degrade; each wrapper→filter mapping (`byProps`/`byName`/`byPrototypes`/`byFilePath`/`byStore`);
  `findStore` `short` default + un-suffixed key via wrapper; **`findStore` drops 2nd name (report)**.
- **initialize-module:** factory throw → false + blacklist + flag; already-blacklisted short-circuit (no
  `__r`, assert counter); already-init error-free → true no re-run; init+hasError → re-runs; `ErrorUtils`
  handler restored in `finally` (both paths); `Function.prototype.toString` restore branch (descriptor
  `configurable/writable`); **absent id → `__r` runs, returns true, marks nothing (report false-positive)**.
- **metro-fixture edit:** prefer the existing `spec.factory` escape hatch; add nothing unless forced.

### Slice F — Addons install / delete
- **New:** `tests/managers/install-delete.test.ts`, `tests/helpers/fetch-fixture.ts`.
- **Substrate:** inline `~/api/fs` + `~/api/storage` mocks (copy the `lifecycle.test.ts` idiom) +
  `installFetchMock`. Reuse the `FakeAddons` subclass shape.
- **Depends on:** Phase 0. **Blocks:** — .
- **install:** happy path (fetch→validate→resolve bundle URL→persist both→load→`installed`→entity);
  bundle-URL resolution (relative `main` vs absolute `main` over same manifest URL — the varied pair;
  `./` and subdir forms); manifest `!res.ok`→throw+`install-error`+nothing persisted; bundle
  `!res.ok`→degrade+manifest NOT persisted; malformed JSON caught; `validateManifest` fail; type
  mismatch/absent/match; **`load` records error → `install` returns undefined, NO `installed`, NO
  `install-error` (report silent gap)**; `{cache:'no-cache'}` on both fetches.
- **delete:** happy (`unload`+`unloaded`+`fs.rm('Unbound/PLUGINS/<id>')`+`deleted`); unknown id early
  return; resolve by name; entity object; **`fs.rm` reject → error recorded, `deleted` NOT emitted,
  addon already unloaded but folder remains (report asymmetry)**; started addon stopped by inner unload.

### Slice G — Themes manager
- **New:** `tests/managers/themes.test.ts`. **Substrate:** inline `~/api/fs`+`~/api/storage` mocks +
  A's `store-fixture.ts` for `ThemeStore`. Test a fresh `new Themes()` per test (seed helper).
- **Depends on:** A. **Blocks:** — .
- **handleBundle:** valid JSON→object; malformed→throws→(via `start`) recorded+`failed`; valid non-object
  primitive → what `setApplied` stores (degrade probe).
- **enable (override):** no prev applied; different prev started → stopped before swap (assert order vs
  `settings.set('applied')`); different prev not started → no stop; prev no longer loaded → guard holds;
  re-enable already-applied (`prev===id`) → no restart; already-started → `start` skipped, `setApplied`
  runs; resolve miss; **`start` throws → still reaches `setApplied` with null instance while `applied`
  points at failed theme (report)**.
- **disable (override):** started applied → clear applied/state/stop/`setApplied(null,null)`/`disabled`;
  stopped → no stop but still clears; **disabling a NON-applied theme clears `applied` anyway, clobbering
  the real one (report)**; resolve miss.
- **initialize:** `UNBOUND_THEMES` populated / absent (`?? []`) / bad-manifest-continues; `initialized:true`.

### Slice H — Plugins manager
- **New:** `tests/managers/plugins.test.ts`. **Substrate:** inline `~/api/fs`+`~/api/storage` mocks.
- **Depends on:** Phase 0. **Blocks:** — .
- **handleBundle (`eval` IIFE):** object-literal source → instance; function source → called once, result
  is instance; `default` unwrapped; `default`+siblings → only default (lossy); nullish payload → survives
  to `started:true` with null instance (probe); eval syntax error → propagates→recorded+`failed`; IIFE
  throws at call → same degrade distinct branch; empty string → `undefined`.
- **initialize:** `UNBOUND_PLUGINS` populated / absent / bad-manifest-continues; enabled-in-states entry
  runs the eval path end-to-end during initialize.

### Slice I — Fonts + Icons (**creates the flagged `discord-fixture.ts`**)
- **New:** `tests/managers/fonts.test.ts`, `tests/managers/icons.test.ts`,
  `tests/helpers/discord-fixture.ts`.
- **Substrate:** `installCommonMock` (`mock.module('~/api/metro/common')` → synthetic
  `Constants`/`Assets`/`ReactNative` with a fake `Image.prototype.render`); inline `~/api/fs` mock with a
  controllable `exists` map; `~/api/storage` mock; `defineGlobal` for `window.UNBOUND_FONTS` /
  `UNBOUND_AVAILABLE_FONTS`.
- **discord-fixture.ts header MUST state:** this asserts our logic against a shape we invented; if
  Discord's real shape diverges these tests stay green while the client breaks; risk accepted here only.
  Include awkward entries: a key with no `_`, a value with padded whitespace, a family duplicated across
  keys, a non-string value; `SYNTHETIC_ASSETS.getAssetByID` returns `null` past the end (the termination
  contract Icons' `applyPack` loop depends on).
- **Depends on:** Phase 0. **Blocks:** — .
- **fonts:** `getTargets` grouping by `key.split('_')[0]`, comma-split families, trim, within-group
  dedupe, cross-group duplication, no-underscore key = whole group, empty `Fonts` → `[]`, non-string
  `String()` coercion; `getFonts`/`initialize` (absent `?? []`, `initialized:true`); `getAvailableFonts`
  present/absent; `getOverrides` `unbound.font-states` `{}` default; `setOverride` writes+emits `changed`
  once; `clearOverride` present + **absent-still-emits (probe)**; `setOverrideAll`/`clearOverrideAll` `'*'`
  key; `install` happy (filename from last URL segment, base64, `Unbound/Fonts/<file>`, `changed`, returns
  file); **URL ending `/` → `pop()` is `''`, `??` doesn't fire, writes `Unbound/Fonts/` (BUG, report)**;
  `!res.ok` / fetch reject → undefined, no `changed`, nothing written.
- **icons:** `applied` default/persisted; `isEnabled`; `toggle` both directions + emit + unknown-id;
  `enable` picks pack / **falls back to defaultPack on unknown id (probe)** / `unpatchAll` / awaits
  `applyPack` / `enabled`; **`applyPack` reject → recorded, no `enabled`, but `applied` already set
  (report half-applied)**; `disable` → defaultPack + `unpatchAll` + `disabled` / unknown-id; `applyPack
  ('default')` no-op (render untouched); `applyPack` walk stops at first `null` (assert counter, incl.
  "asset 3 null but 4 exists → 4 never seen"); `stampAsset` descending scales, first-exists wins,
  absolute `iconPackPath`, no-file → both cleared; `relativeAssetPath` `/assets/` strip + `@2x`/`@3x`/none;
  `Image.render` patch: number+stamped rewritten, number+unstamped untouched, non-number early return,
  absent props guard; `initialize` loads packs + applyPack + `initialized:true` even if applyPack rejects;
  `delete` disables-if-applied + filters packs + unload + `fs.rm('Unbound/Icons/<id>')` + `deleted` /
  non-applied skips disable / unknown-id.
- **Exclude (note in header):** icons `install`/`downloadTree` (GitHub tree walk — duplicates F's surface).

### Slice J — Loader (two files — `__r`-present branch is import-persistent)
- **New:** `tests/lib/loader.test.ts` (defer path), `tests/lib/loader-legacy.test.ts` (`__r` present).
- **Substrate:** its own — before import, `defineGlobal` a fake `window` `{}`, `__fbBatchedBridge`,
  `RN$AppRegistry`, `__c` factory, stub `alert`.
- **Depends on:** Phase 0. **Blocks:** — .
- **J1 defer:** `deferUntilReady` doesn't call `onReady` yet; assigning `__r` installs patched require;
  `__r(5)`→`original(5)` passthrough; `__r(0)`→ensureModules→hold→runReady ordering (`onReady` then
  `original(0)` then flush); self-unpatch (2nd `__r(0)` no re-run); `ensureModules` populate/`__c`-absent/
  already-set-no-call; **`__d` getter leaks `globalThis.value` (report)**; bridge hold/passthrough/
  drop-on-uncallable-resume; registry hold+replay; neither present = no-op; unpatches run before
  `original(0)` (identity); `runReady` Error → alert+continues; **non-Error reject → `'stack' in error`
  TypeError (report)**; held-call ordering.
- **J2 legacy:** `__r` pre-defined → `onReady` immediate, `defineProperties` never installed (assert
  descriptor unchanged), returns sync while `runReady` pending; reject path alerts.

### Slice K — force-render
- **New:** `tests/lib/force-render.test.ts`. **Substrate:** its own — before import, install a sentinel
  dispatcher object on
  `React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE.H` via one typed boundary.
- **Depends on:** Phase 0. **Blocks:** — .
- **Branches:** returns a fn, component not invoked until called; called once, returns value; args
  forwarded; `context` → `this` is context; **falsy-but-valid context (`0`/`''`) takes no-context branch
  (probe)**; each override asserted from inside a component (`useMemo` calls every time, `useState`/
  `useReducer` shape + noop setter, effects return undefined + never run, `useDeferredValue`→v,
  `useRef`→fresh `{current:null}` each call (probe), `useCallback`→identity, `useTransition`→`[false,noop]`,
  `useSyncExternalStore`→`getSnapshot()` + sub never called, `useContext`→`_currentValue`); restoration
  by identity per key on normal return; restoration on throw (error propagates + `finally` restores);
  nesting (inner `forceRender` inside outer → fully restored after outer); non-overridden keys untouched.

## Parallelization

```
Phase 0 (export defineGlobal)
   ├── A ──┬── C
   │       └── G
   ├── B   ├── D   ├── E*   ├── F   ├── H   ├── I   ├── J   └── K   (* sole metro-fixture writer)
```

- **Wave 0 (1 agent):** Phase 0. Merge. Gate: existing suite `0 fail`.
- **Wave 1 (parallel, zero file overlap):** A, B, D, E, F, J, K. (Add H, I here if agents available.)
- **Wave 2 (parallel):** C, G (after A), H, I.

Each slice lands its own commit. A bug found → documenting test with `FINDING:`/`MUTATION PROBE:`
prefix, never a source fix.

## Verification

Per slice, from `packages/client/`: `bun test --isolate <slice files>` — all green.

Whole-suite gate after each wave merges (repo root unless noted):
- `cd packages/client && bun test --isolate` — count climbs monotonically, `0 fail`.
- `bun run fmt:check` — `oxfmt` clean (tabs, width 4, single quotes, trailing commas).
- `bun run lint` — `oxlint` clean, incl. `perfectionist` import order (line-length descending, 3 groups).
- `bunx tsc -p packages/client/tsconfig.json --noEmit` — enforces the no-`as any` rule. (Fallback if the
  tsconfig's `emitDeclarationOnly` fights it: add `--emitDeclarationOnly false`.)
- Optional: `bunx ast-grep scan -c sgconfig.yml packages/client/tests` for `no-double-type-assertion`.

**Confirm the net bites (the real deliverable, not the green check):** each slice must show ≥2 of its
tests go red when the source is perturbed, then revert. Concrete mutations per slice:
A drop `updateToastWithOptions` unknown-id guard · B no-op `remove`'s delete + flip `isEmpty` ·
C `options.id ?? uuid()` → `uuid()` · D drop cold-path `typeof !== 'number'` guard · E `cache ??=`→`cache =`
and remove `blacklist.add` in `initializeModule` catch · F drop bundle-fetch `!res.ok` throw ·
G remove `prev !== resolved.id` in `enable` · H `instance?.default ?? instance` → `instance` ·
I `sort((a,b)=>b-a)` → ascending and `split('_')` → `split('-')` · J remove `unpatches.splice(0)` loop ·
K delete the `finally`.

## Out of scope

`ui/**`, `builtins/**`, `entry.ts`/`index.ts`/`preinitialize.ts`/`shims.ts`, `api/patcher.ts`/`possess`
internals, `useSettingsStore` (React hook), icons `install`/`downloadTree` (GitHub tree walk), and any
assertion of a real (non-synthetic) Discord bundle shape.
