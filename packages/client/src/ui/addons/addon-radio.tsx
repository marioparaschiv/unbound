import { Pressable } from 'react-native';
import { memo } from 'react';

import TintedIcon from '~/metro/fallbacks/tinted-icon';
import useAddonState from '~/ui/hooks/use-addon-state';
import { Discord } from '~/metro/components';
import type { Addon } from '~/addons/addon';
import { Manager } from '~/addons/manager';
import { reload } from '~/native/native';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';

type AddonRadioProps = {
	addon: Addon;
	kind: 'theme' | 'icon-pack';
	disabled?: boolean;
};

/**
 * @description The trailing control for a theme or icon-pack card: a single-select indicator. Selecting
 * applies this addon via its manager; the previously applied one deselects because state is derived
 * from the manager, not held here. Discord's design module exposes no bare radio-dot primitive (only
 * the full `TableRadioRow`), so the indicator is a tinted check icon shown only while selected.
 */
function AddonRadio({ addon, kind, disabled }: AddonRadioProps) {
	const { enabled } = useAddonState(kind, addon.id);
	const manager = Manager.for(kind);

	function toggle() {
		if (enabled) {
			manager.disable(addon.id);
		} else {
			manager.enable(addon.id);
		}

		if (kind !== 'theme') return;

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
			style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}
			onPress={toggle}
		>
			{enabled ? <TintedIcon source={icons['CircleCheckIcon'] ?? 0} size={20} /> : null}
		</Pressable>
	);
}

export default memo(AddonRadio);
