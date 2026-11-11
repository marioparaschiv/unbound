import { describe, expect, spyOn, test } from 'bun:test';

import { broadcast, bundleEtag, gateReloads, handleHot } from '../hot-reload';

const decoder = new TextDecoder();

async function readEtags(force: boolean): Promise<string[]> {
	const abort = new AbortController();
	const response = handleHot(new Request('http://localhost/__hot', { signal: abort.signal }));
	const reader = response.body!.getReader();

	await reader.read();
	broadcast(force);

	const { value } = await reader.read();

	abort.abort();

	return [...decoder.decode(value).matchAll(/"etag":"((?:\\"|[^"])*)"/g)].map(([, etag]) =>
		JSON.parse(`"${etag}"`),
	);
}

describe('broadcast', () => {
	gateReloads(() => false);

	test('sends the etag of the bundle on disk', async () => {
		expect(await readEtags(false)).toEqual([bundleEtag()]);
	});

	test('sends an etag no bundle has when forced, so a loader holding the bundle reloads', async () => {
		const [etag] = await readEtags(true);
		const unquoted = (value: string) => value.replaceAll('"', '');

		expect(unquoted(etag ?? '')).not.toBe(unquoted(bundleEtag()));
		expect(unquoted(etag ?? '')).toStartWith(unquoted(bundleEtag()));
	});

	test('logs the etag it sent, with the -patched suffix when forced', () => {
		const info = spyOn(console, 'info').mockImplementation(() => {});
		let logged = '';

		try {
			broadcast(true);
			logged = info.mock.calls.flat().join(' ');
		} finally {
			info.mockRestore();
		}

		expect(logged).toContain(`etag "${bundleEtag().replaceAll('"', '')}-patched"`);
	});
});
