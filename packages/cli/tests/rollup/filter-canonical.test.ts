import { beforeAll, describe, expect, test } from 'bun:test';

import type {
	BuiltFilter,
	ClientFilters,
	FixtureModule,
	FixtureValue,
} from './helpers/filter-plugin';

import {
	buildPlugin,
	clientFilters,
	compilePredicate,
	customKeys,
	runFilters,
} from './helpers/filter-plugin';

const CACHE_KEY = Symbol.for('metro.cache');

let client: ClientFilters;

beforeAll(async () => {
	client = await clientFilters();
});

function plugin(...predicates: string[]) {
	return `import { metro } from '@unbound-app/api';\nexport const start = () => [${predicates.map((predicate) => `metro.find(${predicate})`).join(', ')}];`;
}

// The key the built filter carries on the device: a built-in's for a rewrite, `custom::` for a predicate kept as written.
async function rewrite(predicate: string) {
	const { code, warnings } = await buildPlugin({ 'index.ts': plugin(predicate) });
	const [filter] = runFilters(code, client);

	return { key: filter?.[CACHE_KEY], warnings, keys: customKeys(code) };
}

describe('built-in rewrites', () => {
	test.each([
		["(m) => m.type?.name === 'Row'", 'byTypeName::Row'],
		["(m) => m.type.name === 'Row'", 'byTypeName::Row'],
		["(m) => m.name === 'Row'", 'byName::Row'],
		["(m) => m.displayName === 'Row'", 'byDisplayName::Row'],
		['(m) => m.a !== undefined && m.b !== void 0', 'byProps::a::b'],
		['(m) => m.prototype?.render !== undefined', 'byPrototypes::render'],
		["(m) => m._dispatcher && m.getName?.() === 'UserStore'", 'byStore::UserStore'],
		["(m) => m.name === 'Row' && m.a !== undefined", 'all("byName::Row","byProps::a")'],
		[
			"(m) => m.name === 'Row' || m.displayName === 'Row'",
			'any("byDisplayName::Row","byName::Row")',
		],
	])('rewrites %s', async (predicate, expected) => {
		const { key, keys } = await rewrite(predicate);

		expect(key).toBe(expected);
		expect(keys).toEqual([]);
	});

	test('normalises operand order, quotes and the parameter name', async () => {
		expect((await rewrite('(module) => "Row" === module.name')).key).toBe('byName::Row');
		expect((await rewrite('(x) => void 0 !== x.a')).key).toBe('byProps::a');
	});

	test('keeps the part no built-in covers as a keyed residual', async () => {
		const { key, keys } = await rewrite("(m) => m.type?.name === 'Row' && m.size > 2");

		expect(keys).toHaveLength(1);
		expect(key).toBe(`all("byTypeName::Row","${keys[0]}")`);
	});

	test('keeps a truthiness test, with a hint naming byProps', async () => {
		const { key, warnings, keys } = await rewrite('(m) => m.a && m.b');

		expect(key).toBe(keys[0]);
		expect(warnings).toEqual([expect.stringContaining("use metro.filters.byProps('a', 'b')")]);
	});

	test.each([
		['a side effect', "(m) => m.count++ > 0 && m.name === 'Row'"],
		['another call', "(m) => m.name === 'Row' && Object.keys(m).length === 2"],
		['a loose comparison', "(m) => m.name == 'Row'"],
		['a null check', '(m) => m.a != null'],
		['a primitive prototype method', '(m) => m.prototype?.toFixed !== undefined'],
	])('leaves a predicate with %s as written', async (_, predicate) => {
		const { key, keys } = await rewrite(predicate);

		expect(keys).toHaveLength(1);
		expect(key).toBe(keys[0]);
	});

	test('logs each rewrite under verbose', async () => {
		process.env.UNBOUND_VERBOSE = '1';

		try {
			const { infos } = await buildPlugin({
				'index.ts': plugin("(m) => m.type?.name === 'Row'"),
			});

			expect(infos).toEqual([
				expect.stringMatching(
					/index\.ts:2 {2}m\.type\?\.name === 'Row' → byTypeName\('Row'\)$/,
				),
			]);
		} finally {
			delete process.env.UNBOUND_VERBOSE;
		}
	});
});

// Shapes whose built-in twin differs on Discord's odd exports: falsy props, primitive prototypes, throwing getters.
const registry: FixtureModule[] = [
	{},
	{ name: 'Row' },
	{ name: 'Cell' },
	{ displayName: 'Row' },
	{ type: { name: 'Row' } },
	{ type: null },
	{ type: 'Row' },
	{ type: {} },
	{ a: 0, b: '' },
	{ a: false, b: null },
	{ a: void 0, b: 1 },
	{ a: 1, b: 1, size: 3, type: { name: 'Row', props: { size: 2 } } },
	{ a: 1 },
	{ prototype: { render: 1 } },
	{ prototype: 0 },
	{ prototype: '' },
	{ prototype: null },
	class Row {
		render() {}
	},
	{ _dispatcher: {}, getName: () => 'UserStore' },
	{ _dispatcher: {}, getName: 'UserStore' },
	{ _dispatcher: null, getName: () => 'UserStore' },
	{ getName: () => 'UserStore' },
	{ default: { name: 'Row' } },
	{ default: { type: { name: 'Row' } }, a: 1 },
	{ default: { _dispatcher: 1, getName: () => 'UserStore' } },
];

function isModule(value: FixtureValue): value is FixtureModule {
	return typeof value === 'object' && value !== null;
}

// A filter that throws on a module misses it, as in `find`.
function passes(filter: BuiltFilter, mdl: FixtureModule) {
	try {
		return Boolean(filter(mdl));
	} catch {
		return false;
	}
}

// Mirrors `find`: the `default` export is tried when the module itself misses.
function matches(filter: BuiltFilter, mdl: FixtureModule) {
	const fallback = typeof mdl === 'object' ? mdl.default : void 0;

	return passes(filter, mdl) || (isModule(fallback) && passes(filter, fallback));
}

test('a rewritten filter matches exactly the modules its predicate does', async () => {
	const predicates = [
		"(m) => m.type?.name === 'Row'",
		"(m) => m.type.name === 'Row'",
		"(m) => m.name === 'Row'",
		"(m) => 'Row' === m.displayName",
		'(m) => m.a !== undefined && m.b !== void 0',
		'(m) => m.prototype?.render !== undefined',
		"(m) => m._dispatcher && m.getName?.() === 'UserStore'",
		"(m) => m.getName() === 'UserStore' && m._dispatcher",
		"(m) => m.name === 'Row' || m.displayName === 'Row'",
		"(m) => m.a !== undefined && m.type?.name === 'Row' && m.type.props?.size === 2",
	];
	const { code } = await buildPlugin({ 'index.ts': plugin(...predicates) });
	const rewritten = runFilters(code, client);

	for (const [index, source] of predicates.entries()) {
		const original = compilePredicate(source);
		const filter = rewritten[index];

		if (!filter) {
			throw new Error(`The bundle returned no filter for ${source}.`);
		}

		expect(filter[CACHE_KEY], source).toMatch(/^(by|all|any)/);
		expect(
			registry.map((mdl) => matches(filter, mdl)),
			source,
		).toEqual(registry.map((mdl) => matches(original, mdl)));
	}
});
