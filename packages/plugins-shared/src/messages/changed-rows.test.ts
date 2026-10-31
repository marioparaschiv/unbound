import {
	createMessageStoreModel,
	type MessageStoreModel,
	type RawMessage,
} from '@unbound-plugins/shared/messages/message-store-model';
import {
	CHANGED_ROWS_LIMIT,
	trackChangedRows,
} from '@unbound-plugins/shared/messages/changed-rows';
import { afterAll, beforeEach, describe, expect, spyOn, test } from 'bun:test';

type Action = Parameters<MessageStoreModel['dispatch']>[0];

let store = createMessageStoreModel('me');
const dispatched: Action[] = [];
const errors = spyOn(console, 'error').mockImplementation(() => {});

function raw(id: string): RawMessage {
	return {
		id,
		channel_id: 'c1',
		content: `<@me> <@u1> ${id}`,
		mentions: [{ id: 'me' }, { id: 'u1' }],
		embeds: [{ title: 'Title', description: '<@u1>', footer: { text: 'Footer' } }],
	};
}

function isLoaded(channelId: string, id: string) {
	return Boolean(store.getMessage(channelId, id));
}

function dispatch(action: Action) {
	dispatched.push(action);

	return store.dispatch(action);
}

beforeEach(() => {
	store = createMessageStoreModel('me');
	dispatched.length = 0;
	errors.mockClear();
});

afterAll(() => {
	errors.mockRestore();
});

describe('trackChangedRows', () => {
	test('rebuild gives each recorded message a new record with the same data', async () => {
		const rows = trackChangedRows('Test', { isLoaded, dispatch });
		const before = store.add(raw('m1'));

		rows.add(before);
		rows.rebuild();
		await Promise.resolve();

		const after = store.getMessage('c1', 'm1');

		expect(after).not.toBe(before);
		expect(after).toEqual(before);
		expect(after?.mentions).toEqual(['me', 'u1']);
		expect(after?.mentioned).toBe(true);
		expect(after?.embeds).toEqual([
			{ rawTitle: 'Title', rawDescription: '<@u1>', footer: { text: 'Footer' } },
		]);
	});

	test('rebuild skips messages that are no longer loaded and forgets every message', () => {
		const rows = trackChangedRows('Test', { isLoaded, dispatch });

		rows.add(store.add(raw('m1')));
		rows.add({ id: 'gone', channel_id: 'c1' });
		rows.rebuild();
		rows.rebuild();

		expect(dispatched).toEqual([
			{ type: 'MESSAGE_UPDATE', message: { id: 'm1', channel_id: 'c1' } },
		]);
	});

	test('keeps only the most recently changed messages', () => {
		const rows = trackChangedRows('Test', { isLoaded: () => true, dispatch });

		for (let i = 0; i <= CHANGED_ROWS_LIMIT; i++) {
			rows.add({ id: `m${i}`, channel_id: 'c1' });
		}

		rows.add({ id: 'm0', channel_id: 'c1' });
		rows.rebuild();

		const ids = dispatched.map((action) => action.message?.id);

		expect(ids).toHaveLength(CHANGED_ROWS_LIMIT);
		expect(ids).not.toContain('m1');
		expect(ids.at(-1)).toBe('m0');
	});

	test('rebuild goes on past a failed lookup or dispatch, then forgets every message', async () => {
		const rows = trackChangedRows('Test', {
			isLoaded(channelId, id) {
				if (id === 'm1') {
					throw new TypeError('MessageStore is undefined');
				}

				return isLoaded(channelId, id);
			},
			dispatch(action) {
				if (action.message.id === 'm2') {
					throw new Error('dispatch threw');
				}

				if (action.message.id === 'm3') {
					return Promise.reject(new Error('dispatch rejected'));
				}

				return dispatch(action);
			},
		});

		for (const id of ['m1', 'm2', 'm3', 'm4']) {
			rows.add(store.add(raw(id)));
		}

		const before = store.getMessage('c1', 'm4');

		expect(() => rows.rebuild()).not.toThrow();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(store.getMessage('c1', 'm4')).not.toBe(before);
		expect(errors).toHaveBeenCalledTimes(3);

		dispatched.length = 0;
		rows.rebuild();

		expect(dispatched).toEqual([]);
	});
});
