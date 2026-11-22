import { describe, expect, test } from 'bun:test';

import { loadWorkspaces } from '~/workspaces';

import manifest from '../../.release-please-manifest.json';
import config from '../../release-please-config.json';

// Products users install that npm never sees: the client bundle and the devtools binaries.
const SHIPPED_PRODUCTS = ['packages/client', 'apps/devtools'];

describe('release-please config', () => {
	test('versions only npm packages and shipped products, never internal workspaces', () => {
		const { manifests } = loadWorkspaces();

		for (const dir of Object.keys(config.packages)) {
			if (SHIPPED_PRODUCTS.includes(dir)) {
				continue;
			}

			const workspace = manifests.get(dir);

			expect({ dir, workspace: Boolean(workspace), private: workspace?.private }).toEqual({
				dir,
				workspace: true,
				private: undefined,
			});
		}
	});

	// `release-as` pins every later release to the same version, so it goes once that version is out.
	test('pins a release version only until it is released', () => {
		const versions: Record<string, string> = manifest;

		for (const [dir, options] of Object.entries(config.packages)) {
			if (!('release-as' in options)) {
				continue;
			}

			expect({ dir, released: versions[dir] === options['release-as'] }).toEqual({
				dir,
				released: false,
			});
		}
	});

	test('tracks a version for exactly the configured packages', () => {
		expect(Object.keys(manifest).sort()).toEqual(Object.keys(config.packages).sort());
	});
});
