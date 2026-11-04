import { SelectedChannelStore, SilentToggle, readSetting } from '~/modules';

/**
 * @description Turns the toggle off when you open another channel, unless Persist State is on.
 * @returns A function that stops listening.
 */
export function resetOnChannelSwitch(): () => void {
	function onChange() {
		SilentToggle.switchChannel(
			SelectedChannelStore.getChannelId(),
			readSetting('persistState'),
		);
	}

	SelectedChannelStore.addChangeListener(onChange);

	return () => SelectedChannelStore.removeChangeListener(onChange);
}
