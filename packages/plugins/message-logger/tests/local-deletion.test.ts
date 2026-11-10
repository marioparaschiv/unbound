import { expect, test } from 'bun:test';
import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { flux as apiFlux } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { ChatManager, RowManager, generateRow } from './discord';
import { findSaved } from '~/archive/runtime';

async function boot() {
	const message = {
		id: '10',
		channel_id: '20',
		content: 'My phone message',
		author: { id: '1', username: 'Me' },
		attachments: [],
		state: 'SENT',
	};
	let live: typeof message | undefined = message;
	const actions = {
		sendMessage() {},
		receiveMessage() {},
		deleteMessage(
			channelId: string,
			id: string,
			onlyLocal: boolean | { onlyLocal: boolean } = false,
		) {
			return apiFlux.dispatch({ type: 'MESSAGE_DELETE', channelId, id });
		},
	};
	metro.register(actions);
	metro.register(RowManager);
	metro.register(ChatManager);
	metro.register({ openLazy() {}, hideActionSheet() {} });
	flux.seed({
		Message: {
			getMessage: () => live,
			getMessages: () => ({ toArray: () => (live ? [live] : []) }),
		},
		Channel: { getChannel: () => ({ guild_id: '90' }) },
		User: { getCurrentUser: () => ({ id: '1' }) },
	});
	settings.archive.persistCapture = true;
	await startPlugin();
	apiFlux.onAction('MESSAGE_DELETE', () => {
		live = undefined;
	});
	return {
		actions,
		row: () =>
			generateRow({
				id: '10',
				channel_id: '20',
				content: message.content,
				author: message.author,
				attachments: [],
			}),
	};
}
test('phone delete followed by server confirmation keeps the red marker and exactly one saved record', async () => {
	const d = await boot();
	await d.actions.deleteMessage('20', '10');
	await apiFlux.dispatch({ type: 'MESSAGE_DELETE', channelId: '20', id: '10' });
	expect(d.row().ephemeralIndication).toBeDefined();
	expect(d.row().textColor).toBeDefined();
	expect(findSaved()).toHaveLength(1);
});
test('Dismiss still removes the message and its saved copy after a phone deletion', async () => {
	const d = await boot();
	await d.actions.deleteMessage('20', '10');
	await apiFlux.dispatch({ type: 'MESSAGE_DELETE', channelId: '20', id: '10' });
	await d.actions.deleteMessage('20', '10', true);
	expect(d.row().ephemeralIndication).toBeUndefined();
	expect(findSaved()).toHaveLength(0);
});
test('immediate explicit local dismissal is not swallowed as a server confirmation', async () => {
	const d = await boot();
	await d.actions.deleteMessage('20', '10');
	await d.actions.deleteMessage('20', '10', { onlyLocal: true });
	await apiFlux.dispatch({ type: 'MESSAGE_DELETE', channelId: '20', id: '10' });
	expect(d.row().ephemeralIndication).toBeUndefined();
	expect(findSaved()).toHaveLength(0);
});
test('a server-only deletion still shows the marker and supports Dismiss', async () => {
	const d = await boot();
	await apiFlux.dispatch({ type: 'MESSAGE_DELETE', channelId: '20', id: '10' });
	expect(d.row().ephemeralIndication).toBeDefined();
	await d.actions.deleteMessage('20', '10', true);
	expect(d.row().ephemeralIndication).toBeUndefined();
});
