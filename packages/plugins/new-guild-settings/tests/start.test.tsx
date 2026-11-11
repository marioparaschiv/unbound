import { logs, metro, render } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { View } from 'react-native';
import { createElement } from 'react';

import { sheets, startGuildSettings } from './helpers/discord';
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

test('starts without a warning once every feature has applied', async () => {
	await startGuildSettings();

	expect(logs.entries.filter(({ level }) => level !== 'info')).toEqual([]);
});

test('fails to start when the context menu cannot be patched, so Unbound removes the rest', async () => {
	const failure = await startGuildSettings(false, true).catch((error: unknown) => error);

	expect(failure).toEqual(new Error('The menu module changed shape.'));
});

test('keeps the action sheet row with one warning when Discord moved the context menus', async () => {
	metro.markMissing('showContextMenu');
	await startGuildSettings();

	const module = { default: GuildSheet };

	sheets.openLazy(Promise.resolve(module), 'GuildActionSheet:100', { guild: { id: '100' } });
	await Promise.resolve();
	await Promise.resolve();

	const view = render(createElement(module.default));

	expect(view.findAll('ActionSheetRow').map((node) => node.props.label)).toContain(
		'Apply New Guild Settings',
	);
	expect(logs.entries).toContainEqual({
		level: 'warn',
		args: [
			'Context menu item skipped: Discord moved updateGuildNotificationSettings, showContextMenu or SettingsIcon.',
		],
	});
});
