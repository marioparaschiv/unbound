import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { checkSurface, readRuntimeSurfaces } from '../src/surface';

const FIXTURE = join(import.meta.dirname, 'fixtures', 'surface');
const CLIENT = join(FIXTURE, 'client');
const SOURCES = {
	entry: join(CLIENT, 'index.ts'),
	clientRoot: CLIENT,
	global: join(FIXTURE, 'typed', 'global.d.ts'),
};

describe('checkSurface', () => {
	test('reads value exports and public class members, without types, default or private members', () => {
		const { surfaces } = readRuntimeSurfaces(SOURCES);

		expect(surfaces).toEqual({
			live: [
				'initialize',
				'shutdown',
				'widgets',
				'widgets.counter',
				'widgets.counter.doubled',
				'widgets.counter.increment',
				'widgets.counter.value',
				'widgets.render',
			],
			shutdown: ['initialize', 'shutdown'],
		});
	});

	test('reports a missing namespace key, a missing class member and an extra key', () => {
		expect(checkSurface(SOURCES)).toEqual({
			live: {
				missing: ['widgets.counter.doubled', 'widgets.render'],
				extra: ['widgets.legacy'],
			},
			shutdown: { missing: [], extra: [] },
		});
	});
});
