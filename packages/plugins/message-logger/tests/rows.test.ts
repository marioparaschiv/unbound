import { flux, metro } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

import { createMessageLog, type MessageLog } from '~/log';
import { startRows } from '~/rows';

type Row = { message: Record<string, unknown> };

class RowManager {
	generate(_input: unknown): Row {
		return {
			message: {
				id: 'm1',
				channelId: 'c1',
				content: [{ type: 'text', content: 'hello' }],
				attachments: [{ id: 'a1', filename: 'cat.png' }],
			},
		};
	}
}

class ChatManager {
	determineChangeType(_input: unknown): number {
		return 0;
	}
}

const RED = 0xfff23f42;

let log: MessageLog;

beforeEach(() => {
	log = createMessageLog();

	metro.register(RowManager);
	metro.register(ChatManager);
	metro.register({ processColor: () => RED, View: {} });
	flux.seed({ Message: { getMessage: () => ({ id: 'm1', flags: 0 }) } });
	startRows(log);
});

describe('a message row', () => {
	test('is left alone while the log knows nothing about its message', () => {
		const { message } = new RowManager().generate({});

		expect(message.textColor).toBeUndefined();
		expect(message.ephemeralIndication).toBeUndefined();
	});

	test('turns red with a deleted marker once its message is deleted', () => {
		log.markDeleted('c1', 'm1');

		const { message } = new RowManager().generate({});

		expect(message.textColor).toBe(RED);
		expect(message.ephemeralIndication).toMatchObject({
			content: [
				{ type: 'text', content: 'This message was deleted' },
				{ type: 'text', content: ' • ' },
				{ type: 'link', content: [{ type: 'text', content: 'Dismiss message' }] },
			],
		});
		expect(message.attachments).toEqual([{ id: 'a1', filename: '(deleted) cat.png' }]);
	});

	test('stays plain with red text and the deleted marker off', () => {
		settings.redText = false;
		settings.deletedMarker = false;
		log.markDeleted('c1', 'm1');

		const { message } = new RowManager().generate({});

		expect(message.textColor).toBeUndefined();
		expect(message.ephemeralIndication).toBeUndefined();
	});

	test('is drawn again once, after its log changes', () => {
		const chat = new ChatManager();

		log.requestRender('m1');

		expect(chat.determineChangeType({ message: { id: 'm1' } })).toBe(2);
		expect(chat.determineChangeType({ message: { id: 'm1' } })).toBe(0);
	});
});
