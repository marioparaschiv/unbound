import { describe, expect, mock, test } from 'bun:test';

const actualConstants = await import('~/core/constants');

mock.module('~/core/constants', () => ({ ...actualConstants, BUILD_CHANNEL: 'beta' }));

const { isImportantSince, isStagedUpdateImportant, recordRunningBundle } =
	await import('~/updates/important-update');

const RUNNING_SINCE = Date.parse('2026-11-22T12:00:00Z');

function serve(body: string, status = 200): typeof fetch {
	return Object.assign(async () => new Response(body, { status }), { preconnect() {} });
}

describe('isImportantSince', () => {
	test('prompts only for an important build made after the running bundle started', () => {
		expect(isImportantSince({ importantAt: '2026-11-22T13:00:00Z' }, RUNNING_SINCE)).toBe(true);
		expect(isImportantSince({ importantAt: '2026-11-22T11:00:00Z' }, RUNNING_SINCE)).toBe(
			false,
		);
		expect(isImportantSince({}, RUNNING_SINCE)).toBe(false);
		expect(isImportantSince({ importantAt: 'soon' }, RUNNING_SINCE)).toBe(false);
	});
});

describe('isStagedUpdateImportant', () => {
	test('reads the published manifest against when this bundle started running', async () => {
		recordRunningBundle();

		const later = new Date(Date.now() + 60_000).toISOString();
		const earlier = new Date(Date.now() - 60_000).toISOString();

		expect(await isStagedUpdateImportant(serve(JSON.stringify({ importantAt: later })))).toBe(
			true,
		);
		expect(await isStagedUpdateImportant(serve(JSON.stringify({ importantAt: earlier })))).toBe(
			false,
		);
	});

	test('stays quiet when the manifest cannot be read', async () => {
		expect(await isStagedUpdateImportant(serve('', 503))).toBe(false);
		expect(await isStagedUpdateImportant(serve('{not json'))).toBe(false);
	});
});
