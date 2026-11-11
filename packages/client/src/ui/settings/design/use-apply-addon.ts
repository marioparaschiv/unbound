import { useCallback, useRef, useState } from 'react';

import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { reload } from '~/native/native';
import { messages } from '~/i18n/api';

/**
 * @description Tracks which of a kind's addons is applied and applies another. The applied addon is read from its
 * manager on every render, so it follows changes made anywhere; `revision` counts the changes made outside this hook.
 * A theme applies live and, as its card's radio does, asks to restart only when native views lag it.
 * @param kind The single-select kind.
 * @param addons The addons to choose from, from a list that re-renders on the manager's events.
 * @returns The applied addon's id, the external change count, the function that applies one, and the one that clears it.
 */
function useApplyAddon(kind: 'theme' | 'icon-pack', addons: Addon[]) {
	const applied = addons.find((addon) => addon.isEnabled())?.id;

	// What this hook last applied; any other value arrived from elsewhere and bumps `revision`.
	const picked = useRef(applied);
	const [revision, setRevision] = useState(0);

	if (applied !== picked.current) {
		picked.current = applied;
		setRevision((current) => current + 1);
	}

	// Stable, so a patch holding it is installed once.
	const apply = useCallback(
		(addon: Addon) => {
			// Settling on a swatch and closing the picker both apply it; the second changes nothing.
			if (addon.id === picked.current) return;

			picked.current = addon.id;
			void addon.enable();

			if (kind !== 'theme' || !Manager.for('theme').needsRestart(addon.id)) return;

			Discord.showConfirmModal({
				title: messages.UNBOUND_RESTART,
				content: messages.UNBOUND_THEME_RESTART_CONFIRM,
				confirmText: messages.UNBOUND_RESTART,
				cancelText: messages.UNBOUND_CANCEL,
				onConfirm: reload,
			});
		},
		[kind],
	);

	// Stable for the same reason as `apply`.
	const clear = useCallback(() => {
		if (picked.current === undefined) return;

		picked.current = undefined;
		Manager.for(kind)
			.getAddons()
			.find((entry) => entry.isEnabled())
			?.disable();
	}, [kind]);

	return { applied, revision, apply, clear };
}

export default useApplyAddon;
