import { describe, expect, mock, test } from 'bun:test';

mock.module('@unbound-app/api', () => ({ fs: {} }));

const { createTokenStore } = await import('./token-store');

function memoryFiles(initial: Record<string, string> = {}) {
	const files = new Map(Object.entries(initial));

	return {
		files,
		exists: async (path: string) => files.has(path),
		read: async (path: string) => files.get(path) ?? '',
		write: async (path: string, contents: string) => {
			files.set(path, contents);
		},
	};
}

const line = [[{ content: 'const', offset: 0, color: '#569CD6', fontStyle: 0 }]];

describe('createTokenStore', () => {
	test('saves results and loads them in a new store, as after a restart', async () => {
		const io = memoryFiles();
		const first = createTokenStore(io, 'tokens.json');

		await first.ready;
		first.set('dark\u0000ts\u0000const', line);
		await first.flush();

		const second = createTokenStore(io, 'tokens.json');

		await second.ready;
		expect(second.get('dark\u0000ts\u0000const')).toEqual(line);
	});

	test('starts empty when the saved file is not valid', async () => {
		const store = createTokenStore(memoryFiles({ 'tokens.json': '{broken' }), 'tokens.json');

		await store.ready;
		expect(store.get('anything')).toBeUndefined();
	});

	test('keeps only the most recent results and skips very long code', async () => {
		const io = memoryFiles();
		const store = createTokenStore(io, 'tokens.json');

		await store.ready;

		for (let index = 0; index < 60; index++) store.set(`key-${index}`, line);
		store.set('x'.repeat(5_000), line);
		await store.flush();

		const saved = JSON.parse(io.files.get('tokens.json')!) as [string, unknown][];

		expect(saved).toHaveLength(48);
		expect(saved[0]![0]).toBe('key-12');
		expect(saved.some(([key]) => key.length > 4_000)).toBe(false);
	});
});
