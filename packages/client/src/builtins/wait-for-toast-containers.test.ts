import { expect, test } from 'bun:test';

import type { MetroFilter } from '~/api/metro/filters';

import type { ToastContainerTarget } from './wait-for-toast-containers';

// The build defines `$$DEV$$`, which the filters read through `~/lib/constants`.
Object.assign(globalThis, { $$DEV$$: false });

const { default: waitForToastContainers } = await import('./wait-for-toast-containers');

type Waiter = {
	filter: MetroFilter;
	onLoad: (mdl: MetroExport) => void;
};

const APP_PATH = 'modules/toast/native/AppToastContainer.tsx';
const MANA_PATH = 'design/mana/components/Toast/ToastContainer.native.tsx';

const component = () => null;

// Stands in for `onModuleLoaded`: each wait settles once, on the first module that loads and matches.
function createRegistry() {
	const waiters = new Set<Waiter>();
	const targets: ToastContainerTarget[] = [];

	function wait(filter: MetroFilter, onLoad: (mdl: MetroExport) => void) {
		const waiter = { filter, onLoad };

		waiters.add(waiter);

		return () => void waiters.delete(waiter);
	}

	// Waits are tested in reverse, since Discord does not promise any order.
	function load(exports: MetroExport, path?: string) {
		const record = { __filePath: path, publicModule: { exports } };

		for (const waiter of [...waiters].reverse()) {
			if (!waiters.has(waiter) || !waiter.filter(waiter.filter.isRaw ? record : exports, 0)) {
				continue;
			}

			waiters.delete(waiter);
			waiter.onLoad(exports);
		}
	}

	const stop = waitForToastContainers(wait, (target) => targets.push(target));

	return { load, stop, targets };
}

test('replaces both the app container and the design system container as they load', () => {
	const app = { default: component };
	const mana = { ToastContainer: component };
	const { load, targets } = createRegistry();

	load(mana, MANA_PATH);
	load(app, APP_PATH);

	expect(targets).toEqual([
		[mana, 'ToastContainer'],
		[app, 'default'],
	]);
});

test('falls back to a memoized ToastContainer export when no known file loads', () => {
	const memo = { type: component };
	const { load, targets } = createRegistry();

	load({ ToastContainer: memo }, 'design/elsewhere.tsx');

	expect(targets).toEqual([[memo, 'type']]);
});

test('does not fall back once a known container has loaded', () => {
	const mana = { ToastContainer: component };
	const { load, targets } = createRegistry();

	load(mana, MANA_PATH);
	load({ ToastContainer: component }, 'design/native.tsx');

	expect(targets).toEqual([[mana, 'ToastContainer']]);
});

test('replaces nothing that loads after it stops', () => {
	const { load, stop, targets } = createRegistry();

	stop();
	load({ ToastContainer: component }, MANA_PATH);

	expect(targets).toEqual([]);
});
