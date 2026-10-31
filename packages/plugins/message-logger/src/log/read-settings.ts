import { DEFAULT_SETTINGS, type SettingKey } from '~/constants';
import { settings } from '~/discord/modules';

export type LoggerSettings = {
	-readonly [K in SettingKey]: (typeof DEFAULT_SETTINGS)[K] extends boolean ? boolean : string;
};

/**
 * @description Reads every setting, falling back to its default.
 * @returns The current settings.
 */
export function readSettings(): LoggerSettings {
	const read = <K extends SettingKey>(key: K) => settings.get(key, DEFAULT_SETTINGS[key]);

	return {
		redText: Boolean(read('redText')),
		deletedMarker: Boolean(read('deletedMarker')),
		logDeletes: Boolean(read('logDeletes')),
		logEdits: Boolean(read('logEdits')),
		logDeletedAttachments: Boolean(read('logDeletedAttachments')),
		inlineEdits: Boolean(read('inlineEdits')),
		ignoreBots: Boolean(read('ignoreBots')),
		ignoreSelf: Boolean(read('ignoreSelf')),
		ignoreUsers: String(read('ignoreUsers')),
		ignoreChannels: String(read('ignoreChannels')),
		ignoreGuilds: String(read('ignoreGuilds')),
	};
}

export default readSettings;
