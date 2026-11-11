import type { Plugin } from '@unbound-app/types';
import { expect, test } from 'bun:test';

import { readSelfTest } from '~/plugins/self-test';

function running(selfTest?: Plugin['selfTest'], startIssues: string[] = []) {
	const instance: Plugin = selfTest ? { selfTest } : {};

	return { started: true, instance, startIssues };
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

test('fails with the first warning or error logged while starting, before the plugin report', async () => {
	const issues = [
		'Member list skipped: Discord moved UserRow.',
		'Failed to patch profiles: boom',
	];

	expect(await readSelfTest(running(undefined, issues))).toEqual({
		ok: false,
		detail: 'Member list skipped: Discord moved UserRow.',
	});
	expect(
		await readSelfTest(running(() => ({ ok: true, detail: '3 tags drawn' }), issues)),
	).toEqual({ ok: false, detail: 'Member list skipped: Discord moved UserRow.' });
});

test('passes a running plugin that logged no warnings and has no self-test', async () => {
	expect(await readSelfTest(running())).toEqual({ ok: true, detail: 'started without warnings' });
});

test('reports nothing for a stopped or missing plugin', async () => {
	const stopped = running(() => ({ ok: true, detail: 'drawn' }));

	expect(await readSelfTest({ ...stopped, started: false })).toBeUndefined();
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
