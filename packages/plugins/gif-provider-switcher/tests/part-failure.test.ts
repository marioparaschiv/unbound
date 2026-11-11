import { flux, logs, metro, startPlugin } from '@unbound-app/api/testing';
import { afterEach, expect, test } from 'bun:test';

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
});

test('a picker that cannot be patched leaves the requests answered and fails the self test', async () => {
	const REST = {
		getAPIBaseURL: () => '',
		get: async (_request: object) => ({ body: ['from discord'] }),
		post: async () => ({}),
	};

	metro.register(REST);
	metro.register({ default: 'not a component' }, 'modules/gif_picker/native/GIFPickerHeader.tsx');
	flux.seed({ Locale: { locale: 'en-US' }, GIFPickerView: { getQuery: () => '' } });
	globalThis.fetch = (async () => Response.json({ results: ['cat'] })) as unknown as typeof fetch;

	await startPlugin();

	const response = (await REST.get({ url: '/gifs/suggest', query: { q: 'ca' } })) as {
		body: string[];
	};

	expect(response.body).toEqual(['cat']);
	expect(logs.entries.map(({ level, args }) => [level, args[0]])).toContainEqual([
		'error',
		'Failed to patch GIFPickerHeader:',
	]);
});
