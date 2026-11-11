import { createFakeNative, installAddonGlobals } from '@unbound-app/api/testing/fakes';
import { beforeEach, describe, expect, test } from 'bun:test';

import {
	awaitModule,
	drawnSelfTest,
	ensurePresent,
	runFeatures,
	skipFeature,
	startTogether,
} from '~/lifecycle/features';

const { logs } = installAddonGlobals();
const context = createFakeNative().context(addon.manifest);

beforeEach(() => {
	logs.length = 0;
});

describe('runFeatures', () => {
	test('starts the other features when one throws, and reports the failure', async () => {
		const ended: string[] = [];
		const plugin = runFeatures([
			() => () => void ended.push('a'),
			() => {
				throw new Error('no render function');
			},
			() => () => void ended.push('c'),
		]);

		plugin.start(context);

		expect(plugin.selfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: no render function',
		});
		expect(logs[0]?.args[0]).toBe('Failed to start a feature:');

		await plugin.stop();

		expect(ended).toEqual(['c', 'a']);
	});

	test('counts features in on start and out on stop, across restarts', () => {
		const plugin = runFeatures([() => {}, () => () => {}]);

		plugin.start(context);
		expect(plugin.selfTest()).toEqual({ ok: true, detail: '2 features applied' });

		plugin.stop();
		expect(plugin.selfTest()).toEqual({ ok: false, detail: 'no features are applied' });

		plugin.start(context);
		expect(plugin.selfTest()).toEqual({ ok: true, detail: '2 features applied' });
	});

	test('passes the start context to each feature', () => {
		const seen: unknown[] = [];

		runFeatures([(received) => void seen.push(received)]).start(context);

		expect(seen).toEqual([context]);
	});

	test('reverts the started features when an atomic one throws', () => {
		const calls: string[] = [];
		const plugin = runFeatures(
			[
				() => () => void calls.push('a'),
				() => {
					throw new Error('missing');
				},
				() => () => void calls.push('never'),
			],
			{ atomic: true },
		);

		plugin.start(context);

		expect(calls).toEqual(['a']);
		expect(plugin.selfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: missing',
		});
		expect(plugin.stop()).toBeUndefined();
		expect(calls).toEqual(['a']);
	});

	test('returns nothing from stop when every cleanup is synchronous', () => {
		const plugin = runFeatures([() => () => undefined]);

		plugin.start(context);

		expect(plugin.stop()).toBeUndefined();
		expect(plugin.stop()).toBeUndefined();
	});

	test('waits for asynchronous cleanups, and logs one that rejects', async () => {
		const calls: string[] = [];
		let finish = () => {};
		const plugin = runFeatures([
			() => () =>
				new Promise<void>((resolve) => {
					finish = () => {
						calls.push('async');
						resolve();
					};
				}),
			() => () => Promise.reject(new Error('stuck')),
			() => () => void calls.push('sync'),
		]);

		plugin.start(context);

		const pending = plugin.stop();

		expect(calls).toEqual(['sync']);
		finish();
		await pending;
		expect(calls).toEqual(['sync', 'async']);
		expect(logs.map((entry) => entry.args[0])).toEqual(['Failed to clean up a feature:']);
	});

	test('starts what a function returns, and nothing when it returns nothing', () => {
		const plugin = runFeatures(() => undefined);

		plugin.start(context);
		expect(plugin.selfTest()).toEqual({ ok: false, detail: 'no features are applied' });

		const built = runFeatures(() => [() => {}]);

		built.start(context);
		expect(built.selfTest().ok).toBe(true);
	});

	test('fails the self test with what a feature skipped, until the plugin stops', () => {
		let missing = true;
		const plugin = runFeatures([
			() => {
				if (missing) {
					skipFeature('modules not found: MessageStore');
				}
			},
		]);

		plugin.start(context);

		expect(plugin.selfTest()).toEqual({
			ok: false,
			detail: 'skipped: modules not found: MessageStore',
		});
		expect(logs[0]).toEqual({
			level: 'error',
			args: ['Skipped, modules not found: MessageStore.'],
		});

		plugin.stop();
		missing = false;
		plugin.start(context);

		expect(plugin.selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
	});

	test('waits for asynchronous features, and counts them once started', async () => {
		const calls: string[] = [];
		let finish = () => {};
		const plugin = runFeatures([
			() =>
				new Promise((resolve) => {
					finish = () => resolve(() => void calls.push('ended'));
				}),
		]);

		const started = plugin.start(context);

		expect(plugin.selfTest()).toEqual({ ok: false, detail: 'no features are applied' });
		finish();
		await started;
		expect(plugin.selfTest()).toEqual({ ok: true, detail: '1 feature applied' });

		plugin.stop();
		expect(calls).toEqual(['ended']);
		expect(runFeatures([() => {}]).start(context)).toBeUndefined();
	});

	test('ends an asynchronous feature that finishes starting after stop', async () => {
		const calls: string[] = [];
		let finish = () => {};
		const plugin = runFeatures([
			() =>
				new Promise((resolve) => {
					finish = () => resolve(() => void calls.push('ended'));
				}),
		]);

		const started = plugin.start(context);

		plugin.stop();
		finish();
		await started;
		expect(calls).toEqual(['ended']);
	});

	test('reports a rejected asynchronous feature as failed', async () => {
		const plugin = runFeatures([() => Promise.reject(new Error('no view'))]);

		await plugin.start(context);

		expect(plugin.selfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: no view',
		});
	});

	test('throws from start when building the features throws, and fails the self test', () => {
		const plugin = runFeatures(() => {
			throw new Error('no message view');
		});

		expect(() => plugin.start(context)).toThrow('no message view');
		expect(plugin.selfTest()).toEqual({
			ok: false,
			detail: 'start failed and was reverted: no message view',
		});
	});

	test('names the modules a feature still waits for in the self test', () => {
		let loaded = false;
		const plugin = runFeatures([() => awaitModule('MessageStore', () => loaded)]);

		plugin.start(context);
		expect(plugin.selfTest()).toEqual({
			ok: true,
			detail: '1 feature applied, waiting for MessageStore',
		});

		loaded = true;
		expect(plugin.selfTest()).toEqual({ ok: true, detail: '1 feature applied' });
	});

	test('builds the self test on the features result', () => {
		const plugin = runFeatures([() => {}], {
			selfTest: (features) => ({ ...features, detail: `checked: ${features.detail}` }),
		});

		plugin.start(context);

		expect(plugin.selfTest()).toEqual({ ok: true, detail: 'checked: 1 feature applied' });
	});
});

