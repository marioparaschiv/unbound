import type { SettingValue } from '@unbound-app/types/settings';
import type { ReactElement } from 'react';

import type { SettingItem } from '~/ui/settings-kit/schema-layout';
import { settingElement } from '~/ui/settings-kit/setting-element';
import type { DefinedSettings } from '~/storage/define';

type StoredFieldProps = {
	settings: DefinedSettings;
	item: SettingItem;
	translate: (key: string) => string;
	disabled: boolean;
	/** Called after a setting marked `requiresRestart` changes. */
	onRestartNeeded: () => void;
};

/**
 * @description The row of one stored setting in a generated settings panel; re-renders only when that setting changes.
 * @param props The plugin's settings, the setting, the message lookup and whether the row is disabled.
 * @returns The row.
 */
function StoredField({
	settings,
	item,
	translate,
	disabled,
	onRestartNeeded,
}: StoredFieldProps): ReactElement {
	// A setting's key never names a section, so its hook reads a value.
	const value = settings.useSetting(item.path) as SettingValue;

	function onChange(next: SettingValue) {
		settings.set(item.path, next);

		if (item.field.requiresRestart) {
			onRestartNeeded();
		}
	}

	return settingElement({ entry: item, value, disabled, onChange, translate });
}

export default StoredField;
