import { describe, expect, test, beforeEach } from 'bun:test';

import type { ModuleExports, ModuleFactory } from '../helpers/metro-fixture';

import { installMetroGlobals } from '../helpers/metro-fixture';

function widget() {}

function Collection() {}
Collection.prototype.push = () => {};
Collection.prototype.pop = () => {};

const userStore = {
	_dispatcher: {},
	getName: () => 'UserStore',
};

const draftStore = {
	_dispatcher: {},
	getName: () => 'Draft',
};

// The fixture's default factory copies exports onto a fresh object; assigning by reference keeps the
// store identities these tests match on.
const byReference =
	(exports: ModuleExports): ModuleFactory =>
	(_g, _r, _d, _a, moduleObject) => {
		moduleObject.exports = exports;
	};

installMetroGlobals({
	modules: {
		1: { exports: { alpha: 1, shared: 'one' } },
		2: { exports: { beta: 2 } },
		3: { exports: { default: widget }, esModule: true },
		4: { factory: byReference(Collection) },
		5: { factory: byReference(userStore) },
		6: { factory: byReference(draftStore) },
		7: { exports: { tracked: true } },
	},
});

const Metro = await import('~/api/metro');
const { data, blacklist } = await import('~/api/metro/state');
const Cache = (await import('~/lib/cache')).default;

window.modules.get(7)!.__filePath = ['app', 'tracked.js'];

beforeEach(() => {
	Cache.state.modules = {};
	data.cache.clear();
	blacklist.clear();
});

describe('bulk dispatch through findByProps', () => {
	test('params bags produce results positionally aligned with the items', () => {
		const [first, second] = Metro.findByProps(
			{ params: ['alpha'] },
			{ params: ['beta'] },
			{ bulk: true },
		);

		expect(first).toEqual({ alpha: 1, shared: 'one' });
		expect(second).toEqual({ beta: 2 });
	});

	test('a multi-prop params bag requires every listed prop', () => {
		const [both, impossible] = Metro.findByProps(
			{ params: ['alpha', 'shared'] },
			{ params: ['alpha', 'beta'] },
			{ bulk: true },
		);

		expect(both).toEqual({ alpha: 1, shared: 'one' });
		expect(impossible).toBeUndefined();
	});

	test('FINDING: the array-payload bulk branch works but no public signature admits it', () => {
		// searchWithOptions spreads a non-`params` payload straight into the filter, which requires an
		// array element. `MetroBulkFind` only permits `{ params }` bags, so the branch is reachable
		// only by defeating the types. It should either be typed or removed.
		// @ts-expect-error a nested array is not assignable to any findByName overload
		const [fn] = Metro.findByName(['widget'], { bulk: true });

		expect(fn).toBe(widget);
	});

	test('a params bag with interop: false keeps the esModule wrapper', () => {
		const [wrapped] = Metro.findByName({ params: ['widget'], interop: false }, { bulk: true });

		expect(wrapped.default).toBe(widget);
	});

	test('interop is honoured per item within a single bulk search', () => {
		const [unwrapped, wrapped] = Metro.findByName(
			{ params: ['widget'] },
			{ params: ['widget'], interop: false },
			{ bulk: true },
		);

		expect(unwrapped).toBe(widget);
		expect(wrapped.default).toBe(widget);
	});

	test('FINDING: a bulk bag without params throws instead of degrading to a zero-arg filter', () => {
		// The non-params branch spreads the payload into the filter, which only works for an array.
		// A bag carrying options but no `params` should either search for nothing or be rejected by
		// name, not raise a spread TypeError from inside the dispatcher.
		// @ts-expect-error a bag without `params` is not assignable to MetroBulkFind
		expect(() => Metro.findByProps({ interop: true }, { bulk: true })).toThrow(TypeError);
	});
});

describe('wrapper to filter mapping', () => {
	test('findByProps matches a module exposing every requested prop', () => {
		expect(Metro.findByProps('alpha', 'shared')).toEqual({ alpha: 1, shared: 'one' });
		expect(Metro.findByProps('alpha', 'beta')).toBeNull();
	});

	test('findByName matches the name of the default export', () => {
		expect(Metro.findByName('widget')).toBe(widget);
		expect(Metro.findByName('absent')).toBeNull();
	});

	test('findByPrototypes matches methods present on the prototype', () => {
		expect(Metro.findByPrototypes('push', 'pop')).toBe(Collection);
		expect(Metro.findByPrototypes('push', 'shift')).toBeNull();
	});

	test('FINDING: findByFilePath accepts path segments as terms but only ever matches an array', () => {
		// findByFilePath is typed `...args: U[]` over string terms, yet forwards them as
		// `byFilePath(...args)` and byFilePath takes one `string[]`. Passing segments the signature
		// invites compares `__filePath` against the string `'app'` and always misses. It should be
		// typed `(path: string[], options?)` so the working shape is the only spelling.
		const path = window.modules.get(7)!.__filePath!;

		expect(Metro.findByFilePath(...path)).toBeNull();
	});

	test('findByFilePath matches only when the whole path array is a single term', () => {
		const path = window.modules.get(7)!.__filePath!;

		expect(Metro.findByFilePath(path)).toEqual({ tracked: true });
	});

	test('findByFilePath compares by identity, so an equal-but-distinct array misses', () => {
		const equalPath: string[] = ['app', 'tracked.js'];

		// @ts-expect-error the only argument shape that works is the one the signature rejects
		expect(Metro.findByFilePath(equalPath)).toBeNull();
	});
});

describe('findStore', () => {
	test('short defaults to true, appending Store to the given name', () => {
		expect(Metro.findStore('User')).toBe(userStore);
	});

	test('the default suffix means an already-suffixed name misses', () => {
		expect(Metro.findStore('UserStore')).toBeNull();
	});

	test('short: false matches an un-suffixed store name verbatim', () => {
		expect(Metro.findStore('Draft', { short: false })).toBe(draftStore);
	});

	test('FINDING: findStore silently drops every name after the first', () => {
		// It destructures `[[name]]` off the parsed terms, so extra names are neither matched nor
		// rejected. It should either search each name or refuse more than one.
		expect(Metro.findStore('Draft', 'User')).toBeNull();
		expect(Metro.findStore('User', 'Draft')).toBe(userStore);
	});
});
