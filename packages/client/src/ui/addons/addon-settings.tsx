import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import type { Addon } from '~/managers/addon';
import { Screens } from '~/lib/constants';

import RoundButton from './round-button';

type AddonSettingsProps = {
	addon: Addon;
	disabled?: boolean;
};

/**
 * @description Opens a plugin-provided settings panel inside Unbound's native custom settings route.
 * The cog remains visible when a panel is unavailable so card actions keep a stable layout.
 */
function AddonSettings({ addon, disabled }: AddonSettingsProps) {
	const navigation = Discord.useNavigation();
	const panel = addon.settingsPanel;

	function handlePress() {
		if (!panel) return;

		navigation.push(Screens.Custom, { title: addon.name, render: panel });
	}

	return (
		<RoundButton
			icon='SettingsIcon'
			label={`${addon.name} settings`}
			disabled={disabled || !panel}
			onPress={handlePress}
		/>
	);
}

export default memo(AddonSettings);
