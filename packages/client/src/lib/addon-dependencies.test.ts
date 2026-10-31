import { describe, expect, test } from 'bun:test';

import type { DependentAddon, ListedDependency } from './addon-dependencies';

import {
	brokenDependents,
	dependentsOf,
	isLibrary,
	planDependencies,
	satisfies,
} from './addon-dependencies';

function addon(
	id: string,
	dependencies?: Record<string, string>,
	library?: boolean,
): DependentAddon {
	return { id, data: { name: id, version: '1.0.0', dependencies, library } };
}

function listed(
	id: string,
	version: string,
	dependencies?: Record<string, string>,
): ListedDependency {
	return { id, name: id, version, dependencies };
}

describe('satisfies', () => {
	test('handles the range forms manifests use', () => {
		const cases: [string, string, boolean][] = [
			['1.4.2', '^1.2.0', true],
			['2.0.0', '^1.2.0', false],
			['0.2.5', '^0.2.1', true],
			['0.3.0', '^0.2.1', false],
			['0.0.3', '^0.0.3', true],
			['0.0.4', '^0.0.3', false],
			['1.2.9', '~1.2.3', true],
			['1.3.0', '~1.2.3', false],
			['1.5.0', '>=1.2.0 <2.0.0', true],
			['2.0.0', '>=1.2.0 <2.0.0', false],
			['3.1.0', '^1.0.0 || ^3.0.0', true],
			['1.0.0', '1.0.0', true],
			['1.0.1', '=1.0.0', false],
			['9.9.9', '*', true],
			['1.0.0-beta.1', '^1.0.0', true],
			['next', '*', false],
			['1.0.0', 'latest', false],
		];

		for (const [version, range, expected] of cases) {
			expect([version, range, satisfies(version, range)]).toEqual([version, range, expected]);
		}
	});
});

describe('libraries and dependents', () => {
	const installed = [
		addon('lib.core', undefined, true),
		addon('lib.ui', { 'lib.core': '^1.0.0' }),
		addon('plugin.a', { 'lib.ui': '^1.0.0' }),
		addon('plugin.b', { 'lib.core': '^1.0.0' }),
		addon('plugin.c'),
	];

	test('a library says so or is needed by another addon', () => {
		expect(
			installed.filter((entry) => isLibrary(entry, installed)).map((entry) => entry.id),
		).toEqual(['lib.core', 'lib.ui']);
	});

	test('lists dependents transitively, each before what it needs', () => {
		expect(dependentsOf('lib.core', installed).map((entry) => entry.id)).toEqual([
			'plugin.a',
			'lib.ui',
			'plugin.b',
		]);
		expect(dependentsOf('plugin.c', installed)).toEqual([]);
	});
});

describe('brokenDependents', () => {
	const installed = [
		addon('dev.lib'),
		addon('dev.caret', { 'dev.lib': '^2.0.0' }),
		addon('dev.range', { 'dev.lib': '>=1.0.0 <3.0.0' }),
		addon('dev.other', { 'dev.else': '^1.0.0' }),
		addon('dev.free'),
	];

	test('lists the dependents whose range the chosen version falls outside of', () => {
		expect(brokenDependents('dev.lib', '1.4.0', installed).map(({ id }) => id)).toEqual([
			'dev.caret',
		]);
		expect(brokenDependents('dev.lib', '3.0.0', installed).map(({ id }) => id)).toEqual([
			'dev.caret',
			'dev.range',
		]);
	});

	test('lists nothing when every declared range still fits', () => {
		expect(brokenDependents('dev.lib', '2.1.0', installed)).toEqual([]);
		expect(brokenDependents('dev.free', '0.1.0', installed)).toEqual([]);
	});
});

describe('planDependencies', () => {
	const store = new Map([
		['lib.core', listed('lib.core', '1.3.0')],
		['lib.ui', listed('lib.ui', '1.1.0', { 'lib.core': '^1.2.0' })],
		['lib.old', listed('lib.old', '1.0.0')],
	]);

	test('installs missing dependencies after their own, and updates outdated ones', () => {
		const plan = planDependencies(
			{ 'lib.ui': '^1.0.0' },
			new Map([['lib.core', '1.0.0']]),
			store,
		);

		expect(plan.update.map((entry) => entry.id)).toEqual(['lib.core']);
		expect(plan.install.map((entry) => entry.id)).toEqual(['lib.ui']);
		expect(plan.unavailable).toEqual([]);
		expect(plan.ordered.map((entry) => entry.id)).toEqual(['lib.core', 'lib.ui']);
	});

	test('skips satisfied dependencies and reports what the store cannot satisfy', () => {
		const plan = planDependencies(
			{ 'lib.core': '^1.0.0', 'lib.old': '^2.0.0', 'lib.gone': '*' },
			new Map([['lib.core', '1.1.0']]),
			store,
		);

		expect(plan).toEqual({
			install: [],
			update: [],
			unavailable: ['lib.old ^2.0.0', 'lib.gone *'],
			ordered: [],
		});
	});
});
