import { flux, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';

import { ActionSheets, hidden, patched, picked, registerDiscord } from './fake-discord';

import type { StoreSeeds } from '@unbound-app/api/testing';

const message = { id: 'm1', channel_id: 'c1', type: 0, author: { id: 'me' }, attachments: [] };

// Discord's own row: the plugin adds its row to this group.
const copy = { key: 'copy', label: 'Copy Text', onPress: () => undefined };

// A host element, so the plugin's sheet renderer has no function component to wrap: the fake renderer freezes elements.
function MessageLongPressActionSheet() {
	return createElement('ActionSheetRowGroup', { hasIcons: false }, [createElement('Row', copy)]);
}

const stores: StoreSeeds = {
	User: { getCurrentUser: () => ({ id: 'me' }) },
	Message: { getMessage: () => ({ ...message, attachments: [{ id: '1' }, { id: '2' }] }) },
	Channel: { getChannel: () => ({ id: 'c1', isPrivate: () => true }) },
};

async function openSheet(sheetMessage: typeof message) {
	const module = { default: MessageLongPressActionSheet };

	flux.seed(stores);
	await startPlugin();
	ActionSheets.openLazy(Promise.resolve(module), 'MessageLongPressActionSheet', {
		message: sheetMessage,
		onClose: () => undefined,
	});
	await Promise.resolve();

	return render(<module.default />);
}

const addRow = (sheet: Awaited<ReturnType<typeof openSheet>>) =>
	sheet.findAll((node) => node.props.accessibilityLabel === 'Add Attachments');

beforeEach(() => registerDiscord({ assets: [{ uri: 'file:///dog.png', fileName: 'dog.png' }] }));

describe('Add Attachments row', () => {
	test('joins the long-press menu of your own message', async () => {
		expect(addRow(await openSheet(message))).toHaveLength(1);
	});

	test('stays out of a menu for a message that is not yours', async () => {
		const sheet = await openSheet({ ...message, author: { id: 'them' } });

		expect(addRow(sheet)).toEqual([]);
	});

	test('closes the menu and opens the picker, limited to the room left', async () => {
		const sheet = await openSheet({
			...message,
			attachments: [{ id: '1' }, { id: '2' }],
		} as never);

		sheet.act(() => addRow(sheet)[0]?.props.onPress?.());
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(hidden).toEqual(['MessageLongPressActionSheet']);
		expect(picked).toMatchObject([{ selectionLimit: 8 }]);
		expect(toasts.shown.map((toast) => toast.content)).toEqual([
			'Uploading, this can take a while...',
			'Attachment added successfully!',
		]);
		expect(patched).toMatchObject([
			{ body: { attachments: [{ id: '1' }, { id: '2' }, { id: '0' }] } },
		]);
	});
});
