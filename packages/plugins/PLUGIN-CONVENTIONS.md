# Plugin conventions

Every first-party plugin follows the same layout, so a contributor who has read one plugin can find their way around all of them. `moyai` is the reference implementation. The repository [code style](../../AGENTS.md) applies to plugin code too.

## Naming

Plugin folders use lowercase kebab-case, such as `message-link-embeds`. They are limited to 48 characters and must contain only lowercase letters, numbers, and single hyphens.

Plugin IDs use a lowercase namespace followed by the folder name, such as `unbound.message-link-embeds` or `adrian.aussie-speech`. The final ID segment must exactly match the folder name.

Display names are short human-readable names made from title-case words separated by spaces. Established brand names may use a final uppercase acronym, such as `PronounDB` or `ReviewDB`; standalone acronyms are also allowed, such as `GIF Paste`. They must be 64 characters or fewer, with no leading or trailing whitespace or control characters.

Descriptions are concise, user-facing sentences with a maximum of 160 characters. They must be single-line text with no leading or trailing whitespace or control characters.

The pre-commit hook validates every plugin folder, manifest, naming collision, and description limit before allowing a commit.

## Layout

```
my-plugin/
├── manifest.json
├── package.json
├── rollup.config.mjs     # createPluginConfig(import.meta.url, { settingsPanel })
├── tsconfig.json         # maps ~/* to ./src/*
└── src/
    ├── index.ts(x)       # start, stop, getSettingsPanel. Nothing else.
    ├── constants.ts      # every module-level constant
    ├── modules.ts        # every metro lookup and the settings store, all lazy
    ├── patches/          # one file per patched module, named after it
    ├── events/           # one file per dispatcher action, named after it
    ├── stores/           # flux stores the plugin defines
    ├── components/       # React components, including settings-panel.tsx
    ├── native/           # code that uses the Objective-C bridge (context.native)
    └── <domain>.ts       # pure logic, named after what it does (matchers.ts, rules.ts)
```

Create only the folders a plugin needs. Import across folders with `~/`, such as `~/modules`. Never import from another plugin. Code two plugins need lives in `@unbound-plugins/shared`.

## The entry file

`src/index.ts` is the cleanest file in the plugin. It wires features together and owns the lifecycle. It holds no logic of its own.

```tsx
let dispose = () => {};

function start() {
	const DCDSoundManager = native.getNativeModule<SoundManager>('DCDSoundManager');

	if (!ensureModules('Moyai', { DCDSoundManager, SelectedChannelStore })) return;

	const player = createPlayer(DCDSoundManager);

	dispose = applyFeatures('Moyai', [
		() => player.dispose,
		() => subscribeMessages(player),
		() => whileEnabled(settings, 'allowReactions', true, () => subscribeReactions(player)),
	]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default { start, stop, getSettingsPanel: () => <SettingsPanel /> };
```

- Each feature function (`subscribeX`, `patchX`, `createX`) applies itself and returns the function that removes it.
- `applyFeatures` (`@unbound-plugins/shared/lifecycle/apply-features`) applies them in order and returns one cleanup that removes them in reverse. If a feature throws, it removes the features already applied. Unbound never calls `stop` after a failed `start`, so this is the only thing that prevents a leaked patch.
- A plugin with patches creates one patcher named after its ID, in `modules.ts`.
- `stop` must leave nothing behind: no patch, listener, timer, native hook, or registered setting. Force a re-render after unpatching a component that is on screen.

## Failing safely

A feature never runs half-working. When anything it depends on is missing, it logs one line and does nothing. The rest of the plugin keeps working.

- Call `ensureModules(name, { ...handles })` from `@unbound-plugins/shared/metro/ensure-modules`. It returns `false` and logs the missing names. Check in `start` only the modules every feature needs. Check a module that one feature needs at the top of that feature's apply function, and return a no-op cleanup when it is missing.
- A module that only makes a feature nicer, such as haptics or a theme color, is optional: use it with `?.` and keep working without it.
- Check that a patched method exists and has the expected shape before patching it. The patcher throws on a missing method.
- A missing native bridge is a truthy object whose methods throw. Check the capabilities in `context.native` before using it, not `ensureModules`.
- Never wrap the happy path in `try/catch` to hide a broken lookup. Catch only around calls that can fail at runtime for reasons outside the plugin, such as network requests and native calls.

## Modules

`src/modules.ts` holds every handle to something outside the plugin. A Discord rename then needs a one-line fix in one place.

