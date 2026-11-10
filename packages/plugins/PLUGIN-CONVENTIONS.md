# Plugin conventions

This file holds the rules that apply to first-party plugins only. Everything a plugin author needs is in the developer guide, and the guide wins where it differs from a habit of one plugin.

- [Anatomy of a Plugin](../../docs/developer/getting-started/plugin-anatomy.mdx) shows every file of a plugin in the code of `character-counter`, the reference plugin. Copy its layout.
- [Project Layout](../../docs/developer/getting-started/project-rules.mdx) lists the layout rules and the lint rule or build check behind each one.
- [How Plugins Run](../../docs/developer/getting-started/lifecycle.mdx) covers the lifecycle and the Addon scope, and the guide's other pages cover each API. Its code blocks are typechecked by `bun test packages/plugin-scripts/src/docs-examples.test.ts`.
- The repository [code style](../../AGENTS.md) applies to plugin code too.

## Naming

Plugin folders use lowercase kebab-case, such as `message-link-embeds`. They are limited to 48 characters and must contain only lowercase letters, numbers, and single hyphens.

Plugin IDs use a lowercase namespace followed by the folder name, such as `unbound.message-link-embeds` or `adrian.aussie-speech`. The final ID segment must exactly match the folder name.

Display names are short human-readable names made from title-case words separated by spaces. Established brand names may use a final uppercase acronym, such as `PronounDB` or `ReviewDB`; standalone acronyms are also allowed, such as `GIF Paste`. They must be 64 characters or fewer, with no leading or trailing whitespace or control characters.

Descriptions are concise, user-facing sentences with a maximum of 160 characters. They must be single-line text with no leading or trailing whitespace or control characters.

The pre-commit hook validates every plugin folder, manifest, naming collision, and description limit before allowing a commit.

## Shared code

`@unbound-plugins/shared` (`packages/plugins-shared`) holds code that more than one plugin uses, or logic large and critical enough to deserve its own tests. Add it to the plugin's `dependencies` as `workspace:*` and import a module by its path, such as `@unbound-plugins/shared/settings/while-enabled`. Never import from another plugin.

Shared modules are grouped by domain: `action-sheets/`, `assets/`, `colors/`, `composer/`, `context-menus/`, `lifecycle/`, `members/`, `metro/`, `native/`, `oauth/`, `react/`, `settings/`, `stickers/` and `text-replace/`. The ones every plugin reaches for:

| Module                                      | Use it to                                                                                                                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lifecycle/start-features`                  | Start features that are independent. A feature that throws is logged and recorded, and the others still start                                                                                                                     |
| `lifecycle/apply-features`                  | Apply features that depend on each other. A feature that throws removes the ones already applied, so the plugin is never half applied. Unbound never calls `stop` after a failed `start`, so this is what prevents a leaked patch |
| `lifecycle/health`                          | Count applied features with `recordApplied`, and record `recordSkip` and `recordFailure`. Export `featureSelfTest` from the entry as `selfTest`. Call `resetHealth` in a test's `beforeEach`                                      |
| `metro/ensure-modules`                      | Bail out of a feature, with one log line, when a module it needs is missing. It never loads a lazy handle                                                                                                                         |
| `metro/when-loaded`                         | Patch a module whose patch target is computed from the module, once it loads                                                                                                                                                      |
| `settings/while-enabled`                    | Apply a feature only while a setting is on                                                                                                                                                                                        |
| `react/render-target`, `react/find-element` | Find the render function behind a module, and search a render result                                                                                                                                                              |

Before writing a helper, check Unbound's API (`@unbound-app/api`) and the shared package. Use what exists.

## Failing safely

A feature never runs half-working. When anything it depends on is missing, it checks with `ensureModules` at the top of its start function, logs one line, and does nothing. The rest of the plugin keeps working. Call `ensureModules` in `start` for the modules every feature needs, and at the top of a feature for the modules only it needs.

- Pass `ensureModules` the handles themselves. A property read such as `{ send: Messages.sendMessage }` loads the module before the check runs.
- A module that only makes a feature nicer, such as haptics or a theme color, is optional: use it with `?.`.
- A missing native bridge is a truthy object whose methods throw. Check `context.native` capabilities before using it, not `ensureModules`.
- Never wrap the happy path in `try`/`catch` to hide a broken lookup. Catch only around calls that can fail for reasons outside the plugin, such as network requests and native calls.

## Self-test and device matrix

Export `selfTest` from the plugin's entry, usually as `export { featureSelfTest as selfTest }`. A plugin that draws its own UI exports a test built on `drawnSelfTest`, which also checks that something is on screen. Two plugins export none: `aussie-mode` does nothing outside an Australian device, so it would fail the matrix everywhere else, and `settings-demo` only demonstrates the settings panel.

The device matrix runs the plugins on real devices. It restarts Discord, calls each `selfTest`, and cycles each plugin through stop, start and reload to look for leaked hooks. Configure the devices in `.device-matrix.json` (see `.device-matrix.example.json`), then run `bun packages/plugin-scripts/src/run-device-matrix.ts --out <dir>`. Use `--only <id,id>` for a few plugins and `--lenient` to fail only on problems that are new since the last run.

A plugin fails the matrix when its self-test is not `ok`, when it will not start again after `stop`, when `stop` or a reload leaves native hooks behind, or when it makes a view call from the JavaScript thread that the [UI thread](../../docs/developer/plugins/ui-thread.mdx) page tells you to avoid. A unit test cannot see these, so run the matrix before you ship a change to a plugin's patches or native code.

## Tests

Test behavior a user can see: what the started plugin draws, shows or sends, and the pure logic under it. Use the testing preset and its fakes, as `character-counter` does, so a test runs the plugin's real entry. Name a test after the file it covers, such as `limit.test.ts`. The [Testing](../../docs/developer/testing/writing-tests.mdx) page covers the preset.

Do not write tests that mock Discord modules and then assert the mock was called. They pass when the plugin is broken on a device and fail when Discord changes nothing.

## Versions and the changelog

Each plugin ships `ADDON.md`, `CHANGELOG.md` and a `version` in its manifest. `bun run plugins:validate` fails when `ADDON.md` is missing or empty, when `CHANGELOG.md` does not parse, and when the changelog has no entry for the manifest's version.

- Raise `version` in `manifest.json` in the same change that alters what the plugin does, and add that version's entry to `CHANGELOG.md`. The `plugins-publish` workflow publishes every plugin and theme whose manifest version is newer than the live one.
- A changelog entry has `Added`, `Changed`, `Fixed` and `Removed` sections. Write what a user notices. A change with no visible effect says so: "The plugin works the same as before."
- Commit as `type(scope): subject`, with the plugin's folder name as the scope, such as `fix(moyai): play the sound once`. `feat`, `fix` and `perf` commits feed the changelog, and every other type is left out.
- A change to `ADDON.md` alone ships as a patch release too, with the entry "The plugin works the same as before." See `character-counter`'s `CHANGELOG.md` for examples.
