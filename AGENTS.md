# Code Style

This is the canonical style guide for this repository, and the `AGENTS.md` that the `@marioparaschiv/oxc-config` lint messages point to. Everything below is derived from the existing source - it describes how this codebase is _already_ written, not an aspiration. Match it exactly.

The hierarchy of authority, highest first:

1. **`oxfmt`** - owns all whitespace, quoting, and line-wrapping. Never fight it; never hand-format. Run it.
2. **`oxlint`** (`.oxlintrc.json`, run `--type-aware`) - correctness, structural bans (the custom `oxc-config/*` rules), JSDoc shape, statement padding, and import/export ordering via `perfectionist`. Every rule is an `error`. The rules and the commitlint config come from `@marioparaschiv/oxc-config`; `.oxlintrc.json` extends its `base`, `react` and `jsdoc` presets with no local rule overrides, so change a shared rule in that package, not here. The one local override allows `any` in the metro layer and the Discord design-module typings (§4). `bun run lint` also runs `oxc-config-check`, which fails on unknown rule names.
3. **This document** - the conventions the tools can't encode: naming, file shape, module structure, the _feel_ of the code.

Fix a lint finding in the code. Don't silence it with a disable comment, a cast, or a config override.

If you're unsure, open a neighbouring file in the same directory and mirror it. Consistency with the local file beats consistency with this document.

---

## 1. Formatting (mechanical - owned by `oxfmt`)

These are settled by `.oxfmtrc.json`. Stated here so you recognise the output, not so you reproduce it by hand.

