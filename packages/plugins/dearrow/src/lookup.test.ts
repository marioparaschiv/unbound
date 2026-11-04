import { describe, expect, test } from 'bun:test';

import { createLookup } from '~/lookup';
import { thumbnailUrl } from '~/branding';

const ID = 'dQw4w9WgXcQ';

const RESPONSE = {
	titles: [{ title: 'Calm', votes: 1 }],
	thumbnails: [{ timestamp: 3, votes: 1, original: false }],
};

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createLookup', () => {
	test('fetches once, caches, and reports resolved branding', async () => {
		const requested: string[] = [];
		let resolved = 0;
		const lookup = createLookup(
			async (id) => {
				requested.push(id);

				return RESPONSE;
			},
			() => resolved++,
		);

		expect(lookup.get(ID)).toBeUndefined();
		expect(lookup.get(ID)).toBeUndefined();

		await flush();

		expect(lookup.get(ID)).toEqual({ title: 'Calm', thumbnail: thumbnailUrl(ID, 3) });
		expect(requested).toEqual([ID]);
		expect(resolved).toBe(1);
	});

	test('caches a miss without redrawing', async () => {
		let resolved = 0;
		const lookup = createLookup(
			async () => null,
			() => resolved++,
		);

		lookup.get(ID);
		await flush();

		expect(lookup.get(ID)).toBeNull();
		expect(resolved).toBe(0);
	});

	test('treats a failed request as a miss', async () => {
		const lookup = createLookup(
			() => Promise.reject(new Error('offline')),
			() => {},
		);

		lookup.get(ID);
		await flush();

		expect(lookup.get(ID)).toBeNull();
	});

	test('drops results that arrive after dispose', async () => {
		let resolved = 0;
		const lookup = createLookup(
			async () => RESPONSE,
			() => resolved++,
		);

		lookup.get(ID);
		lookup.dispose();
		await flush();

		expect(lookup.get(ID)).toBeUndefined();
		expect(resolved).toBe(0);
	});
});
