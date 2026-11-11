import { afterAll, describe, expect, test } from 'bun:test';

import { bundleEtag, gateReloads, handleHot } from '../hot-reload';
import * as outcome from '../outcome';

const decoder = new TextDecoder();
const abort = new AbortController();

gateReloads(() => false);

const reader = handleHot(
	new Request('http://localhost/__hot', { signal: abort.signal }),
).body!.getReader();

// The `: connected` comment the loader gets on connect.
await reader.read();

afterAll(() => abort.abort());

// The next etag the loader is sent, unquoted as the loader compares it.
async function nextEtag(): Promise<string> {
	const { value } = await reader.read();
	const [, etag = ''] = /"etag":"\\?"?([^"\\]*)/.exec(decoder.decode(value)) ?? [];

	return etag;
}

function patch(file: string) {
	outcome.changed(file);
	outcome.sent();
	outcome.patched(1, 0, 5);
}

const loaded = bundleEtag().replaceAll('"', '');

describe('a change no patch covered', () => {
	test('reloads a patched device even though it holds the bundle on disk', async () => {
		outcome.reconnected();
		patch('general.tsx');

		// Reverted to the boot-time source: the build is the bundle the loader holds, and no patch went out.
		outcome.changed('general.tsx');
		outcome.built();

		expect(await nextEtag()).not.toBe(loaded);

		outcome.reconnected();
	});

	test('reloads again after a reload to the same bundle, once a patch has run', async () => {
		patch('general.tsx');
		outcome.changed('general.tsx');
		outcome.built();

		expect(await nextEtag()).not.toBe(loaded);
	});

	test('settles without a reload when the device has run no patch since it loaded the bundle', async () => {
		outcome.reconnected();
		outcome.changed('general.tsx');
		outcome.built();

		expect(await (await outcome.handleOutcome()).text()).toStartWith('reloaded: general.tsx');
	});
});
