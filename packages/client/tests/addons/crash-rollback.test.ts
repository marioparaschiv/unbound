import type { AddonVersion } from '@unbound-app/contracts/addons';
import { describe, expect, test } from 'bun:test';

import { rollbackVersion } from '~/addons/crash-rollback';

function version(number: string, min?: string): AddonVersion {
	const listed: AddonVersion = {
		version: number,
		manifest: {
			id: 'unbound.example',
			name: 'Example',
			description: 'test',
			authors: [{ name: 'adrian', id: '1' }],
			main: 'index.js',
			version: number,
			type: 'plugin',
			...(min ? { unbound: { min } } : {}),
		},
		changelog: null,
		changes: null,
		source: null,
		bundleSize: 1,
		sha256: 'digest',
		publishedAt: '2026-11-19T00:00:00.000Z',
		manifestUrl: 'https://cdn.example/manifest.json',
		bundleUrl: 'https://cdn.example/index.js',
	};

	return listed;
}

describe('rollbackVersion', () => {
	const versions = [
		version('1.3.0'),
		version('1.2.0', '9.0.0'),
		version('1.1.0'),
		version('1.0.0'),
	];

	test('goes back to the newest older version this client runs', () => {
		expect(rollbackVersion(versions, '1.3.0', '3.10.0')?.version).toBe('1.1.0');
	});

	test('has nothing to roll back to from the oldest version', () => {
		expect(rollbackVersion(versions, '1.0.0', '3.10.0')).toBeUndefined();
	});
});
