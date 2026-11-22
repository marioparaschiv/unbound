import { describe, expect, mock, spyOn, test } from 'bun:test';

const folders = new Set<string>();
const failed: string[] = [];
const stored = new Map<string, string>();

// Like the native write: it creates a missing parent folder, and fails when another write created it meanwhile.
mock.module('~/native/fs', () => ({
	default: {
		documentsPath: '/docs',
		exists: async (path: string) => stored.has(path),
		readFile: async (path: string) => stored.get(path) ?? '',
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

const { downloadAddonFiles, writeAddonFiles } = await import('~/addons/files');
const { watchDownload } = await import('~/addons/download-progress');
const { default: sha256 } = await import('@unbound-app/utils/sha256');

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

describe('downloadAddonFiles', () => {
	test('reuses installed files whose SHA-256 matches and downloads the rest', async () => {
		const kept = Buffer.from('kept');
		const changed = Buffer.from('changed');
		const manifest = {
			id: 'unbound.pack',
			name: 'Pack',
			description: '',
			authors: [],
			version: '1.0.1',
			main: 'icons.json',
			assets: {
				'icons/Kept': {
					type: 'png' as const,
					width: 1,
					height: 1,
					scales: { '3': sha256(kept) },
				},
				'icons/Changed': {
					type: 'png' as const,
					width: 1,
					height: 1,
					scales: { '3': sha256(changed) },
				},
			},
		};
		const logger = { error: mock(() => undefined) };

		stored.set(
			`Unbound/Icons/unbound.pack/assets/${sha256(kept)}.png`,
			kept.toString('base64'),
		);
		stored.set(
			`Unbound/Icons/unbound.pack/assets/${sha256(changed)}.png`,
			Buffer.from('stale').toString('base64'),
		);
		const requests = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(changed));
		const reports: number[][] = [];
		const unwatch = watchDownload('unbound.pack', (done, total) => reports.push([done, total]));

		const files = await downloadAddonFiles(
			manifest,
			'https://cdn.example/unbound.pack/icons.json',
			logger as never,
			'Unbound/Icons/unbound.pack',
		);

		unwatch();

		expect(reports).toEqual([
			[1, 2],
			[2, 2],
		]);

		expect(requests.mock.calls.map(([url]) => url)).toEqual([
			`https://cdn.example/unbound.pack/assets/${sha256(changed)}.png`,
		]);
		expect(files[`assets/${sha256(kept)}.png`]).toBe(kept.toString('base64'));
		expect(files[`assets/${sha256(changed)}.png`]).toBe(changed.toString('base64'));
	});
});
