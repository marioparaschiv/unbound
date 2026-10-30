import { describe, expect, test } from 'bun:test';

import { parseDigest, sameEnvironment, type Environment } from './environment';

const environment: Environment = {
	loader: '1.0.0',
	origin: 'Unbound.dylib',
	client: 'abc:10',
	discord: '351.0+118370',
	loaderFile: 'f'.repeat(64),
};

describe('environment', () => {
	test('reads the digest sha256sum prints', () => {
		expect(parseDigest(`${'a'.repeat(64)}  /path/to/file`)).toBe('a'.repeat(64));
		expect(parseDigest('{"output":"sha256sum: /missing: No such file"}')).toBe('');
	});

	test('keeps results only on the same loader, client and Discord', () => {
		expect(sameEnvironment(environment, environment)).toBe(true);
		expect(sameEnvironment(undefined, environment)).toBe(false);
		expect(sameEnvironment(environment, { ...environment, client: 'def:10' })).toBe(false);
		expect(sameEnvironment(environment, { ...environment, loaderFile: 'e'.repeat(64) })).toBe(
			false,
		);
		expect(sameEnvironment(environment, { ...environment, discord: '352.0+1' })).toBe(false);
		expect(
			sameEnvironment({ ...environment, loaderFile: '' }, { ...environment, loaderFile: '' }),
		).toBe(false);
	});
});
