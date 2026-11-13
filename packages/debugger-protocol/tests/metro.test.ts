import { describe, expect, test } from 'bun:test';

import {
	METRO_RESULT_TYPES,
	failMetroRequest,
	isMetroRequest,
	isMetroResult,
	parseMessage,
} from '~/index';

import contract from './fixtures/devtools-contract.json';

const {
	metroModulesRequest,
	metroModulesOk,
	metroChildrenRequest,
	metroChildrenOk,
	metroReadOk,
	metroLoadAllOk,
	metroSearchRequest,
	metroSearchOk,
	metroFilesOk,
} = contract.frames;

// UNKNOWN: the frames under test are deliberately malformed or loosely typed fixture JSON.
const parse = (frame: unknown): unknown => parseMessage(JSON.stringify(frame));
// UNKNOWN: as `parse`, the frame is deliberately malformed.
const rejects = (frame: unknown) => expect(parse(frame)).toBeUndefined();

describe('metro requests', () => {
	test('a target names exactly one of a module id or a ref', () => {
		for (const target of [{ module: 0 }, { ref: 'a:1' }]) {
			const frame = { ...metroChildrenRequest, target };

			expect(parse(frame)).toEqual(frame);
		}

		for (const target of [{}, { module: 1, ref: 'a:1' }, { module: -1 }, { ref: 2 }]) {
			rejects({ ...metroChildrenRequest, target });
		}
	});

	test('a modules request takes only known statuses and counts', () => {
		expect(parse({ type: 'metro-modules-request', id: 'm' })).toEqual({
			type: 'metro-modules-request',
			id: 'm',
		});

		for (const bad of [{ status: 'pending' }, { offset: -1 }, { limit: 1.5 }, { filter: 3 }]) {
			rejects({ ...metroModulesRequest, ...bad });
		}

		rejects({ type: 'metro-load-request', id: 'l', module: '12' });
	});

	test('a search needs a query and takes a cursor', () => {
		expect(parse(metroSearchRequest)).toEqual(metroSearchRequest);

		for (const bad of [{ query: void 0 }, { cursor: -1 }, { cursor: '3' }]) {
			rejects({ ...metroSearchRequest, ...bad });
		}
	});
});

describe('metro results', () => {
	test('a result checks its modules and values', () => {
		rejects({ ...metroModulesOk, modules: [{ id: 1, status: 'pending', label: null }] });
		rejects({ ...metroModulesOk, loaded: undefined });
		rejects({ ...metroChildrenOk, children: [{ key: 'a', kind: 'bigint', text: '1n' }] });
		rejects({ ...metroChildrenOk, internal: undefined });
		rejects({ ...metroReadOk, value: { key: 'a', kind: 'string' } });
	});

	test('a load-all batch counts what is left', () => {
		expect(parse(metroLoadAllOk)).toEqual(metroLoadAllOk);
		rejects({ ...metroLoadAllOk, remaining: void 0 });
	});

	test('a files result checks each id and path', () => {
		expect(parse(metroFilesOk)).toEqual(metroFilesOk);
		rejects({ ...metroFilesOk, files: [{ id: 1, path: 2 }] });
		rejects({ ...metroFilesOk, unloaded: void 0 });
	});

	test('a search result checks each match and ends with a null cursor', () => {
		expect(parse({ ...metroSearchOk, cursor: null })).toEqual({
			...metroSearchOk,
			cursor: null,
		});
		rejects({ ...metroSearchOk, cursor: void 0 });
		rejects({ ...metroSearchOk, matches: [{ ...metroSearchOk.matches[0], path: [1] }] });
		rejects({ ...metroSearchOk, matches: [{ ...metroSearchOk.matches[0], module: 1544 }] });
	});

	test('a failure carries a known code', () => {
		const failure = failMetroRequest(metroChildrenRequest as never, 'gone', 'stale');

		expect(parse(failure)).toEqual(failure);
		rejects({ ...failure, code: 'brand-new' });
	});

	test('every request type has a result type', () => {
		for (const [request, result] of Object.entries(METRO_RESULT_TYPES)) {
			expect(isMetroRequest({ type: request })).toBe(true);
			expect(isMetroResult({ type: result })).toBe(true);
			expect(isMetroRequest({ type: result })).toBe(false);
		}
	});
});
