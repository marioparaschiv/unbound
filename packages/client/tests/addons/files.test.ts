import { describe, expect, mock, test } from 'bun:test';

const folders = new Set<string>();
const failed: string[] = [];

// Like the native write: it creates a missing parent folder, and fails when another write created it meanwhile.
mock.module('~/native/fs', () => ({
	default: {
		documentsPath: '/docs',
		exists: async () => false,
		removeFile: async () => true,
		writeFile: async (path: string) => {
			const folder = path.slice(0, path.lastIndexOf('/'));
			const missing = !folders.has(folder);

			await Promise.resolve();

			if (missing && folders.has(folder)) {
				failed.push(path);
				throw new Error(`Failed to create parent directory ${folder}`);
			}

			folders.add(folder);
		},
	},
}));

const { writeAddonFiles } = await import('~/addons/files');

describe('writeAddonFiles', () => {
	test('writes many files into a new folder without racing to create it', async () => {
		const scales = { '3': 'a'.repeat(64) };
		const assets = Object.fromEntries(
			Array.from({ length: 20 }, (_, index) => [
				`icons/Icon${index}`,
				{
					type: 'png' as const,
					width: 24,
					height: 24,
					scales: { '3': `${index}`.padStart(64, '0') },
				},
			]),
		);
		const manifest = {
			id: 'unbound.pack',
			name: 'Pack',
			description: '',
			authors: [],
			version: '1.0.0',
			main: 'icons.json',
			assets: {
				...assets,
				'icons/Same': { type: 'png' as const, width: 24, height: 24, scales },
			},
		};
		const files = Object.fromEntries(
			Object.values(manifest.assets).map(({ scales: { '3': sha } }) => [
				`assets/${sha}.png`,
				'AA==',
			]),
		);

		await writeAddonFiles('Unbound/Icons/unbound.pack', manifest, files);

		expect(failed).toEqual([]);
		expect(folders.has('Unbound/Icons/unbound.pack/assets')).toBe(true);
	});
});