describe('startTogether', () => {
	test('ends the parts in reverse', () => {
		const calls: string[] = [];
		const end = startTogether([
			() => () => void calls.push('a'),
			() => () => void calls.push('b'),
		]);

		expect(end()).toBeUndefined();
		expect(calls).toEqual(['b', 'a']);
	});

	test('reverts the started parts and rethrows when one fails', () => {
		const calls: string[] = [];

		expect(() =>
			startTogether([
				() => () => void calls.push('a'),
				() => {
					throw new Error('missing');
				},
			]),
		).toThrow('missing');
		expect(calls).toEqual(['a']);
	});
});

describe('ensurePresent', () => {
	test('names the feature and what is missing', () => {
		expect(ensurePresent([], 'modules not found')).toBe(true);
		expect(ensurePresent(['Theme'], 'modules not found', 'context menus')).toBe(false);
		expect(logs[0]?.args).toEqual(['Skipped, context menus: modules not found: Theme.']);
	});
});

describe('drawnSelfTest', () => {
	const running = { ok: true, detail: '1 feature applied' } as const;

	test('passes only once something is drawn', () => {
		expect(drawnSelfTest(running, () => 3, 'embeds')).toEqual({
			ok: true,
			detail: '3 embeds drawn on screen',
		});
		expect(drawnSelfTest(running, () => 0, 'embeds')).toEqual({
			ok: false,
			detail: 'no embeds are drawn on screen',
			nothingDrawn: true,
		});
		expect(
			drawnSelfTest(
				running,
				() => 3,
				'embeds',
				() => true,
			),
		).toEqual({ ok: true, detail: '3 embeds drawn on screen', settling: true });
		expect(drawnSelfTest(running, undefined, 'embeds').ok).toBe(false);
	});

	test('keeps a failed start before counting', () => {
		const skipped = { ok: false, detail: 'skipped: modules not found' } as const;

		expect(drawnSelfTest(skipped, () => 3, 'embeds')).toEqual(skipped);
	});
});
