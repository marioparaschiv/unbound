import type { Plugin } from '@unbound-app/types';
import { expect, test } from 'bun:test';

import { readSelfTest } from '~/plugins/self-test';

function running(selfTest: NonNullable<Plugin['selfTest']>) {
	const instance: Plugin = { selfTest };

	return { started: true, instance };
}

test('reads a running plugin report with its drawing flags', async () => {
	expect(
		await readSelfTest(running(() => ({ ok: true, detail: '3 tags drawn', settling: true }))),
	).toEqual({ ok: true, detail: '3 tags drawn', settling: true });
	expect(
		await readSelfTest(
			running(async () => ({ ok: false, detail: 'none drawn', nothingDrawn: true })),
		),
	).toEqual({ ok: false, detail: 'none drawn', nothingDrawn: true });
});

test('reports nothing for a stopped plugin or one without a self-test', async () => {
	const stopped = running(() => ({ ok: true, detail: 'drawn' }));

	expect(await readSelfTest({ ...stopped, started: false })).toBeUndefined();
	expect(await readSelfTest({ started: true, instance: {} })).toBeUndefined();
	expect(await readSelfTest(undefined)).toBeUndefined();
});

test('rejects with what the self-test threw', async () => {
	const failure = await readSelfTest(
		running(() => {
			throw new Error('boom');
		}),
	).then(
		() => undefined,
		(error: Error) => error.message,
	);

	expect(failure).toBe('boom');
});
