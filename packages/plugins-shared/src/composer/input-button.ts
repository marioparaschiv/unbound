import {
	Image,
	Pressable,
	View,
	type PressableStateCallbackType,
	type ViewStyle,
} from 'react-native';
import { assets, metro } from '@unbound-app/api';
import { createElement } from 'react';
import { definePlatform } from '@unbound-app/api/native';

import { patchSendButton as android } from './android/input-toggle';
import { patchRightActions as ios } from './ios/input-toggle';

export type InputButtonOptions = {
	key: string;
	name: string;
	icon: string;
	label: () => string;
	onPress: (channelId: string) => void;
};

type ButtonProps = InputButtonOptions & {
	channelId: string;
	assetId: number;
	trailingGap: number;
};

const BUTTON = { size: 32, iconSize: 22 };
const FALLBACK_COLOR = '#b5bac1';

function ActionButton({ channelId, label, onPress, assetId, trailingGap }: ButtonProps) {
	const { Theme } = metro.common;

	return createElement(
		View,
		{ style: { marginRight: trailingGap } },
		createElement(
			Pressable,
			{
				accessibilityRole: 'button',
				accessibilityLabel: label(),
				onPress: () => onPress(channelId),
				hitSlop: 8,
				style: ({ pressed }: PressableStateCallbackType): ViewStyle => ({
					width: BUTTON.size,
					height: BUTTON.size,
					alignItems: 'center',
					justifyContent: 'center',
					opacity: pressed ? 0.5 : 1,
					transform: [{ scale: pressed ? 0.86 : 1 }],
				}),
			},
			createElement(Image, {
				source: assetId,
				style: {
					width: BUTTON.iconSize,
					height: BUTTON.iconSize,
					tintColor: Theme.colors?.INTERACTIVE_ICON_DEFAULT ?? FALLBACK_COLOR,
				},
			}),
		),
	);
}

const drawButton = definePlatform({ ios, android });

/**
 * @description Adds a button to the chat input, where the input's toggles go: in front of `ChatInputRightActions` on iOS
 * and of `ChatInputSendButton` on Android.
 * @param options The button's key, icon, label and what it does.
 */
export function patchChatInputButton(options: InputButtonOptions): void {
	const assetId = assets.getIdByName(options.icon);

	if (assetId === undefined) {
		logger.warn(`${options.name} button skipped: its icon asset was not found.`);

		return;
	}

	const button = (channelId: string, trailingGap: number) =>
		createElement(ActionButton, {
			...options,
			key: options.key,
			channelId,
			assetId,
			trailingGap,
		});

	drawButton(button, options.name);
}

export default { patchChatInputButton };
