import { expect, test } from 'bun:test';

import type { MetroFilter } from '~/api/metro/filters';

// The build defines `$$DEV$$`, which the filters read through `~/lib/constants`.
Object.assign(globalThis, { $$DEV$$: false });

const { default: waitForSettingsOverview } = await import('./wait-for-settings-overview');

type Waiter = {
	filter: MetroFilter;
	onLoad: (mdl: MetroExport) => void;
};

type OverviewExports = { default: () => null };

const OVERVIEW_PATH = 'modules/user_settings/overview/native/SettingsOverviewScreen.tsx';

// Stands in for `onModuleLoaded`, testing a module's `default` export as well, as `interop: false` searches do.
function createRegistry(loaded: [OverviewExports, string][] = []) {
	const waiters = new Set<Waiter>();
	const found: OverviewExports[] = [];

	function matches(filter: MetroFilter, exports: OverviewExports, path: string) {
		if (filter.isRaw) {
			return Boolean(filter({ __filePath: path, publicModule: { exports } }, 0));
		}

		return Boolean(filter(exports, 0) || filter(exports.default, 0));
	}

	function wait(filter: MetroFilter, onLoad: (mdl: MetroExport) => void) {
		const ready = loaded.find(([exports, path]) => matches(filter, exports, path));

		if (ready) {
			onLoad(ready[0]);

			return () => {};
		}

		const waiter = { filter, onLoad };

		waiters.add(waiter);

		return () => void waiters.delete(waiter);
	}

	function load(exports: OverviewExports, path: string) {
		for (const waiter of waiters) {
			if (!matches(waiter.filter, exports, path)) {
				continue;
			}

			waiters.delete(waiter);
			waiter.onLoad(exports);
		}
	}

	const stop = waitForSettingsOverview(wait, (overview) => found.push(overview));

	return { load, stop, found, waiters };
}

test('finds an anonymous settings overview by its Metro path once it loads', () => {
	const overview = { default: () => null };
	const { load, found } = createRegistry();

	expect(found).toEqual([]);

	load(overview, OVERVIEW_PATH);

	expect(found).toEqual([overview]);
});

test('passes a named overview that has already loaded once, and stops waiting', () => {
	function SettingsOverviewScreen() {
		return null;
	}

	const overview = { default: SettingsOverviewScreen };
	const { found, waiters } = createRegistry([[overview, OVERVIEW_PATH]]);

	expect(found).toEqual([overview]);
	expect(waiters.size).toBe(0);
});

test('passes nothing that loads after it stops', () => {
	const { load, stop, found } = createRegistry();

	stop();
	load({ default: () => null }, OVERVIEW_PATH);

	expect(found).toEqual([]);
});
