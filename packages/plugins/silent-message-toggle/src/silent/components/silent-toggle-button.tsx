import { Image, Pressable, View, type PressableStateCallbackType } from 'react-native';
import { useSyncExternalStore } from 'react';
import { messages } from '@unbound-app/i18n';
import { useSetting } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';

import { Button, FallbackColors } from '~/constants';
import { Haptics, Theme } from '~/silent/modules';
import { silentToggle } from '~/silent/toggle';

export type ToggleIcons = {
	on: number;
	off: number;
};

type SilentToggleButtonProps = {
	channelId: string;
	icons: ToggleIcons;
	trailingGap?: number;
};

function useActive(channelId: string, persist: boolean): boolean {
	return useSyncExternalStore(silentToggle.subscribe, () =>
		silentToggle.isActive(channelId, persist),
	);
}

function SilentToggleButton({ channelId, icons, trailingGap = 0 }: SilentToggleButtonProps) {
	const persist = useSetting('persistState');
	const active = useActive(channelId, persist);

	function toggle() {
		const enabled = silentToggle.toggle(channelId, persist);

		toasts.show({
			title: messages.SILENT_MESSAGE_TOGGLE,
			content: enabled ? messages.TOGGLED_ON : messages.TOGGLED_OFF,
		});
	}

	return (
		<View style={{ marginRight: trailingGap }}>
			<Pressable
				accessibilityRole='switch'
				accessibilityState={{ checked: active }}
				accessibilityLabel={
					active ? messages.DISABLE_SILENT_MESSAGE : messages.ENABLE_SILENT_MESSAGE
				}
				onPress={toggle}
				onPressIn={() =>
					Haptics.triggerHapticFeedback?.(Haptics.HapticFeedbackTypes?.IMPACT_LIGHT)
				}
				hitSlop={8}
				style={({ pressed }: PressableStateCallbackType) => ({
					width: Button.size,
					height: Button.size,
					alignItems: 'center',
					justifyContent: 'center',
					opacity: pressed ? 0.5 : 1,
					transform: [{ scale: pressed ? 0.86 : 1 }],
				})}
			>
				<Image
					source={active ? icons.on : icons.off}
					style={{
						width: Button.iconSize,
						height: Button.iconSize,
						tintColor: active
							? (Theme.colors?.TEXT_BRAND ?? FallbackColors.on)
							: (Theme.colors?.INTERACTIVE_ICON_DEFAULT ?? FallbackColors.off),
					}}
				/>
			</Pressable>
		</View>
	);
}

export default SilentToggleButton;
