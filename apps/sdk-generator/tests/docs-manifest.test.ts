import type { DocsVersion } from '@unbound-app/contracts/docs';
import { describe, expect, test } from 'bun:test';

import { compareDocsVersions, mergeDocsManifest } from '../src/docs-manifest';

describe('compareDocsVersions', () => {
	test('puts main first, then release tags newest first by semver', () => {
		const versions: DocsVersion[] = [
			'v0.9.0',
			'v0.10.0',
			'main',
			'v1.0.0-beta.1',
			'v1.0.0',
			'v0.10.1',
		];

		expect(versions.sort(compareDocsVersions)).toEqual([
			'main',
			'v1.0.0',
			'v1.0.0-beta.1',
			'v0.10.1',
			'v0.10.0',
			'v0.9.0',
		]);
	});
});

describe('mergeDocsManifest', () => {
	test('starts a manifest when none was published', () => {
		expect(mergeDocsManifest(undefined, 'api', 'main')).toEqual({
			package: 'api',
			versions: ['main'],
		});
	});

	test('adds a release without losing earlier ones', () => {
		const merged = mergeDocsManifest(
			{ package: 'api', versions: ['main', 'v0.12.0'] },
			'api',
			'v0.13.0',
		);

		expect(merged.versions).toEqual(['main', 'v0.13.0', 'v0.12.0']);
	});

	test('adding a listed version changes nothing', () => {
		const manifest = {
			package: 'api' as const,
			versions: ['main', 'v0.12.0'] as DocsVersion[],
		};

		expect(mergeDocsManifest(manifest, 'api', 'v0.12.0')).toEqual(manifest);
	});
});
