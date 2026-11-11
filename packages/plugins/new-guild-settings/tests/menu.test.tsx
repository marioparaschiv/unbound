import { patches, render, stopPlugin, toasts } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { View } from 'react-native';
import { createElement } from 'react';

import {
	applied,
	contextMenus,
	hidden,
	hiddenMenus,
	sheets,
	startGuildSettings,
} from './helpers/discord';

function ActionSheetRow(_props: { label: string; onPress: () => void }) {
	return <View />;
}

function RowGroup({ children }: { hasIcons: boolean; children: unknown }) {
	return <View>{children as never}</View>;
}

function GuildSheet() {
	return (
		<View>
			<RowGroup hasIcons>
				{[<ActionSheetRow key='read' label='Mark As Read' onPress={() => {}} />]}
			</RowGroup>
		</View>
	);
}

async function openSheet(key: string, props: Record<string, unknown>) {
	const module = { default: GuildSheet };

	sheets.openLazy(Promise.resolve(module), key, props);
	await Promise.resolve();
	await Promise.resolve();

	return render(createElement(module.default));
}

const labels = (view: ReturnType<typeof render>) =>
	view.findAll('ActionSheetRow').map((node) => node.props.label);

beforeEach(() => startGuildSettings());

describe("a server's action sheet", () => {
	test('gets Apply New Guild Settings', async () => {
		const view = await openSheet('GuildActionSheet:100', { guild: { id: '100' } });

		expect(labels(view)).toEqual(['Mark As Read', 'Apply New Guild Settings']);
	});

	test('applies the defaults and tells which server when the row is pressed', async () => {
		const view = await openSheet('GuildActionSheet:100', { guild: { id: '100' } });

		view.act(() =>
			view.find((node) => node.props.label === 'Apply New Guild Settings').props.onPress(),
		);

		expect(hidden).toEqual(['GuildActionSheet:100']);
		expect(applied.map(({ guildId }) => guildId)).toEqual(['100']);
		expect(toasts.shown).toMatchObject([{ content: 'Applied to Wumpus Den.' }]);
	});

	test('says so without a name when the server is not loaded', async () => {
		const view = await openSheet('GuildActionSheet:300', { guildId: '300' });

		view.act(() =>
			view.find((node) => node.props.label === 'Apply New Guild Settings').props.onPress(),
		);

		expect(toasts.shown).toMatchObject([{ content: 'Applied to this server.' }]);
	});

	test('is left alone on any other sheet', async () => {
		const view = await openSheet('ChannelLongPressActionSheet', { guildId: '100' });

		expect(labels(view)).toEqual(['Mark As Read']);
	});
});

describe("a server's context menu", () => {
	test('gets Apply New Guild Settings once', () => {
		const menu = { key: '100', items: [] as { label?: string; action?: () => void }[] };

		contextMenus.showContextMenu(menu);
		contextMenus.showContextMenu(menu);

		expect(menu.items.map((item) => item.label)).toEqual(['Apply New Guild Settings']);
	});

	test('applies the defaults and closes the menu when chosen', () => {
		const menu = { key: '100', items: [] as { label?: string; action?: () => void }[] };

		contextMenus.showContextMenu(menu);
		menu.items[0]?.action?.();

		expect(hiddenMenus).toHaveLength(1);
		expect(applied.map(({ guildId }) => guildId)).toEqual(['100']);
	});

	test('is left alone for a menu that is not a loaded server', () => {
		const menu = { key: '999', items: [] as unknown[] };

		contextMenus.showContextMenu(menu);

		expect(menu.items).toEqual([]);
	});
});

test('stops patching when the plugin stops', async () => {
	expect(patches.applied.length).toBeGreaterThan(0);

	await stopPlugin();

	expect(patches.applied).toEqual([]);
});
