import { fs, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import { restoreIntoPage, toRawMessage, type RawMessage } from '~/lib/persist';
import { LOG_FILE } from '~/lib/constants';

import { dispatch, generateRow, startLogger } from '../helpers/discord';

const SAVED_PATH = `/documents/${LOG_FILE}`;

const raw = (id: string, channel_id = 'c1'): RawMessage => ({ id, channel_id, content: id });

const ids = (messages: RawMessage[] | undefined) => messages?.map((message) => message.id);

const afterSave = () => new Promise((resolve) => setTimeout(resolve, 1100));

describe('toRawMessage', () => {
	test('turns a stored message into the API shape', () => {
		const message = toRawMessage({
			id: '5',
			channel_id: 'c1',
			content: 'hi',
			author: { id: '2', username: 'someone', globalName: 'Someone', avatar: null },
			timestamp: '2026-01-01T00:00:00.000Z',
			attachments: [{ id: 'a1', filename: 'cat.png' }],
			messageReference: { message_id: '4', channel_id: 'c1' },
		});

		expect(message).toMatchObject({
			id: '5',
			channel_id: 'c1',
			content: 'hi',
			author: { id: '2', username: 'someone', global_name: 'Someone' },
			timestamp: '2026-01-01T00:00:00.000Z',
			edited_timestamp: null,
			attachments: [{ id: 'a1', filename: 'cat.png' }],
			message_reference: { message_id: '4', channel_id: 'c1' },
		});
	});

	test('gives up on a message without an author', () => {
		expect(toRawMessage({ id: '5', channel_id: 'c1' })).toBeUndefined();
	});
});

describe('restoreIntoPage', () => {
	test('puts a deleted message back between the messages around it', () => {
		const action = { channelId: 'c1', messages: [raw('30'), raw('10')], hasMoreBefore: true };

		restoreIntoPage(action, new Map([['20', raw('20')]]), new Map());

		expect(ids(action.messages)).toEqual(['30', '20', '10']);
	});

	test('puts back a deleted message newer than the latest page', () => {
		const action = { channelId: 'c1', messages: [raw('30'), raw('10')], hasMoreBefore: true };

		restoreIntoPage(action, new Map([['40', raw('40')]]), new Map());

		expect(ids(action.messages)).toEqual(['40', '30', '10']);
	});

	test('leaves out deleted messages outside an older page, and those of other channels', () => {
		const action = {
			channelId: 'c1',
			messages: [raw('30'), raw('10')],
			isBefore: true,
			hasMoreBefore: true,
		};

		restoreIntoPage(
			action,
			new Map([
				['40', raw('40')],
				['5', raw('5')],
				['20', raw('20', 'c2')],
			]),
			new Map(),
		);

		expect(ids(action.messages)).toEqual(['30', '10']);
	});

	test('puts deleted attachments back on the message that lost them', () => {
		const action: { channelId: string; messages: RawMessage[] } = {
			channelId: 'c1',
			messages: [{ ...raw('30'), attachments: [{ id: 'a2' }] }],
		};

		restoreIntoPage(action, new Map(), new Map([['30', [{ id: 'a1', filename: 'cat.png' }]]]));

		expect(action.messages[0]?.attachments).toEqual([
			{ id: 'a2' },
			{ id: 'a1', filename: 'cat.png' },
		]);
	});
});

describe('keeping the log after restarts', () => {
	test('saves a deleted message and puts it back when its channel loads again', async () => {
		await startLogger();
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });
		await afterSave();

		expect(fs.files.get(SAVED_PATH)).toContain('"m1"');

		await stopPlugin();

		expect(fs.files.has(SAVED_PATH)).toBe(true);

		await startLogger();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const load = {
			type: 'LOAD_MESSAGES_SUCCESS',
			channelId: 'c1',
			messages: [] as RawMessage[],
			hasMoreBefore: false,
			hasMoreAfter: false,
		};

		await dispatch(load);

		expect(ids(load.messages)).toEqual(['m1']);
		expect(generateRow().ephemeralIndication).toBeDefined();
	});

	test('keeps earlier versions across a restart', async () => {
		await startLogger();
		await dispatch({
			type: 'MESSAGE_UPDATE',
			message: {
				id: 'm1',
				channel_id: 'c1',
				content: 'hello world',
				edited_timestamp: '2026-01-01',
			},
		});
		await afterSave();
		await stopPlugin();
		await startLogger();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(generateRow({ content: 'hello world' }).content.map((node) => node.content)).toEqual(
			['-# hello (edited)', 'hello world'],
		);
	});

	test('saves nothing and removes the saved log when the setting is off', async () => {
		fs.files.set(SAVED_PATH, '{"version":1,"deleted":[],"edits":[],"deletedAttachments":[]}');
		settings.persistLog = false;
		await startLogger();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(fs.files.has(SAVED_PATH)).toBe(false);

		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });
		await afterSave();

		expect(fs.files.has(SAVED_PATH)).toBe(false);
	});
});
