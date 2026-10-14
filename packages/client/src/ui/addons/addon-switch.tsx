import type { Addon } from '@unbound-app/types';
import { Pressable, View } from 'react-native';
import { useState, memo } from 'react';

import { Switch } from '~/api/metro/components';
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
	const [transitioning, setTransitioning] = useState(false);
	const manager = getManager(kind);
	const unavailable = disabled || transitioning;

	async function handleValueChange() {
		setTransitioning(true);

		try {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			await manager.toggle(addon.id);
		} finally {
			setTransitioning(false);
		}
	}

	return (
		<Pressable
			accessibilityRole='switch'
			accessibilityState={{ checked: enabled, disabled: unavailable }}
			accessibilityLabel={`${addon.data.name} enabled`}
			disabled={unavailable}
			onPress={handleValueChange}
		>
			<View pointerEvents='none'>
				<Switch value={enabled} disabled={unavailable} onValueChange={handleValueChange} />
			</View>
		</Pressable>
	);
}

export default memo(AddonSwitch);
