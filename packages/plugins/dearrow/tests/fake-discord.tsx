import { metro as pluginMetro } from '@unbound-app/api';
import { metro } from '@unbound-app/api/testing';
import { mock } from 'bun:test';
import { Pressable } from 'react-native';

// The testing kit has no fake of `metro.api` or of Discord's design components; these stand in until it has.
function ActionSheetRow({ label, onPress }: { label: string; onPress: () => void }) {
	return <Pressable accessibilityLabel={label} onPress={onPress} />;
}

ActionSheetRow.Icon = () => null;

mock.module('@unbound-app/api/metro/components', () => ({ BottomSheets: { ActionSheetRow } }));

export const hidden: string[] = [];

export const ActionSheets = {
	openLazy: (..._args: unknown[]) => undefined,
	hideActionSheet: (key: string) => hidden.push(key),
};

Object.assign(pluginMetro, { api: { ActionSheets } });

export type RowInput = { message?: { id: string; channel_id: string; embeds: unknown[] } };

export const rows: RowInput[] = [];

// The fake metro keeps its modules between tests, so Discord's module is registered once and records into `rows`.
export const MessageRowData = {
	generateMessageRowData: (input: RowInput) => {
		rows.push(input);

		return input;
	},
};

metro.register(MessageRowData);
