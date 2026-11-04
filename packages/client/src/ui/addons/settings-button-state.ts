import type { AddonPhase } from '~/addons/addon';

/** What the card's settings button shows: whether it is on the card, and whether it opens the panel. */
export type SettingsButtonState = { visible: boolean; enabled: boolean };

/**
 * @description Decides the settings button from the addon's lifecycle: shown while the addon has a panel, even
 * while it starts or failed, and pressable only while it runs. It leaves as soon as a stop begins, so turning the
 * plugin off moves it at once rather than after the stop settles.
 * @param phase Where the addon is in its lifecycle.
 * @param hasPanel Whether its current or last start exported a `SettingsPanel`.
 * @returns Whether the button is on the card, and whether it is enabled.
 */
export function settingsButtonState(phase: AddonPhase, hasPanel: boolean): SettingsButtonState {
	const visible = hasPanel && phase !== 'stopping';

	return { visible, enabled: visible && phase === 'running' };
}

export default settingsButtonState;
