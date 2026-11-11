# Creating a plugin

1. **Scaffold**: `bunx --bun @unbound-app/cli create --kind plugin --name <kebab-name> --shape repository --git-init --install`. `--shape addon` makes a single plugin instead of a workspace. It creates `--dir` (default `./<name>`) and refuses a folder that already has files.
2. **Know the layout** (one folder per plugin; `packages/plugins/character-counter` is the reference):

| Path                                | Holds                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `manifest.json`                     | `id` (`<author>.<name>`), `name`, `description`, `authors`, `version`, `icon` (a Discord icon name), `main` (entry inside `src/`). Never `platforms` or `capabilities`: the build writes them |
| `src/index.tsx`                     | The entry: named exports `start`, `stop`, `SettingsPanel`, `selfTest`, all optional. `start` and `stop` only list features ([lifecycle.md](lifecycle.md))                                     |
| `src/patches.ts`, `src/commands.ts` | One file per kind while it is small: `patchX` features in `patches.ts`, `registerX` in `commands.ts`                                                                                          |
| `src/native/`, `src/flux/`          | `native/hooks.ts`, `views.ts`, `worklets.ts`, `calls.ts`; `flux/interceptors.ts` (`interceptX`), `flux/listeners.ts` (`listenToX`)                                                            |
| `src/components/`                   | React components and their hooks                                                                                                                                                              |
| `src/lib/`                          | The plugin's own logic: data, network, storage, helpers. No Discord patches; tests import it directly                                                                                         |
| `settings.ts`                       | `defineSettings({ key: setting.boolean({ default, title, subtitle }) })`; read via `import { settings } from '@unbound-app/settings'`                                                         |
| `i18n/en-US.json`                   | Every string shown; `title`, `subtitle` and toast arguments are its keys                                                                                                                      |
| `tests/`                            | Mirrors `src/`; `bun test` with the preset `bunfig.toml` loads (`startPlugin`, `stopPlugin` from `@unbound-app/api/testing`)                                                                  |

Never deeper than `src/<folder>/<file>`, except platform code in `src/<folder>/ios/<file>` and `src/<folder>/android/<file>`. A kind file that grows too big becomes a folder of named files: `patches/message-rows.ts`; a platform split becomes `native/android/worklets.ts` and `native/ios/worklets.ts` (or `lib/ios/`, `patches/android/`, ...), selected by `definePlatform` in `native/worklets.ts`, never `-ios`/`-android` file names. Function names carry their kind (`patchX`, `interceptX`, `listenToX`, `registerX`, `hookX`, `drawX`), so a file moves without renames. State several features share, such as a log, is its own module in `lib/` that they import.

3. **Add a feature**: one function in the file of its kind. It checks its needs first, then patches:

    ```ts
    export function patchMemberList() {
    	if (!settings.memberList) return;

    	const UserRow = metro.findByFilePath('modules/members/native/UserRow.tsx');

    	if (!UserRow) {
    		logger.warn('Member list skipped: Discord moved UserRow.');
    		return;
    	}

    	patcher.after(UserRow, 'default', drawIndicators);
    }
    ```

    The setting check is silent; a missing module is one `logger.warn` naming the feature and what moved. Lookups sit inside the feature, after its setting check, so a disabled feature creates none. Keep a `lib/modules.ts` only for handles several features or components share. Then call the feature from `start`.

4. **Check**: `ubd check` reports no errors, and `ubd debug push <id>` shows the plugin running ([the `unbound-debugger` skill](../unbound-debugger/loop.md)).

Globals every plugin has: `logger` (prefixed with the plugin name), `addon` (`id`, `name`, `version`, `manifest`), scoped `setTimeout` and `setInterval`, `React`.
