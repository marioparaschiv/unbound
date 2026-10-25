import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { ManagerKind } from '~/lib/constants';
import { getManager } from '~/managers/utils';
import { TintedIcon } from '~/ui/components';
import { useAddonState } from '~/ui/hooks';
import { Messages } from '~/api/i18n';
import { reload } from '~/api/native';
import { Icons } from '~/api/assets';

type AddonRadioProps = {
	addon: Addon;
	kind: ManagerKind.Themes | ManagerKind.Icons;
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
	const manager = getManager(kind);

	function toggle() {
		if (enabled) {
			manager.disable(addon.id);
		} else {
			manager.enable(addon.id);
		}

		if (kind !== ManagerKind.Themes) return;

		Discord.showConfirmModal({
			title: Messages.UNBOUND_RESTART,
			content: Messages.UNBOUND_THEME_RESTART_CONFIRM,
			confirmText: Messages.UNBOUND_RESTART,
			cancelText: Messages.UNBOUND_CANCEL,
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
			{enabled ? <TintedIcon source={Icons['CircleCheckIcon'] ?? 0} size={20} /> : null}
		</Pressable>
	);
}

export default memo(AddonRadio);
