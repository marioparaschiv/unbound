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
	test('the committed SDK types everything window.unbound exposes', () => {
		expect(checkSurface()).toEqual({
			live: { missing: [], extra: [] },
			shutdown: { missing: [], extra: [] },
		});
	});

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
				'widgets.spare',
				'widgets.spare.doubled',
				'widgets.spare.increment',
				'widgets.spare.value',
			],
			shutdown: ['initialize', 'shutdown'],
		});
	});

	test('reports a missing namespace key, missing class members on every path to a type, and an extra key', () => {
		expect(checkSurface(SOURCES)).toEqual({
			live: {
				missing: [
					'widgets.counter.doubled',
					'widgets.render',
					'widgets.spare.doubled',
					'widgets.spare.increment',
				],
				extra: ['widgets.legacy'],
			},
			shutdown: { missing: [], extra: [] },
		});
	});
});
