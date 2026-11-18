import {
	Image,
	Pressable,
	View,
	type PressableStateCallbackType,
	type ViewStyle,
} from 'react-native';
import { assets, flux, metro, toasts, ui } from '@unbound-app/api';
import { createElement, useSyncExternalStore } from 'react';
import { definePlatform } from '@unbound-app/api/native';

import type { ChannelToggle } from './channel-toggle';
import { useComposerState } from './composer-state';
import useStyles from './input-toggle.style';

import { patchSendButton as android } from './android/input-toggle';
import { patchRightActions as ios } from './ios/input-toggle';

/** The words a toggle shows: its name for the toast, the toast for each state and the button's labels. */
export type ToggleLabels = {
	name: string;
	toggledOn: string;
	toggledOff: string;
	enable: string;
	disable: string;
};

/** How a plugin draws its toggle in the chat input. */
export type InputToggleOptions = {
	/** A stable key, unique per plugin. */
	key: string;
	/** What log lines call the toggle, such as `Silent`. */
	name: string;
	/** Asset names for the on and off icons. */
	icons: { on: string; off: string };
	toggle: ChannelToggle;
	/** Reads the plugin's Persist State setting, as a hook. */
	usePersist: () => boolean;
	/** Reads the labels when the button renders, so they follow the language. */
	labels: () => ToggleLabels;
	/** Hides the toggle while the input holds no text or attachments, on or off, for toggles that only matter once there is a draft. */
	hideWhenEmpty?: boolean;
};

type ToggleIcons = { on: number; off: number };

type Haptics =
	| {
			// UNKNOWN: Discord's feedback type is an opaque enum value passed straight back.
			triggerHapticFeedback?: (type: unknown) => void;
			HapticFeedbackTypes?: { IMPACT_LIGHT?: unknown };
	  }
	| undefined;

type ButtonProps = InputToggleOptions & {
	channelId: string;
	assetIds: ToggleIcons;
	haptics: Haptics;
	trailingGap: number;
};

function useToggle(channelId: string, toggle: ChannelToggle, usePersist: () => boolean) {
	const persist = usePersist();
	const active = useSyncExternalStore(toggle.subscribe, () =>
		toggle.isActive(channelId, persist),
	);

	return { active, flip: () => toggle.toggle(channelId, persist) };
}

function ToggleRow({
	channelId,
	toggle,
	usePersist,
	labels,
	assetIds,
	hideWhenEmpty = false,
}: Omit<ButtonProps, 'trailingGap' | 'haptics'>) {
	const { active, flip } = useToggle(channelId, toggle, usePersist);
	const empty = useComposerState(channelId) === 'empty';

	if (hideWhenEmpty && empty) return null;

	return createElement(ui.SwitchRow, {
		label: labels().name,
		icon: active ? assetIds.on : assetIds.off,
		value: active,
		onValueChange: flip,
	});
}

function ToggleButton({
	channelId,
	toggle,
	usePersist,
	labels,
	assetIds,
	haptics,
	trailingGap,
	hideWhenEmpty = false,
}: ButtonProps) {
	const { active, flip } = useToggle(channelId, toggle, usePersist);
	const empty = useComposerState(channelId) === 'empty';
	const styles = useStyles();
	const text = labels();

	if (hideWhenEmpty && empty) return null;

	function press() {
		const enabled = flip();

		toasts.show({ title: text.name, content: enabled ? text.toggledOn : text.toggledOff });
	}

	return createElement(
		View,
		{ style: { marginRight: trailingGap } },
		createElement(
			Pressable,
			{
				accessibilityRole: 'switch',
				accessibilityState: { checked: active },
				accessibilityLabel: active ? text.disable : text.enable,
				onPress: press,
				onPressIn: () =>
					haptics?.triggerHapticFeedback?.(haptics.HapticFeedbackTypes?.IMPACT_LIGHT),
				hitSlop: 8,
				style: ({ pressed }: PressableStateCallbackType): ViewStyle[] => [
					styles.button,
					{ opacity: pressed ? 0.5 : 1, transform: [{ scale: pressed ? 0.86 : 1 }] },
				],
			},
			createElement(Image, {
				source: active ? assetIds.on : assetIds.off,
				style: active ? styles.iconActive : styles.icon,
			}),
		),
	);
}

const drawToggle = definePlatform({ ios, android });

/**
 * @description Adds a toggle button to the chat input: in front of `ChatInputRightActions` on iOS, which stays on screen while
 * typing, or of `ChatInputSendButton` on Android, which collapses the right-hand actions once there is text.
 * @param options The toggle, its icons, labels and Persist State hook.
 */
export function patchChatInputToggle(options: InputToggleOptions): void {
	const on = assets.getIdByName(options.icons.on);
	const off = assets.getIdByName(options.icons.off);

	if (on === undefined || off === undefined) {
		logger.warn(`${options.name} toggle skipped: its icon assets were not found.`);

		return;
	}

	const haptics: Haptics = metro.findByFilePath('modules/haptics/HapticUtils.native.tsx');
	const button = (channelId: string, trailingGap: number) =>
		createElement(ToggleButton, {
			...options,
			key: options.key,
			channelId,
			assetIds: { on, off },
			haptics,
			trailingGap,
		});

	drawToggle(button, options.name, options.key, {
		label: () => options.labels().name,
		row: (channelId: string) =>
			createElement(ToggleRow, {
				...options,
				key: options.key,
				channelId,
				assetIds: { on, off },
			}),
	});
}

/**
 * @description Turns a toggle off when you open another channel, unless Persist State is on.
 * @param toggle The toggle.
 * @param persist Reads the Persist State setting.
 */
export function followChannelSwitches(toggle: ChannelToggle, persist: () => boolean): void {
	const SelectedChannelStore = flux.getStore('SelectedChannel');

	flux.onStoreChange(SelectedChannelStore, () => {
		toggle.switchChannel(SelectedChannelStore.getChannelId(), persist());
	});
}

export default { patchChatInputToggle, followChannelSwitches };
