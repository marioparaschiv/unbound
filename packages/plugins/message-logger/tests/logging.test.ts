import { stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { flux } from '@unbound-app/api';

import { ME, dispatch, generateRow, message, startLogger, type Action } from './discord';

let reached: Action[];

beforeEach(async () => {
	reached = [];

	await startLogger();

	for (const type of [
		'MESSAGE_DELETE',
		'MESSAGE_DELETE_BULK',
		'MESSAGE_UPDATE',
		'MESSAGE_CREATE',
	]) {
		flux.onAction(type, (action) => void reached.push(action as Action));
	}
});

const isMarkedDeleted = () => generateRow().ephemeralIndication !== undefined;

const del = (extra: Record<string, unknown> = {}) =>
	dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1', ...extra });

describe('a deleted message', () => {
	test('stays in the chat and is logged as deleted', async () => {
		await del();

		expect(reached).toEqual([]);
		expect(isMarkedDeleted()).toBe(true);
	});

	test('goes through the second time, as with Dismiss message', async () => {
		await del();
		await del();

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE', id: 'm1' }]);
		expect(isMarkedDeleted()).toBe(false);
	});

	test('is not kept when it came from a bot, which is ignored by default', async () => {
		message.author = { id: '2', bot: true };
		await del();
		message.author = { id: '2' };

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE' }]);
		expect(isMarkedDeleted()).toBe(false);
	});

	test('is not kept when logging deletions is off', async () => {
		settings.logDeletes = false;
		await del();

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE' }]);
		expect(isMarkedDeleted()).toBe(false);
	});

	test('lets the rest of a bulk delete through', async () => {
		await dispatch({ type: 'MESSAGE_DELETE_BULK', ids: ['m1', 'm2'], channelId: 'c1' });

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE_BULK', ids: ['m2'] }]);
		expect(isMarkedDeleted()).toBe(true);
	});

	test('is removed from the chat when the plugin stops', async () => {
		await del();
		await stopPlugin();

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' }]);
	});
});

describe('the plugin stopping', () => {
	// What the chat would draw if it read the row at each action `stop` sends.
	function drawnDuring(...types: string[]) {
		const rows: ReturnType<typeof generateRow>[] = [];

		for (const type of types) flux.onAction(type, () => void rows.push(generateRow()));

		return rows;
	}

	test('draws a deleted message as a plain row while it is removed', async () => {
		await del();
		expect(isMarkedDeleted()).toBe(true);

		const rows = drawnDuring('MESSAGE_DELETE');

		await stopPlugin();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.ephemeralIndication).toBeUndefined();
		expect(rows[0]?.textColor).toBeUndefined();
	});

	test('draws a message plainly while its deleted attachments are removed', async () => {
		await dispatch({
			type: 'MESSAGE_UPDATE',
			message: {
				id: 'm1',
				channel_id: 'c1',
				content: 'hello',
				edited_timestamp: '2026-01-01',
				attachments: [{ id: 'a1' }],
			},
		});
		expect(generateRow().attachments[1]?.filename).toBe('(deleted) dog.png');

		const rows = drawnDuring('MESSAGE_UPDATE');

		await stopPlugin();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.attachments.map((attachment) => attachment.filename)).toEqual([
			'cat.png',
			'dog.png',
		]);
	});
});

describe('an edited message', () => {
	const edit = (extra: Record<string, unknown>) =>
		dispatch({
			type: 'MESSAGE_UPDATE',
			message: { id: 'm1', channel_id: 'c1', edited_timestamp: '2026-01-01', ...extra },
		});

	const texts = (content: { content?: unknown }[] | undefined) =>
		content?.map((node) => node.content);

	test('keeps its earlier text above the new text', async () => {
		await edit({ content: 'hello world' });

		expect(reached).toHaveLength(1);
		expect(texts(generateRow({ content: 'hello world' }).content)).toEqual([
			'hello',
			' (edited)\n',
			'hello world',
		]);
	});

	test('keeps an attachment the edit removed, marked as deleted', async () => {
		await edit({ content: 'hello', attachments: [{ id: 'a1' }] });

		expect(reached[0]).toMatchObject({
			message: { attachments: [{ id: 'a1' }, { id: 'a2' }] },
		});
		expect(generateRow().attachments).toEqual([
			{ id: 'a1', filename: 'cat.png' },
			{ id: 'a2', filename: '(deleted) dog.png' },
		]);
	});

	test('drops the attachment once logging deleted attachments is off', async () => {
		settings.logDeletedAttachments = false;
		await edit({ content: 'hello', attachments: [{ id: 'a1' }] });

		expect(reached[0]).toMatchObject({ message: { attachments: [{ id: 'a1' }] } });
		expect(generateRow().attachments).toEqual(message.attachments);
	});

	test('logs nothing while edits are not logged', async () => {
		settings.logEdits = false;
		await edit({ content: 'hello world' });

		expect(texts(generateRow({ content: 'hello world' }).content)).toEqual(['hello world']);
	});
});

describe('a reused nonce', () => {
	test('no longer replaces an earlier sent message from someone else', async () => {
		await dispatch({
			type: 'MESSAGE_CREATE',
			message: { id: 'm9', channel_id: 'c1', nonce: 'm1', author: { id: '3' } },
		});

		expect(reached[0]).toMatchObject({ message: { id: 'm9' } });
		expect((reached[0]?.message as { nonce?: string } | undefined)?.nonce).toBeUndefined();
	});

	test('is left alone on your own message', async () => {
		await dispatch({
			type: 'MESSAGE_CREATE',
			message: { id: 'm9', channel_id: 'c1', nonce: 'm1', author: { id: ME } },
		});

		expect((reached[0]?.message as { nonce?: string } | undefined)?.nonce).toBe('m1');
	});
});
