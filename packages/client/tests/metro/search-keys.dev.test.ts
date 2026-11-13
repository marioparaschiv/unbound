import { describe, expect, test } from 'bun:test';

import { exportOwners, searchKeys } from '~/metro/search-keys.dev';

const shared = { sharedThing: 1 };
const hostile = new Proxy(
	{},
	{
		ownKeys() {
			throw new Error('no keys');
		},
		getPrototypeOf() {
			throw new Error('no prototype');
		},
	},
);

function Component() {}

Component.prototype.setState = function setState() {};

function Profile() {}

Profile.prototype = Object.create(Component.prototype);

const exportsOf = new Map<number, MetroExport>([
	[
		1,
		{
			shared,
			hostile,
			get thing() {
				throw new Error('ran');
			},
		},
	],
	[2, shared],
	[3, { Component }],
	[4, { default: Profile }],
]);

Object.assign(globalThis, {
	window: globalThis,
	modules: new Map(
		[...exportsOf].map(([id, exports]) => [
			id,
			{ isInitialized: true, hasError: false, publicModule: { exports } },
		]),
	),
});

const owners = exportOwners([1, 2, 3, 4]);
const paths = (id: number, needle: string) =>
	searchKeys(id, exportsOf.get(id), needle, owners, 50).map((match) => match.path.join(' '));

describe('searchKeys', () => {
	test('leaves another module`s exports to that module', () => {
		expect(paths(1, 'sharedthing')).toEqual([]);
		expect(paths(2, 'sharedthing')).toEqual(['sharedThing']);
	});

	test('matches a getter by key without running it, past a hostile proxy', () => {
		expect(paths(1, 'thing')).toEqual(['thing']);
	});

	test('finds an inherited method under the module exporting its class alone', () => {
		expect(paths(3, 'setstate')).toEqual(['Component prototype setState']);
		expect(paths(4, 'setstate')).toEqual([]);
	});

	test('never walks into the engine`s own prototypes', () => {
		expect(paths(2, 'hasownproperty')).toEqual([]);
	});
});
