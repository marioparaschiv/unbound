import { expect, test } from 'bun:test';

import { isDrawn, redrawTimesScript, selfTestsScript } from '~/device-scripts';
import { runOnFakeDevice } from './helpers/device-fakes';

type Report = { ok: boolean; detail: string; nothingDrawn?: boolean; settling?: boolean };

function fakePlugins(reports: Record<string, () => Report | undefined>) {
	const ids = Object.keys(reports);

	return {
		plugins: {
			entities: new Map(ids.map((id) => [id, { id, started: true }])),
			selfTest: async (id: string) => {
				const report = reports[id]?.();

				if (report?.detail === 'throws') throw new Error('boom');

				return report;
			},
		},
	};
}

test('a plugin has drawn only when it works, drew something and is not settling', () => {
	expect(isDrawn({ ok: true, detail: '' })).toBe(true);
	expect(isDrawn({ ok: true, detail: '', settling: true })).toBe(false);
	expect(isDrawn({ ok: false, detail: '', nothingDrawn: true })).toBe(false);
	expect(isDrawn(undefined)).toBe(false);
});

test('the self-tests script reads each plugin through plugins.selfTest', async () => {
	const fake = fakePlugins({
		'unbound.alpha': () => ({ ok: true, detail: '2 drawn', settling: true }),
		'unbound.beta': () => ({ ok: false, detail: 'throws' }),
		'unbound.gamma': () => undefined,
	});

	expect(JSON.parse(String(await runOnFakeDevice(selfTestsScript(), fake)))).toEqual({
		'unbound.alpha': { ok: true, detail: '2 drawn', settling: true },
		'unbound.beta': { ok: false, detail: 'boom' },
	});
});

test('the redraw script times plugins until each has drawn, skipping those without a self-test', async () => {
	let polls = 0;
	const fake = fakePlugins({
		'unbound.alpha': () => ({ ok: true, detail: '', settling: ++polls < 3 }),
		'unbound.gamma': () => undefined,
	});
	const times = JSON.parse(String(await runOnFakeDevice(redrawTimesScript(60_000), fake)));

	expect(Object.keys(times)).toEqual(['unbound.alpha']);
	expect(polls).toBe(3);
});
