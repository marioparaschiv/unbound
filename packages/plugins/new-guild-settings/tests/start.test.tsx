import { logs, render } from '@unbound-app/api/testing';
import { expect, test } from 'bun:test';
import { View } from 'react-native';
import { createElement } from 'react';

import { selfTest } from '~/index';

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

test('reports healthy once every feature has started', async () => {
	await startGuildSettings();

	expect(await selfTest()).toEqual({ ok: true, detail: '3 features applied' });
});

test('keeps the action sheet row when the context menu cannot be patched', async () => {
	await startGuildSettings(false, true);

	const module = { default: GuildSheet };

	sheets.openLazy(Promise.resolve(module), 'GuildActionSheet:100', { guild: { id: '100' } });
	await Promise.resolve();
	await Promise.resolve();

	const view = render(createElement(module.default));

	expect(view.findAll('ActionSheetRow').map((node) => node.props.label)).toContain(
		'Apply New Guild Settings',
	);
	expect((await selfTest()).ok).toBe(false);
	expect(logs.entries.some(({ level }) => level === 'error')).toBe(true);
});
