import { useEffect, useState } from 'react';

import type { Addon, AddonPhase } from '~/addons/addon';
import { Manager } from '~/addons/manager';

/** The parts of an addon its lifecycle slice reads. */
export type PhaseSource = Pick<Addon, 'id' | 'phase' | 'hasSettingsPanel'>;

/** One addon's lifecycle slice: its phase, and whether it has a settings panel. */
export type AddonPhaseState = { phase: AddonPhase; hasPanel: boolean };

/**
 * @description Reads an addon's lifecycle phase and panel, re-rendering on each of its manager's `changed` events.
 * @param kind The addon's manager kind.
 * @param addon The addon.
 * @returns Its phase and whether it has a settings panel.
 */
function useAddonPhase(
	kind: 'plugin' | 'theme' | 'icon-pack',
	addon: PhaseSource,
): AddonPhaseState {
	const [, setVersion] = useState(0);

	useEffect(() => {
		const manager = Manager.for(kind);

		function handler(changed: Addon) {
			if (changed.id === addon.id) {
				setVersion((version) => version + 1);
			}
		}

		manager.on('changed', handler);

		return () => void manager.off('changed', handler);
	}, [kind, addon.id]);

	return { phase: addon.phase, hasPanel: addon.hasSettingsPanel };
}

export default useAddonPhase;
