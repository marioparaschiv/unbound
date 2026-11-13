import { describe, expect, test } from 'bun:test';

import {
	EXPLORER_RESULT_TYPES,
	failExplorerRequest,
	isExplorerRequest,
	isExplorerResult,
	parseMessage,
} from '~/index';

import contract from './fixtures/devtools-contract.json';

const {
	explorerObjectRequest,
	explorerObjectOk,
	explorerMembersRequest,
	explorerMembersOk,
	explorerValuesRequest,
	explorerValuesOk,
	explorerClassesRequest,
	explorerImagesOk,
} = contract.frames;

// UNKNOWN: the frames under test are deliberately malformed or loosely typed fixture JSON.
const parse = (frame: unknown): unknown => parseMessage(JSON.stringify(frame));
// UNKNOWN: as `parse`, the frame is deliberately malformed.
const rejects = (frame: unknown) => expect(parse(frame)).toBeUndefined();

describe('explorer requests', () => {
	test('a target names exactly one of a node, an object or a class', () => {
		for (const target of [{ object: 'a:1' }, { className: 'UIView' }]) {
			const frame = { ...explorerObjectRequest, target };

			expect(parse(frame)).toEqual(frame);
		}

		for (const target of [{}, { node: '1', object: 'a:1' }, { node: 1 }, 'UIView']) {
			rejects({ ...explorerObjectRequest, target });
		}
	});

	test('members and classes page with whole, non-negative numbers', () => {
		const { offset: _, limit: __, filter: ___, ...firstPage } = explorerMembersRequest;

		expect(parse(firstPage)).toEqual(firstPage);
		expect(parse({ type: 'explorer-classes-request', id: 'c' })).toEqual({
			type: 'explorer-classes-request',
			id: 'c',
		});

		for (const bad of [{ offset: -1 }, { limit: 1.5 }, { filter: 3 }, { kind: 'slots' }]) {
			rejects({ ...explorerMembersRequest, ...bad });
		}

		rejects({ ...explorerClassesRequest, image: null });
	});

	test('a values request names its members as strings', () => {
		rejects({ ...explorerValuesRequest, names: ['text', 1] });
		rejects({ ...explorerValuesRequest, invokeGetters: 'yes' });
		rejects({ ...explorerValuesRequest, object: undefined });
	});
});

describe('explorer results', () => {
	const [member] = explorerMembersOk.members;
	const [klass] = explorerObjectOk.object.chain;

	test('rejects payloads that do not match their shape', () => {
		const bad = [
			{ ...explorerObjectOk, object: { ...explorerObjectOk.object, platform: 'web' } },
			{
				...explorerObjectOk,
				object: { ...explorerObjectOk.object, chain: [{ ...klass, counts: { slots: 1 } }] },
			},
			{ ...explorerMembersOk, total: undefined },
			{ ...explorerMembersOk, members: [{ ...member, read: 'sometimes' }] },
			{ ...explorerMembersOk, members: [{ ...member, attributes: 'strong' }] },
			{ ...explorerValuesOk, values: [{ name: 'x', kind: 'blob', text: '' }] },
			{ ...explorerImagesOk, images: [{ path: '/a', name: 'a' }] },
		];

		for (const frame of bad) rejects(frame);
	});

	test('a failure carries a known code', () => {
		const failure = { type: 'explorer-members-result', id: 'm', ok: false, error: 'Gone' };

		expect(parse({ ...failure, code: 'stale' })).toEqual({
			...failure,
			code: 'stale',
		});
		rejects(failure);
		rejects({ ...failure, code: 'timeout' });
	});

	test('failExplorerRequest answers with the matching result type', () => {
		for (const [request, result] of Object.entries(EXPLORER_RESULT_TYPES)) {
			const frame = failExplorerRequest(
				{ type: request as keyof typeof EXPLORER_RESULT_TYPES, id: 'x' },
				'Gone',
				'stale',
			);

			expect(frame).toEqual({
				type: result,
				id: 'x',
				ok: false,
				error: 'Gone',
				code: 'stale',
			});
			expect(isExplorerResult(frame)).toBe(true);
			expect(isExplorerRequest(frame)).toBe(false);
			expect(parse(frame)).toEqual(frame);
		}
	});
});
