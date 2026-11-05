import { Pressable } from 'react-native';
import { memo } from 'react';

import useAddonState from '~/ui/hooks/use-addon-state';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { reload } from '~/native/native';
import { messages } from '~/i18n/api';

import useStyles from './addon-radio.style';

type AddonRadioProps = {
	addon: Addon;
	kind: 'theme' | 'icon-pack';
	disabled?: boolean;
};

/**
 * @description The trailing control for a theme or icon-pack card: a single-select indicator. Selecting
 * applies this addon via its manager; the previously applied one deselects because state is derived
 * from the manager, not held here. A theme applies live, and asks to restart only when native views
 * cannot follow it until then. The indicator is Discord's bare `FormRadio`, which only draws; the
 * surrounding `Pressable` handles the press.
 */
function AddonRadio({ addon, kind, disabled }: AddonRadioProps) {
	const styles = useStyles();
	const { enabled } = useAddonState(kind, addon.id);
	const manager = Manager.for(kind);

	function toggle() {
		if (enabled) {
			manager.disable(addon.id);
		} else {
			manager.enable(addon.id);
		}

		if (kind !== 'theme' || enabled || !Manager.for('theme').needsRestart(addon.id)) return;

		Discord.showConfirmModal({
			title: messages.UNBOUND_RESTART,
			content: messages.UNBOUND_THEME_RESTART_CONFIRM,
			confirmText: messages.UNBOUND_RESTART,
			cancelText: messages.UNBOUND_CANCEL,
			onConfirm: reload,
		});
	}

	return (
		<Pressable
			disabled={disabled}
			hitSlop={8}
			accessibilityRole='radio'
			accessibilityState={{ selected: enabled, disabled }}
			style={styles.radio}
			onPress={toggle}
		>
			<Discord.FormRadio selected={enabled} />
		</Pressable>
	);
}

export default memo(AddonRadio);
