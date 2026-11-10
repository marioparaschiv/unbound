import { metro, render, startPlugin, toasts } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { settings } from '@unbound-app/settings';

import { selfTest } from '~/index';

const clipboard = { text: '' };
const hidden: string[] = [];
const realFetch = globalThis.fetch;

const ActionSheets = {
	openLazy: (..._args: unknown[]) => undefined,
	hideActionSheet: (key: string) => hidden.push(key),
};

function ActionSheetRowGroup({ children }: { hasIcons: boolean; children?: ReactNode }) {
	return children;
}

// Discord's own sheet: the plugin adds its row to this group.
function MessageLongPressActionSheet() {
	return createElement(ActionSheetRowGroup, { hasIcons: false }, [
		createElement('Row', { key: 'copy', label: 'Copy Text', onPress: () => undefined }),
	]);
}

async function openSheet(message: { content: string }) {
	const module = { default: MessageLongPressActionSheet };

	ActionSheets.openLazy(Promise.resolve(module), 'MessageLongPressActionSheet', { message });
	await Promise.resolve();

	return render(<module.default />);
}

const labels = (sheet: Awaited<ReturnType<typeof openSheet>>) =>
	sheet.findAll('ActionSheetRow').map((node) => node.props.label);

beforeEach(async () => {
	clipboard.text = '';
	resetHealth();
	hidden.length = 0;
	metro.register(ActionSheets);
	metro.register(
		class RowManager {
			generate() {}
		},
	);
	metro.register(
		class ChatManager {
			determineChangeType() {}
		},
	);
	metro.register({
		setString: (text: string) => (clipboard.text = text),
		getString: () => '',
		setImage: () => undefined,
		getImage: () => undefined,
	});
	settings.accessToken = 'access';
	settings.refreshToken = 'refresh';
	settings.expiresAt = Date.now() + 3_600_000;
	globalThis.fetch = (() =>
		Promise.resolve(
			new Response(JSON.stringify({ translatedText: 'Hallo' }), { status: 200 }),
		)) as unknown as typeof fetch;
	await startPlugin();
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

describe('the message long-press menu', () => {
	test('offers Translate, which copies the translation and closes the sheet when pressed', async () => {
		const sheet = await openSheet({ content: 'Hello' });

		expect(labels(sheet)).toEqual(['Translate']);

		sheet.act(() => sheet.find('ActionSheetRow').props.onPress?.());
		// The copy and the toast follow a chain of awaits; one macrotask lets them all finish.
		await new Promise((resolve) => setTimeout(resolve));

		expect(hidden).toEqual(['MessageLongPressActionSheet']);
		expect(clipboard.text).toBe('Hallo');
		expect(toasts.shown).toMatchObject([{ title: 'Translated', content: 'Hallo' }]);
	});

	test('has no Translate row on a message without text', async () => {
		expect(labels(await openSheet({ content: '  ' }))).toEqual([]);
	});

	test('reports its row as applied to the self test', () => {
		expect(selfTest()).toMatchObject({ ok: true });
	});
});
