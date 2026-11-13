import type { MetroResult, MetroValue } from '@unbound-app/debugger-protocol';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

/** A module record as Metro keeps it, with only the fields the answer reads. */
function record(exports: MetroExport, isInitialized = true): MetroModuleRecord {
	return { isInitialized, hasError: false, publicModule: { exports } };
}

class Base {
	render() {}
}

const dispatcher: { stores: object[] } = { stores: [] };
const store = { dispatcher };

dispatcher.stores.push(store);

let reads = 0;
const lazy = {
	get value() {
		reads++;

		return { loaded: true };
	},
};

const records = new Map<number, MetroModuleRecord>([
	[1, record({ __esModule: true, default: Base })],
	[2, { ...record({ store }), __filePath: 'modules/flux/Store.tsx' }],
	[3, record(lazy)],
	[4, record(Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`k${i}`, i])))],
	[5, record(void 0, false)],
	[6, record(void 0, false)],
	// Its factory throws without the blacklist hearing of it, as the harness's stand-in does.
	[7, record(void 0, false)],
]);

Object.assign(globalThis, { window: globalThis, modules: records });

mock.module('~/metro/search', () => ({
	initializeModule(id: number) {
		if (id === 7) {
			return false;
		}

		Object.assign(records.get(id)!, {
			isInitialized: true,
			publicModule: { exports: { ready: 1 } },
		});

		return true;
	},
}));

const { answerMetro, resetMetro } = await import('~/debugger/metro.dev');

let next = 0;

/** The successful result of one frame type. */
type OkFrame<T extends MetroResult['type']> = { type: T; ok: true };

function ok<T extends MetroResult['type']>(result: MetroResult, type: T) {
	expect(result.type).toBe(type);

	if (!result.ok) {
		throw new Error(result.error);
	}

	return result as Extract<MetroResult, OkFrame<T>>;
}

function children(target: { module: number } | { ref: string }, offset?: number) {
	const result = answerMetro({
		type: 'metro-children-request',
		id: `c${next++}`,
		target,
		offset,
	});

	return ok(result, 'metro-children-result');
}

const child = (values: MetroValue[], key: string) => values.find((value) => value.key === key)!;

beforeEach(() => resetMetro());

describe('answerMetro', () => {
	test('lists modules with their status and counts', () => {
		const result = ok(
			answerMetro({ type: 'metro-modules-request', id: 'm', status: 'unloaded' }),
			'metro-modules-result',
		);

		expect(result.modules.map((module) => module.id)).toEqual([5, 6, 7]);
		expect([result.total, result.loaded, result.count]).toEqual([3, 4, 7]);
	});

	test('names a transpiled class and lists its prototype', () => {
		const exported = children({ module: 1 });
		const base = child(exported.children, 'default');

		expect(base).toMatchObject({ kind: 'class', text: 'class Base' });
		expect(children({ ref: base.ref! }).internal.map((slot) => slot.key)).toContain(
			'[[Prototype]]',
		);
	});

	test('gives a circular value the ref of its ancestor', () => {
		const storeValue = child(children({ module: 2 }).children, 'store');
		const dispatcherValue = child(children({ ref: storeValue.ref! }).children, 'dispatcher');
		const stores = child(children({ ref: dispatcherValue.ref! }).children, 'stores');

		expect(child(children({ ref: stores.ref! }).children, '0').ref).toBe(storeValue.ref);
	});

	test('runs a getter only when read', () => {
		const getter = child(children({ module: 3 }).children, 'value');

		expect(getter.kind).toBe('getter');
		expect(reads).toBe(0);

		const read = ok(
			answerMetro({ type: 'metro-read-request', id: 'r', ref: getter.ref! }),
			'metro-read-result',
		);

		expect(read.value).toMatchObject({ key: 'value', kind: 'object' });
		expect(reads).toBe(1);
	});

	test('pages a large export', () => {
		const page = children({ module: 4 }, 200);

		expect(page.total).toBe(250);
		expect(page.children.map((value) => value.key)).toEqual(
			Array.from({ length: 50 }, (_, i) => `k${i + 200}`),
		);
	});

	test('fails an unloaded module, then loads it', () => {
		expect(
			answerMetro({ type: 'metro-children-request', id: 'u', target: { module: 5 } }),
		).toMatchObject({
			ok: false,
			code: 'unloaded',
		});

		const loaded = ok(
			answerMetro({ type: 'metro-load-request', id: 'l', module: 5 }),
			'metro-load-result',
		);

		expect(loaded.module.status).toBe('loaded');
		expect(loaded.loaded).toBe(5);
	});

	test('searches keys through prototypes, without running getters or repeating a cycle', () => {
		const before = reads;
		const found = (query: string) =>
			ok(
				answerMetro({ type: 'metro-search-request', id: `s${next++}`, query }),
				'metro-search-result',
			);
		const paths = (query: string) =>
			found(query).matches.map((match) => [match.module.id, ...match.path].join(' '));

		expect(paths('RENDER')).toEqual(['1 default prototype render']);
		expect(paths('stores')).toEqual(['2 store dispatcher stores']);
		expect(found('value').matches[0].value.kind).toBe('getter');
		expect(reads).toBe(before);
		expect(found('base').matches[0]).toMatchObject({
			path: ['default'],
			value: { key: 'default', kind: 'class' },
		});
	});

	test('stops a search page at a module end and returns where to continue', () => {
		const page = ok(
			answerMetro({ type: 'metro-search-request', id: 'p', query: 'k2', limit: 5 }),
			'metro-search-result',
		);

		expect(page.matches.map((match) => match.path[0])).toEqual([
			'k2',
			'k20',
			'k21',
			'k22',
			'k23',
		]);
		expect(page.cursor).toBe(4);
		expect([page.searched, page.total]).toEqual([4, 5]);
	});

	test('lists the loaded modules that reported a file path, sorted', () => {
		const result = ok(
			answerMetro({ type: 'metro-files-request', id: 'f' }),
			'metro-files-result',
		);

		expect(result.files).toEqual([{ id: 2, path: 'modules/flux/Store.tsx' }]);
		expect([result.unloaded, result.count]).toEqual([2, 7]);
	});

	test('loads every pending module once, counting the ones that fail', () => {
		const batch = () =>
			ok(
				answerMetro({ type: 'metro-load-all-request', id: `a${next++}` }),
				'metro-load-all-result',
			);

		expect(batch()).toMatchObject({
			attempted: 2,
			failed: 1,
			remaining: 0,
			loaded: 6,
			count: 7,
		});
		expect(batch()).toMatchObject({ attempted: 0, remaining: 0 });
	});

	test('answers stale for a dropped ref and unknown-module for a missing id', () => {
		expect(answerMetro({ type: 'metro-read-request', id: 's', ref: 'gone:1' })).toMatchObject({
			code: 'stale',
		});
		expect(answerMetro({ type: 'metro-load-request', id: 'x', module: 99 })).toMatchObject({
			code: 'unknown-module',
		});
	});
});
