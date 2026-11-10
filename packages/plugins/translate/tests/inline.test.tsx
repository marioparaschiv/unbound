import { flux, metro, render, startPlugin, stopPlugin, toasts } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { settings } from '@unbound-app/settings';

import { withTranslation } from '~/translate/inline';
import { selfTest } from '~/index';

type Record = {
	id: string;
	channel_id: string;
	content: string;
	set(key: string, value: string): Record;
};

const realFetch = globalThis.fetch;
const stored = new Map<string, Record>();

function record(content: string): Record {
	return {
		id: '1',
		channel_id: '2',
		content,
		set: (key, value) => ({ ...record(content), [key]: value }) as Record,
	};
}

class RowManager {
	generate({ message }: { message: Record }) {
		return {
			message: { id: message.id, content: [{ type: 'text', content: message.content }] },
		};
	}
}

class ChatManager {
	determineChangeType(_input: { message: { id: string } }) {
		return 0;
	}
}

const ActionSheets = {
	openLazy: (..._args: unknown[]) => undefined,
	hideActionSheet: (_key: string) => undefined,
};

function ActionSheetRowGroup({ children }: { hasIcons: boolean; children?: ReactNode }) {
	return children;
}

function MessageLongPressActionSheet() {
	return createElement(ActionSheetRowGroup, { hasIcons: false }, [
		createElement('Row', { key: 'copy', label: 'Copy Text', onPress: () => undefined }),
	]);
}

async function pressTranslate() {
	const module = { default: MessageLongPressActionSheet };

	ActionSheets.openLazy(Promise.resolve(module), 'MessageLongPressActionSheet', {
		message: stored.get('1'),
	});
	await Promise.resolve();

	const sheet = render(<module.default />);
	const row = sheet.find('ActionSheetRow');
	const label = row.props.label;

	sheet.act(() => row.props.onPress?.());
	await new Promise((resolve) => setTimeout(resolve));

	return label;
}

const drawn = () => new RowManager().generate({ message: stored.get('1')! }).message.content;

beforeEach(async () => {
	resetHealth();
	stored.set('1', record('Hello'));
	metro.register(ActionSheets);
	metro.register(RowManager);
	metro.register(ChatManager);
	flux.seed({ Message: { getMessage: (_channel: string, id: string) => stored.get(id) } });
	settings.display = 'inline';
	settings.sourceLanguage = 'auto';
	settings.targetLanguage = 'de';
	settings.accessToken = 'access';
	settings.refreshToken = 'refresh';
	settings.expiresAt = Date.now() + 3_600_000;
	globalThis.fetch = (() =>
		Promise.resolve(
			new Response(
				JSON.stringify({ translatedText: 'Hallo', detectedLanguage: { language: 'en' } }),
				{ status: 200 },
			),
		)) as unknown as typeof fetch;
	await startPlugin();
});

afterEach(async () => {
	await stopPlugin();
	globalThis.fetch = realFetch;
});

describe('translating in the message', () => {
	test('shows the translation under the text, without a toast, and redraws the row', async () => {
		expect(await pressTranslate()).toBe('Translate');

		expect(drawn()).toEqual([{ type: 'text', content: 'Hello\n\n-# *Hallo* (en -> de)' }]);
		expect(toasts.shown).toEqual([]);
		expect(flux.dispatched).toMatchObject([
			{ type: 'MESSAGE_UPDATE', message: { id: '1', channel_id: '2', content: 'Hello' } },
		]);
		expect(new ChatManager().determineChangeType({ message: { id: '1' } })).toBe(2);
	});

	test('offers Show Original on a translated message, which brings the text back', async () => {
		await pressTranslate();

		expect(await pressTranslate()).toBe('Show Original');
		expect(drawn()).toEqual([{ type: 'text', content: 'Hello' }]);
	});

	test('drops the translation once the message is edited', async () => {
		await pressTranslate();
		stored.set('1', record('Goodbye'));

		expect(drawn()).toEqual([{ type: 'text', content: 'Goodbye' }]);
	});

	test('draws the original text again when the plugin stops', async () => {
		await pressTranslate();
		await stopPlugin();
		await startPlugin();

		expect(drawn()).toEqual([{ type: 'text', content: 'Hello' }]);
	});

	test('keeps redrawing rows until Discord handles the update after the plugin stops', async () => {
		await pressTranslate();

		const stopping = stopPlugin();

		await new Promise((resolve) => setTimeout(resolve));

		expect(new ChatManager().determineChangeType({ message: { id: '1' } })).toBe(2);

		await stopping;
		await startPlugin();
	});

	test('reports the row and the inline translation as applied', () => {
		expect(selfTest()).toMatchObject({ ok: true, detail: '2 features applied' });
	});
});

describe('the translated message text', () => {
	test('puts each line of a multi-line translation in italic subtext and the codes on the last', () => {
		expect(
			withTranslation('Hi\nthere', { text: 'Hallo\n\nda ', source: 'en', target: 'de' }),
		).toBe('Hi\nthere\n\n-# *Hallo*\n-# *da* (en -> de)');
	});
});
