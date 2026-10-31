import type { Addon } from '@unbound-app/types';
import { useState, memo } from 'react';

import { Discord } from '~/api/metro/components';
import { getManager } from '~/managers/utils';
import { useAddonState } from '~/ui/hooks';

type AddonSwitchProps = {
	addon: Addon;
	kind: 'plugins';
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

	async function handleValueChange() {
		setTransitioning(true);

		try {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			manager.toggle(addon.id);
		} finally {
			setTransitioning(false);
		}
	}

	return (
		<Discord.FormSwitch
			value={enabled}
			disabled={disabled || transitioning}
			accessibilityLabel={`${addon.data.name} enabled`}
			onValueChange={handleValueChange}
		/>
	);
}

export default memo(AddonSwitch);