```ts
export const SelectedChannelStore = metro.findStore('SelectedChannel', { lazy: true });
export const MessageActions = metro.findByProps('sendMessage', 'receiveMessage', { lazy: true });
export const settings = storage.getStore('unbound.my-plugin');
export const Patcher = patcher.createPatcher('unbound.my-plugin');
```

- Pass `{ lazy: true }` to every lookup so the search runs on first use.
- Prefer what Unbound already resolves: `metro.common` (`Dispatcher`, `Clipboard`, `Constants`, `Theme`, `Moment`, `Reanimated`), `metro.stores`, `metro.api`, and `metro.components` (`Discord`, `Forms`, `Media`).
- Prefer `findStore`, `findByProps`, and `findByName` over a hand-written filter. A custom filter goes through `metro.filters.createCacheable`.
- Resolve React Native native modules with `native.getNativeModule(...names)`.

## Patches

Put all patches on one module in `src/patches/<module>.ts`, named after the module in kebab-case, such as `patches/message-store.ts` or `patches/chat-input.ts`. The file exports one function that applies its patches and returns the unpatch function.

```ts
export function patchMessageStore(): () => void {
	return Patcher.after(MessageStore, 'getMessages', ({ result }) => filterBlocked(result));
}
```

- **Lazy patching.** Patch a module when it loads, not before. For a module that may not be loaded at `start`, use `whenLoaded(source, apply)` from `@unbound-plugins/shared/metro/when-loaded`, where `source` is a metro filter, a file path, or an array of candidates in order of preference. Use `whenAllLoaded(sources, apply)` from the same file for a feature that needs several such modules. Both return the cleanup for `stop`.
- **Setting-gated patching.** When a feature is behind a setting, apply its patch only while the setting is on. Use `whileEnabled(settings, key, default, apply)` from `@unbound-plugins/shared/settings/while-enabled`. It listens to the store through Unbound's settings listener, applies the feature when the key turns on, and removes it when the key turns off. Do not check the setting inside an always-on patch.

## Native code

Code that uses the Objective-C ABI (`context.native.objc`, `ffi`, `fabric`) lives in `src/native/`. `start(context)` passes `context.native` into it. Declare the capabilities the plugin uses in `manifest.json`. When the bridge or a capability is missing, the native feature does not start.

## Settings

- The settings panel is `src/components/settings-panel.tsx`. Build it from `Page` (`@unbound-plugins/shared/components/page`) and Discord's own rows: `Discord.TableRowGroup`, `TableSwitchRow`, `TableRow`, `TextInput`, and the rest of `metro.components.Discord`.
- Read and write values with the `settings` store from `modules.ts`. In React, call `settings.useSettingsStore()`.
- Set `settingsPanel: true` in `rollup.config.mjs` exactly when the plugin exports `getSettingsPanel`.

## Constants and text

- A module-level constant goes in `src/constants.ts`. A string used in one or two places is written inline. The plugin ID is written inline where it is needed.
- Format numbers, dates, durations, lists, and plurals with `Intl` (`NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `ListFormat`, `PluralRules`). Do not build them by hand.
- Use built-in runtime features before writing a helper: `Array.prototype.at`, `structuredClone`, `URL`, `URLSearchParams`, `AbortController`, `Promise.allSettled`.

## Shared code

`@unbound-plugins/shared` (`packages/plugins-shared`) holds code that more than one plugin uses, or logic large and critical enough to deserve its own tests. Add it to the plugin's `dependencies` as `workspace:*` and import a module by its path, such as `@unbound-plugins/shared/settings/while-enabled`. Shared modules are grouped by domain: `action-sheets/`, `components/`, `colors/`, `metro/`, `native/`, `react/`, `settings/`.

The lifecycle primitives are `ensureModules` (`metro/ensure-modules`) to bail out of `start`, `whenLoaded` and `whenAllLoaded` (`metro/when-loaded`) to wait for late modules, and `whileEnabled` (`settings/while-enabled`) to gate a feature on a setting. Settings panels use `Page` (`components/page`). Generic React tree helpers live in `react/`: `findRenderTarget` (`react/render-target`) finds the render function behind a module or element, through `memo` and `forwardRef`, and `findElement` (`react/find-element`) searches a render result.

Before writing a helper, check Unbound's API (`@unbound-app/api`) and the shared package. Use what exists.

## Tests

Test behavior a user or caller can observe through pure logic: parsing, matching, formatting, rule evaluation. Name the test after the file it covers, such as `matchers.test.ts`.

Do not write tests that mock Discord modules and then assert the mock was called. They pass when the plugin is broken on device and fail when Discord changes nothing. Verify integration on a device instead.
