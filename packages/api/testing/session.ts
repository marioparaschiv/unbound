import type { InstalledAddonGlobals } from './install-addon-globals';
import type { FakeDialogs, FakeToasts } from './fake-feedback';
import type { ListenerRegistry } from './listener-registry';
import type { FakeAssets, FakeFlux } from './fake-api';
import type { FakeSettings } from './fake-settings';
import type { FakeLocales } from './fake-locales';
import type { FakePlugins } from './fake-plugins';
import type { FakeNative } from './fake-native';
import type { FakeFs } from './fake-fs';

import { SOURCE_LOCALE } from '../src/_conventions/addon-locales';
import { unmountAll } from './test-renderer';

/** The plugin under test and every fake the preset installed for it. */
export type TestSession = {
	root: string;
	entry: string | undefined;
	scope: InstalledAddonGlobals;
	listeners: ListenerRegistry;
	toasts: FakeToasts;
	dialogs: FakeDialogs;
	flux: FakeFlux;
	assets: FakeAssets;
	locales: FakeLocales | undefined;
	settings: FakeSettings | undefined;
	native: FakeNative;
	plugins: FakePlugins;
	fs: FakeFs;
};

let active: TestSession | undefined;

/**
 * @description Makes a session the one the recorders, `render` and `startPlugin` read. The preset calls it once.
 * @param session The session.
 */
export function startSession(session: TestSession): void {
	active = session;
}

/**
 * @description Returns the session the preset started.
 * @returns The session; throws naming the bunfig line when the preset is not loaded.
 */
export function getSession(): TestSession {
	if (!active) {
		throw new Error(
			'The Unbound test preset is not loaded. Add `preload = ["@unbound-app/api/testing/preset"]` under [test] in bunfig.toml.',
		);
	}

	return active;
}

/**
 * @description Puts every fake back to how the preset made it: no mounted trees, patches, commands, listeners, timers,
 * metro modules, files, stored settings, toasts, dialogs, stores or logs, the platform iOS, and en-US.
 */
export function resetSession(): void {
	const session = getSession();
	const { scope } = session;

	unmountAll();
	scope.patcher.unpatchAll();
	scope.commands.unregisterAll();
	scope.timers.clearAll();
	scope.metro.reset();
	session.listeners.clear();
	session.native.reset();
	session.plugins.reset();
	session.fs.files.clear();
	scope.storage.data.clear();
	scope.logs.length = 0;
	session.flux.reset();
	session.toasts.shown.length = 0;
	session.dialogs.opened.length = 0;
	session.locales?.setLocale(SOURCE_LOCALE);
}
