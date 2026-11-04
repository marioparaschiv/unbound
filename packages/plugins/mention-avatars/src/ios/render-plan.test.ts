import { describe, expect, test } from 'bun:test';

import {
	createCellMessages,
	isSettledWithoutMentions,
	planRetries,
	retryTargets,
	shouldWait,
} from '~/ios/render-plan';

function fakeIndex({
	exhausted = [] as string[],
	unresolved = [] as string[],
	settledEmpty = [] as string[],
} = {}) {
	return {
		exhausted: (id: string) => exhausted.includes(id),
		isUnresolved: (id: string) => unresolved.includes(id),
		isSettledEmpty: (id: string) => settledEmpty.includes(id),
	};
}

describe('retry planning', () => {
	const waiting = new Map([
		['cell-a', { id: '1', channelId: 'c1' }],
		['cell-b', { id: '2' }],
		['cell-c', { id: '3' }],
		['cell-d', {}],
	]);

	test('refreshes only the waiting cells that have a message', () => {
		expect(retryTargets(waiting)).toEqual([
			{ id: '1', channelId: 'c1' },
			{ id: '2', channelId: undefined },
			{ id: '3', channelId: undefined },
		]);
	});

	test('reschedules only the cells whose mentions changed', () => {
		const plan = planRetries(waiting, new Set(['2']), () => false);

		expect(plan.reschedule).toEqual(['cell-b']);
		expect(plan.drop).toEqual(['cell-d']);
	});

	test('drops cells whose message used up its retries', () => {
		const plan = planRetries(waiting, new Set(), (id) => id === '3');

		expect(plan.reschedule).toEqual([]);
		expect(plan.drop).toEqual(['cell-c', 'cell-d']);
	});

	test('waits only for unresolved or missing messages with retries left', () => {
		const index = fakeIndex({ unresolved: ['1', '2'], exhausted: ['2'] });

		expect(shouldWait(index, '1', true)).toBe(true);
		expect(shouldWait(index, '2', true)).toBe(false);
		expect(shouldWait(index, '3', true)).toBe(false);
		expect(shouldWait(index, '3', false)).toBe(true);
		expect(shouldWait(index, undefined, false)).toBe(false);
	});
});

describe('settled messages', () => {
	const index = fakeIndex({ settledEmpty: ['1'] });

	test('a settled message without mentions needs no settle render', () => {
		expect(isSettledWithoutMentions(index, '1', true, false)).toBe(true);
	});

	test('a cell that still shows mention images is rendered to restore it', () => {
		expect(isSettledWithoutMentions(index, '1', true, true)).toBe(false);
	});

	test('an unsettled, missing or unknown message is not final', () => {
		expect(isSettledWithoutMentions(index, '2', true, false)).toBe(false);
		expect(isSettledWithoutMentions(index, '1', false, false)).toBe(false);
		expect(isSettledWithoutMentions(index, undefined, true, false)).toBe(false);
	});
});

describe('cell messages', () => {
	function setup() {
		const viewModels = new Map<string, string | undefined>([['cell', 'vm1']]);
		let reads = 0;
		const messages = createCellMessages<string, { messageId: string }>(
			(cell) => viewModels.get(cell),
			async (cell) => ({ messageId: `${cell}:${++reads}` }),
		);

		return { viewModels, messages, reads: () => reads };
	}

	test('reads a cell once while it shows the same view model', async () => {
		const { messages, reads } = setup();

		await messages.get('cell', 'key');
		await messages.get('cell', 'key');

		expect(reads()).toBe(1);
	});

	test('reads again when the cell shows a different view model', async () => {
		const { viewModels, messages, reads } = setup();

		await messages.get('cell', 'key');
		viewModels.set('cell', 'vm2');

		expect(await messages.get('cell', 'key')).toEqual({ messageId: 'cell:2' });
		expect(reads()).toBe(2);
	});

	test('does not cache without a key or view model, or after forget', async () => {
		const { viewModels, messages, reads } = setup();

		await messages.get('cell', undefined);
		await messages.get('cell', undefined);
		viewModels.set('cell', undefined);
		await messages.get('cell', 'key');
		await messages.get('cell', 'key');
		viewModels.set('cell', 'vm1');
		await messages.get('cell', 'key');
		messages.forget('key');
		await messages.get('cell', 'key');

		expect(reads()).toBe(6);
	});
});
