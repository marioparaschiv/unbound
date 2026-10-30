import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { pluginIcon, readPluginManifests } from './plugin-manifests';
import { firstPartyPlugins } from './verify-published';

const manifest: PublishedManifest = {
	id: 'unbound.sample',
	name: 'Sample',
	description: 'A sample plugin.',
	version: '1.0.0',
	main: 'index.js',
	icon: 'StarIcon',
	authors: [{ name: 'adrian', id: '1' }],
};

function workspace(plugins: Record<string, string | undefined>): string {
	const directory = mkdtempSync(join(tmpdir(), 'plugin-manifests-'));

	for (const [folder, contents] of Object.entries(plugins)) {
		mkdirSync(join(directory, folder));

		if (contents !== undefined)
			writeFileSync(join(directory, folder, 'manifest.json'), contents);
	}

	return directory;
}

describe('readPluginManifests', () => {
	test('reads every folder with a manifest and skips the rest', () => {
		const directory = workspace({ sample: JSON.stringify(manifest), shared: undefined });

		expect(readPluginManifests(directory)).toEqual([{ folder: 'sample', manifest }]);
	});

	test('throws with the path for a manifest that is not a valid addon manifest', () => {
		const directory = workspace({ sample: JSON.stringify({ ...manifest, version: 'one' }) });

		expect(() => readPluginManifests(directory)).toThrow(
			join(directory, 'sample', 'manifest.json'),
		);
	});
});

describe('firstPartyPlugins', () => {
	test('lists plugin ids', () => {
		const directory = workspace({ sample: JSON.stringify(manifest) });

		expect(firstPartyPlugins(directory)).toEqual([{ id: 'unbound.sample' }]);
	});

	test('fails loudly instead of dropping a plugin with a broken manifest', () => {
		const directory = workspace({ sample: JSON.stringify(manifest), broken: '{ not json' });

		expect(() => firstPartyPlugins(directory)).toThrow();
	});
});

describe('pluginIcon', () => {
	test('returns a bundled icon name', () => {
		expect(pluginIcon(manifest)).toBe('StarIcon');
	});

	test('rejects a missing or malformed icon', () => {
		expect(() => pluginIcon({ ...manifest, icon: undefined })).toThrow('missing');
		expect(() => pluginIcon({ ...manifest, icon: '../icon' })).toThrow('invalid icon name');
		expect(() => pluginIcon({ ...manifest, icon: { uri: 'https://x.test/a.png' } })).toThrow(
			'icon URI',
		);
	});
});
