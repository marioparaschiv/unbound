import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';

test('a picker that cannot be patched fails the start', async () => {
	metro.register({
		getAPIBaseURL: () => '',
		get: async (_request: object) => ({ body: ['from discord'] }),
		post: async () => ({}),
	});
	metro.register({ default: 'not a component' }, 'modules/gif_picker/native/GIFPickerHeader.tsx');
	flux.seed({ Locale: { locale: 'en-US' }, GIFPickerView: { getQuery: () => '' } });

	await expect(startPlugin()).rejects.toThrow('Failed to patch component');
});
