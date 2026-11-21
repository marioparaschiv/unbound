import { beforeEach, describe, expect, mock, test } from 'bun:test';

const installed = new Set<string>();
const sources: Record<string, string> = {};
const updated: string[] = [];
let running = 0;
let peak = 0;
let flaky = 1;

mock.module('~/plugins/manager', () => ({
	plugins: {
		isEnabled: () => true,
		getAddon: (id: string) => (installed.has(id) ? { id } : undefined),
		install: async (url: string) => {
			running++;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			running--;

			if (url.endsWith('flaky') && flaky-- > 0) {
				throw new Error('timeout');
			}

			installed.add(url.split('/').pop() ?? '');
		},
		uninstall: async () => {},
		enable: () => {},
		disable: () => {},
		getSources: () => sources,
		recordSource: (id: string, url: string) => void (sources[id] = url),
		forgetSource: () => {},
		listInstalled: () => [...installed].map((id) => ({ kind: 'plugin', id, version: '1.0.0' })),
	},
}));

const empty = {
	getAppliedId: () => null,
	isEnabled: () => false,
	getAddon: () => undefined,
	getSources: () => ({}),
	listInstalled: () => [],
};

mock.module('~/themes/manager', () => ({ themes: empty }));
mock.module('~/icon-packs/manager', () => ({ icons: empty }));
mock.module('~/fonts/manager', () => ({ fonts: { ...empty, isSupported: () => false } }));
const catalog = {
	status: 'ready',
	catalog: {
		addons: [{ id: 'p0', latestVersion: { manifestUrl: 'https://cdn.invalid/latest/p0' } }],
	},
};

mock.module('~/marketplace/state', () => ({
	default: { getState: () => ({ state: catalog, load: async () => true }) },
}));
mock.module('~/storage/api', () => ({ getBucket: () => ({}), snapshot: () => ({}) }));
mock.module('~/addons/manager', () => ({
	Manager: {
		for: () => ({
			listInstalled: () =>
				[...installed].map((id) => ({ kind: 'plugin', id, version: '1.0.0' })),
			getHeldVersion: () => undefined,
			update: async (id: string) => {
				updated.push(id);

				return true;
			},
		}),
	},
}));
mock.module('~/updates/addon-updates', () => ({
	fetchUpdates: async (entries: { id: string }[]) =>
		entries.map(({ id }) => ({ kind: 'plugin', id, update: { version: '2.0.0' } })),
	automaticUpdates: (pending: unknown[]) => pending,
}));

const { applyActions } = await import('~/sync/device');

const install = (id: string) => ({
	type: 'install' as const,
	kind: 'plugins' as const,
	install: { id, url: `https://cdn.invalid/${id}`, enabled: true },
});

beforeEach(() => {
	installed.clear();
	updated.length = 0;
	peak = 0;
	flaky = 1;
});

describe('applyActions', () => {
	test('installs six at a time, retries a failure once and updates every fresh install', async () => {
		const ids = Array.from({ length: 14 }, (_, index) => `p${index}`);

		const failed = await applyActions([...ids.map(install), install('flaky')]);

		expect(failed).toEqual([]);
		expect(sources.p0).toBe('https://cdn.invalid/latest/p0');
		expect(peak).toBe(6);
		expect(installed.size).toBe(15);
		expect(updated.toSorted()).toEqual([...ids, 'flaky'].toSorted());
	});

	test('leaves an addon that keeps failing in the failed list', async () => {
		flaky = 5;

		const failed = await applyActions([install('flaky')]);

		expect(failed).toEqual([install('flaky')]);
	});
});
