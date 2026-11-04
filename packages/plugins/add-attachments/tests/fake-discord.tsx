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
export const patched: unknown[] = [];
export const uploaded: unknown[][] = [];
export const picked: unknown[] = [];

export const ActionSheets = {
	openLazy: (..._args: unknown[]) => undefined,
	hideActionSheet: (key: string) => hidden.push(key),
};

Object.assign(pluginMetro, { api: { ActionSheets } });

class CloudUpload {
	status = 'COMPLETED';
	uploadedFilename: string;
	filename: string;

	constructor(item: { filename: string }) {
		this.filename = item.filename;
		this.uploadedFilename = `cdn-${item.filename}`;
	}

	async upload() {}
}

/** Registers the Discord modules the plugin looks up, each recording what the plugin sends it. */
export function registerDiscord(pickerResult: unknown = { assets: [] }) {
	for (const list of [hidden, patched, uploaded, picked]) list.length = 0;

	metro.register({ CloudUpload });
	metro.register({
		launchImageLibraryAsync: async (options: unknown) => {
			picked.push(options);

			return pickerResult;
		},
	});
	metro.register({
		getAPIBaseURL: () => '',
		patch: async (request: unknown) => patched.push(request),
	});
}
