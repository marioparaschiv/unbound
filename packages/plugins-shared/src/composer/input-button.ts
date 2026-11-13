import {
	Image,
	Pressable,
	View,
	type PressableStateCallbackType,
	type ViewStyle,
} from 'react-native';
import { definePlatform } from '@unbound-app/api/native';
import { assets } from '@unbound-app/api';
import { createElement } from 'react';

import { patchSendButton as android } from './android/input-toggle';
import { patchRightActions as ios } from './ios/input-toggle';
import useStyles from './input-button.style';

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

function ActionButton({ channelId, label, onPress, assetId, trailingGap }: ButtonProps) {
	const styles = useStyles();

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
				style: ({ pressed }: PressableStateCallbackType): ViewStyle[] => [
					styles.button,
					{ opacity: pressed ? 0.5 : 1, transform: [{ scale: pressed ? 0.86 : 1 }] },
				],
			},
			createElement(Image, {
				source: assetId,
				style: styles.icon,
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