- **Tabs, width 4.** Indentation is hard tabs. Never spaces. (The `.oxfmtrc.json` uses 2-space indent for itself - that's the config file, not source. Source is tabs.)
- **Single quotes** everywhere, including JSX (`jsxSingleQuote: true`). Double quotes only when the string contains a single quote.
- **Semicolons** always.
- **Trailing commas** everywhere they're legal (`trailingComma: "all"`) - multiline arrays, objects, params, type args, imports.
- **Print width 100.** Let the formatter wrap; don't pre-break lines to "help" it.
- **Bracket spacing on**: `{ foo }`, not `{foo}`.
- `*.gen.ts` is formatter-ignored. Don't hand-edit generated files.

You never need to think about any of the above. Save the file; the global `turn-check` hook formats it. At the end of each turn the same hook runs `oxlint --type-aware --fix` on every file changed in that turn, by any tool, and reports what's left.

---

## 2. Imports & Exports

### 2.1 Import ordering is enforced - by line length, descending

`perfectionist/sort-imports` is set to `type: "line-length"`, `order: "desc"`. **Longest import line first, shortest last**, with alphabetical as the tiebreak. This is the single most distinctive surface feature of the codebase. Every file looks like a left-aligned staircase descending to a point:

```ts
import type { GestureEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { InternalToastOptions } from '@unbound-app/types/toasts';
import { PanGestureHandler } from 'react-native-gesture-handler';
import Animated, { withSpring } from 'react-native-reanimated';
import { View, Image, Pressable } from 'react-native';
import { createElement, useState } from 'react';

import { BackdropFilters, Discord } from '~/api/metro/components';
import { useSettingsStore } from '~/api/storage';
import ToastStore from '~/stores/toasts';
import { Icons } from '~/api/assets';

import useToastState from './use-toast-state';
import useStyles from './toast.style';
```

Don't sort by hand - let the linter do it - but **write new imports knowing this is the target** so diffs stay small.

### 2.2 Import groups, in this order, separated by exactly one blank line

The `groups` config collapses to three visible blocks in practice:

1. **External** - builtins + third-party + everything from `@unbound-app/*` (the `internalPattern` only matches `~/` and `@/`, so the workspace packages resolve as external). Side-effect imports sort to the very top of this block.
2. **Internal aliased** - `~/...` (the `~` alias → `src/`).
3. **Relative** - `./...` and `../...`.

One blank line between groups. None within a group.

### 2.3 `import type` vs `import`

- Use `import type { … }` for type-only imports. It's used pervasively and sorts _within_ its length position alongside value imports (the config interleaves `type-external` with `value-external`).
- Mixed default + named is fine: `import Animated, { withSpring } from '…'`.

### 2.4 Exports

- **A barrel `index.ts` re-exports; it contains no logic.** See `ui/toasts/index.ts`, `api/index.ts`, `logger/src/index.ts`:
    ```ts
    export { default as ToastContainer } from './toast-container';
    export { default as useToastState } from './use-toast-state';
    export { default as Toast } from './toast';
    ```
    ```ts
    export { default } from './logger';
    export * from './logger';
    ```
- Namespace re-exports use `export * as name`:
    ```ts
    export * as storage from '~/api/storage';
    export * as metro from '~/api/metro';
    ```
- `perfectionist/sort-exports` also sorts by line length descending. Same staircase.

### 2.5 The default-export-plus-named-exports module shape

This is the backbone pattern of every API/lib module. **Export each function individually as a named export, then provide a `default` object that bundles them all.** Consumers can do either `import fs from '~/api/fs'` or `import { read } from '~/api/fs'`.

```ts
export function read(/* … */) {
	/* … */
}
export function write(/* … */) {
	/* … */
}
export function rm(/* … */) {
	/* … */
}

export default { Documents, read, write, rm, exists };
```

The default object lists members roughly in definition order (constants first, then functions). `storage.ts`, `cache.ts`, `assets.ts`, `toasts.ts`, `filters.ts` all follow this. Do not omit the named exports in favour of only a default, and do not omit the default in favour of only named - modules expose both.

---

## 3. File & Directory Conventions

### 3.1 Naming

- **Files: `kebab-case.ts` / `kebab-case.tsx`** (`oxc-config/kebab-case-filename`). `toast-container.tsx`, `use-toast-state.ts`, `create-proxy.ts`, `is-empty.ts`, `error-boundary.tsx`.
- **One concept per file.** `utils/src/` is the purest expression: `noop.ts`, `uuid.ts`, `lazy.ts`, `debounce.ts` - each is a single default-exported function and nothing else.
- **Co-located styles** use the `.style.ts` suffix next to the component: `toast.tsx` ↔ `toast.style.ts`, `toast-container.tsx` ↔ `toast-container.style.ts`.
- **Hooks** are files prefixed `use-` exporting a `useThing` function as default: `use-toast-state.ts` → `export default useToastState`.

### 3.2 Directory roles (in `packages/client/src`)

| Dir         | Holds                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `api/`      | Public-facing capability modules (`fs`, `storage`, `toasts`, `assets`, `native`, `metro/`). Default + named export shape. |
| `managers/` | Stateful singletons / classes (`base`, `addons`, `plugins`, `themes`).                                                    |
| `stores/`   | Zustand stores. One store per file, `PascalCase` store name, default-exported.                                            |
| `ui/`       | React Native components, grouped in a folder with their `.style.ts` and a barrel `index.ts`.                              |
| `lib/`      | Internal infrastructure not meant as public API (`cache`, `constants`).                                                   |
| `builtins/` | Built-in features wired in at startup.                                                                                    |

`utils/`, `logger/`, `types/` are separate workspace packages, each with `src/` and a single responsibility.

### 3.3 Path aliases

- `~/` → the package's `src/`. Always use it for intra-package imports across directories (`~/api/storage`, `~/managers/base`, `~/stores/toasts`).
- Relative `./` only for siblings inside the same feature folder (a component importing its own `./toast.style`).
- Workspace packages are imported by name: `@unbound-app/logger`, `@unbound-app/utils/noop`, `@unbound-app/types/toasts`. Note `utils` exports per-file (`@unbound-app/utils/noop`), not a barrel - import the specific file.

---

## 4. TypeScript

The base config is `strict: true` but relaxes the _unused_ and _implicit-any_ family (`noUnusedLocals: false`, `noImplicitAny: false`, `noImplicitThis: false`, `noPropertyAccessFromIndexSignature: false`). Lint is stricter than the compiler here:

- **Explicit `any` is a lint error** (`typescript/no-explicit-any`) everywhere except the metro layer (`packages/client/src/api/metro/**`) and the Discord design-module typings (`packages/types/typings/components.ts`), where the shapes are Discord internals that can't be known.
- **`unknown` needs a reason.** An `unknown` parameter or return type is an error (`oxc-config/no-unknown-parameters`, `oxc-config/no-unknown-returns`) unless the function is a type predicate (`value is T`) or carries a `// UNKNOWN: <reason>` comment on the function or the parameter. Narrow with a type predicate rather than casting.
- **No unsafe dictionaries** - `Record<string, unknown | any | object | {}>` is banned (`oxc-config/no-unsafe-dictionary-type`); give the value a real type.

### 4.1 Type declarations - the hard rules

- **No inline object types** in parameters, return types, or type arguments (`oxc-config/no-inline-object-type`). Extract to a top-level `type` alias.

    ```ts
    // Bad
    function f(x: { id: string }) {}
    // Good
    type Args = { id: string };
    function f(x: Args) {}
    ```

    _(Standalone `type` bodies are fine - the ban is specifically on object types positioned in param/return/type-argument annotations.)_

- **No bare `object` parameters** (`oxc-config/no-object-parameters`) - give the parameter a specific shape.
- **No double type assertions** - `as unknown as T` and `as any as T` are banned (`oxc-config/no-double-type-assertion`), as are chained `as A as B` (`oxc-config/no-chained-type-assertions`) and the split form, annotating a variable `unknown`/`any` and asserting it later (`oxc-config/no-widen-then-assert`). Fix the underlying type so the value is assignable.
- **`as` style only**, and never on an object literal (`typescript/consistent-type-assertions`) - annotate the variable instead.
- **Type-only imports use `import type`** (`typescript/consistent-type-imports`), never `import()` type annotations.

### 4.2 `type`, not `interface`

Every object shape is a `type` alias (`typescript/consistent-type-definitions`): `type SettingsPayload = { … }`, `type ThemeStore = { … }`, `type AddonResolveable = string | Addon`, `type MetroFilter = ((…) => …) & { … }`, the whole `Metro*` conditional-type family. Compose and extend with `&` intersections: `type MetroStoreOptions = MetroSearchOptions & { … }`.

### 4.3 Generics

- Single-letter `T`, `U`, `T extends …` for the common case (`Manager<T, EventMap>`, `lazy<T extends object>`, `find<T extends Fn>`).
- Descriptive `TProps`, `EventMap` when a second param would be ambiguous.
- Constrain generics (`T extends object`, `T extends Addon`, `T extends Fn`) rather than leaving them open.

### 4.4 Misc type idioms

- Prefer `T | undefined` return types for lookups that can miss (`getEntity(id): T | undefined`, `getByID(id): UnboundAsset | undefined`), and guard at the call site with early return.
- `PropertyKey` over `string | number | symbol`.
- `Record<string, boolean>`, `Record<number, number>` for maps-as-objects; `Map` for genuine runtime maps (`new Map<PropertyKey, T>()`).
- `void 0` is used in hot/runtime-checking code (`metro`, `storage`) in place of `undefined` - match the surrounding file. Elsewhere `undefined` is fine.

---

## 5. Functions

### 5.1 `function` declarations are the default

Top-level functions are **named `function` declarations**, not arrow consts:

```ts
export function showToast(options: ToastOptions): ToastHandle {
	/* … */
}
function isValidCache() {
	/* … */
}
function save() {
	/* … */
}
```

The single-purpose util files declare a named `function` and default-export it at the bottom - never `export default function`, never an arrow:

```ts
function noop(): void {
	// No.
}

export default noop;
```

A block-body arrow assigned to a `const` is a lint error (`oxc-config/no-const-arrow-function`). Arrow functions are reserved for:

- Inline callbacks (`.map`, `.find`, event handlers, predicates).
- Short factory one-liners: `const find = (...args: string[]) => lazy(() => require('~/api/metro').findByProps(...args));`.
- Object-literal methods where the surrounding object is a config (zustand `set => ({ … })`, `getStore`'s returned object).

### 5.2 Default parameter values, not `options ?? default` inside

When an argument has a sensible default, put it in the signature:

```ts
function read(
	path: string,
	encoding: DCDFileManagerEncoding = 'utf8',
	inDocuments: boolean = true,
) {}
function byStore(name: string, short: boolean = true): MetroFilter {}
function uuid(length: number = 30): string {}
```

For _option-bag_ defaults, destructure with defaults at the top of the body:

```ts
const {
	all = false,
	interop = true,
	cache: useCache = true,
	esModules = true,
	raw = false,
} = options;
```

### 5.3 Early return / guard clauses

Bail out at the top; don't nest the happy path (`unicorn-js/prefer-early-return`). This is universal:

```ts
unload(entity: AddonResolveable) {
	const resolved = this.resolve(entity);

	if (!resolved) return;

	// … happy path at top indentation
}
```

Only a bare `return;` or `return null;` may go unbraced (`oxc-config/require-block-except-empty-return`); every other branch body, including `throw` and `continue`, takes a block:

```ts
if (!resolved || resolved.started) return;

if (!filter) {
	throw new Error('You must provide a filter to search by.');
}

if (cache) {
	continue;
}
```

Statements are padded (`stylistic/padding-line-between-statements`): a blank line before every `if`/`for`/`while`/`switch`/`try`/`return`, after each of those blocks, and after a run of `const`/`let` declarations.

### 5.4 Explicit return types on public API; inferred internally

Exported API functions annotate their return type (`: ToastHandle`, `: Widen<T>`, `: MetroFilter`, `: Promise<boolean>`, `: UnboundAsset | undefined`). Small private helpers and obvious cases let inference do the work (`function save()`, `function isValidCache()`).

---

## 6. Control Flow & Language Idioms

Most of these are lint rules (some auto-fixed by `bun run lint:fix`) - write them this way from the start.

- **Logical assignment operators.** `x ||= y`, `x &&= y`, `x ??= y` - never the longhand `x = x || y` (`oxc-config/use-logical-assignment`). Heavily used: `data.current[keys[i]] ??= {}`, `options.date ??= Date.now()`, `res[i] ??= []`, `state.modules[key] ??= []`.
- **Optional chaining for guarded calls.** `obj?.method()` not `obj.method && obj.method()` (`oxc-config/prefer-optional-chaining`). And `resolved.instance?.start?.()`.
- **Nullish coalescing `??`** for defaults (distinct from `||`): `prev ?? []`, `options.duration ?? settings.get(…)`, `entity.id ?? this.getByName(entity)`. Use `??` when `0`/`''`/`false` are valid values; `||` only when any falsy should fall through.
- **No redundant `await` inside `Promise.all([...])`** (`oxc-config/no-await-in-promise-all`), and no `await` on a value that isn't a promise (`typescript/await-thenable`).
- **No `.forEach()`** (`oxc-config/no-foreach`) - use `for…of`.
- **`for…of` over arrays/values, classic `for` with cached length in hot loops.** Iteration style is chosen for the context:
    - Readable iteration: `for (const field of required)`, `for (const id of cached)`.
    - Performance-sensitive metro/filter loops use the indexed form with a cached length: `for (let i = 0, len = props.length; i < len; i++)`.
- **`[...map.values()]` / `[...map.keys()]`** to materialise iterables (`getEntities()`, `moduleIds`, `assets.values()`).
- **Bitwise for flags.** Flag enums are `1 << 0`; set with `|=`, clear with `&= ~flag`, test with `& flag`, and `~idx` is used as the "found" check after `indexOf` (`if (~idx) store.splice(idx, 1)`).
- **`Boolean(x)`** to coerce, not `!!x`, when returning a boolean from a flag test (`return Boolean(state.moduleFlags[id] & flag)`). `!!` is fine inline in conditions.

---

## 7. Classes

Used for stateful, identity-bearing things: managers, the `Logger`. Plain functions/objects for everything else. Conventions, from `managers/base.ts` and `logger.ts`:

- **`abstract class` with abstract methods** to define a contract for subclasses: `abstract initialize(): void;`.
- **Field declarations with initialisers at the top**, before the constructor:

    ```ts
    entities = new Map<PropertyKey, T>();
    errors = new Map<PropertyKey, Error>();
    initialized = false;

    protected logger: ReturnType<typeof createLogger>;
    ```

- **`ReturnType<typeof factory>`** to type a field whose value comes from a factory function (`createLogger`, `createPatcher`, `storage.getStore`) instead of importing/declaring the type.
- **Parameter properties** for constructor-injected readonly config: `constructor(public readonly type: ManagerType)`.
- **Visibility is explicit and minimal**: `protected` for subclass-only internals (`resolve`, `getByName`, `getStates`, `validateManifest`), `private` for class-only (`Logger.inspectFn`), public (no modifier) for the API surface.
- **`static` factory + `static` helpers** pattern on `Logger` (`static create(…)`, `static setInspector()`), alongside an exported free function wrapper (`export function createLogger(...)`).
- **A leading-underscore prefix** marks methods that are public-by-necessity but conceptually internal (`Logger._getPrefix`, `_getColor`, `_inspect`). New code prefers `private`/`protected`; the underscore convention persists where TS visibility can't be used.

### 7.1 The Manager pattern (read before touching `managers/`)

`Manager<T, EventMap>` extends `EventEmitter` (from `~/lib/event-emitter`, a port of `tseep`) and intersects a `BaseManagerEvents<T>` map onto the subclass's event map. Subclasses (`Addons`, then `Plugins`/`Themes`) layer on more events and methods. Every state-changing method:

1. Resolves its input via `resolve()` (accepts an id string _or_ the entity).
2. Guards (`if (!resolved) return;`).
3. Wraps the mutation in `try/catch`, logging via `this.logger.error('Failed to … {id}:', error)` and recording `this.errors.set(id, error)` on failure.
4. `this.emit('<pastTense>', resolved)` on success.

Event names are past-tense verbs: `loaded`, `unloaded`, `started`, `stopped`, `enabled`, `disabled`, `toggled`, `reloaded`. Mirror this exactly when adding manager operations.

---

## 8. React / React Native (`.tsx`)

### 8.1 Component shape

- **Named `function Component()` declaration, default-exported at the bottom.** Never `export default function`, never `React.FC`, never an arrow component.
    ```ts
    function ToastContainer() {
    	/* … */
    }
    export default ToastContainer;
    ```
- **Props are a destructured object in the signature**, with defaults inline and the props shape as a named `type` (an inline literal prop type is banned by §4.1): `function TintedIcon({ source, size = 24 }: TintedIconProps)`.
- Small private sub-components live in the same file above the main one (`TintedIcon`, `unitToHex`, `withoutOpacity` in `toast.tsx`).

### 8.2 Hooks

- Custom hooks are their own `use-name.ts` file, `useName` default-exported.
- `useState` - **no type argument when the initial value makes it inferable** (`oxc-config/no-unnecessary-usestate-type`): `useState(1)`, not `useState<number>(1)`. Type args only for non-inferable initial states (`useState(options.closing)` where the type comes from the value is fine; an explicit type is only added when the initial value is `null`/`undefined` and the real type is wider).
- `useEffect` with `[]` for mount, named `function handler(…)` declared inside for subscriptions, returning the cleanup: `return () => Events.off('changed', handler);`. When the cleanup return value must be discarded, wrap in `void`: `return () => void Events.off('changed', handler);`.
- `useMemo` for derived collections with explicit dep arrays (`toast-container.tsx`).

### 8.3 JSX

- **No `&&` short-circuit that can leak a falsy value into render** (`oxc-config/jsx-no-conditional-leak`). Use a ternary returning `null`:
    ```tsx
    {
    	condition ? <Thing /> : null;
    }
    ```
    _(You will see existing `options.icon && (…)` in `toast.tsx`; that pattern is exactly what the rule now flags - write the ternary in new code.)_
- **No nested `<a>`** (`oxc-config/no-nested-links`) - N/A in RN but enforced for any web JSX.
- Single quotes in JSX attributes (`variant='text-sm/semibold'`, `pointerEvents='box-none'`).
- `style={[base, conditional, { inline }]}` array form for composing RN styles.

### 8.4 Styles

- Styles live in a sibling `*.style.ts`, default-exporting the result of `Discord.createStyles({ … })`.
- Reference theme tokens through the metro `Theme`/`Constants` namespaces (`Theme.colors.TOAST_BG`, `Constants.Fonts.PRIMARY_SEMIBOLD`), never hard-coded hex.
- Keys are `camelCase` (`contentContainer`, `iconTint`, `toastShadow`).

### 8.5 Stores (zustand)

One store per file in `stores/`. `PascalCase` name matching the file's concept, default-exported:

```ts
type ThemeStore = {
	applied: string | null;
	data: Theme | null;
	setApplied: (id: string | null, theme: Theme | null) => void;
};

const ThemeStore = create<ThemeStore>((set) => ({
	applied: null,
	data: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
}));

export default ThemeStore;
```

Actions live _in_ the store (method shorthand `addToast(options) { … }` for ones needing `get()`, arrow for trivial setters). Immutable updates via spread: `set((prev) => ({ toasts: { ...prev.toasts, [id]: options } }))`.

---

## 9. Errors, Logging, Events

- **`createLogger(name)`** (or `createLogger('Scope', 'SubScope')` for nested) gives a scoped logger; managers hold one as `this.logger`. Levels: `.log .info .success .warn .error .debug`. The prefix renders as `[Scope → SubScope]`.
- **Error messages name the thing and the id**: `` `Failed to load addon ${manifest.id}:` `` then the error object as a second arg.
- **try/catch around fallible mutations**, recording rather than throwing where the system should degrade gracefully (managers record to `this.errors`; metro blacklists the offending module and continues). Throw only for programmer errors / contract violations (`throw new Error('You must provide a filter to search by.')`, manifest validation).
- **`catch (error)`**, left as the compiler's `unknown` - an `any` annotation is a lint error outside the metro layer (§4). An unused catch binding is allowed (`caughtErrors: "none"`). Empty catch bodies carry an explanatory comment (`// Not in Node environment`).
- **Events use the `EventEmitter` from `~/lib/event-emitter`** (a port of `tseep`) with a typed event map (`new EventEmitter<EventMap>()`). Expose `on`/`off` by binding (`export const on = Events.on.bind(Events)`). Provide an `addListener(predicate, callback)` that returns an unsubscribe function. Event payloads are a single object argument.

---

## 10. Comments & Documentation

- **JSDoc on every exported function** (`jsdoc-js/require-jsdoc`), with `@description`, `@template` (for generics), and a `@param` per parameter plus `@returns` (`jsdoc-js/require-param`, `jsdoc-js/require-returns`). This is consistent across `utils/src/*`:
    ```ts
    /**
     * @description Creates a lazy object that will run its initializer once any property is accessed for the first time.
     * @template T The object type returned by the initializer.
     * @param initializer A function that returns the object you would like to make lazy.
     * @returns An object that appears empty but has the same properties as the object returned from the initializer.
     */
    ```
- **A JSDoc block is a summary plus tags** (`oxc-config/jsdoc-summary-only`): the summary is one line, two at most, and there are no further prose paragraphs. Put extra detail in `@param`/`@returns`, or in a `//` comment beside the code it explains.
- **Comments stay under 200 characters** (`oxc-config/max-comment-length`); a run of consecutive `//` lines counts as one comment. If it needs more, it is probably narration.
- **Inline comments explain _why_, sparingly**, and often carry a performance rationale: `// Instead of creating a symbol each time, use a pre-defined one for performance gains.`, `// Loop through whole registry if any of the items have "all" as an option`.
- **No commented-out code.** No decorative banners except the deliberate `/****** CACHE ******/` section markers used in the dense metro `find` to delimit the cache fast-path - reserve that for genuinely long, branchy functions.
- Don't document the obvious. A one-line `noop` gets `// No.` and that's the whole point.

---

## 11. The "feel" - what makes this code clean

When in doubt, optimise for these, in order:

1. **Guard early, keep the happy path un-indented.** A function should read top-to-bottom with the bail-outs first.
2. **One file, one job.** If a file is doing two things, it's two files.
3. **Small, total functions.** Most functions fit on a screen. Lookups return `T | undefined` and never throw for "not found".
4. **Symmetry.** Paired operations (`enable`/`disable`, `load`/`unload`, `addCachedIDForKey`/`removeCachedIDForKey`, mount/leave animations) are written to mirror each other line-for-line. If you change one, change its twin identically.
5. **The dual export shape.** Named exports for tree-shaking + a `default` aggregate for ergonomics.
6. **Let the tooling carry the mechanical load.** Never hand-format, never hand-sort imports. Write the logic; run the formatter and linter.

When adding code, the test is: _would this diff be invisible if dropped into the file blind?_ If a reviewer can tell which lines are new from style alone, it's not done.
