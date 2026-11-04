import { flux, metro, render, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createElement, type ReactNode } from 'react';

import type { StoreSeeds } from '@unbound-app/api/testing';

const VIDEO = 'dQw4w9WgXcQ';
const BRANDING = {
	titles: [{ title: 'Calm title', votes: 3 }],
	thumbnails: [{ timestamp: 12, votes: 3, original: false }],
};

const embed = {
	url: `https://www.youtube.com/watch?v=${VIDEO}`,
	rawTitle: 'YOU WONT BELIEVE THIS',
	provider: { name: 'YouTube' },
	video: { url: `https://www.youtube.com/embed/${VIDEO}` },
	thumbnail: { url: 'https://i.ytimg.com/a.jpg', proxyURL: 'https://images/a.jpg' },
};

const message = { id: 'm1', channel_id: 'c1', embeds: [embed] };
const stores: StoreSeeds = {
	Message: { getMessage: () => undefined, emitChange: () => undefined },
};

type RowInput = { message?: { id: string; channel_id: string; embeds: unknown[] } };

const rows: RowInput[] = [];
const hidden: string[] = [];

const ActionSheets = {
	openLazy: (..._args: unknown[]) => undefined,
	hideActionSheet: (key: string) => hidden.push(key),
};

const MessageRowData = {
	generateMessageRowData: (input: RowInput) => {
		rows.push(input);

		return input;
	},
};

const realFetch = globalThis.fetch;

function respondWith(body: unknown) {
	globalThis.fetch = Object.assign(async () => Response.json(body), {
		preconnect: () => undefined,
	});
}

beforeEach(() => {
	rows.length = 0;
	hidden.length = 0;
	metro.register(MessageRowData);
	metro.register(ActionSheets);
	flux.seed(stores);
	respondWith(BRANDING);
});

afterEach(() => {
	globalThis.fetch = realFetch;
});

/** Builds the row twice: once while the branding loads, once after it arrived. */
async function buildRow() {
	const build = () => MessageRowData.generateMessageRowData({ message });

	build();
	await new Promise((resolve) => setTimeout(resolve, 0));

	return (build() as { message: typeof message }).message.embeds[0] as typeof embed;
}

describe('YouTube embeds', () => {
	test('show the calm title and thumbnail once DeArrow has them', async () => {
		await startPlugin();

		const shown = await buildRow();

		expect(rows[0]?.message?.embeds[0]).toMatchObject({ rawTitle: 'YOU WONT BELIEVE THIS' });
		expect(shown.rawTitle).toBe('Calm title');
		expect(shown.thumbnail.proxyURL).toContain('dearrow-thumb.ajay.app');
	});

	test('replace only titles when the user picks titles', async () => {
		settings.replaceElements = 'titles';
		await startPlugin();

		const shown = await buildRow();

		expect(shown.rawTitle).toBe('Calm title');
		expect(shown.thumbnail.proxyURL).toBe('https://images/a.jpg');
	});

	test('stay as posted when Dearrow by Default is off', async () => {
		settings.dearrowByDefault = false;
		await startPlugin();

		expect((await buildRow()).rawTitle).toBe('YOU WONT BELIEVE THIS');
	});

	test('are left alone on a message that has no YouTube embed', async () => {
		await startPlugin();

		const plain = { ...message, embeds: [{ url: 'https://example.com', rawTitle: 'Example' }] };

		MessageRowData.generateMessageRowData({ message: plain });

		expect(rows[0]?.message).toBe(plain);
	});
});

function ActionSheetRowGroup({ children }: { hasIcons: boolean; children?: ReactNode }) {
	return children;
}

// Discord's own row: the plugin adds its row to this group.
function MessageLongPressActionSheet() {
	return createElement(ActionSheetRowGroup, { hasIcons: false }, [
		createElement('Row', { key: 'copy', label: 'Copy Text', onPress: () => undefined }),
	]);
}

async function openSheet() {
	const module = { default: MessageLongPressActionSheet };

	await startPlugin();
	await buildRow();
	ActionSheets.openLazy(Promise.resolve(module), 'MessageLongPressActionSheet', { message });
	await Promise.resolve();

	return render(<module.default />);
}

const labels = (sheet: Awaited<ReturnType<typeof openSheet>>) =>
	sheet.findAll('ActionSheetRow').map((node) => node.props.label);

describe('message menu', () => {
	test('offers to show the original embed, and switches the embed back when pressed', async () => {
		const sheet = await openSheet();

		expect(labels(sheet)).toEqual(['Show Original Embed']);

		sheet.act(() => sheet.find('ActionSheetRow').props.onPress?.());

		expect(hidden).toEqual(['MessageLongPressActionSheet']);
		expect(
			(MessageRowData.generateMessageRowData({ message }) as { message: typeof message })
				.message.embeds[0],
		).toMatchObject({ rawTitle: 'YOU WONT BELIEVE THIS' });
	});

	test('has no row while Show Toggle is off', async () => {
		settings.showToggle = false;

		expect(labels(await openSheet())).toEqual([]);
	});

	test('has no row for a message without branding to show', async () => {
		respondWith({});

		expect(labels(await openSheet())).toEqual([]);
	});
});
