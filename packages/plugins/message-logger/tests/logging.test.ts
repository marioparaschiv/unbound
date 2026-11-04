import { flux as fakeFlux } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { flux } from '@unbound-app/api';

import { createMessageLog, type MessageLog } from '~/log';
import { purgeLog } from '~/history/actions';
import { startDeletions } from '~/deletions';
import { startNonces } from '~/nonces';
import { startEdits } from '~/edits';

// UNKNOWN: a test sends Discord's action payloads, which FluxAction does not type.
type Action = { type: string } & Record<string, unknown>;

const ME = '1';
const message = {
	id: 'm1',
	channel_id: 'c1',
	content: 'hello',
	author: { id: '2' },
	attachments: [{ id: 'a1' }, { id: 'a2' }],
	state: 'SENT',
};

let log: MessageLog;
let reached: Action[];

beforeEach(() => {
	log = createMessageLog();
	reached = [];

	fakeFlux.seed({
		Message: {
			getMessage: (_channel: string, id: string) => (id === message.id ? message : undefined),
		},
		Channel: { getChannel: () => ({ guild_id: 'g1' }) },
		User: { getCurrentUser: () => ({ id: ME }) },
	});

	for (const type of [
		'MESSAGE_DELETE',
		'MESSAGE_DELETE_BULK',
		'MESSAGE_UPDATE',
		'MESSAGE_CREATE',
	]) {
		flux.onAction(type, (action) => void reached.push(action as Action));
	}
});

function dispatch(action: Action) {
	return fakeFlux.dispatch(action);
}

describe('a deleted message', () => {
	beforeEach(() => startDeletions(log));

	test('stays in the chat and is logged as deleted', async () => {
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });

		expect(reached).toEqual([]);
		expect(log.isDeleted('m1')).toBe(true);
	});

	test('goes through the second time, as with Dismiss message', async () => {
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE', id: 'm1' }]);
		expect(log.isDeleted('m1')).toBe(false);
	});

	test('is not kept when it came from a bot, which is ignored by default', async () => {
		message.author = { id: '2', bot: true } as never;
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });
		message.author = { id: '2' };

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE' }]);
		expect(log.isDeleted('m1')).toBe(false);
	});

	test('is not kept when logging deletions is off', async () => {
		settings.logDeletes = false;
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE' }]);
	});

	test('lets the rest of a bulk delete through', async () => {
		await dispatch({ type: 'MESSAGE_DELETE_BULK', ids: ['m1', 'm2'], channelId: 'c1' });

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE_BULK', ids: ['m2'] }]);
		expect(log.isDeleted('m1')).toBe(true);
	});

	test('is removed from the chat when the plugin stops', async () => {
		await dispatch({ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' });
		purgeLog(log);
		await Promise.resolve();

		expect(reached).toMatchObject([{ type: 'MESSAGE_DELETE', id: 'm1', channelId: 'c1' }]);
		expect(log.hasHistory('m1')).toBe(false);
	});
});

describe('an edited message', () => {
	beforeEach(() => startEdits(log));

	const edit = (extra: Record<string, unknown>) =>
		dispatch({
			type: 'MESSAGE_UPDATE',
			message: { id: 'm1', channel_id: 'c1', edited_timestamp: '2026-01-01', ...extra },
		});

	test('keeps its earlier text', async () => {
		await edit({ content: 'hello world' });

		expect(log.editsOf('m1')).toEqual([{ content: 'hello', timestamp: '2026-01-01' }]);
		expect(reached).toHaveLength(1);
	});

	test('keeps an attachment the edit removed, marked as deleted', async () => {
		await edit({ content: 'hello', attachments: [{ id: 'a1' }] });

		expect(log.deletedAttachmentIds('m1')).toEqual(['a2']);
		expect(reached[0]).toMatchObject({
			message: { attachments: [{ id: 'a1' }, { id: 'a2' }] },
		});
	});

	test('drops the attachment once logging deleted attachments is off', async () => {
		settings.logDeletedAttachments = false;
		await edit({ content: 'hello', attachments: [{ id: 'a1' }] });

		expect(log.deletedAttachmentIds('m1')).toEqual([]);
		expect(reached[0]).toMatchObject({ message: { attachments: [{ id: 'a1' }] } });
	});

	test('logs nothing while edits are not logged', async () => {
		settings.logEdits = false;
		await edit({ content: 'hello world' });

		expect(log.editsOf('m1')).toEqual([]);
	});
});

describe('a reused nonce', () => {
	beforeEach(() => startNonces());

	test('no longer replaces an earlier sent message from someone else', async () => {
		await dispatch({
			type: 'MESSAGE_CREATE',
			message: { id: 'm9', channel_id: 'c1', nonce: 'm1', author: { id: '3' } },
		});

		expect(reached[0]).toMatchObject({ message: { id: 'm9' } });
		expect((reached[0]?.message as { nonce?: string }).nonce).toBeUndefined();
	});

	test('is left alone on your own message', async () => {
		await dispatch({
			type: 'MESSAGE_CREATE',
			message: { id: 'm9', channel_id: 'c1', nonce: 'm1', author: { id: ME } },
		});

		expect((reached[0]?.message as { nonce?: string }).nonce).toBe('m1');
	});
});
