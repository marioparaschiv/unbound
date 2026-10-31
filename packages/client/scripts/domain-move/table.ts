/**
 * Old path → new path for the client domain move (plan §1, C3), relative to `packages/client/src`.
 * A key ending in `/` moves every file under that folder. Files not listed here stay where they are.
 */
export const moves: Record<string, string> = {
	'entry.ts': 'core/entry.ts',
	'index.ts': 'core/index.ts',
	'preinitialize.ts': 'core/preinitialize.ts',
	'shims.ts': 'core/shims.ts',
	'shims.test.ts': 'core/shims.test.ts',
	'api/index.ts': 'core/api.ts',
	'lib/constants.ts': 'core/constants.ts',
	'lib/event-emitter.ts': 'core/event-emitter.ts',
	'lib/loader.ts': 'core/loader.ts',
	'lib/loader.test.ts': 'core/loader.test.ts',
	'lib/environment.ts': 'core/environment.ts',
	'lib/navigation-ready.ts': 'core/navigation-ready.ts',
	'lib/repository.ts': 'core/repository.ts',
	'lib/versions.ts': 'core/versions.ts',
	'lib/versions.test.ts': 'core/versions.test.ts',
	'lib/discord-support.ts': 'core/discord-support.ts',
	'lib/discord-support.test.ts': 'core/discord-support.test.ts',

	'api/metro/': 'metro/',
	'lib/cache.ts': 'metro/cache.ts',

	'api/patcher.ts': 'patcher/api.ts',

	'api/commands.ts': 'commands/api.ts',
	'lib/commands/': 'commands/',
	'builtins/commands.ts': 'commands/builtin.ts',
	'builtins/core-commands.ts': 'commands/core-commands.ts',
	'builtins/format-code-block.ts': 'commands/format-code-block.ts',
	'builtins/format-code-block.test.ts': 'commands/format-code-block.test.ts',

	'api/storage.ts': 'storage/api.ts',
	'api/storage.test.ts': 'storage/api.test.ts',

	'api/native.ts': 'native/native.ts',
	'api/fs.ts': 'native/fs.ts',
	'api/native-runtime.ts': 'native/runtime.ts',
	'api/native-capabilities.ts': 'native/capabilities.ts',
	'api/native-errors.ts': 'native/errors.ts',
	'api/native-flux-bridge.ts': 'flux/runtime-bridge.ts',
	'api/native-plugin-bridge.ts': 'native/plugin-bridge.ts',
	'api/native-scope.ts': 'native/scope.ts',
	'lib/native-consent.ts': 'native/consent.ts',
	'lib/native-consent.test.ts': 'native/consent.test.ts',
	'builtins/native-consent.ts': 'native/builtin.ts',
	'lib/unbound-path.ts': 'native/unbound-path.ts',
	'lib/unbound-path.test.ts': 'native/unbound-path.test.ts',

	'api/assets.ts': 'assets/api.ts',

	'api/i18n.ts': 'i18n/api.ts',
	'api/create-moment-calendar-locale.ts': 'i18n/create-moment-calendar-locale.ts',
	'api/create-moment-calendar-locale.test.ts': 'i18n/create-moment-calendar-locale.test.ts',
	'api/create-moment-locale-definer.ts': 'i18n/create-moment-locale-definer.ts',
	'api/create-moment-locale-definer.test.ts': 'i18n/create-moment-locale-definer.test.ts',
	'api/create-moment-locale-setter.ts': 'i18n/create-moment-locale-setter.ts',
	'api/create-moment-locale-setter.test.ts': 'i18n/create-moment-locale-setter.test.ts',
	'api/resolve-moment-locale.ts': 'i18n/resolve-moment-locale.ts',
	'api/resolve-moment-locale.test.ts': 'i18n/resolve-moment-locale.test.ts',
	'builtins/i18n.ts': 'i18n/builtin.ts',

	'api/toasts.ts': 'toasts/api.ts',
	'stores/toasts.ts': 'toasts/state.ts',
	'lib/toast-content.ts': 'toasts/content.ts',
	'ui/toasts/toast-duration.ts': 'toasts/duration.ts',
	'ui/toasts/toast-duration.test.ts': 'toasts/duration.test.ts',
	'builtins/toasts.tsx': 'toasts/builtin.tsx',
	'builtins/discord-toast-options.ts': 'toasts/discord-toast-options.ts',
	'builtins/discord-toast-options.test.ts': 'toasts/discord-toast-options.test.ts',
	'builtins/find-toast-containers.ts': 'toasts/find-toast-containers.ts',
	'builtins/find-toast-containers.test.ts': 'toasts/find-toast-containers.test.ts',

	'api/settings.ts': 'settings/api.ts',
	'stores/settings.ts': 'settings/state.ts',
	'lib/unbound-settings.ts': 'settings/unbound.ts',
	'lib/unbound-settings.test.ts': 'settings/unbound.test.ts',
	'builtins/settings.tsx': 'settings/builtin.tsx',
	'builtins/find-settings-overview.ts': 'settings/find-overview.ts',
	'builtins/find-settings-overview.test.ts': 'settings/find-overview.test.ts',

	'managers/base.ts': 'addons/manager.ts',
	'managers/manager-of.ts': 'addons/manager-of.ts',
	'managers/addon.ts': 'addons/addon.ts',
	'managers/addons.ts': 'addons/addons.ts',
	'managers/addon-lifecycle.ts': 'addons/lifecycle.ts',
	'managers/index.ts': 'addons/managers.ts',
	'api/crash-guard.ts': 'addons/crash-guard.ts',
	'lib/addon-dependencies.ts': 'addons/dependencies.ts',
	'lib/addon-dependencies.test.ts': 'addons/dependencies.test.ts',
	'lib/addon-download.ts': 'addons/download.ts',
	'lib/addon-manifest.ts': 'addons/manifest.ts',
	'lib/addon-paths.ts': 'addons/paths.ts',
	'lib/addon-paths.test.ts': 'addons/paths.test.ts',
	'lib/addon-versions.ts': 'addons/versions.ts',
	'lib/addon-versions.test.ts': 'addons/versions.test.ts',

	'managers/plugins.ts': 'plugins/manager.ts',
	'ui/addons/sample-addons.ts': 'plugins/sample-addons.ts',
	'managers/themes.ts': 'themes/manager.ts',
	'stores/themes.ts': 'themes/state.ts',
	'builtins/themes.ts': 'themes/builtin.ts',
	'lib/theme-bundle.ts': 'themes/bundle.ts',
	'lib/theme-colors.ts': 'themes/colors.ts',
	'lib/theme-colors.test.ts': 'themes/colors.test.ts',
	'managers/icons.ts': 'icon-packs/manager.ts',
	'managers/fonts.ts': 'fonts/manager.ts',

	'lib/catalog.ts': 'marketplace/catalog.ts',
	'lib/catalog.test.ts': 'marketplace/catalog.test.ts',
	'stores/marketplace.ts': 'marketplace/state.ts',

	'lib/updates.ts': 'updates/addon-updates.ts',
	'lib/updates.test.ts': 'updates/addon-updates.test.ts',
	'lib/loader-updates.ts': 'updates/loader-updates.ts',
	'lib/loader-updates.test.ts': 'updates/loader-updates.test.ts',
	'stores/updates.ts': 'updates/state.ts',
	'builtins/updater.ts': 'updates/builtin.ts',

	'managers/cloud-sync.ts': 'sync/api.ts',
	'lib/sync.ts': 'sync/merge.ts',
	'lib/sync.test.ts': 'sync/merge.test.ts',
	'managers/sync-device.ts': 'sync/device.ts',
	'lib/discord-oauth.ts': 'sync/discord-oauth.ts',
	'builtins/cloud-sync.ts': 'sync/builtin.ts',

	'managers/builtins.ts': 'builtins/registry.ts',
	'managers/builtins.test.ts': 'builtins/registry.test.ts',

	'builtins/debugger.ts': 'debugger/builtin.ts',
	'lib/reload-summary.ts': 'debugger/reload-summary.ts',
	'lib/reload-summary.test.ts': 'debugger/reload-summary.test.ts',

	'lib/hot/': 'hot-refresh/',
	'builtins/hot-refresh.ts': 'hot-refresh/builtin.ts',

	'api/dialogs.tsx': 'dialogs/api.tsx',
	'lib/crash-reports.ts': 'diagnostics/crash-reports.ts',
	'lib/crash-report.ts': 'diagnostics/crash-report.ts',
	'lib/crash-report.test.ts': 'diagnostics/crash-report.test.ts',
	'lib/debug-report/': 'diagnostics/',
	'builtins/links.ts': 'links/builtin.ts',
	'builtins/share-link.ts': 'links/share-link.ts',
	'builtins/share-link.test.ts': 'links/share-link.test.ts',
	'builtins/resolve-unbound-link.ts': 'links/resolve-unbound-link.ts',
	'builtins/resolve-unbound-link.test.ts': 'links/resolve-unbound-link.test.ts',
};

/** Files deleted only in contract mode, relative to `packages/client/src`. */
export const removals: string[] = [
	'lib/force-render.ts',
	'managers/utils.ts',
	'ui/components/index.ts',
	'ui/hooks/index.ts',
	'ui/addons/index.ts',
	'ui/marketplace/index.ts',
	'ui/toasts/index.ts',
];

/** Files under the old layer folders that the plan keeps in place. */
export const kept: string[] = [
	'builtins/api.ts',
	'builtins/discord-support.ts',
	'builtins/error-boundary.tsx',
	'builtins/staff-mode.ts',
	'builtins/tracking.ts',
];

export default { moves, removals, kept };
