import { Image, Pressable, View, type PressableStateCallbackType } from 'react-native';
import { useSyncExternalStore } from 'react';
import { storage, toasts } from '@unbound-app/api';

import { Haptics, SilentToggle, Theme, ToggleRunning } from '~/modules';
import { Button, FallbackColors, PLUGIN_NAME, SETTINGS } from '~/constants';
import { toggleLabel, toggledMessage } from '~/labels';

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
	return useSyncExternalStore(SilentToggle.subscribe, () =>
		SilentToggle.isActive(channelId, persist),
	);
}

function SilentToggleButton({ channelId, icons, trailingGap = 0 }: SilentToggleButtonProps) {
	const running = ToggleRunning.useRunning();
	const settings = storage.useBucket('unbound.silent-message-toggle');
	const persist = settings.get('persistState', SETTINGS.persistState);
	const active = useActive(channelId, persist);

	if (!running) return null;

	function toggle() {
		const enabled = SilentToggle.toggle(channelId, persist);

		toasts.show({ title: PLUGIN_NAME, content: toggledMessage(enabled) });
	}

	return (
		<View style={{ marginRight: trailingGap }}>
			<Pressable
				accessibilityRole='switch'
				accessibilityState={{ checked: active }}
				accessibilityLabel={toggleLabel(active)}
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
