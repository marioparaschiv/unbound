import { expect, test } from 'bun:test';
import { flux, fs, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings, SettingsPanel } from '@unbound-app/settings';
import { createElement } from 'react';
import { flux as apiFlux } from '@unbound-app/api';
import { clearSaved, findSaved, archiveState } from '~/archive/runtime';
import { clearMessageHistory } from '~/history/actions';
import { createMessageLog } from '~/log';
import { openSavedArchive } from '~/archive/sheet';
import { ChatManager, RowManager, generateRow } from './discord';

function dispatch<T extends { type: string }>(action: T) {
	return flux.dispatch(action);
}

const previous = {
	id: '10',
	channel_id: '20',
	content: 'Original saved text',
	author: { id: '30', username: 'Alice' },
	attachments: [{ id: '40', filename: 'notes.txt' }],
	state: 'SENT',
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
async function boot() {
	const sheets: {
		calls: any[][];
		openLazy: (...args: any[]) => void;
		hideActionSheet: () => void;
	} = {
		calls: [],
		openLazy(...args) {
			this.calls.push(args);
		},
		hideActionSheet() {},
	};
	metro.register(RowManager);
	metro.register(ChatManager);
	metro.register(sheets);
	flux.seed({
		Message: {
			getMessage: (_c: string, id: string) => (id === '10' ? previous : undefined),
			getMessages: () => ({ toArray: () => [previous] }),
		},
		User: { getCurrentUser: () => ({ id: '1' }) },
		Channel: { getChannel: () => ({ guild_id: '90' }) },
	});
	await startPlugin();
	return sheets;
}
test('official deletion behavior and the persistent snapshot work together across restart', async () => {
	settings.archive.persistCapture = true;
	await boot();
	await dispatch({ type: 'MESSAGE_DELETE', id: '10', channelId: '20' });
	await turn();
	expect(findSaved()[0]?.before.content).toBe(previous.content);
	expect(archiveState().status).toBe('Saved locally');
	await stopPlugin();
	expect([...fs.files.values()].some((v) => v.includes(previous.content))).toBe(true);
	await boot();
	expect(findSaved()[0]?.before.content).toBe(previous.content);
	await clearSaved();
	await stopPlugin();
	await boot();
	expect(findSaved()).toHaveLength(0);
});
test('edit capture happens before the official handler keeps removed attachments', async () => {
	settings.archive.persistCapture = true;
	await boot();
	await dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: '10',
			channel_id: '20',
			content: 'Replacement',
			edited_timestamp: new Date().toISOString(),
			attachments: [],
		},
	});
	await turn();
	const event = findSaved()[0];
	expect(event?.before.content).toBe(previous.content);
	expect(event?.after?.content).toBe('Replacement');
	expect(event?.before.attachments).toEqual(['notes.txt']);
	expect(event?.after?.attachments).toEqual([]);
});
test('persistent capture starts off while official in-chat logging remains available', async () => {
	await boot();
	expect(settings.archive.persistCapture).toBe(false);
	await dispatch({ type: 'MESSAGE_DELETE', id: '10', channelId: '20' });
	await turn();
	expect(findSaved()).toHaveLength(0);
});
test('official clear history also removes the archived record without recapturing it', async () => {
	settings.archive.persistCapture = true;
	await boot();
	await dispatch({
		type: 'MESSAGE_UPDATE',
		message: {
			id: '10',
			channel_id: '20',
			content: 'Changed',
			edited_timestamp: new Date().toISOString(),
		},
	});
	await turn();
	expect(findSaved()).toHaveLength(1);
	clearMessageHistory(createMessageLog(), '20', '10');
	await turn();
	expect(findSaved()).toHaveLength(0);
});
test('generated settings render archive controls and the search viewer opens as an official-style sheet', async () => {
	const sheets = await boot();
	const panel = render(createElement(SettingsPanel));
	expect(panel.text()).toContain('Open saved archive and search');
	openSavedArchive();
	expect(sheets.calls.length).toBeGreaterThan(0);
	const call = sheets.calls.at(-1)!;
	const loaded = await call[0];
	const sheet = render(createElement(loaded.default));
	expect(sheet.text()).toContain('Saved Message Archive');
	expect(sheet.findAll('TextInput')).toHaveLength(2);
});
async function seedPersistedDeletion() {
	settings.archive.persistCapture = true;
	await boot();
	await dispatch({ type: 'MESSAGE_DELETE', id: '10', channelId: '20' });
	await turn();
	await stopPlugin();
	await boot();
}
const liveHistory = () => [
	{ id: '30', channel_id: '20', content: 'Newer live text', author: { id: '31' } },
	{ id: '5', channel_id: '20', content: 'Older live text', author: { id: '31' } },
];
test('after restart, saved deletion returns in its original channel with the official red/deleted decoration', async () => {
	await seedPersistedDeletion();
	let loaded: any;
	const remove = apiFlux.onAction('LOAD_MESSAGES_SUCCESS', (a) => {
		loaded = a;
	});
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
		isBefore: false,
		isAfter: false,
	});
	expect(loaded.messages.map((m: any) => m.id)).toEqual(['30', '10', '5']);
	expect(loaded.messages[1].content).toContain(previous.content);
	const row = generateRow({ id: '10', channel_id: '20' });
	expect(row.ephemeralIndication).toBeDefined();
	expect(row.textColor).toBeDefined();
	expect(flux.dispatched.some((a) => a.type === 'MESSAGE_CREATE')).toBe(false);
	remove();
});
test('inline restoration respects channel, account, ignore filters and its setting', async () => {
	await seedPersistedDeletion();
	let loaded: any;
	apiFlux.onAction('LOAD_MESSAGES_SUCCESS', (a) => {
		loaded = a;
	});
	settings.archive.restoreInChannel = false;
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	expect(loaded.messages).toHaveLength(2);
	settings.archive.restoreInChannel = true;
	settings.ignoreUsers = '30';
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	expect(loaded.messages).toHaveLength(2);
	settings.ignoreUsers = '';
	flux.seed({ User: { getCurrentUser: () => ({ id: '2' }) } });
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	expect(loaded.messages).toHaveLength(2);
});
test('dismissing an inline restored message clears its saved copy and does not recapture it', async () => {
	await seedPersistedDeletion();
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	await dispatch({ type: 'MESSAGE_DELETE', channelId: '20', id: '10' });
	await turn();
	expect(findSaved()).toHaveLength(0);
	await stopPlugin();
	await boot();
	let loaded: any;
	apiFlux.onAction('LOAD_MESSAGES_SUCCESS', (a) => {
		loaded = a;
	});
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	expect(loaded.messages).toHaveLength(2);
});
test('stopping the plugin purges restored rows without erasing persisted snapshots', async () => {
	await seedPersistedDeletion();
	await dispatch({
		type: 'LOAD_MESSAGES_SUCCESS',
		channelId: '20',
		messages: liveHistory(),
	});
	await stopPlugin();
	await boot();
	expect(findSaved()).toHaveLength(1);
});
