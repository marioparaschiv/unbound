# Creating a plugin

1. **Scaffold**: `bunx --bun @unbound-app/cli create --kind plugin --name <kebab-name> --shape repository --git-init --install`. `--shape addon` makes a single plugin instead of a workspace. It creates `--dir` (default `./<name>`) and refuses a folder that already has files.
2. **Know the layout** (one folder per plugin):

| Path                       | Holds                                                                                                                                                                                         |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`            | `id` (`<author>.<name>`), `name`, `description`, `authors`, `version`, `icon` (a Discord icon name), `main` (entry inside `src/`). Never `platforms` or `capabilities`: the build writes them |
| `src/index.tsx`            | The entry: named exports `start`, `stop`, `SettingsPanel`, `selfTest`, all optional. It only starts features                                                                                  |
| `src/<feature>/index.ts`   | One folder per feature, exporting `start<Feature>()`                                                                                                                                          |
| `src/<feature>/modules.ts` | Every metro and flux lookup the feature uses, so a Discord rename is a one-line fix                                                                                                           |
| `settings.ts`              | `defineSettings({ key: setting.boolean({ default, title, subtitle }) })`; read via `import { settings } from '@unbound-app/settings'`                                                         |
| `i18n/en-US.json`          | Every string shown; `title`, `subtitle` and toast arguments are its keys                                                                                                                      |
| `tests/`                   | `bun test` with the preset `bunfig.toml` loads (`startPlugin`, `stopPlugin` from `@unbound-app/api/testing`)                                                                                  |

3. **Add a feature**: create `src/<feature>/index.ts` with its `start<Feature>()`, then call it from `start` in `src/index.tsx`.
4. **Check**: `ubd check` reports no errors, and `ubd debug push <id>` shows the plugin running ([the `unbound-debugger` skill](../unbound-debugger/loop.md)).

Globals every plugin has: `logger` (prefixed with the plugin name), `addon` (`id`, `name`, `version`, `manifest`), scoped `setTimeout` and `setInterval`, `React`.
