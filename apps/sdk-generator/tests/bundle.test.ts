import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveLibraryTypes } from '../src/bundle';

// Manifests are read from disk, so the expected typings path comes from the package, not the resolver.
const REPO = join(import.meta.dirname, '..', '..', '..');

type Manifest = {
	types?: string;
	exports?: Record<'.', string | { types?: string }>;
};

function readManifest(path: string): Manifest {
	return JSON.parse(readFileSync(join(REPO, path), 'utf8')) as Manifest;
}

describe('resolveLibraryTypes', () => {
	test('resolves a types-field package (react-native-gesture-handler)', () => {
		const { types } = readManifest(
			'packages/client/node_modules/react-native-gesture-handler/package.json',
		);

		expect(resolveLibraryTypes('react-native-gesture-handler')).toEndWith(
			join('react-native-gesture-handler', String(types)),
		);
	});

	test('resolves a string root export (@unbound-app/logger)', () => {
		const root = readManifest('packages/logger/package.json').exports?.['.'];

		expect(resolveLibraryTypes('@unbound-app/logger')).toEndWith(
			join('logger', String(typeof root === 'object' ? root.types : root)),
		);
	});

	test('resolves an exports types condition (possess)', () => {
		const root = readManifest('packages/client/node_modules/possess/package.json').exports?.[
			'.'
		];
		const typings = typeof root === 'object' ? root.types : root;

		expect(resolveLibraryTypes('possess')).toEndWith(join('possess', String(typings)));
	});

	test('returns undefined for a package without a typings entry (@unbound-app/utils)', () => {
		expect(resolveLibraryTypes('@unbound-app/utils')).toBeUndefined();
	});

	test('returns undefined for a package that is not installed', () => {
		expect(resolveLibraryTypes('definitely-not-installed-here')).toBeUndefined();
	});
});
