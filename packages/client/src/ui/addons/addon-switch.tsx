import type { Addon } from '@unbound-app/types';
import { Switch } from 'react-native';
import { memo } from 'react';

import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { useAddonState } from '~/ui/hooks';

type AddonSwitchProps = {
	addon: Addon;
	kind: ManagerKind.Plugins;
	disabled?: boolean;
};

/**
 * @description The trailing control for a plugin card: a switch that toggles the plugin through its
 * manager. Reads its own state slice so flipping it re-renders only this card.
 */
function AddonSwitch({ addon, kind, disabled }: AddonSwitchProps) {
	const { enabled } = useAddonState(kind, addon.id);
	const manager = getManager(kind);

	return (
		<Switch
			value={enabled}
			disabled={disabled}
			onValueChange={() => manager.toggle(addon.id)}
		/>
	);
}

export default memo(AddonSwitch);
