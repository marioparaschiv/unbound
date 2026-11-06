import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

import { ChatManager, dispatch, generateRow, startLogger } from './discord';

const RED = 0xfff23f42;

const del = () => dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });

beforeEach(startLogger);

describe('a message row', () => {
	test('is left alone while the log knows nothing about its message', () => {
		const row = generateRow();

		expect(row.textColor).toBeUndefined();
		expect(row.ephemeralIndication).toBeUndefined();
	});

	test('turns red with a deleted marker once its message is deleted', async () => {
		await del();

		const row = generateRow();

		expect(row.textColor).toBe(RED);
		expect(row.ephemeralIndication).toMatchObject({
			content: [
				{ type: 'text', content: 'This message was deleted' },
				{ type: 'text', content: ' • ' },
				{ type: 'link', content: [{ type: 'text', content: 'Dismiss message' }] },
			],
		});
		expect(row.attachments).toEqual([
			{ id: 'a1', filename: '(deleted) cat.png' },
			{ id: 'a2', filename: '(deleted) dog.png' },
		]);
	});

	test('stays plain with red text and the deleted marker off', async () => {
		settings.redText = false;
		settings.deletedMarker = false;
		await del();

		const row = generateRow();

		expect(row.textColor).toBeUndefined();
		expect(row.ephemeralIndication).toBeUndefined();
	});
	test('uses the selected deleted-message color while preserving the marker and dismiss link', async () => {
		settings.deletedColor = '#00ff00';
		await del();
		const row = generateRow();
		expect(row.textColor).toBe(0xff00ff00);
		expect(row.ephemeralIndication).toBeDefined();
	});

	test('is drawn again once, after its log changes', async () => {
		const chat = new ChatManager();

		await del();

		expect(chat.determineChangeType({ message: { id: 'm1' } })).toBe(2);
		expect(chat.determineChangeType({ message: { id: 'm1' } })).toBe(0);
	});
});
