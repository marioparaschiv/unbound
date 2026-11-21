import type { AddonManifest } from '@unbound-app/types';
import { describe, expect, mock, test } from 'bun:test';

const written: string[] = [];
const removed: string[] = [];
const moves: [string, string][] = [];
let moveSucceeds = true;

mock.module('~/native/fs', () => ({
	default: {
		writeFile: async (path: string) => void written.push(path),
		removeFile: async (path: string) => {
			removed.push(path);

			return true;
		},
		exists: async () => false,
	},
}));

mock.module('~/native/unbound-native', () => ({ getLoader: () => ({ bytecodeVersion: 98 }) }));

const { writeAddon } = await import('~/addons/write-addon');
const { stagingDirectoryOf } = await import('~/addons/staging');

const manifest: AddonManifest = {
	id: 'a.plugin',
	name: 'A',
	description: 'test',
	authors: [{ name: 'Mario', id: '1' }],
	main: 'index.js',
	version: '1.0.0',
};

function reset(replace?: (from: string, to: string) => boolean) {
	written.length = 0;
	removed.length = 0;
	moves.length = 0;
	Object.assign(globalThis, { NativePlatform: replace ? { files: { replace } } : undefined });
}

describe('writeAddon', () => {
	test('writes into a staging folder and moves it into place', async () => {
		reset((from, to) => {
			moves.push([from, to]);

			return moveSucceeds;
		});

		await writeAddon({
			target: 'Unbound/Plugins/a.plugin',
			bundle: 'x',
			manifest,
			bytecode: 'eA==',
		});

		expect(removed).toEqual(['Unbound/Staging/Plugins/a.plugin']);
		expect(written).toEqual([
			'Unbound/Staging/Plugins/a.plugin/manifest.json',
			'Unbound/Staging/Plugins/a.plugin/index.js',
			'Unbound/Staging/Plugins/a.plugin/index.98.hbc',
		]);
		expect(moves).toEqual([['Staging/Plugins/a.plugin', 'Plugins/a.plugin']]);
	});

	test('fails the install when the move fails', async () => {
		moveSucceeds = false;
		reset(() => moveSucceeds);

		const failure = await writeAddon({
			target: 'Unbound/Plugins/a.plugin',
			bundle: 'x',
			manifest,
		}).then(
			() => undefined,
			(error: Error) => error,
		);

		expect(failure?.message).toContain('Failed to move a.plugin');
		moveSucceeds = true;
	});

	test('writes in place on a loader that cannot move folders', async () => {
		reset();

		await writeAddon({ target: 'Unbound/Plugins/a.plugin', bundle: 'x', manifest });

		expect(written).toEqual([
			'Unbound/Plugins/a.plugin/manifest.json',
			'Unbound/Plugins/a.plugin/index.js',
		]);
		expect(stagingDirectoryOf('Unbound/Themes/b')).toBe('Unbound/Staging/Themes/b');
	});
});
